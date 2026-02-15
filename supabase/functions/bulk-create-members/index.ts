import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MemberData {
  name: string;
  email: string;
  phone?: string;
  nik?: string;
  address?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_name?: string;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  gender?: string;
  birth_date?: string;
  birth_place?: string;
  occupation?: string;
  join_date?: string; // Tanggal bergabung asli (untuk anggota lama)
  member_number?: string; // Nomor anggota manual (opsional, untuk anggota lama)
}

type ClaimMethod = 'magic_link' | 'password_change' | 'pending';

interface BulkCreateRequest {
  members: MemberData[];
  send_email: boolean;
  default_password?: string;
  admin_user_id: string;
  claim_method?: ClaimMethod; // New: method for account claim
}

// Generate unique token for magic link
function generateClaimToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ============= AUTHORIZATION CHECK =============
    // Verify the requesting user is authenticated and has admin role
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has admin role
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole) {
      console.error('Admin role check failed for user:', user.id, roleError?.message);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ============= END AUTHORIZATION CHECK =============

    const { members, send_email, default_password, admin_user_id, claim_method = 'password_change' }: BulkCreateRequest = await req.json();

    // Validate that admin_user_id matches authenticated user (if provided)
    if (admin_user_id && admin_user_id !== user.id) {
      console.warn(`Admin user ID mismatch: provided ${admin_user_id}, authenticated ${user.id}`);
      // Use authenticated user ID instead of client-provided value for security
    }
    const authenticatedAdminId = user.id;

    console.log(`Starting bulk create for ${members.length} members with claim_method: ${claim_method} by admin: ${authenticatedAdminId}`);

    const results = {
      success: [] as { email: string; name: string; member_number: string; claim_method?: string }[],
      failed: [] as { email: string; name: string; error: string }[],
    };

    // Get cooperative settings for member number prefix
    const { data: settingsData } = await supabaseAdmin
      .from('cooperative_settings')
      .select('value')
      .eq('key', 'member_number_prefix')
      .single();
    
    const memberNumberPrefix = (settingsData?.value as string) || 'ANG';

    // Group members by join date for sequential numbering
    const membersByDate: Map<string, MemberData[]> = new Map();
    
    for (const member of members) {
      const joinDate = member.join_date || new Date().toISOString().split('T')[0];
      const dateKey = joinDate.replace(/-/g, '');
      
      if (!membersByDate.has(dateKey)) {
        membersByDate.set(dateKey, []);
      }
      membersByDate.get(dateKey)!.push({ ...member, join_date: joinDate });
    }

    // Process members grouped by date
    for (const [dateKey, dateMembers] of membersByDate) {
      // Get next sequence for this date using database function
      const { data: nextNumber, error: seqError } = await supabaseAdmin
        .rpc('get_next_member_number', { 
          p_prefix: memberNumberPrefix, 
          p_date: dateKey 
        });

      if (seqError) {
        console.error('Error getting next member number:', seqError);
      }

      // Parse the starting sequence from the returned number
      let currentSequence = 1;
      if (nextNumber) {
        const parts = nextNumber.split('-');
        if (parts.length === 3) {
          currentSequence = parseInt(parts[2], 10);
        }
      }

      for (const member of dateMembers) {
        try {
          // Validate email format
          if (!member.email || !member.email.includes('@')) {
            results.failed.push({
              email: member.email || 'unknown',
              name: member.name,
              error: 'Email tidak valid',
            });
            continue;
          }

          // Check if email already exists
          const { data: existingUser } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('email', member.email)
            .single();

          if (existingUser) {
            results.failed.push({
              email: member.email,
              name: member.name,
              error: 'Email sudah terdaftar',
            });
            continue;
          }

          // Check if NIK already exists (if provided) using RPC
          if (member.nik) {
            const { data: nikExists, error: nikCheckError } = await supabaseAdmin
              .rpc('check_nik_exists', { p_nik: member.nik });

            if (nikCheckError) {
              console.error('Error checking NIK:', nikCheckError);
            } else if (nikExists) {
              results.failed.push({
                email: member.email,
                name: member.name,
                error: 'NIK sudah terdaftar',
              });
              continue;
            }
          }

          // Generate password
          const password = default_password || generateRandomPassword();

          // Create auth user
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: member.email,
            password: password,
            email_confirm: true,
            user_metadata: {
              name: member.name,
              phone: member.phone,
            },
          });

          if (authError || !authUser.user) {
            console.error(`Error creating auth user for ${member.email}:`, authError);
            results.failed.push({
              email: member.email,
              name: member.name,
              error: authError?.message || 'Gagal membuat akun auth',
            });
            continue;
          }

          const userId = authUser.user.id;
          
          // Use custom member number if provided, otherwise generate new one
          let memberNumber: string;
          if (member.member_number && member.member_number.trim()) {
            // Check if custom member number already exists
            const { data: existingMemberNumber } = await supabaseAdmin
              .from('profiles')
              .select('member_number')
              .eq('member_number', member.member_number.trim())
              .single();

            if (existingMemberNumber) {
              // Rollback: delete auth user
              await supabaseAdmin.auth.admin.deleteUser(userId);
              results.failed.push({
                email: member.email,
                name: member.name,
                error: `Nomor anggota ${member.member_number} sudah digunakan`,
              });
              continue;
            }
            memberNumber = member.member_number.trim();
          } else {
            // Generate member number with format: PREFIX-YYYYMMDD-XXXX
            memberNumber = `${memberNumberPrefix}-${dateKey}-${String(currentSequence).padStart(4, '0')}`;
            currentSequence++;
          }

          // Determine if this is a migrated account and set appropriate flags
          const isMagicLink = claim_method === 'magic_link';
          const isPasswordChange = claim_method === 'password_change';
          
          // Create profile using RPC to handle NIK encryption
          const { data: insertResult, error: profileError } = await supabaseAdmin
            .rpc('insert_profile_with_nik', {
              p_user_id: userId,
              p_name: member.name,
              p_email: member.email,
              p_nik: member.nik || null,
              p_phone: member.phone || null,
              p_address: member.address || null,
              p_bank_name: member.bank_name || null,
              p_bank_account_number: member.bank_account_number || null,
              p_bank_account_name: member.bank_account_name || null,
              p_birth_place: member.birth_place || null,
              p_birth_date: member.birth_date || null,
              p_gender: member.gender || null,
              p_occupation: member.occupation || null,
              p_member_number: memberNumber,
              p_join_date: member.join_date || null,
              p_branch_id: null,
              p_approval_status: 'approved',
              p_is_active: true,
              p_is_migration: true
            });

          if (profileError) {
            console.error(`Error creating profile for ${member.email}:`, profileError);
            // Rollback: delete auth user
            await supabaseAdmin.auth.admin.deleteUser(userId);
            results.failed.push({
              email: member.email,
              name: member.name,
              error: 'Gagal membuat profil: ' + profileError.message,
            });
            continue;
          }

          // Assign member role
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: userId,
              role: 'member',
            });

          if (roleError) {
            console.error(`Error assigning role for ${member.email}:`, roleError);
          }

          // Create savings summary with initial values of 0
          // The trigger will update these values when transactions are approved
          const { error: savingsError } = await supabaseAdmin
            .from('savings_summary')
            .insert({
              user_id: userId,
              simpanan_pokok: 0,
              simpanan_wajib: 0,
              simpanan_sukarela: 0,
              total_simpanan: 0,
            });

          if (savingsError) {
            console.error(`Error creating savings for ${member.email}:`, savingsError);
          }

          // Create initial transactions for savings if any using saldo_awal_* types
          // These types are handled by triggers and update savings_summary correctly
          const transactionDate = member.join_date || new Date().toISOString();
          
          // Helper function to create migration journal entry with proper COA balance updates
          async function createMigrationJournal(
            amount: number,
            savingsType: 'pokok' | 'wajib' | 'sukarela',
            transactionId: string
          ) {
            try {
              // Get journal entry number
              const { data: entryNumber } = await supabaseAdmin.rpc('generate_journal_entry_number');
              if (!entryNumber) {
                console.error('Failed to generate journal entry number');
                return null;
              }

              // Account code mapping for savings liabilities
              const savingsAccountCodes: Record<string, string> = {
                'pokok': '2-1010',
                'wajib': '2-1020',
                'sukarela': '2-1030',
              };

              // Get account IDs with current balances
              const { data: accounts } = await supabaseAdmin
                .from('chart_of_accounts')
                .select('id, account_code, account_type, balance')
                .in('account_code', [savingsAccountCodes[savingsType], '3-9000', '3-0000']);

              const savingsAccount = accounts?.find(a => a.account_code === savingsAccountCodes[savingsType]);
              const migrationAccount = accounts?.find(a => a.account_code === '3-9000') || 
                                       accounts?.find(a => a.account_code === '3-0000');

              if (!savingsAccount || !migrationAccount) {
                console.log(`Accounts not found for migration journal: ${savingsType}`);
                return null;
              }

              // Create journal entry
              const { data: journalEntry, error: journalError } = await supabaseAdmin
                .from('journal_entries')
                .insert({
                  entry_number: entryNumber,
                  entry_date: transactionDate.split('T')[0],
                  description: `Migrasi saldo awal simpanan ${savingsType} - ${member.name}`,
                  total_debit: amount,
                  total_credit: amount,
                  is_balanced: true,
                  status: 'posted',
                  reference_type: 'migration',
                  reference_id: transactionId,
                })
                .select('id, entry_number')
                .single();

              if (journalError || !journalEntry) {
                console.error('Error creating migration journal:', journalError);
                return null;
              }

              // Create journal lines
              // Jurnal Standar Akuntansi Koperasi untuk Saldo Awal Migrasi:
              // Debit: Modal Migrasi / Saldo Awal (Equity) - sebagai offset sementara
              // Credit: Hutang Simpanan (Liability) - mencatat kewajiban ke anggota
              const { error: linesError } = await supabaseAdmin.from('journal_entry_lines').insert([
                {
                  journal_entry_id: journalEntry.id,
                  account_id: migrationAccount.id,
                  debit_amount: amount,
                  credit_amount: 0,
                  description: `Modal migrasi saldo awal simpanan ${savingsType} - ${member.name}`,
                },
                {
                  journal_entry_id: journalEntry.id,
                  account_id: savingsAccount.id,
                  debit_amount: 0,
                  credit_amount: amount,
                  description: `Hutang simpanan ${savingsType} - Saldo awal migrasi ${member.name}`,
                },
              ]);

              if (linesError) {
                console.error('Error creating journal lines:', linesError);
                return null;
              }

              // Update Chart of Accounts balances sesuai standar akuntansi
              // Modal Migrasi (Equity): Debit mengurangi saldo (atau bisa juga sebagai contra account)
              // Untuk equity account: Credit increases, Debit decreases
              // Tapi Modal Migrasi adalah akun offset khusus, jadi kita update dengan mengurangi
              const migrationCurrentBalance = migrationAccount.balance || 0;
              const migrationNewBalance = migrationCurrentBalance - amount; // Debit decreases equity
              
              await supabaseAdmin
                .from('chart_of_accounts')
                .update({ balance: migrationNewBalance, updated_at: new Date().toISOString() })
                .eq('id', migrationAccount.id);

              // Hutang Simpanan (Liability): Credit increases
              // Liability: Credit increases, Debit decreases
              const savingsCurrentBalance = savingsAccount.balance || 0;
              const savingsNewBalance = savingsCurrentBalance + amount; // Credit increases liability
              
              await supabaseAdmin
                .from('chart_of_accounts')
                .update({ balance: savingsNewBalance, updated_at: new Date().toISOString() })
                .eq('id', savingsAccount.id);

              console.log(`Created migration journal ${journalEntry.entry_number} for ${savingsType}: D.Modal Migrasi ${amount}, K.Hutang Simpanan ${amount}`);
              
              return journalEntry.id;
            } catch (error) {
              console.error('Error in createMigrationJournal:', error);
              return null;
            }
          }

          if (member.simpanan_pokok > 0) {
            const { data: txData } = await supabaseAdmin.from('transactions').insert({
              user_id: userId,
              type: 'saldo_awal_pokok',
              amount: member.simpanan_pokok,
              status: 'approved',
              payment_method: 'transfer_bank',
              account_holder_name: member.name,
              notes: 'Saldo awal migrasi data',
              approved_at: transactionDate,
              created_at: transactionDate,
              is_migration: true,
            }).select('id').single();

            if (txData) {
              const journalId = await createMigrationJournal(member.simpanan_pokok, 'pokok', txData.id);
              if (journalId) {
                await supabaseAdmin.from('transactions')
                  .update({ journal_entry_id: journalId })
                  .eq('id', txData.id);
              }
            }
          }

          if (member.simpanan_wajib > 0) {
            const { data: txData } = await supabaseAdmin.from('transactions').insert({
              user_id: userId,
              type: 'saldo_awal_wajib',
              amount: member.simpanan_wajib,
              status: 'approved',
              payment_method: 'transfer_bank',
              account_holder_name: member.name,
              notes: 'Saldo awal migrasi data',
              approved_at: transactionDate,
              created_at: transactionDate,
              is_migration: true,
            }).select('id').single();

            if (txData) {
              const journalId = await createMigrationJournal(member.simpanan_wajib, 'wajib', txData.id);
              if (journalId) {
                await supabaseAdmin.from('transactions')
                  .update({ journal_entry_id: journalId })
                  .eq('id', txData.id);
              }
            }
          }

          if (member.simpanan_sukarela > 0) {
            const { data: txData } = await supabaseAdmin.from('transactions').insert({
              user_id: userId,
              type: 'saldo_awal_sukarela',
              amount: member.simpanan_sukarela,
              status: 'approved',
              payment_method: 'transfer_bank',
              account_holder_name: member.name,
              notes: 'Saldo awal migrasi data',
              approved_at: transactionDate,
              created_at: transactionDate,
              is_migration: true,
            }).select('id').single();

            if (txData) {
              const journalId = await createMigrationJournal(member.simpanan_sukarela, 'sukarela', txData.id);
              if (journalId) {
                await supabaseAdmin.from('transactions')
                  .update({ journal_entry_id: journalId })
                  .eq('id', txData.id);
              }
            }
          }

          // Create magic link token if using magic_link method
          if (claim_method === 'magic_link') {
            const claimToken = generateClaimToken();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 72); // 72 hours expiry

            await supabaseAdmin.from('account_claim_tokens').insert({
              user_id: userId,
              token: claimToken,
              expires_at: expiresAt.toISOString(),
            });
            
            console.log(`Created magic link token for ${member.email}`);
          }

          results.success.push({
            email: member.email,
            name: member.name,
            member_number: memberNumber,
            claim_method: claim_method,
          });

          console.log(`Successfully created member: ${member.email} with number ${memberNumber}`);

        } catch (memberError) {
          console.error(`Unexpected error for ${member.email}:`, memberError);
          results.failed.push({
            email: member.email,
            name: member.name,
            error: 'Terjadi kesalahan tidak terduga',
          });
        }
      }
    }

    // Log the import (use authenticated admin ID, not client-provided value)
    await supabaseAdmin.from('member_import_logs').insert({
      import_type: 'bulk_create',
      total_rows: members.length,
      success_count: results.success.length,
      failed_count: results.failed.length,
      failed_details: results.failed,
      performed_by: authenticatedAdminId,
    });

    // Create admin notification
    await supabaseAdmin.from('admin_notifications').insert({
      notification_type: 'member_import',
      title: 'Import Anggota Selesai',
      message: `Import ${results.success.length} anggota berhasil, ${results.failed.length} gagal dari total ${members.length} data.`,
      metadata: { results },
    });

    console.log(`Bulk create completed. Success: ${results.success.length}, Failed: ${results.failed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Import selesai: ${results.success.length} berhasil, ${results.failed.length} gagal`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-create-members:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

