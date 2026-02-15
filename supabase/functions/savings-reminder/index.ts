import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to generate email header with optional logo
const generateEmailHeader = (cooperativeName: string, logoBase64: string | null) => {
  const logoHtml = logoBase64 ? `
    <img 
      src="${logoBase64}" 
      alt="${cooperativeName}" 
      style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; border: 3px solid rgba(255,255,255,0.3);"
    />
  ` : '';
  
  return `
    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
      ${logoHtml}
      <h1 style="color: white; margin: 0; font-size: 24px;">${cooperativeName}</h1>
    </div>
  `;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for preview mode
    const requestBody = await req.json().catch(() => ({}));
    const previewMode = requestBody?.preview === true;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting savings reminder check... (preview: ${previewMode})`);

    // Get cooperative settings including logo
    const { data: settingsData, error: settingsError } = await supabase
      .from('cooperative_settings')
      .select('key, value')
      .in('key', [
        'savings_reminder_enabled',
        'savings_reminder_day_of_month',
        'savings_reminder_email_enabled',
        'email_notifications_enabled',
        'cooperative_name',
        'cooperative_logo_base64',
        'simpanan_wajib'
      ]);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    // Parse settings
    const settings: Record<string, unknown> = {};
    settingsData?.forEach((s: { key: string; value: unknown }) => {
      settings[s.key] = s.value;
    });

    const emailEnabled = settings['email_notifications_enabled'] !== false;
    const reminderEnabled = settings['savings_reminder_enabled'] !== false;
    const emailNotificationEnabled = settings['savings_reminder_email_enabled'] !== false;
    const dayOfMonth = Number(settings['savings_reminder_day_of_month']) || 1;
    const cooperativeName = String(settings['cooperative_name'] || 'Koperasi');
    const logoBase64 = settings['cooperative_logo_base64'] as string | null;
    const requiredSimpananWajib = Number(settings['simpanan_wajib']) || 100000;

    console.log('Settings:', { reminderEnabled, emailNotificationEnabled, dayOfMonth, requiredSimpananWajib });

    // Check if today is the configured day
    const today = new Date();
    const currentDay = today.getDate();
    
    // For testing, we allow manual trigger regardless of date
    // But in production cron, it should check the date
    const isManualTrigger = req.method === 'POST';
    
    if (!isManualTrigger && currentDay !== dayOfMonth) {
      console.log(`Today is ${currentDay}, reminder day is ${dayOfMonth}. Skipping...`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Not reminder day (today: ${currentDay}, configured: ${dayOfMonth})`,
          notificationsSent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reminderEnabled) {
      console.log('Savings reminder is disabled');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Savings reminder is disabled',
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
        email,
        member_number,
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
      const emptyResponse = previewMode
        ? {
            preview: true,
            members: [],
            totalCount: 0,
            requiredAmount: requiredSimpananWajib,
            monthName: today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
          }
        : { 
            success: true, 
            message: 'No active members found',
            notificationsSent: 0 
          };
      return new Response(
        JSON.stringify(emptyResponse),
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

    // Check for existing notifications sent today
    const todayStr = today.toISOString().split('T')[0];
    const { data: existingNotifications, error: existingError } = await supabase
      .from('member_notifications')
      .select('user_id')
      .eq('notification_type', 'savings_reminder')
      .gte('created_at', `${todayStr}T00:00:00`);

    if (existingError) {
      console.error('Error checking existing notifications:', existingError);
    }

    const alreadyNotifiedUserIds = new Set(existingNotifications?.map(n => n.user_id) || []);

    // Filter out members who already received notification today
    const membersToNotify = members.filter(m => !alreadyNotifiedUserIds.has(m.user_id));

    console.log(`${membersToNotify.length} members to notify`);

    // If preview mode, return preview data without sending notifications
    if (previewMode) {
      const monthName = today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const previewData = membersToNotify.map((member) => {
        const currentSimpanan = savingsMap.get(member.user_id) || 0;
        return {
          userId: member.user_id,
          memberName: member.name || 'Unknown',
          memberNumber: member.member_number || '-',
          email: member.email || null,
          currentSimpananWajib: currentSimpanan,
        };
      });

      const membersWithEmail = previewData.filter((p) => p.email).length;
      const membersWithoutEmail = previewData.length - membersWithEmail;

      return new Response(
        JSON.stringify({
          preview: true,
          members: previewData,
          totalCount: previewData.length,
          membersWithEmail,
          membersWithoutEmail,
          requiredAmount: requiredSimpananWajib,
          monthName,
          alreadyNotifiedCount: alreadyNotifiedUserIds.size,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (membersToNotify.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All members already notified today',
          notificationsSent: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Resend if API key is available
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // Create notifications
    const notifications = [];
    const emailsToSend = [];
    const formattedRequired = new Intl.NumberFormat('id-ID').format(requiredSimpananWajib);
    const monthName = today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    for (const member of membersToNotify) {
      const currentSimpanan = savingsMap.get(member.user_id) || 0;
      const formattedCurrent = new Intl.NumberFormat('id-ID').format(currentSimpanan);

      const title = 'Pengingat Simpanan Wajib Bulanan';
      const message = `Jangan lupa untuk membayar simpanan wajib bulan ${monthName} sebesar Rp ${formattedRequired}. Simpanan wajib Anda saat ini: Rp ${formattedCurrent}.`;

      notifications.push({
        user_id: member.user_id,
        title,
        message,
        notification_type: 'savings_reminder',
        metadata: {
          month: today.getMonth() + 1,
          year: today.getFullYear(),
          required_amount: requiredSimpananWajib,
          current_amount: currentSimpanan,
          source: 'scheduled_reminder'
        }
      });

      // Prepare email if enabled
      if (emailEnabled && emailNotificationEnabled && resend && member.email) {
        emailsToSend.push({
          to: member.email,
          name: member.name || 'Anggota',
          memberNumber: member.member_number,
          currentAmount: formattedCurrent,
          requiredAmount: formattedRequired,
          monthName,
        });
      }
    }

    // Insert notifications
    const { error: insertError } = await supabase
      .from('member_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error inserting notifications:', insertError);
      throw insertError;
    }

    // Send emails
    let emailsSent = 0;
    if (resend && emailsToSend.length > 0) {
      for (const emailData of emailsToSend) {
        try {
          const headerHtml = generateEmailHeader(cooperativeName, logoBase64);
          
          const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${headerHtml}
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">💰 Pengingat Simpanan Wajib</h2>
    
    <p>Halo <strong>${emailData.name}</strong>,</p>
    
    <p>Ini adalah pengingat untuk membayar simpanan wajib bulanan Anda untuk bulan <strong>${emailData.monthName}</strong>.</p>
    
    <div style="background: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Nomor Anggota</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${emailData.memberNumber || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Simpanan Wajib Bulanan</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold; color: #28a745;">Rp ${emailData.requiredAmount}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Total Simpanan Wajib Anda</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold;">Rp ${emailData.currentAmount}</td>
        </tr>
      </table>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      Pembayaran dapat dilakukan melalui aplikasi atau langsung ke kantor ${cooperativeName}. 
      Terima kasih atas partisipasi aktif Anda sebagai anggota koperasi.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
      Email ini dikirim secara otomatis oleh sistem ${cooperativeName}.<br>
      Mohon tidak membalas email ini.
    </p>
  </div>
</body>
</html>
          `;

          await resend.emails.send({
            from: `${cooperativeName} <onboarding@resend.dev>`,
            to: [emailData.to],
            subject: `[${cooperativeName}] Pengingat Simpanan Wajib - ${emailData.monthName}`,
            html: htmlContent,
          });
          emailsSent++;
          console.log(`Email sent to ${emailData.to}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${emailData.to}:`, emailError);
        }
      }
    }

    console.log(`Successfully sent ${notifications.length} savings reminders, ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${notifications.length} savings reminders`,
        notificationsSent: notifications.length,
        emailsSent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in savings-reminder:', error);
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
