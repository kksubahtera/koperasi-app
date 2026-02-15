import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is admin
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userId } = await req.json();

    if (action === 'list') {
      // Get all auth users
      const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers();
      
      if (authUsersError) {
        throw authUsersError;
      }

      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id');

      const profileUserIds = new Set(profiles?.map(p => p.user_id) || []);

      // Find orphan users (auth users without profiles)
      const orphanUsers = authUsers.users
        .filter(u => !profileUserIds.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          name: u.user_metadata?.name || null,
          last_sign_in_at: u.last_sign_in_at,
        }));

      return new Response(
        JSON.stringify({ orphanUsers }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync' && userId) {
      // Get user data from auth
      const { data: { user: targetUser }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
      
      if (getUserError || !targetUser) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userName = targetUser.user_metadata?.name || targetUser.email?.split('@')[0] || 'Unknown';
      const memberNumber = 'MBR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + userId.slice(0, 4).toUpperCase();

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          name: userName,
          email: targetUser.email,
          member_number: memberNumber,
          approval_status: 'pending',
          is_active: false,
        });

      if (profileError && !profileError.message.includes('duplicate')) {
        throw profileError;
      }

      // Create user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'member',
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('Role insert error (non-critical):', roleError);
      }

      // Create savings summary
      const { error: savingsError } = await supabase
        .from('savings_summary')
        .insert({
          user_id: userId,
          simpanan_pokok: 0,
          simpanan_wajib: 0,
          simpanan_sukarela: 0,
        });

      if (savingsError && !savingsError.message.includes('duplicate')) {
        console.error('Savings insert error (non-critical):', savingsError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Profile synced successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync-all') {
      // Get all auth users
      const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers();
      
      if (authUsersError) {
        throw authUsersError;
      }

      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id');

      const profileUserIds = new Set(profiles?.map(p => p.user_id) || []);

      // Find orphan users
      const orphanUsers = authUsers.users.filter(u => !profileUserIds.has(u.id));

      let syncedCount = 0;
      const errors: string[] = [];

      for (const user of orphanUsers) {
        try {
          const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown';
          const memberNumber = 'MBR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + user.id.slice(0, 4).toUpperCase();

          await supabase.from('profiles').insert({
            user_id: user.id,
            name: userName,
            email: user.email,
            member_number: memberNumber,
            approval_status: 'pending',
            is_active: false,
          });

          await supabase.from('user_roles').insert({
            user_id: user.id,
            role: 'member',
          });

          await supabase.from('savings_summary').insert({
            user_id: user.id,
            simpanan_pokok: 0,
            simpanan_wajib: 0,
            simpanan_sukarela: 0,
          });

          syncedCount++;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to sync ${user.email}: ${errorMessage}`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          syncedCount, 
          totalOrphans: orphanUsers.length,
          errors: errors.length > 0 ? errors : undefined 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
