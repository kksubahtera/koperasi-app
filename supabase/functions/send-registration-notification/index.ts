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
  status: 'approved' | 'rejected';
  rejectionReason?: string;
  memberName?: string;
  memberEmail?: string;
}

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
      <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
    </div>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-registration-notification function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, status, rejectionReason, memberName, memberEmail }: NotificationRequest = await req.json();
    
    console.log(`Processing notification for user ${userId}, status: ${status}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If memberName and memberEmail are not provided, fetch from database
    let name = memberName;
    let email = memberEmail;
    
    if (!name || !email) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', userId)
        .single();
      
      if (error || !profile) {
        console.error("Error fetching profile:", error);
        return new Response(
          JSON.stringify({ error: "Profile not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      name = profile.name;
      email = profile.email;
    }

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

    let subject: string;
    let htmlContent: string;

    if (status === 'approved') {
      subject = `Selamat! Pendaftaran Anda di ${cooperativeName} Telah Disetujui`;
      const headerHtml = generateEmailHeader(cooperativeName, logoBase64, '🎉 Pendaftaran Disetujui!', 'linear-gradient(135deg, #10b981 0%, #059669 100%)');
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${headerHtml}
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px;">Halo <strong>${name}</strong>,</p>
            <p>Kami dengan senang hati memberitahukan bahwa pendaftaran Anda sebagai anggota <strong>${cooperativeName}</strong> telah <span style="color: #10b981; font-weight: bold;">DISETUJUI</span>.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h3 style="margin-top: 0; color: #059669;">Langkah Selanjutnya:</h3>
              <ol style="margin: 0; padding-left: 20px;">
                <li>Silakan login ke aplikasi menggunakan email dan password Anda</li>
                <li>Lengkapi profil Anda jika ada data yang belum lengkap</li>
                <li>Mulai gunakan layanan simpan pinjam koperasi</li>
              </ol>
            </div>
            
            <p>Selamat bergabung dan selamat berkoperasi!</p>
            
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Salam hangat,<br>
              <strong>Tim ${cooperativeName}</strong>
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = `Pemberitahuan Status Pendaftaran di ${cooperativeName}`;
      const headerHtml = generateEmailHeader(cooperativeName, logoBase64, 'Pemberitahuan Pendaftaran', 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)');
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${headerHtml}
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px;">Halo <strong>${name}</strong>,</p>
            <p>Mohon maaf, kami harus memberitahukan bahwa pendaftaran Anda sebagai anggota <strong>${cooperativeName}</strong> <span style="color: #ef4444; font-weight: bold;">belum dapat disetujui</span> saat ini.</p>
            
            ${rejectionReason ? `
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <h3 style="margin-top: 0; color: #dc2626;">Alasan:</h3>
              <p style="margin: 0;">${rejectionReason}</p>
            </div>
            ` : ''}
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="margin-top: 0; color: #d97706;">Apa yang dapat Anda lakukan?</h3>
              <p style="margin: 0;">Jika Anda merasa ada kesalahan atau ingin mengajukan pendaftaran ulang, silakan hubungi pengurus koperasi untuk informasi lebih lanjut.</p>
            </div>
            
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Salam,<br>
              <strong>Tim ${cooperativeName}</strong>
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
          </div>
        </body>
        </html>
      `;
    }

    if (!email) {
      console.error("Email address not found");
      return new Response(
        JSON.stringify({ error: "Email address not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending ${status} email to ${email}`);
    
    const emailResponse = await resend.emails.send({
      from: `${cooperativeName} <onboarding@resend.dev>`,
      to: [email as string],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-registration-notification function:", error);
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
