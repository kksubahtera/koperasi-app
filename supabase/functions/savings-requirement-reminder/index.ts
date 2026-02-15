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

    console.log('Starting savings requirement reminder check...');

    // Get cooperative settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('cooperative_settings')
      .select('key, value')
      .in('key', ['requireMinSimpananWajibForLoan', 'minSimpananWajibForLoan']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    // Parse settings
    let requireMinSimpanan = false;
    let minSimpananAmount = 100000;

    settingsData?.forEach((setting: { key: string; value: unknown }) => {
      if (setting.key === 'requireMinSimpananWajibForLoan') {
        requireMinSimpanan = setting.value === true || setting.value === 'true';
      }
      if (setting.key === 'minSimpananWajibForLoan') {
        minSimpananAmount = typeof setting.value === 'number' ? setting.value : parseInt(String(setting.value)) || 100000;
      }
    });

    console.log('Settings:', { requireMinSimpanan, minSimpananAmount });

    // If the setting is not enabled, skip
    if (!requireMinSimpanan) {
      console.log('Savings requirement validation is not enabled, skipping...');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Savings requirement validation is not enabled',
          notificationsSent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active members with their savings
    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        name,
        is_active,
        approval_status
      `)
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    if (membersError) {
      console.error('Error fetching members:', membersError);
      throw membersError;
    }

    console.log(`Found ${members?.length || 0} active members`);

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active members found',
          notificationsSent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get savings for all members
    const userIds = members.map(m => m.user_id);
    const { data: savingsData, error: savingsError } = await supabase
      .from('savings_summary')
      .select('user_id, simpanan_wajib')
      .in('user_id', userIds);

    if (savingsError) {
      console.error('Error fetching savings:', savingsError);
      throw savingsError;
    }

    // Create a map of user_id to simpanan_wajib
    const savingsMap = new Map<string, number>();
    savingsData?.forEach((s: { user_id: string; simpanan_wajib: number | null }) => {
      savingsMap.set(s.user_id, s.simpanan_wajib || 0);
    });

    // Find members with insufficient savings
    const membersNeedingReminder = members.filter(m => {
      const simpananWajib = savingsMap.get(m.user_id) || 0;
      return simpananWajib < minSimpananAmount;
    });

    console.log(`Found ${membersNeedingReminder.length} members with insufficient savings`);

    if (membersNeedingReminder.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All members have sufficient savings',
          notificationsSent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing notifications sent today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingNotifications, error: existingError } = await supabase
      .from('member_notifications')
      .select('user_id')
      .eq('notification_type', 'savings_requirement_reminder')
      .gte('created_at', `${today}T00:00:00`);

    if (existingError) {
      console.error('Error checking existing notifications:', existingError);
      throw existingError;
    }

    const alreadyNotifiedUserIds = new Set(existingNotifications?.map(n => n.user_id) || []);

    // Filter out members who already received notification today
    const membersToNotify = membersNeedingReminder.filter(m => !alreadyNotifiedUserIds.has(m.user_id));

    console.log(`${membersToNotify.length} members need new notifications`);

    if (membersToNotify.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All eligible members already notified today',
          notificationsSent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notifications
    const notifications = membersToNotify.map(member => {
      const currentSimpanan = savingsMap.get(member.user_id) || 0;
      const amountNeeded = minSimpananAmount - currentSimpanan;

      return {
        user_id: member.user_id,
        title: 'Simpanan Wajib Belum Mencukupi',
        message: `Simpanan wajib Anda (Rp ${currentSimpanan.toLocaleString('id-ID')}) belum mencapai minimal Rp ${minSimpananAmount.toLocaleString('id-ID')} yang diperlukan untuk mengajukan pinjaman. Anda perlu menambah Rp ${amountNeeded.toLocaleString('id-ID')} lagi.`,
        notification_type: 'savings_requirement_reminder',
        metadata: {
          current_amount: currentSimpanan,
          required_amount: minSimpananAmount,
          amount_needed: amountNeeded,
          source: 'cron_job'
        }
      };
    });

    const { error: insertError } = await supabase
      .from('member_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log(`Successfully sent ${notifications.length} savings requirement reminders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${notifications.length} savings requirement reminders`,
        notificationsSent: notifications.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in savings-requirement-reminder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
