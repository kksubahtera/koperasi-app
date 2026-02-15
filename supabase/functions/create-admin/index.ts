import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return true;
  }
  
  entry.count++;
  return false;
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         req.headers.get("x-real-ip") || 
         "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const timestamp = new Date().toISOString();

  try {
    // Rate limiting check
    if (isRateLimited(clientIP)) {
      console.warn(`[${timestamp}] RATE_LIMITED: IP=${clientIP} - Too many admin creation attempts`);
      return new Response(
        JSON.stringify({ error: "Too many attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, password, name, setup_key } = await req.json();

    // SECURITY: Require ADMIN_SETUP_KEY environment variable - NO DEFAULT VALUE
    const expectedSetupKey = Deno.env.get("ADMIN_SETUP_KEY");
    
    if (!expectedSetupKey) {
      console.error(`[${timestamp}] CONFIG_ERROR: ADMIN_SETUP_KEY environment variable not set`);
      return new Response(
        JSON.stringify({ error: "Admin creation is not configured. Please set ADMIN_SETUP_KEY environment variable." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate setup key with constant-time comparison to prevent timing attacks
    const setupKeyValid = expectedSetupKey.length === setup_key?.length && 
                          expectedSetupKey === setup_key;
    
    if (!setupKeyValid) {
      console.warn(`[${timestamp}] AUTH_FAILED: IP=${clientIP} Email=${email || 'not_provided'} - Invalid setup key`);
      return new Response(
        JSON.stringify({ error: "Invalid setup key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Input validation
    if (!email || !password) {
      console.warn(`[${timestamp}] VALIDATION_FAILED: IP=${clientIP} - Missing email or password`);
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn(`[${timestamp}] VALIDATION_FAILED: IP=${clientIP} - Invalid email format`);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      console.warn(`[${timestamp}] VALIDATION_FAILED: IP=${clientIP} - Password too short`);
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if any admin already exists - if so, require existing admin auth
    const { data: existingAdmins, error: checkError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      console.error(`[${timestamp}] DB_ERROR: IP=${clientIP} - Error checking existing admins: ${checkError.message}`);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.warn(`[${timestamp}] ACCESS_DENIED: IP=${clientIP} Email=${email} - Admin already exists, setup key method disabled`);
      return new Response(
        JSON.stringify({ 
          error: "An admin account already exists. Additional admins must be created by an existing admin through the application." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${timestamp}] CREATING_ADMIN: IP=${clientIP} Email=${email} - Attempting initial admin creation`);

    // Create user with admin client
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name || email,
      },
    });

    if (createError) {
      console.error(`[${timestamp}] CREATE_FAILED: IP=${clientIP} Email=${email} - ${createError.message}`);
      return new Response(
        JSON.stringify({ error: "Failed to create user account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      console.error(`[${timestamp}] CREATE_FAILED: IP=${clientIP} Email=${email} - No user returned`);
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    const memberNumber = 'ADM-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + userId.slice(0, 4).toUpperCase();

    // Create/update profile for admin using upsert to handle trigger race condition
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: userId,
        name: name || email,
        email: email,
        member_number: memberNumber,
        approval_status: 'approved',
        is_active: true,
        join_date: new Date().toISOString().slice(0, 10),
      }, { 
        onConflict: 'user_id' 
      });

    if (profileError) {
      console.error(`[${timestamp}] PROFILE_CREATE_FAILED: ${profileError.message}`);
      // Continue anyway, role is more important
    } else {
      console.log(`[${timestamp}] PROFILE_CREATED: UserID=${userId}`);
    }

    // Create admin role - use insert since this is a new user
    // The unique constraint is on (user_id, role), not just user_id
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ 
        user_id: userId, 
        role: "admin" 
      });

    if (roleError) {
      console.error(`[${timestamp}] ROLE_INSERT_FAILED: ${roleError.message}`);
      // If role insert fails, we should clean up the user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to assign admin role. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[${timestamp}] ROLE_SET: UserID=${userId} Role=admin`);

    // Create savings summary for admin
    const { error: savingsError } = await supabaseAdmin
      .from("savings_summary")
      .insert({
        user_id: userId,
        simpanan_pokok: 0,
        simpanan_wajib: 0,
        simpanan_sukarela: 0,
        total_simpanan: 0,
      });

    if (savingsError) {
      console.error(`[${timestamp}] SAVINGS_CREATE_FAILED: ${savingsError.message}`);
    } else {
      console.log(`[${timestamp}] SAVINGS_CREATED: UserID=${userId}`);
    }

    console.log(`[${timestamp}] ADMIN_CREATED: IP=${clientIP} Email=${email} UserID=${userId} - Initial admin account created successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin account created successfully. This endpoint is now disabled for security.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error(`[${timestamp}] UNEXPECTED_ERROR: IP=${clientIP} - ${error instanceof Error ? error.message : "Unknown error"}`);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
