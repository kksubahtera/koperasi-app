import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MemberInterestCalculation {
  userId: string;
  memberName: string;
  memberNumber: string;
  eligibleBalance: number;
  interestRate: number;
  interestAmount: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for manual trigger or use previous month for cron
    let targetMonth: Date;
    let isManualTrigger = false;
    
    try {
      const body = await req.json();
      if (body.targetMonth) {
        targetMonth = new Date(body.targetMonth);
        isManualTrigger = true;
      } else {
        // Default to previous month
        const now = new Date();
        targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      }
    } catch {
      // Default to previous month for cron job
      const now = new Date();
      targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }

    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    // Format month name in Indonesian
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthName = `${monthNames[month]} ${year}`;

    console.log(`Processing monthly closing for ${monthName} (${monthKey})`);

    // Check if auto-closing is enabled (skip check for manual triggers)
    if (!isManualTrigger) {
      const { data: autoClosingSetting } = await supabase
        .from('cooperative_settings')
        .select('value')
        .eq('key', 'auto_monthly_closing')
        .maybeSingle();

      const isEnabled = autoClosingSetting?.value?.enabled === true;
      if (!isEnabled) {
        console.log('Auto monthly closing is disabled');
        return new Response(
          JSON.stringify({ success: false, message: 'Auto monthly closing is disabled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if already closed
    const { data: existingEntry } = await supabase
      .from('expense_entries')
      .select('id')
      .eq('type', 'bunga_simpanan_sukarela')
      .ilike('description', `%[${monthKey}]%`)
      .maybeSingle();

    if (existingEntry) {
      console.log(`Month ${monthKey} already closed`);
      return new Response(
        JSON.stringify({ success: false, message: `Periode ${monthName} sudah ditutup sebelumnya` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get interest rate from settings
    const { data: interestSetting } = await supabase
      .from('cooperative_settings')
      .select('value')
      .eq('key', 'simpananSukarelaInterestRate')
      .maybeSingle();

    const interestRate = interestSetting?.value ?? 0.4;

    // Get cutoff date from settings
    const { data: cutoffSetting } = await supabase
      .from('cooperative_settings')
      .select('value')
      .eq('key', 'simpananSukarelaInterestCutoffDate')
      .maybeSingle();

    const cutoffDate = cutoffSetting?.value ?? 15;

    // Get all active members
    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select('user_id, name, member_number')
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    if (membersError) throw membersError;

    // Get all savings summaries
    const { data: savingsSummaries, error: savingsError } = await supabase
      .from('savings_summary')
      .select('user_id, simpanan_sukarela');

    if (savingsError) throw savingsError;

    const savingsMap = new Map(
      savingsSummaries?.map(s => [s.user_id, Number(s.simpanan_sukarela) || 0]) || []
    );

    // Calculate month boundaries
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0); // Last day of month

    // Get transactions for target month
    const { data: monthTransactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'approved')
      .in('type', ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'])
      .gte('date', monthStart.toISOString().split('T')[0])
      .lte('date', monthEnd.toISOString().split('T')[0]);

    if (txError) throw txError;

    // Get transactions after target month
    const { data: futureTransactions, error: futureTxError } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'approved')
      .in('type', ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'])
      .gt('date', monthEnd.toISOString().split('T')[0]);

    if (futureTxError) throw futureTxError;

    // Calculate future movement by user
    const futureMovementByUser = new Map<string, number>();
    (futureTransactions || []).forEach(tx => {
      const userId = tx.user_id;
      const current = futureMovementByUser.get(userId) || 0;
      const amount = Number(tx.amount);
      
      if (tx.type === 'penarikan_simpanan_sukarela') {
        futureMovementByUser.set(userId, current + amount);
      } else {
        futureMovementByUser.set(userId, current - amount);
      }
    });

    // Group month transactions by user
    const txByUser = new Map<string, any[]>();
    (monthTransactions || []).forEach(tx => {
      const existing = txByUser.get(tx.user_id) || [];
      existing.push(tx);
      txByUser.set(tx.user_id, existing);
    });

    const memberCalculations: MemberInterestCalculation[] = [];
    let totalInterestExpense = 0;

    // Calculate interest for each member
    for (const member of (members || [])) {
      const currentBalance = savingsMap.get(member.user_id) || 0;
      const userTx = txByUser.get(member.user_id) || [];
      const futureMovement = futureMovementByUser.get(member.user_id) || 0;

      const closingBalance = currentBalance + futureMovement;

      let monthDeposits = 0;
      let monthWithdrawals = 0;
      let depositsBeforeCutoff = 0;

      userTx.forEach(tx => {
        const txDate = new Date(tx.date);
        const dayOfMonth = txDate.getDate();
        const amount = Number(tx.amount);

        if (tx.type === 'penarikan_simpanan_sukarela') {
          monthWithdrawals += amount;
        } else {
          monthDeposits += amount;
          if (dayOfMonth <= cutoffDate) {
            depositsBeforeCutoff += amount;
          }
        }
      });

      const openingBalance = closingBalance - monthDeposits + monthWithdrawals;
      const eligibleBalance = Math.max(0, openingBalance + depositsBeforeCutoff);
      const interestAmount = Math.round(eligibleBalance * (interestRate / 100));

      if (interestAmount > 0) {
        memberCalculations.push({
          userId: member.user_id,
          memberName: member.name,
          memberNumber: member.member_number || '',
          eligibleBalance: Math.round(eligibleBalance),
          interestRate,
          interestAmount,
        });

        totalInterestExpense += interestAmount;
      }
    }

    console.log(`Calculated interest for ${memberCalculations.length} members, total: ${totalInterestExpense}`);

    // Record expense entry
    if (totalInterestExpense > 0) {
      const { error: expenseError } = await supabase
        .from('expense_entries')
        .insert({
          description: `Beban Bunga Simpanan Sukarela - ${monthName} [${monthKey}]`,
          amount: totalInterestExpense,
          type: 'bunga_simpanan_sukarela',
          date: monthEnd.toISOString().split('T')[0],
          year: year,
        });

      if (expenseError) throw expenseError;

      // Create notifications for each member
      const notifications = memberCalculations.map(mc => ({
        user_id: mc.userId,
        period: monthKey,
        period_name: monthName,
        eligible_balance: mc.eligibleBalance,
        interest_rate: mc.interestRate,
        interest_amount: mc.interestAmount,
        is_read: false,
      }));

      if (notifications.length > 0) {
        const { error: notifError } = await supabase
          .from('interest_notifications')
          .insert(notifications);

        if (notifError) {
          console.error('Error creating notifications:', notifError);
        }
      }
    }

    const result = {
      success: true,
      period: monthKey,
      periodName: monthName,
      totalInterestExpense,
      memberCount: memberCalculations.length,
      processedAt: new Date().toISOString(),
    };

    console.log('Monthly closing completed:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Monthly closing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
