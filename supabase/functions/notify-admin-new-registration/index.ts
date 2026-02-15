import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userId: string;
  userName: string;
  userEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-admin-new-registration function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userName, userEmail }: NotificationRequest = await req.json();
    
    console.log(`Processing admin notification for new registration: ${userName} (${userEmail})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if admin notification is enabled
    const { data: settingData } = await supabase
      .from('cooperative_settings')
      .select('value')
      .eq('key', 'admin_new_registration_email_enabled')
      .single();
    
    const isEmailEnabled = settingData?.value !== false;
    console.log(`Admin new registration email enabled: ${isEmailEnabled}`);

    // Fetch cooperative name and logo for email branding
    const { data: coopSettings } = await supabase
      .from('cooperative_settings')
      .select('key, value')
      .in('key', ['cooperative_name', 'cooperative_logo_base64']);
    
    const settingsMap: Record<string, string> = {};
    coopSettings?.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    
    const cooperativeName = settingsMap['cooperative_name'] || 'Koperasi';
    const logoBase64 = settingsMap['cooperative_logo_base64'] || null;

    // Get all active admins
    const { data: admins, error: adminsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (adminsError) {
      console.error("Error fetching admins:", adminsError);
      throw adminsError;
    }

    if (!admins || admins.length === 0) {
      console.log("No active admins found");
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${admins.length} active admin(s)`);

    // Get admin profiles for email
    const adminUserIds = admins.map(a => a.user_id);
    const { data: adminProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .in('user_id', adminUserIds);

    if (profilesError) {
      console.error("Error fetching admin profiles:", profilesError);
      throw profilesError;
    }

    // Create in-app notification for all admins
    const registrationDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const { error: notifError } = await supabase
      .from('admin_notifications')
      .insert({
        notification_type: 'new_registration',
        title: 'Pendaftaran Anggota Baru',
        message: `${userName} (${userEmail}) telah mendaftar dan menunggu verifikasi.`,
        metadata: {
          user_id: userId,
          user_name: userName,
          user_email: userEmail,
          registration_date: new Date().toISOString()
        }
      });

    if (notifError) {
      console.error("Error creating admin notification:", notifError);
    } else {
      console.log("Admin in-app notification created successfully");
    }

    // Send email to admins if enabled
    let emailsSent = 0;
    if (isEmailEnabled && adminProfiles && adminProfiles.length > 0) {
      const logoHtml = logoBase64 ? `
        <img 
          src="${logoBase64}" 
          alt="${cooperativeName}" 
          style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid rgba(255,255,255,0.3);"
        />
      ` : '';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
            ${logoHtml}
            <h1 style="color: white; margin: 0; font-size: 20px;">🔔 Pendaftaran Anggota Baru</h1>
          </div>
          <div style="background: #f9fafb; padding: 25px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 15px; margin-bottom: 15px;">Halo Admin,</p>
            <p>Ada anggota baru yang mendaftar di <strong>${cooperativeName}</strong> dan menunggu verifikasi:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 100px;">Nama</td>
                  <td style="padding: 8px 0; font-weight: 600;">${userName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Email</td>
                  <td style="padding: 8px 0;">${userEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Tanggal Daftar</td>
                  <td style="padding: 8px 0;">${registrationDate}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                ⏳ <strong>Menunggu Verifikasi</strong><br>
                Silakan login ke aplikasi untuk memverifikasi dan menyetujui pendaftaran anggota ini.
              </p>
            </div>
            
            <p style="margin-top: 25px; color: #6b7280; font-size: 13px;">
              Salam,<br>
              <strong>Sistem ${cooperativeName}</strong>
            </p>
          </div>
          <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 11px;">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
          </div>
        </body>
        </html>
      `;

      for (const admin of adminProfiles) {
        if (admin.email) {
          try {
            const emailResponse = await resend.emails.send({
              from: `${cooperativeName} <onboarding@resend.dev>`,
              to: [admin.email],
              subject: `[${cooperativeName}] Pendaftaran Anggota Baru - ${userName}`,
              html: emailHtml,
            });
            console.log(`Email sent to admin ${admin.email}:`, emailResponse);
            emailsSent++;
          } catch (emailError) {
            console.error(`Failed to send email to ${admin.email}:`, emailError);
          }
        }
      }
    }

    console.log(`Notification complete: 1 in-app notification, ${emailsSent} email(s) sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationCreated: true,
        emailsSent,
        adminsNotified: admins.length
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-admin-new-registration function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
