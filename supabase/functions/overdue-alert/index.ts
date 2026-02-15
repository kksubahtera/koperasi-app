import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting overdue alert check for members with >3 months overdue...');

    const today = new Date();
    // Calculate date 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    console.log(`Checking for installments overdue since before ${threeMonthsAgoStr}`);

    // Find overdue installments that are more than 3 months past due
    const { data: overdueInstallments, error: installmentsError } = await supabase
      .from('loan_installments')
      .select(`
        id,
        loan_id,
        installment_number,
        due_date,
        total_amount,
        penalty_amount,
        paid_amount,
        status,
        loans!inner (
          id,
          user_id,
          principal_amount,
          remaining_principal,
          status
        )
      `)
      .lt('due_date', threeMonthsAgoStr)
      .in('status', ['overdue', 'unpaid', 'partial'])
      .eq('loans.status', 'active');

    if (installmentsError) {
      console.error('Error fetching overdue installments:', installmentsError);
      throw installmentsError;
    }

    console.log(`Found ${overdueInstallments?.length || 0} installments overdue >3 months`);

    if (!overdueInstallments || overdueInstallments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No severely overdue installments found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by user to get unique defaulting members
    const userOverdueMap = new Map<string, {
      userId: string;
      loanId: string;
      overdueCount: number;
      totalOverdueAmount: number;
      oldestDueDate: string;
      remainingPrincipal: number;
    }>();

    for (const inst of overdueInstallments) {
      const loan = inst.loans as any;
      const userId = loan.user_id;
      
      if (!userOverdueMap.has(userId)) {
        userOverdueMap.set(userId, {
          userId,
          loanId: loan.id,
          overdueCount: 0,
          totalOverdueAmount: 0,
          oldestDueDate: inst.due_date,
          remainingPrincipal: loan.remaining_principal || 0,
        });
      }
      
      const userData = userOverdueMap.get(userId)!;
      userData.overdueCount += 1;
      
      const paidAmount = inst.paid_amount || 0;
      const outstanding = inst.total_amount - paidAmount + (inst.penalty_amount || 0);
      userData.totalOverdueAmount += outstanding;
      
      // Track oldest due date
      if (inst.due_date < userData.oldestDueDate) {
        userData.oldestDueDate = inst.due_date;
      }
    }

    console.log(`Found ${userOverdueMap.size} unique members with severely overdue loans`);

    // Get member profiles
    const userIds = Array.from(userOverdueMap.keys());
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, member_number, phone')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Check existing notifications to avoid duplicates (within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: existingNotifications, error: existingError } = await supabase
      .from('admin_notifications')
      .select('metadata')
      .eq('notification_type', 'severe_overdue_alert')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (existingError) {
      console.error('Error checking existing notifications:', existingError);
    }

    // Create a set of already notified user IDs
    const notifiedUsers = new Set(
      existingNotifications?.map((n: any) => n.metadata?.user_id) || []
    );

    // Prepare admin notifications and member notifications
    const adminNotifications = [];
    const memberNotifications = [];

    for (const [userId, data] of userOverdueMap) {
      // Skip if already notified within 7 days
      if (notifiedUsers.has(userId)) {
        console.log(`Skipping user ${userId} - already notified within 7 days`);
        continue;
      }

      const profile = profileMap.get(userId);
      if (!profile) {
        console.log(`Profile not found for user ${userId}`);
        continue;
      }

      const oldestDueDate = new Date(data.oldestDueDate);
      const monthsOverdue = Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      const formattedAmount = new Intl.NumberFormat('id-ID').format(data.totalOverdueAmount);
      const formattedPrincipal = new Intl.NumberFormat('id-ID').format(data.remainingPrincipal);

      // Admin notification
      adminNotifications.push({
        title: `Anggota Menunggak ${monthsOverdue} Bulan`,
        message: `${profile.name} (${profile.member_number || '-'}) memiliki ${data.overdueCount} angsuran menunggak sejak ${oldestDueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}. Total tunggakan: Rp ${formattedAmount}. Sisa pokok pinjaman: Rp ${formattedPrincipal}. Segera lakukan penagihan atau pertimbangkan restrukturisasi.`,
        notification_type: 'severe_overdue_alert',
        metadata: {
          user_id: userId,
          loan_id: data.loanId,
          member_name: profile.name,
          member_number: profile.member_number,
          phone: profile.phone,
          overdue_count: data.overdueCount,
          total_overdue_amount: data.totalOverdueAmount,
          remaining_principal: data.remainingPrincipal,
          months_overdue: monthsOverdue,
          oldest_due_date: data.oldestDueDate,
        },
      });

      // Member notification - alert the member about their severe overdue status
      memberNotifications.push({
        user_id: userId,
        title: `Peringatan: Tunggakan ${monthsOverdue} Bulan`,
        message: `Anda memiliki ${data.overdueCount} angsuran yang menunggak dengan total Rp ${formattedAmount}. Segera lakukan pembayaran untuk menghindari tindakan penagihan lebih lanjut. Hubungi kantor koperasi untuk informasi restrukturisasi.`,
        notification_type: 'overdue_alert',
        metadata: {
          loan_id: data.loanId,
          overdue_count: data.overdueCount,
          total_overdue_amount: data.totalOverdueAmount,
          remaining_principal: data.remainingPrincipal,
          months_overdue: monthsOverdue,
          oldest_due_date: data.oldestDueDate,
        },
      });
    }

    console.log(`Creating ${adminNotifications.length} admin notifications and ${memberNotifications.length} member notifications`);

    // Insert admin notifications
    if (adminNotifications.length > 0) {
      const { error: insertError } = await supabase
        .from('admin_notifications')
        .insert(adminNotifications);

      if (insertError) {
        console.error('Error inserting admin notifications:', insertError);
        throw insertError;
      }
    }

    // Insert member notifications
    if (memberNotifications.length > 0) {
      const { error: memberInsertError } = await supabase
        .from('member_notifications')
        .insert(memberNotifications);

      if (memberInsertError) {
        console.error('Error inserting member notifications:', memberInsertError);
        throw memberInsertError;
      }
    }

    console.log('Overdue alert check completed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Overdue alerts sent successfully', 
        adminNotificationsSent: adminNotifications.length,
        memberNotificationsSent: memberNotifications.length,
        totalOverdueMembers: userOverdueMap.size,
        skippedAlreadyNotified: userOverdueMap.size - adminNotifications.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in overdue-alert function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
