import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailChangeAlertRequest {
  oldEmail: string;
  newEmail: string;
  memberName: string;
  requestTime: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-email-change-alert function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { oldEmail, newEmail, memberName, requestTime }: EmailChangeAlertRequest = await req.json();

    console.log(`Sending email change alert to ${oldEmail} for member ${memberName}`);

    // Mask new email for privacy (show first 2 chars and domain)
    const maskedNewEmail = newEmail.replace(/^(.{2})(.*)(@.*)$/, '$1***$3');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            
            <!-- Warning Header -->
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="background-color: #fef3c7; border-radius: 50%; width: 64px; height: 64px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 32px;">⚠️</span>
              </div>
              <h1 style="color: #d97706; margin: 0; font-size: 24px;">Permintaan Perubahan Email</h1>
            </div>

            <!-- Content -->
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Halo <strong>${memberName}</strong>,
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Kami menerima permintaan untuk mengubah alamat email akun koperasi Anda.
            </p>

            <!-- Details Box -->
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Email Lama:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 4px 0;">${oldEmail}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Email Baru:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 4px 0;">${maskedNewEmail}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Waktu Permintaan:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 4px 0;">${requestTime}</td>
                </tr>
              </table>
            </div>

            <!-- Warning Message -->
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #dc2626; font-size: 14px; margin: 0; font-weight: 600;">
                🚨 Jika Anda TIDAK melakukan permintaan ini:
              </p>
              <ul style="color: #7f1d1d; font-size: 14px; margin: 8px 0 0 0; padding-left: 20px;">
                <li>Segera hubungi administrator koperasi</li>
                <li>Ganti password akun Anda secepatnya</li>
                <li>Periksa aktivitas akun Anda</li>
              </ul>
            </div>

            <!-- Info Message -->
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
              Jika Anda yang melakukan permintaan ini, Anda dapat mengabaikan email ini. 
              Perubahan email baru akan aktif setelah Anda mengkonfirmasi melalui link yang dikirim ke email baru.
            </p>

          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Email ini dikirim secara otomatis untuk keamanan akun Anda.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0 0;">
              © ${new Date().getFullYear()} Koperasi. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Koperasi <onboarding@resend.dev>",
        to: [oldEmail],
        subject: "⚠️ Permintaan Perubahan Email Akun Anda",
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    console.log("Email change alert sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-email-change-alert function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
