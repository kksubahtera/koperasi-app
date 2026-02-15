import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting reconciliation check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentDay = now.getDate();

    // Check if we're past the 7th day of the month
    if (currentDay < 7) {
      console.log("Still within grace period (before 7th), skipping check");
      return new Response(
        JSON.stringify({ 
          message: "Within grace period", 
          checked: false 
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Calculate the previous month
    let checkMonth = currentMonth - 1;
    let checkYear = currentYear;
    if (checkMonth === 0) {
      checkMonth = 12;
      checkYear = currentYear - 1;
    }

    console.log(`Checking reconciliation for period: ${checkMonth}/${checkYear}`);

    // Check if reconciliation exists for the previous month
    const { data: reconciliation, error: reconciliationError } = await supabase
      .from("bank_reconciliations")
      .select("id, is_reconciled")
      .eq("period_month", checkMonth)
      .eq("period_year", checkYear)
      .maybeSingle();

    if (reconciliationError) {
      console.error("Error checking reconciliation:", reconciliationError);
      throw reconciliationError;
    }

    // If reconciliation exists, no need to notify
    if (reconciliation) {
      console.log("Reconciliation exists for previous month");
      return new Response(
        JSON.stringify({ 
          message: "Reconciliation already done", 
          checked: true,
          reconciled: true,
          period: `${checkMonth}/${checkYear}`
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Check if notification already sent for this period
    const notificationKey = `reconciliation_reminder_${checkYear}_${checkMonth}`;
    
    const { data: existingNotification, error: notifError } = await supabase
      .from("admin_notifications")
      .select("id")
      .eq("notification_type", "reconciliation_reminder")
      .eq("metadata->period_month", checkMonth)
      .eq("metadata->period_year", checkYear)
      .maybeSingle();

    if (notifError && notifError.code !== "PGRST116") {
      console.error("Error checking existing notification:", notifError);
    }

    if (existingNotification) {
      console.log("Notification already sent for this period");
      return new Response(
        JSON.stringify({ 
          message: "Notification already sent", 
          checked: true,
          notified: false
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Get month name in Indonesian
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const monthName = monthNames[checkMonth - 1];

    // Create notification
    const { error: insertError } = await supabase
      .from("admin_notifications")
      .insert({
        notification_type: "reconciliation_reminder",
        title: "Rekonsiliasi Bank Belum Dilakukan",
        message: `Rekonsiliasi bank untuk periode ${monthName} ${checkYear} belum dilakukan. Sudah lebih dari 7 hari sejak akhir bulan. Segera lakukan rekonsiliasi untuk memastikan akurasi catatan keuangan.`,
        metadata: {
          period_month: checkMonth,
          period_year: checkYear,
          deadline_passed: true,
          days_overdue: currentDay - 7
        }
      });

    if (insertError) {
      console.error("Error creating notification:", insertError);
      throw insertError;
    }

    console.log(`Notification created for ${monthName} ${checkYear}`);

    return new Response(
      JSON.stringify({ 
        message: "Notification created", 
        checked: true,
        notified: true,
        period: `${monthName} ${checkYear}`
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error in check-reconciliation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
