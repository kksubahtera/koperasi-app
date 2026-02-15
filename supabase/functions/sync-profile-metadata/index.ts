import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const timestamp = new Date().toISOString();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { user_id, sync_all_pending } = await req.json();

    console.log(`[${timestamp}] SYNC_PROFILE_METADATA: Starting sync, user_id=${user_id || 'all'}, sync_all_pending=${sync_all_pending}`);

    // If sync_all_pending is true, fetch all pending profiles and sync them
    if (sync_all_pending) {
      const { data: pendingProfiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('user_id, name, email')
        .eq('approval_status', 'pending');

      if (profilesError) {
        console.error(`[${timestamp}] ERROR: Failed to fetch pending profiles: ${profilesError.message}`);
        return new Response(
          JSON.stringify({ error: "Failed to fetch pending profiles" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      for (const profile of pendingProfiles || []) {
        const result = await syncSingleProfile(supabaseAdmin, profile.user_id, timestamp);
        results.push({ user_id: profile.user_id, ...result });
      }

      console.log(`[${timestamp}] SYNC_COMPLETE: Synced ${results.length} profiles`);
      return new Response(
        JSON.stringify({ success: true, synced: results.length, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single user sync
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await syncSingleProfile(supabaseAdmin, user_id, timestamp);
    
    if (!result.success) {
      return new Response(
        JSON.stringify(result),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error(`[${timestamp}] UNEXPECTED_ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function syncSingleProfile(
  supabaseAdmin: any,
  userId: string,
  timestamp: string
): Promise<{ success: boolean; message?: string; error?: string; updated_fields?: string[] }> {
  
  // Fetch user from auth.users to get raw_user_meta_data
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUser?.user) {
    console.error(`[${timestamp}] ERROR: Failed to fetch auth user ${userId}: ${authError?.message}`);
    return { success: false, error: "User not found in auth" };
  }

  const metadata = authUser.user.user_metadata || {};
  console.log(`[${timestamp}] METADATA for ${userId}:`, JSON.stringify(metadata));

  // Check if there's actually data to sync
  const hasData = metadata.nik || metadata.phone || metadata.address || 
                  metadata.bank_name || metadata.bank_account_number ||
                  metadata.birth_place || metadata.birth_date || 
                  metadata.gender || metadata.occupation;

  if (!hasData) {
    console.log(`[${timestamp}] SKIP: No metadata to sync for user ${userId}`);
    return { success: true, message: "No metadata to sync" };
  }

  // Build update object with only non-empty values
  const updateData: Record<string, unknown> = {};
  const updatedFields: string[] = [];

  if (metadata.name) {
    updateData.name = metadata.name;
    updatedFields.push('name');
  }
  // NIK is now encrypted - use RPC to update
  if (metadata.nik) {
    // Will be handled separately via update_member_nik RPC
    updatedFields.push('nik');
  }
  if (metadata.phone) {
    updateData.phone = metadata.phone;
    updatedFields.push('phone');
  }
  if (metadata.address) {
    updateData.address = metadata.address;
    updatedFields.push('address');
  }
  if (metadata.bank_name) {
    updateData.bank_name = metadata.bank_name;
    updatedFields.push('bank_name');
  }
  if (metadata.bank_account_number) {
    updateData.bank_account_number = metadata.bank_account_number;
    updatedFields.push('bank_account_number');
  }
  if (metadata.birth_place) {
    updateData.birth_place = metadata.birth_place;
    updatedFields.push('birth_place');
  }
  if (metadata.birth_date) {
    updateData.birth_date = metadata.birth_date;
    updatedFields.push('birth_date');
  }
  if (metadata.gender) {
    updateData.gender = metadata.gender;
    updatedFields.push('gender');
  }
  if (metadata.occupation) {
    updateData.occupation = metadata.occupation;
    updatedFields.push('occupation');
  }
  if (metadata.branch_id) {
    updateData.branch_id = metadata.branch_id;
    updatedFields.push('branch_id');
  }
  // Also set bank_account_name from name
  if (metadata.name) {
    updateData.bank_account_name = metadata.name;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: "No fields to update" };
  }

  // Update the profile
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('user_id', userId);

  if (updateError) {
    console.error(`[${timestamp}] ERROR: Failed to update profile ${userId}: ${updateError.message}`);
    return { success: false, error: updateError.message };
  }

  // Handle NIK encryption separately via RPC
  if (metadata.nik) {
    const { error: nikError } = await supabaseAdmin
      .rpc('update_member_nik', { p_user_id: userId, p_nik: metadata.nik });
    
    if (nikError) {
      console.error(`[${timestamp}] ERROR: Failed to update encrypted NIK for ${userId}: ${nikError.message}`);
      // Don't fail the whole sync if NIK encryption fails
    } else {
      console.log(`[${timestamp}] SUCCESS: Encrypted NIK for ${userId}`);
    }
  }

  console.log(`[${timestamp}] SUCCESS: Updated profile ${userId} with fields: ${updatedFields.join(', ')}`);
  return { success: true, message: "Profile synced successfully", updated_fields: updatedFields };
}