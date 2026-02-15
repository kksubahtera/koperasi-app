import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CredentialsEmailRequest {
  member_name: string;
  member_number: string;
  email: string;
  password?: string;
  claim_url?: string;
  claim_method: 'password_change' | 'magic_link' | 'pending';
  cooperative_name?: string;
  login_url?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-member-credentials function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get APP_URL from environment or use SUPABASE_URL as fallback
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || "";
    
    const { 
      member_name, 
      member_number, 
      email, 
      password, 
      claim_url,
      claim_method = 'password_change',
      cooperative_name = "Koperasi",
      login_url = appUrl // Use dynamic URL instead of hardcoded value
    }: CredentialsEmailRequest = await req.json();

    console.log(`Sending credentials email to: ${email}, method: ${claim_method}`);

    if (!email || !member_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, member_name" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let emailHtml = '';
    let subject = '';

    if (claim_method === 'magic_link' && claim_url) {
      subject = `${cooperative_name} - Klaim Akun Anggota Anda`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Selamat Bergabung!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Klaim akun anggota Anda sekarang</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Halo <strong>${member_name}</strong>,</p>
            
            <p>Anda telah terdaftar sebagai anggota ${cooperative_name} dengan nomor anggota <strong>${member_number}</strong>.</p>
            
            <p>Untuk mengaktifkan akun Anda, silakan klik tombol di bawah ini:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${claim_url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Klaim Akun Saya
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">Atau salin link berikut ke browser Anda:</p>
            <p style="font-size: 12px; background: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all;">${claim_url}</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ Penting:</strong> Link ini hanya berlaku selama 7 hari. Setelah itu, hubungi admin untuk mendapatkan link baru.
              </p>
            </div>
            
            <p style="margin-bottom: 0;">Salam hangat,<br><strong>Tim ${cooperative_name}</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
            <p>Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Password change method
      subject = `Selamat Bergabung di ${cooperative_name} - Kredensial Login Anda`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Selamat Bergabung!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Akun anggota Anda telah berhasil dibuat</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Halo <strong>${member_name}</strong>,</p>
            
            <p>Anda telah terdaftar sebagai anggota ${cooperative_name}. Berikut adalah informasi akun Anda:</p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 140px;">No. Anggota</td>
                  <td style="padding: 8px 0; font-weight: bold;">${member_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Email</td>
                  <td style="padding: 8px 0; font-weight: bold;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Password</td>
                  <td style="padding: 8px 0; font-weight: bold; font-family: monospace; background: #fff3cd; padding: 4px 8px; border-radius: 4px; display: inline-block;">${password}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #d4edda; border: 1px solid #28a745; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #155724; font-size: 14px;">
                <strong>🔐 Keamanan:</strong> Saat login pertama kali, Anda akan diminta untuk mengganti password demi keamanan akun.
              </p>
            </div>
            
            <p>Anda dapat login ke sistem menggunakan email dan password di atas.</p>
            
            <p style="margin-bottom: 0;">Salam hangat,<br><strong>Tim ${cooperative_name}</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
          </div>
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: `${cooperative_name} <onboarding@resend.dev>`,
      to: [email],
      subject: subject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending credentials email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
