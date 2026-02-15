import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5; // Max attempts per IP per window
const NIK_VERIFICATION_MAX_ATTEMPTS = 3; // Max NIK verification attempts per token
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes lockout after too many failures

// In-memory rate limit store (resets on function cold start, but provides protection during active attacks)
const rateLimitStore = new Map<string, { attempts: number; firstAttempt: number; lockedUntil?: number }>();
const nikFailureStore = new Map<string, { attempts: number; lockedUntil?: number }>();

interface ValidateTokenRequest {
  action: 'validate';
  token: string;
}

interface ClaimAccountRequest {
  action: 'claim';
  token: string;
  new_password: string;
  nik_verification?: string;
}

type RequestBody = ValidateTokenRequest | ClaimAccountRequest;

/**
 * Check rate limit for an IP address
 * Returns { allowed: boolean, remainingAttempts: number, retryAfter?: number }
 */
function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  // Check if IP is locked out
  if (record?.lockedUntil && now < record.lockedUntil) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    console.log(`Rate limit: IP ${ip} is locked out for ${retryAfter} more seconds`);
    return { allowed: false, remainingAttempts: 0, retryAfter };
  }

  // No record or window expired - allow
  if (!record || (now - record.firstAttempt) > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { attempts: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - 1 };
  }

  // Within window - check attempts
  if (record.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    // Lock out the IP
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    rateLimitStore.set(ip, record);
    const retryAfter = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    console.log(`Rate limit: IP ${ip} exceeded max attempts, locked out for ${retryAfter} seconds`);
    return { allowed: false, remainingAttempts: 0, retryAfter };
  }

  // Increment attempts
  record.attempts++;
  rateLimitStore.set(ip, record);
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - record.attempts };
}

/**
 * Check NIK verification attempts for a specific token
 * Returns { allowed: boolean, attemptsRemaining: number }
 */
function checkNikAttempts(token: string): { allowed: boolean; attemptsRemaining: number } {
  const now = Date.now();
  const record = nikFailureStore.get(token);

  // Check if token is locked out
  if (record?.lockedUntil && now < record.lockedUntil) {
    console.log(`NIK verification: Token ${token.substring(0, 8)}... is locked out`);
    return { allowed: false, attemptsRemaining: 0 };
  }

  // No record - allow
  if (!record) {
    return { allowed: true, attemptsRemaining: NIK_VERIFICATION_MAX_ATTEMPTS };
  }

  // Check attempts
  if (record.attempts >= NIK_VERIFICATION_MAX_ATTEMPTS) {
    return { allowed: false, attemptsRemaining: 0 };
  }

  return { allowed: true, attemptsRemaining: NIK_VERIFICATION_MAX_ATTEMPTS - record.attempts };
}

/**
 * Record a failed NIK verification attempt
 */
function recordNikFailure(token: string): void {
  const now = Date.now();
  const record = nikFailureStore.get(token) || { attempts: 0 };
  record.attempts++;
  
  // Lock out after max attempts
  if (record.attempts >= NIK_VERIFICATION_MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.log(`NIK verification: Token ${token.substring(0, 8)}... locked out after ${record.attempts} failed attempts`);
  }
  
  nikFailureStore.set(token, record);
}

/**
 * Clean up old entries from rate limit stores (called periodically)
 */
function cleanupRateLimitStores(): void {
  const now = Date.now();
  
  for (const [ip, record] of rateLimitStore.entries()) {
    if ((now - record.firstAttempt) > RATE_LIMIT_WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      rateLimitStore.delete(ip);
    }
  }
  
  for (const [token, record] of nikFailureStore.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      nikFailureStore.delete(token);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("claim-account function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cleanup old entries periodically
  cleanupRateLimitStores();

  // Get client IP for rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  
  // Check rate limit
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    console.log(`Rate limit exceeded for IP: ${clientIp}`);
    return new Response(
      JSON.stringify({ 
        error: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
        retry_after: rateLimit.retryAfter 
      }),
      { 
        status: 429, 
        headers: { 
          "Content-Type": "application/json", 
          "Retry-After": String(rateLimit.retryAfter || 1800),
          ...corsHeaders 
        } 
      }
    );
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body: RequestBody = await req.json();

    if (body.action === 'validate') {
      // Validate token and return user info
      const { token } = body;

      if (!token) {
        return new Response(
          JSON.stringify({ valid: false, error: "Token tidak ditemukan" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find token
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('account_claim_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        console.log("Token not found:", tokenError);
        return new Response(
          JSON.stringify({ valid: false, error: "Token tidak valid atau tidak ditemukan" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if already claimed
      if (tokenData.claimed_at) {
        return new Response(
          JSON.stringify({ valid: false, error: "Token sudah digunakan sebelumnya" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if expired
      const expiresAt = new Date(tokenData.expires_at);
      if (new Date() > expiresAt) {
        return new Response(
          JSON.stringify({ valid: false, error: "Token sudah kadaluarsa" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get user profile with decrypted NIK via RPC
      const { data: profileData, error: profileError } = await supabaseAdmin
        .rpc('get_profile_with_nik', { p_user_id: tokenData.user_id });

      // Cast to expected type
      const profile = profileData as { 
        name: string; 
        member_number: string | null; 
        nik: string | null;
      } | null;

      if (profileError || !profile) {
        console.log("Profile not found:", profileError);
        return new Response(
          JSON.stringify({ valid: false, error: "Profil anggota tidak ditemukan" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get user email
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(tokenData.user_id);
      
      if (authError || !authUser) {
        console.log("Auth user not found:", authError);
        return new Response(
          JSON.stringify({ valid: false, error: "User tidak ditemukan" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check NIK verification status for this token
      const nikStatus = checkNikAttempts(token);

      return new Response(
        JSON.stringify({
          valid: true,
          user_info: {
            name: profile.name,
            email: authUser.user.email,
            member_number: profile.member_number,
            has_nik: !!profile.nik,
            expires_at: tokenData.expires_at,
            nik_attempts_remaining: nikStatus.attemptsRemaining
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (body.action === 'claim') {
      const { token, new_password, nik_verification } = body;

      if (!token || !new_password) {
        return new Response(
          JSON.stringify({ success: false, error: "Token dan password baru harus diisi" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check NIK verification attempts for this token
      const nikStatus = checkNikAttempts(token);
      if (!nikStatus.allowed) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Terlalu banyak percobaan verifikasi NIK gagal. Token ini dikunci sementara.",
            locked: true
          }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate password strength
      if (new_password.length < 8) {
        return new Response(
          JSON.stringify({ success: false, error: "Password minimal 8 karakter" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find token
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('account_claim_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ success: false, error: "Token tidak valid" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if already claimed
      if (tokenData.claimed_at) {
        return new Response(
          JSON.stringify({ success: false, error: "Token sudah digunakan" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if expired
      if (new Date() > new Date(tokenData.expires_at)) {
        return new Response(
          JSON.stringify({ success: false, error: "Token sudah kadaluarsa" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get profile for NIK verification if provided
      if (nik_verification) {
        // Get decrypted NIK via RPC
        const { data: decryptedNik, error: nikError } = await supabaseAdmin
          .rpc('get_decrypted_nik', { p_user_id: tokenData.user_id });

        if (nikError) {
          console.error('Error getting decrypted NIK:', nikError);
          return new Response(
            JSON.stringify({ success: false, error: "Gagal memverifikasi NIK" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Verify NIK (last 4 digits)
        if (decryptedNik && !decryptedNik.endsWith(nik_verification)) {
          // Record failed NIK verification attempt
          recordNikFailure(token);
          const remainingAttempts = NIK_VERIFICATION_MAX_ATTEMPTS - (nikFailureStore.get(token)?.attempts || 0);
          
          console.log(`NIK verification failed for token ${token.substring(0, 8)}..., ${remainingAttempts} attempts remaining`);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Verifikasi NIK gagal. 4 digit terakhir NIK tidak sesuai.${remainingAttempts > 0 ? ` Sisa percobaan: ${remainingAttempts}` : ' Token dikunci.'}`,
              attempts_remaining: remainingAttempts
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // Get client info
      const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      const user_agent = req.headers.get('user-agent') || 'unknown';

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        tokenData.user_id,
        { password: new_password }
      );

      if (updateError) {
        console.error("Failed to update password:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Gagal mengupdate password: " + updateError.message }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark token as claimed
      const { error: claimError } = await supabaseAdmin
        .from('account_claim_tokens')
        .update({
          claimed_at: new Date().toISOString(),
          ip_address,
          user_agent
        })
        .eq('id', tokenData.id);

      if (claimError) {
        console.error("Failed to mark token as claimed:", claimError);
      }

      // Update profile
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          password_changed_at: new Date().toISOString(),
          must_change_password: false,
          claim_method: 'magic_link'
        })
        .eq('user_id', tokenData.user_id);

      if (profileUpdateError) {
        console.error("Failed to update profile:", profileUpdateError);
      }

      // Clear NIK failure record on successful claim
      nikFailureStore.delete(token);

      // Get user email for login
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(tokenData.user_id);

      console.log("Account claimed successfully for user:", tokenData.user_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Akun berhasil diaktifkan! Silakan login dengan password baru Anda.",
          email: authUser?.user?.email
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Action tidak valid" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in claim-account:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
