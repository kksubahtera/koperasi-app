import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnnouncementRequest {
  title: string;
  message: string;
  announcement_type: string;
  target_type: 'all_members' | 'selected_members';
  target_user_ids?: string[];
  send_email: boolean;
  preview?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AnnouncementRequest = await req.json();
    const { 
      title, 
      message, 
      announcement_type, 
      target_type, 
      target_user_ids,
      send_email,
      preview = false 
    } = body;

    console.log("Announcement request:", { title, announcement_type, target_type, send_email, preview });

    // Get target members
    let membersQuery = supabase
      .from('profiles')
      .select('user_id, name, email, member_number')
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    if (target_type === 'selected_members' && target_user_ids && target_user_ids.length > 0) {
      membersQuery = membersQuery.in('user_id', target_user_ids);
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      console.error("Error fetching members:", membersError);
      throw membersError;
    }

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Tidak ada anggota yang ditemukan" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const membersWithEmail = members.filter(m => m.email);
    const membersWithoutEmail = members.filter(m => !m.email);

    // If preview mode, return data without sending
    if (preview) {
      return new Response(
        JSON.stringify({
          preview: true,
          totalMembers: members.length,
          membersWithEmail: membersWithEmail.length,
          membersWithoutEmail: membersWithoutEmail.length,
          members: members.map(m => ({
            userId: m.user_id,
            name: m.name,
            memberNumber: m.member_number,
            email: m.email || null
          }))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create announcement record
    const { data: announcement, error: announcementError } = await supabase
      .from('cooperative_announcements')
      .insert({
        title,
        message,
        announcement_type,
        target_type,
        target_user_ids: target_type === 'selected_members' ? target_user_ids : null,
        is_email_sent: send_email && resendApiKey ? true : false,
      })
      .select()
      .single();

    if (announcementError) {
      console.error("Error creating announcement:", announcementError);
      throw announcementError;
    }

    // Create member notifications for all target members
    const notifications = members.map(member => ({
      user_id: member.user_id,
      title: title,
      message: message,
      notification_type: 'announcement',
      metadata: {
        announcement_id: announcement.id,
        announcement_type: announcement_type
      }
    }));

    const { error: notifError } = await supabase
      .from('member_notifications')
      .insert(notifications);

    if (notifError) {
      console.error("Error creating notifications:", notifError);
    }

    let emailSentCount = 0;
    let emailErrors: string[] = [];

    // Send emails if requested and Resend is configured
    if (send_email && resendApiKey && membersWithEmail.length > 0) {
      const resend = new Resend(resendApiKey);

      for (const member of membersWithEmail) {
        try {
          await resend.emails.send({
            from: "Koperasi <onboarding@resend.dev>",
            to: [member.email],
            subject: `[Pengumuman] ${title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a365d;">${title}</h2>
                <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="color: #4a5568; white-space: pre-wrap;">${message}</p>
                </div>
                <p style="color: #718096; font-size: 14px;">
                  Hai ${member.name},<br><br>
                  Ini adalah pengumuman resmi dari koperasi. Silakan cek aplikasi untuk informasi lebih lanjut.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #a0aec0; font-size: 12px;">
                  Email ini dikirim otomatis. Mohon tidak membalas email ini.
                </p>
              </div>
            `,
          });
          emailSentCount++;
        } catch (emailError: any) {
          console.error(`Error sending email to ${member.email}:`, emailError);
          emailErrors.push(`${member.name}: ${emailError.message}`);
        }
      }
    }

    // Update announcement with counts
    await supabase
      .from('cooperative_announcements')
      .update({
        email_sent_count: emailSentCount,
        notification_sent_count: members.length
      })
      .eq('id', announcement.id);

    console.log(`Announcement sent: ${members.length} notifications, ${emailSentCount} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        announcementId: announcement.id,
        notificationsSent: members.length,
        emailsSent: emailSentCount,
        emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
        membersWithoutEmail: membersWithoutEmail.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-announcement:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
