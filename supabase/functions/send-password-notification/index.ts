import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordNotificationRequest {
  user_id: string;
  notification_type: "password_changed" | "password_reset";
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, notification_type }: PasswordNotificationRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending password notification to user: ${user_id}, type: ${notification_type}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile) {
      console.error("Failed to get user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get cooperative name for branding
    const { data: coopSettings } = await supabase
      .from("cooperative_settings")
      .select("value")
      .eq("key", "cooperative_name")
      .single();

    const cooperativeName = coopSettings?.value || "Koperasi";
    const currentTime = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "short",
    });

    const isPasswordReset = notification_type === "password_reset";
    const subject = isPasswordReset
      ? `[${cooperativeName}] Password Anda Telah Direset oleh Admin`
      : `[${cooperativeName}] Password Anda Telah Berhasil Diubah`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${cooperativeName}</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">
      ${isPasswordReset ? "🔐 Password Direset" : "✅ Password Berhasil Diubah"}
    </h2>
    
    <p>Halo <strong>${profile.name}</strong>,</p>
    
    ${isPasswordReset 
      ? `<p>Password akun Anda telah <strong>direset oleh administrator</strong> pada:</p>`
      : `<p>Password akun Anda telah <strong>berhasil diubah</strong> pada:</p>`
    }
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
      <p style="margin: 0;"><strong>Waktu:</strong> ${currentTime}</p>
    </div>
    
    ${isPasswordReset 
      ? `<div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">⚠️ <strong>Penting:</strong> Jika Anda menerima password baru dari admin, segera login dan ubah password Anda ke yang lebih aman.</p>
        </div>`
      : ""
    }
    
    <div style="background: #f8d7da; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 20px 0;">
      <p style="margin: 0; color: #721c24;">
        <strong>🚨 Peringatan Keamanan:</strong><br>
        Jika Anda tidak melakukan perubahan ini, segera hubungi administrator koperasi.
      </p>
    </div>
    
    <p>Untuk menjaga keamanan akun Anda:</p>
    <ul style="color: #555;">
      <li>Gunakan password yang kuat dan unik</li>
      <li>Jangan bagikan password kepada siapapun</li>
      <li>Logout dari perangkat yang tidak digunakan</li>
    </ul>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
      Email ini dikirim secara otomatis oleh sistem ${cooperativeName}.<br>
      Mohon tidak membalas email ini.
    </p>
  </div>
</body>
</html>
    `;

    // Send email
    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: `${cooperativeName} <onboarding@resend.dev>`,
      to: [profile.email],
      subject: subject,
      html: htmlContent,
    });

    if (emailError) {
      console.error("Failed to send email:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password notification email sent",
        email_id: emailResponse?.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error sending password notification:", error);
    return new Response(
      JSON.stringify({ 
        error: "An unexpected error occurred", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
