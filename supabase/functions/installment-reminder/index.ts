import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to generate email header with optional logo
const generateEmailHeader = (cooperativeName: string, logoBase64: string | null, title: string, bgColor: string) => {
  const logoHtml = logoBase64 ? `
    <img 
      src="${logoBase64}" 
      alt="${cooperativeName}" 
      style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; border: 3px solid rgba(255,255,255,0.3);"
    />
  ` : '';
  
  return `
    <div style="background: ${bgColor}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
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

    console.log(`Starting installment reminder check... (preview: ${previewMode})`);

    // Get notification settings including logo
    const { data: settingsData } = await supabase
      .from('cooperative_settings')
      .select('key, value')
      .in('key', [
        'installment_reminder_enabled',
        'installment_reminder_days_before',
        'installment_reminder_email_enabled',
        'email_notifications_enabled',
        'cooperative_name',
        'cooperative_logo_base64'
      ]);

    const settings: Record<string, unknown> = {};
    settingsData?.forEach((s: { key: string; value: unknown }) => {
      settings[s.key] = s.value;
    });

    const emailEnabled = settings['email_notifications_enabled'] !== false;
    const reminderEnabled = settings['installment_reminder_enabled'] !== false;
    const emailNotificationEnabled = settings['installment_reminder_email_enabled'] !== false;
    const daysBefore = Number(settings['installment_reminder_days_before']) || 7;
    const cooperativeName = String(settings['cooperative_name'] || 'Koperasi');
    const logoBase64 = settings['cooperative_logo_base64'] as string | null;

    if (!reminderEnabled) {
      console.log('Installment reminder is disabled');
      return new Response(
        JSON.stringify({ message: 'Installment reminder is disabled', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current date and date X days from now based on settings
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysBefore);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    console.log(`Checking installments due between ${todayStr} and ${futureDateStr} (${daysBefore} days)`);

    // Find installments that are due within the configured days and not yet paid
    const { data: dueInstallments, error: installmentsError } = await supabase
      .from('loan_installments')
      .select(`
        id,
        loan_id,
        installment_number,
        due_date,
        total_amount,
        penalty_amount,
        status,
        loans!inner (
          id,
          user_id,
          principal_amount,
          status
        )
      `)
      .gte('due_date', todayStr)
      .lte('due_date', futureDateStr)
      .in('status', ['pending', 'partial'])
      .eq('loans.status', 'active');

    if (installmentsError) {
      console.error('Error fetching installments:', installmentsError);
      throw installmentsError;
    }

    console.log(`Found ${dueInstallments?.length || 0} installments due within ${daysBefore} days`);

    if (!dueInstallments || dueInstallments.length === 0) {
      const emptyResponse = previewMode 
        ? { 
            preview: true, 
            installments: [], 
            totalCount: 0, 
            daysBefore, 
            dateRange: { from: todayStr, to: futureDateStr } 
          }
        : { message: 'No installments due', count: 0 };
      
      return new Response(
        JSON.stringify(emptyResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get member profiles for the notifications
    const userIds = [...new Set(dueInstallments.map((inst: any) => inst.loans.user_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, email, member_number')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // If preview mode, return preview data without sending notifications
    if (previewMode) {
      const previewData = dueInstallments.map((installment: any) => {
        const loan = installment.loans;
        const profile = profileMap.get(loan.user_id);
        const dueDate = new Date(installment.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const totalDue = installment.total_amount + (installment.penalty_amount || 0);

        return {
          installmentId: installment.id,
          loanId: loan.id,
          memberName: profile?.name || 'Unknown',
          memberNumber: profile?.member_number || '-',
          email: profile?.email || null,
          installmentNumber: installment.installment_number,
          totalAmount: totalDue,
          principalAmount: installment.principal_amount,
          interestAmount: installment.interest_amount,
          dueDate: installment.due_date,
          daysUntilDue,
          status: installment.status,
        };
      });

      const membersWithEmail = previewData.filter((p: any) => p.email).length;
      const membersWithoutEmail = previewData.length - membersWithEmail;

      return new Response(
        JSON.stringify({
          preview: true,
          installments: previewData,
          totalCount: previewData.length,
          uniqueMembers: userIds.length,
          membersWithEmail,
          membersWithoutEmail,
          daysBefore,
          dateRange: { from: todayStr, to: futureDateStr },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing notifications to avoid duplicates (within last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: existingNotifications, error: existingError } = await supabase
      .from('member_notifications')
      .select('user_id, metadata')
      .eq('notification_type', 'installment_reminder')
      .gte('created_at', yesterday.toISOString());

    if (existingError) {
      console.error('Error checking existing notifications:', existingError);
    }

    // Create a set of already notified installment IDs
    const notifiedInstallments = new Set(
      existingNotifications?.map((n: any) => n.metadata?.installment_id) || []
    );

    // Prepare notifications and emails
    const notifications = [];
    const emailsToSend = [];

    // Initialize Resend if API key is available
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    for (const installment of dueInstallments) {
      // Skip if already notified
      if (notifiedInstallments.has(installment.id)) {
        console.log(`Skipping installment ${installment.id} - already notified`);
        continue;
      }

      const loan = installment.loans as any;
      const profile = profileMap.get(loan.user_id);
      const dueDate = new Date(installment.due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const totalDue = installment.total_amount + (installment.penalty_amount || 0);
      const formattedAmount = new Intl.NumberFormat('id-ID').format(totalDue);
      const formattedDueDate = dueDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      let title = 'Pengingat Angsuran';
      let message = '';

      if (daysUntilDue === 0) {
        title = 'Angsuran Jatuh Tempo Hari Ini';
        message = `Angsuran ke-${installment.installment_number} sebesar Rp ${formattedAmount} jatuh tempo hari ini. Segera lakukan pembayaran untuk menghindari denda.`;
      } else if (daysUntilDue === 1) {
        title = 'Angsuran Jatuh Tempo Besok';
        message = `Angsuran ke-${installment.installment_number} sebesar Rp ${formattedAmount} akan jatuh tempo besok (${formattedDueDate}). Segera lakukan pembayaran.`;
      } else {
        title = `Pengingat Angsuran - ${daysUntilDue} Hari Lagi`;
        message = `Angsuran ke-${installment.installment_number} sebesar Rp ${formattedAmount} akan jatuh tempo pada ${formattedDueDate}. Pastikan Anda melakukan pembayaran tepat waktu.`;
      }

      notifications.push({
        user_id: loan.user_id,
        title,
        message,
        notification_type: 'installment_reminder',
        metadata: {
          installment_id: installment.id,
          loan_id: loan.id,
          installment_number: installment.installment_number,
          amount: totalDue,
          due_date: installment.due_date,
          days_until_due: daysUntilDue,
        },
      });

      // Prepare email if enabled
      if (emailEnabled && emailNotificationEnabled && resend && profile?.email) {
        emailsToSend.push({
          to: profile.email,
          name: profile.name || 'Anggota',
          title,
          message,
          amount: formattedAmount,
          dueDate: formattedDueDate,
          installmentNumber: installment.installment_number,
          daysUntilDue,
        });
      }
    }

    console.log(`Creating ${notifications.length} new notifications`);

    // Insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('member_notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        throw insertError;
      }
    }

    // Send emails
    let emailsSent = 0;
    if (resend && emailsToSend.length > 0) {
      for (const emailData of emailsToSend) {
        try {
          const urgencyColor = emailData.daysUntilDue <= 1 ? '#dc3545' : emailData.daysUntilDue <= 3 ? '#ffc107' : '#667eea';
          const urgencyBg = emailData.daysUntilDue <= 1 ? '#f8d7da' : emailData.daysUntilDue <= 3 ? '#fff3cd' : '#e8e9ff';
          
          const headerHtml = generateEmailHeader(cooperativeName, logoBase64, cooperativeName, `linear-gradient(135deg, ${urgencyColor} 0%, #764ba2 100%)`);
          
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
    <h2 style="color: #333; margin-top: 0;">💳 ${emailData.title}</h2>
    
    <p>Halo <strong>${emailData.name}</strong>,</p>
    
    <p>${emailData.message}</p>
    
    <div style="background: ${urgencyBg}; padding: 20px; border-radius: 8px; border-left: 4px solid ${urgencyColor}; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Angsuran ke-</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${emailData.installmentNumber}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Jumlah</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold; color: ${urgencyColor};">Rp ${emailData.amount}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Jatuh Tempo</td>
          <td style="padding: 5px 0; text-align: right; font-weight: bold;">${emailData.dueDate}</td>
        </tr>
      </table>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      Hindari denda keterlambatan dengan melakukan pembayaran tepat waktu melalui aplikasi atau langsung ke kantor ${cooperativeName}.
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
            subject: `[${cooperativeName}] ${emailData.title}`,
            html: htmlContent,
          });
          emailsSent++;
          console.log(`Email sent to ${emailData.to}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${emailData.to}:`, emailError);
        }
      }
    }

    console.log('Installment reminder check completed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Installment reminders sent successfully', 
        count: notifications.length,
        emailsSent,
        checked: dueInstallments.length,
        daysBefore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in installment-reminder function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
