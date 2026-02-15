import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResignationNotificationRequest {
  userId: string;
  status: 'approved' | 'rejected';
  rejectionReason?: string;
  memberName?: string;
  memberEmail?: string;
  totalSavings?: number;
  totalArrears?: number;
  refundAmount?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Helper function to generate email header with optional logo
const generateEmailHeader = (cooperativeName: string, logoBase64: string | null, title: string, icon: string, bgColor: string) => {
  const logoHtml = logoBase64 ? `
    <img 
      src="${logoBase64}" 
      alt="${cooperativeName}" 
      style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; border: 3px solid rgba(255,255,255,0.3);"
    />
  ` : `<div style="font-size: 48px; margin-bottom: 10px;">${icon}</div>`;
  
  return `
    <div style="background: ${bgColor}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      ${logoHtml}
      <h1 style="margin: 0;">${title}</h1>
    </div>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userId,
      status,
      rejectionReason,
      memberName,
      memberEmail,
      totalSavings,
      totalArrears,
      refundAmount
    }: ResignationNotificationRequest = await req.json();

    console.log("Processing resignation notification:", { userId, status });

    // Create Supabase client to fetch user data if not provided
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let name = memberName || '';
    let email = memberEmail || '';

    // Fetch user info if not provided
    if (!name || !email) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        throw new Error("Failed to fetch user profile");
      }

      name = name || profile.name;
      email = email || profile.email;
    }

    if (!email) {
      throw new Error("Email is required");
    }

    // Fetch cooperative name and logo
    const { data: coopSettings } = await supabase
      .from("cooperative_settings")
      .select("key, value")
      .in("key", ["cooperative_name", "cooperative_logo_base64"]);

    const settingsMap: Record<string, string> = {};
    coopSettings?.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const cooperativeName = settingsMap['cooperative_name'] || "Koperasi";
    const logoBase64 = settingsMap['cooperative_logo_base64'] || null;

    let subject: string;
    let htmlContent: string;

    if (status === 'approved') {
      subject = `Pengunduran Diri Disetujui - ${cooperativeName}`;
      const headerHtml = generateEmailHeader(cooperativeName, logoBase64, 'Pengunduran Diri Disetujui', '✅', 'linear-gradient(135deg, #10b981 0%, #059669 100%)');
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .amount-box { background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .amount { font-size: 28px; font-weight: bold; color: #10b981; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            ${headerHtml}
            <div class="content">
              <p>Yth. <strong>${name}</strong>,</p>
              
              <p>Dengan hormat kami sampaikan bahwa pengajuan pengunduran diri Anda dari keanggotaan ${cooperativeName} telah <strong style="color: #10b981;">DISETUJUI</strong>.</p>
              
              ${totalSavings !== undefined ? `
              <div class="amount-box">
                <p style="margin: 0 0 10px 0; color: #6b7280;">Dana yang Akan Dikembalikan</p>
                <div class="amount">${formatCurrency(refundAmount || 0)}</div>
              </div>
              
              <h3>Rincian Pengembalian:</h3>
              <div style="background: white; padding: 15px; border-radius: 8px;">
                <div class="detail-row">
                  <span>Total Simpanan</span>
                  <strong>${formatCurrency(totalSavings || 0)}</strong>
                </div>
                ${totalArrears && totalArrears > 0 ? `
                <div class="detail-row">
                  <span>Potongan Tunggakan</span>
                  <strong style="color: #ef4444;">- ${formatCurrency(totalArrears)}</strong>
                </div>
                ` : ''}
                <div class="detail-row" style="border-bottom: none; font-size: 18px;">
                  <span>Dana Dikembalikan</span>
                  <strong style="color: #10b981;">${formatCurrency(refundAmount || 0)}</strong>
                </div>
              </div>
              ` : ''}
              
              <p style="margin-top: 20px;">Silakan hubungi kantor koperasi untuk proses pencairan dana pengembalian simpanan Anda.</p>
              
              <p>Terima kasih atas kepercayaan dan partisipasi Anda selama menjadi anggota ${cooperativeName}. Kami berharap yang terbaik untuk Anda.</p>
              
              <p>Hormat kami,<br><strong>${cooperativeName}</strong></p>
            </div>
            <div class="footer">
              <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = `Pengunduran Diri Ditolak - ${cooperativeName}`;
      const headerHtml = generateEmailHeader(cooperativeName, logoBase64, 'Pengunduran Diri Ditolak', '❌', 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)');
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .reason-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            ${headerHtml}
            <div class="content">
              <p>Yth. <strong>${name}</strong>,</p>
              
              <p>Dengan hormat kami sampaikan bahwa pengajuan pengunduran diri Anda dari keanggotaan ${cooperativeName} <strong style="color: #ef4444;">TIDAK DAPAT DISETUJUI</strong> saat ini.</p>
              
              ${rejectionReason ? `
              <div class="reason-box">
                <h4 style="margin: 0 0 10px 0; color: #dc2626;">Alasan Penolakan:</h4>
                <p style="margin: 0;">${rejectionReason}</p>
              </div>
              ` : ''}
              
              <p>Jika Anda memiliki pertanyaan atau ingin mengajukan kembali pengunduran diri setelah memenuhi persyaratan, silakan hubungi kantor koperasi.</p>
              
              <p>Terima kasih atas pengertian Anda.</p>
              
              <p>Hormat kami,<br><strong>${cooperativeName}</strong></p>
            </div>
            <div class="footer">
              <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${cooperativeName} <onboarding@resend.dev>`,
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-resignation-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
