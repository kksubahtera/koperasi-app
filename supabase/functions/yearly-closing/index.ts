import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let targetYear: number;
    let isManualTrigger = false;
    
    try {
      const body = await req.json();
      if (body.targetYear) {
        targetYear = Number(body.targetYear);
        isManualTrigger = true;
      } else {
        // Default to previous year (run in January for previous year)
        const now = new Date();
        targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() - 1;
      }
    } catch {
      // Default to previous year for cron job
      const now = new Date();
      targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() - 1;
    }

    console.log(`Processing yearly closing for year ${targetYear}`);

    // Check if auto-closing is enabled (skip check for manual triggers)
    if (!isManualTrigger) {
      const { data: autoClosingSetting } = await supabase
        .from('cooperative_settings')
        .select('value')
        .eq('key', 'auto_yearly_closing')
        .maybeSingle();

      const isEnabled = autoClosingSetting?.value?.enabled === true;
      if (!isEnabled) {
        console.log('Auto yearly closing is disabled');
        return new Response(
          JSON.stringify({ success: false, message: 'Auto yearly closing is disabled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if year already closed
    const { data: existingDistribution } = await supabase
      .from('shu_distributions')
      .select('id, status')
      .eq('year', targetYear)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (existingDistribution) {
      console.log(`Year ${targetYear} already closed`);
      return new Response(
        JSON.stringify({ success: false, message: `Tahun ${targetYear} sudah ditutup sebelumnya` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all income for the year
    const { data: incomeEntries, error: incomeError } = await supabase
      .from('income_entries')
      .select('amount')
      .eq('year', targetYear);

    if (incomeError) throw incomeError;

    const totalIncome = (incomeEntries || []).reduce((sum, e) => sum + Number(e.amount), 0);

    // Get all expenses for the year
    const { data: expenseEntries, error: expenseError } = await supabase
      .from('expense_entries')
      .select('amount')
      .eq('year', targetYear);

    if (expenseError) throw expenseError;

    const totalExpense = (expenseEntries || []).reduce((sum, e) => sum + Number(e.amount), 0);

    // Calculate SHU bruto
    const shuBruto = totalIncome - totalExpense;

    console.log(`Year ${targetYear}: Income=${totalIncome}, Expense=${totalExpense}, SHU=${shuBruto}`);

    // Get SHU distribution settings
    const { data: shuSettings } = await supabase
      .from('cooperative_settings')
      .select('key, value')
      .in('key', [
        'shuPengurusPercentage',
        'shuPengawasPercentage',
        'shuPenasihatPercentage',
        'shuAnggotaPercentage',
        'shuDanaCadanganPercentage',
        'shuDanaPendidikanPercentage',
        'shuDanaSosialPercentage',
        'shuDanaPembangunanPercentage',
        'shuAnggotaSimpananRatio',
        'shuAnggotaPinjamanRatio',
      ]);

    const settingsMap = new Map((shuSettings || []).map(s => [s.key, s.value]));

    const pengurusPercent = Number(settingsMap.get('shuPengurusPercentage') ?? 10) / 100;
    const pengawasPercent = Number(settingsMap.get('shuPengawasPercentage') ?? 5) / 100;
    const penasihatPercent = Number(settingsMap.get('shuPenasihatPercentage') ?? 5) / 100;
    const anggotaPercent = Number(settingsMap.get('shuAnggotaPercentage') ?? 40) / 100;
    const danaCadanganPercent = Number(settingsMap.get('shuDanaCadanganPercentage') ?? 25) / 100;
    const danaPendidikanPercent = Number(settingsMap.get('shuDanaPendidikanPercentage') ?? 5) / 100;
    const danaSosialPercent = Number(settingsMap.get('shuDanaSosialPercentage') ?? 5) / 100;
    const danaPembangunanPercent = Number(settingsMap.get('shuDanaPembangunanPercentage') ?? 5) / 100;
    const simpananRatio = Number(settingsMap.get('shuAnggotaSimpananRatio') ?? 50) / 100;
    const pinjamanRatio = Number(settingsMap.get('shuAnggotaPinjamanRatio') ?? 50) / 100;

    // Calculate distributions
    const shuPengurus = Math.round(shuBruto * pengurusPercent);
    const shuPengawas = Math.round(shuBruto * pengawasPercent);
    const shuPenasihat = Math.round(shuBruto * penasihatPercent);
    const shuAnggotaTotal = Math.round(shuBruto * anggotaPercent);
    const danaCadangan = Math.round(shuBruto * danaCadanganPercent);
    const danaPendidikan = Math.round(shuBruto * danaPendidikanPercent);
    const danaSosial = Math.round(shuBruto * danaSosialPercent);
    const danaPembangunan = Math.round(shuBruto * danaPembangunanPercent);

    const shuAnggotaSimpanan = Math.round(shuAnggotaTotal * simpananRatio);
    const shuAnggotaPinjaman = Math.round(shuAnggotaTotal * pinjamanRatio);

    // Get role assignments for management distribution
    const { data: roleAssignments, error: roleError } = await supabase
      .from('role_assignments')
      .select('*');

    if (roleError) throw roleError;

    const roleDistributions: any[] = [];
    (roleAssignments || []).forEach(role => {
      let amount = 0;
      if (role.role === 'Pengurus' || role.role === 'Ketua' || role.role === 'Sekretaris' || role.role === 'Bendahara') {
        amount = Math.round(shuPengurus * (Number(role.share_percentage) / 100));
      } else if (role.role === 'Pengawas') {
        amount = Math.round(shuPengawas * (Number(role.share_percentage) / 100));
      } else if (role.role === 'Penasihat') {
        amount = Math.round(shuPenasihat * (Number(role.share_percentage) / 100));
      }
      
      if (amount > 0) {
        roleDistributions.push({
          roleId: role.id,
          role: role.role,
          name: role.name,
          memberId: role.member_id,
          isMember: role.is_member,
          sharePercentage: role.share_percentage,
          amount,
        });
      }
    });

    // Get all active members for SHU distribution
    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select('user_id, name, member_number')
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    if (membersError) throw membersError;

    // Get savings summaries
    const { data: savingsSummaries, error: savingsError } = await supabase
      .from('savings_summary')
      .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela, total_simpanan');

    if (savingsError) throw savingsError;

    const savingsMap = new Map(
      savingsSummaries?.map(s => [s.user_id, s]) || []
    );

    // Get loan interest paid by each member
    const { data: loanInstallments, error: loanError } = await supabase
      .from('loan_installments')
      .select('loan_id, interest_amount, paid_date')
      .eq('status', 'paid')
      .gte('paid_date', `${targetYear}-01-01`)
      .lte('paid_date', `${targetYear}-12-31`);

    if (loanError) throw loanError;

    // Get loans to map to users
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id, user_id');

    if (loansError) throw loansError;

    const loanUserMap = new Map(loans?.map(l => [l.id, l.user_id]) || []);

    // Calculate interest paid by user
    const interestByUser = new Map<string, number>();
    (loanInstallments || []).forEach(inst => {
      const userId = loanUserMap.get(inst.loan_id);
      if (userId) {
        const current = interestByUser.get(userId) || 0;
        interestByUser.set(userId, current + Number(inst.interest_amount));
      }
    });

    // Calculate total savings and interest
    const totalSavings = (members || []).reduce((sum, m) => {
      const savings = savingsMap.get(m.user_id);
      return sum + (Number(savings?.total_simpanan) || 0);
    }, 0);

    const totalInterestPaid = Array.from(interestByUser.values()).reduce((sum, v) => sum + v, 0);

    // Calculate member distributions
    const memberDistributions: any[] = [];
    (members || []).forEach(member => {
      const savings = savingsMap.get(member.user_id);
      const memberSavings = Number(savings?.total_simpanan) || 0;
      const memberInterest = interestByUser.get(member.user_id) || 0;

      // SHU from savings
      const shuFromSavings = totalSavings > 0 
        ? Math.round((memberSavings / totalSavings) * shuAnggotaSimpanan)
        : 0;

      // SHU from loan services
      const shuFromLoans = totalInterestPaid > 0
        ? Math.round((memberInterest / totalInterestPaid) * shuAnggotaPinjaman)
        : 0;

      const totalShu = shuFromSavings + shuFromLoans;

      if (totalShu > 0) {
        memberDistributions.push({
          userId: member.user_id,
          memberName: member.name,
          memberNumber: member.member_number,
          savings: memberSavings,
          interestPaid: memberInterest,
          shuFromSavings,
          shuFromLoans,
          totalShu,
        });
      }
    });

    // Create SHU distribution record (draft status for admin confirmation)
    const { data: distribution, error: distError } = await supabase
      .from('shu_distributions')
      .upsert({
        year: targetYear,
        shu_bruto: shuBruto,
        shu_pengurus: shuPengurus,
        shu_pengawas: shuPengawas,
        shu_penasihat: shuPenasihat,
        shu_anggota_total: shuAnggotaTotal,
        shu_anggota_simpanan: shuAnggotaSimpanan,
        shu_anggota_jasa_pinjaman: shuAnggotaPinjaman,
        dana_cadangan: danaCadangan,
        dana_pendidikan: danaPendidikan,
        dana_sosial: danaSosial,
        dana_pembangunan: danaPembangunan,
        member_distributions: memberDistributions,
        role_distributions: roleDistributions,
        status: 'draft',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'year' })
      .select()
      .single();

    if (distError) throw distError;

    // Create or update balance sheet for the year
    const { data: existingBalanceSheet } = await supabase
      .from('balance_sheets')
      .select('id')
      .eq('year', targetYear)
      .maybeSingle();

    // Get total member savings
    const totalSimpananPokok = savingsSummaries?.reduce((sum, s) => sum + Number(s.simpanan_pokok || 0), 0) || 0;
    const totalSimpananWajib = savingsSummaries?.reduce((sum, s) => sum + Number(s.simpanan_wajib || 0), 0) || 0;
    const totalSimpananSukarela = savingsSummaries?.reduce((sum, s) => sum + Number(s.simpanan_sukarela || 0), 0) || 0;

    // Get outstanding loans (piutang)
    const { data: activeLoans } = await supabase
      .from('loans')
      .select('remaining_principal')
      .in('status', ['active', 'pending']);

    const totalPiutang = (activeLoans || []).reduce((sum, l) => sum + Number(l.remaining_principal || 0), 0);

    const balanceSheetData = {
      year: targetYear,
      simpanan_pokok: totalSimpananPokok,
      simpanan_wajib: totalSimpananWajib,
      simpanan_sukarela: totalSimpananSukarela,
      dana_cadangan: danaCadangan,
      dana_pendidikan: danaPendidikan,
      dana_sosial: danaSosial,
      dana_pembangunan: danaPembangunan,
      piutang: totalPiutang,
      total_equity: totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela + danaCadangan + danaPendidikan + danaSosial + danaPembangunan,
      total_assets: totalPiutang,
      updated_at: new Date().toISOString(),
    };

    if (existingBalanceSheet) {
      await supabase
        .from('balance_sheets')
        .update(balanceSheetData)
        .eq('id', existingBalanceSheet.id);
    } else {
      await supabase
        .from('balance_sheets')
        .insert(balanceSheetData);
    }

    // Update auto_yearly_closing lastRun
    await supabase
      .from('cooperative_settings')
      .upsert({
        key: 'auto_yearly_closing',
        value: {
          enabled: true,
          lastRun: new Date().toISOString(),
          lastYear: targetYear,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    // ============ AUTO ROLLOVER SECTION ============
    // Check if auto rollover is enabled
    const { data: rolloverSetting } = await supabase
      .from('cooperative_settings')
      .select('value')
      .eq('key', 'auto_shu_rollover')
      .maybeSingle();

    const isRolloverEnabled = rolloverSetting?.value?.enabled === true;
    let rolloverResult = null;

    if (isRolloverEnabled) {
      console.log(`Processing auto rollover from ${targetYear} to ${targetYear + 1}`);

      // Check if rollover already exists
      const { data: existingRollover } = await supabase
        .from('shu_rollover_history')
        .select('id')
        .eq('from_year', targetYear)
        .eq('to_year', targetYear + 1)
        .maybeSingle();

      if (!existingRollover) {
        // Get withheld SHU data
        const { data: withheldData } = await supabase
          .from('shu_withheld')
          .select('id, shu_amount')
          .eq('year', targetYear)
          .eq('status', 'withheld');

        const withheldTotal = (withheldData || []).reduce((sum, item) => sum + Number(item.shu_amount), 0);
        const withheldCount = withheldData?.length || 0;

        const totalRolloverAmount = danaCadangan + danaPendidikan + danaSosial + danaPembangunan + withheldTotal;

        if (totalRolloverAmount > 0) {
          // Generate journal entry number
          const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');

          // Create rollover journal entry
          const { data: journalEntry, error: journalError } = await supabase
            .from('journal_entries')
            .insert({
              entry_number: entryNumber || `JRN-ROLLOVER-${targetYear}`,
              entry_date: `${targetYear + 1}-01-01`,
              description: `Saldo Awal - Rollover SHU dari Tahun ${targetYear}`,
              status: 'approved',
              total_debit: totalRolloverAmount,
              total_credit: totalRolloverAmount,
              is_balanced: true,
              reference_type: 'rollover',
              approved_at: new Date().toISOString()
            })
            .select('id')
            .single();

          let journalId = null;
          if (!journalError && journalEntry) {
            journalId = journalEntry.id;

            // Get chart of accounts for journal lines
            const { data: accounts } = await supabase
              .from('chart_of_accounts')
              .select('id, account_code')
              .in('account_code', ['3-1010', '3-1020', '3-1030', '3-1040', '2-3050', '3-0000']);

            if (accounts && accounts.length > 0) {
              const accountMap = accounts.reduce((map, acc) => {
                map[acc.account_code] = acc.id;
                return map;
              }, {} as Record<string, string>);

              const journalLines = [];

              if (danaCadangan > 0 && accountMap['3-1010']) {
                journalLines.push({
                  journal_entry_id: journalId,
                  account_id: accountMap['3-1010'],
                  debit_amount: danaCadangan,
                  credit_amount: 0,
                  description: 'Rollover Dana Cadangan'
                });
              }

              if (danaPendidikan > 0 && accountMap['3-1020']) {
                journalLines.push({
                  journal_entry_id: journalId,
                  account_id: accountMap['3-1020'],
                  debit_amount: danaPendidikan,
                  credit_amount: 0,
                  description: 'Rollover Dana Pendidikan'
                });
              }

              if (danaSosial > 0 && accountMap['3-1030']) {
                journalLines.push({
                  journal_entry_id: journalId,
                  account_id: accountMap['3-1030'],
                  debit_amount: danaSosial,
                  credit_amount: 0,
                  description: 'Rollover Dana Sosial'
                });
              }

              if (danaPembangunan > 0 && accountMap['3-1040']) {
                journalLines.push({
                  journal_entry_id: journalId,
                  account_id: accountMap['3-1040'],
                  debit_amount: danaPembangunan,
                  credit_amount: 0,
                  description: 'Rollover Dana Pembangunan'
                });
              }

              if (withheldTotal > 0 && accountMap['2-3050']) {
                journalLines.push({
                  journal_entry_id: journalId,
                  account_id: accountMap['2-3050'],
                  debit_amount: withheldTotal,
                  credit_amount: 0,
                  description: `Rollover SHU Ditahan (${withheldCount} anggota)`
                });
              }

              if (accountMap['3-0000'] && totalRolloverAmount > 0) {
                journalLines.push({
                  journal_entry_id: journalId,
                  account_id: accountMap['3-0000'],
                  debit_amount: 0,
                  credit_amount: totalRolloverAmount,
                  description: 'Saldo Awal Rollover'
                });
              }

              if (journalLines.length > 0) {
                await supabase.from('journal_entry_lines').insert(journalLines);
              }
            }
          }

          // Insert rollover history record
          const { error: rolloverHistoryError } = await supabase
            .from('shu_rollover_history')
            .insert({
              from_year: targetYear,
              to_year: targetYear + 1,
              dana_cadangan_rollover: danaCadangan,
              dana_pendidikan_rollover: danaPendidikan,
              dana_sosial_rollover: danaSosial,
              dana_pembangunan_rollover: danaPembangunan,
              shu_withheld_rollover: withheldTotal,
              withheld_members_count: withheldCount,
              total_rollover_amount: totalRolloverAmount,
              journal_entry_id: journalId,
              status: 'completed',
              notes: 'Auto rollover saat tutup buku tahunan'
            });

          if (!rolloverHistoryError) {
            // Update next year balance sheet with opening balances
            const { data: existingNextYearSheet } = await supabase
              .from('balance_sheets')
              .select('id')
              .eq('year', targetYear + 1)
              .maybeSingle();

            const rolloverBalanceData = {
              rolled_from_year: targetYear,
              rollover_date: new Date().toISOString(),
              shu_withheld_balance: withheldTotal,
              rollover_journal_id: journalId,
              saldo_awal_dana_cadangan: danaCadangan,
              saldo_awal_dana_pendidikan: danaPendidikan,
              saldo_awal_dana_sosial: danaSosial,
              saldo_awal_dana_pembangunan: danaPembangunan
            };

            if (existingNextYearSheet) {
              await supabase
                .from('balance_sheets')
                .update(rolloverBalanceData)
                .eq('id', existingNextYearSheet.id);
            } else {
              await supabase
                .from('balance_sheets')
                .insert({
                  year: targetYear + 1,
                  ...rolloverBalanceData,
                  dana_cadangan: danaCadangan,
                  dana_pendidikan: danaPendidikan,
                  dana_sosial: danaSosial,
                  dana_pembangunan: danaPembangunan
                });
            }

            rolloverResult = {
              success: true,
              fromYear: targetYear,
              toYear: targetYear + 1,
              totalAmount: totalRolloverAmount,
              withheldCount
            };

            console.log('Auto rollover completed:', rolloverResult);
          }
        }
      } else {
        console.log(`Rollover from ${targetYear} to ${targetYear + 1} already exists`);
      }
    }

    const result = {
      success: true,
      year: targetYear,
      shuBruto,
      totalIncome,
      totalExpense,
      memberCount: memberDistributions.length,
      status: 'draft',
      rollover: rolloverResult,
      message: `Tutup buku tahun ${targetYear} berhasil dibuat (draft). Silakan konfirmasi distribusi SHU di menu Akuntansi.`,
      processedAt: new Date().toISOString(),
    };

    console.log('Yearly closing completed:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Yearly closing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
