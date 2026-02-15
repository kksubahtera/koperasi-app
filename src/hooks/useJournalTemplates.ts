import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useChartOfAccounts } from './useChartOfAccounts';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export type TemplateType = 
  | 'simpanan_pokok' 
  | 'simpanan_wajib' 
  | 'simpanan_sukarela'
  | 'setor_simpanan_wajib'
  | 'setor_simpanan_sukarela'
  | 'penarikan_simpanan_sukarela'
  | 'pencairan_pinjaman'
  | 'bayar_angsuran_pinjaman'
  // Migration templates
  | 'saldo_awal_pokok'
  | 'saldo_awal_wajib'
  | 'saldo_awal_sukarela'
  | 'saldo_awal_pinjaman';

export interface JournalTemplateLine {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  isDebit: boolean;
  description: string;
}

export interface JournalTemplate {
  id: string;
  type: TemplateType;
  name: string;
  description: string;
  lines: JournalTemplateLine[];
  isActive: boolean;
}

// Mapping between template line descriptions and standard account codes
const TEMPLATE_ACCOUNT_MAPPING: Record<string, string[]> = {
  'Kas/Bank (penerimaan)': ['1-1100', '1-1000'],
  'Kas/Bank (pengeluaran)': ['1-1100', '1-1000'],
  'Kas/Bank (penerimaan total)': ['1-1100', '1-1000'],
  'Hutang Simpanan Pokok': ['2-1010'],
  'Hutang Simpanan Wajib': ['2-1020'],
  'Hutang Simpanan Sukarela': ['2-1030'],
  'Piutang Pinjaman Anggota': ['1-2000'],
  'Piutang Pinjaman (pokok)': ['1-2000'],
  'Pendapatan Bunga Pinjaman': ['4-1000'],
  'Pendapatan Denda Keterlambatan (jika ada)': ['4-2000'],
  'Beban Bunga Simpanan Sukarela (jika ada)': ['5-1000'],
  'Pengeluaran kas': ['1-1100', '1-1000'],
  'Modal Migrasi / Saldo Awal': ['3-9000', '3-0000'],
};

const findAccountByCodeArray = (codes: string[], accounts: any[]): any => {
  for (const code of codes) {
    const account = accounts.find(a => a.account_code === code && a.is_active);
    if (account) return account;
  }
  return null;
};

// Helper to convert database record to JournalTemplate
const dbRecordToTemplate = (record: any): JournalTemplate => {
  const lines = Array.isArray(record.lines) 
    ? record.lines 
    : (typeof record.lines === 'string' ? JSON.parse(record.lines) : []);
  
  return {
    id: record.id,
    type: record.type as TemplateType,
    name: record.name,
    description: record.description || '',
    lines: lines.map((line: any) => ({
      accountId: line.accountId || '',
      accountCode: line.accountCode,
      accountName: line.accountName,
      isDebit: line.isDebit,
      description: line.description,
    })),
    isActive: record.is_active ?? true,
  };
};

// Helper to convert JournalTemplate lines to database format
const linesToJson = (lines: JournalTemplateLine[]): Json => {
  return lines.map(line => ({
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    isDebit: line.isDebit,
    description: line.description,
  })) as Json;
};

export const useJournalTemplates = () => {
  const [templates, setTemplates] = useState<JournalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { accounts } = useChartOfAccounts();

  // Load templates from database
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('journal_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(data.map(dbRecordToTemplate));
      } else {
        // Initialize default templates if empty
        await supabase.rpc('initialize_journal_templates');
        // Reload after initialization
        const { data: newData } = await supabase
          .from('journal_templates')
          .select('*')
          .order('created_at', { ascending: true });
        if (newData) {
          setTemplates(newData.map(dbRecordToTemplate));
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Gagal memuat template jurnal');
    } finally {
      setLoading(false);
    }
  }, []);

  // Get current user ID for audit
  const getCurrentUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  // Auto-map templates when accounts are available
  const autoMapOnInit = useCallback(async () => {
    if (accounts.length === 0 || templates.length === 0) return;
    
    const needsMapping = templates.some(t => t.lines.some(l => !l.accountId));
    if (!needsMapping) return;

    let mappedCount = 0;
    const userId = await getCurrentUserId();
    
    for (const template of templates) {
      const newLines = template.lines.map(line => {
        if (line.accountId) return line;
        
        const targetCodes = TEMPLATE_ACCOUNT_MAPPING[line.description];
        if (!targetCodes) return line;
        
        const account = findAccountByCodeArray(targetCodes, accounts);
        if (account) {
          mappedCount++;
          return {
            ...line,
            accountId: account.id,
            accountCode: account.account_code,
            accountName: account.account_name,
          };
        }
        return line;
      });
      
      if (JSON.stringify(newLines) !== JSON.stringify(template.lines)) {
        await supabase
          .from('journal_templates')
          .update({ 
            lines: linesToJson(newLines),
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq('id', template.id);
      }
    }
    
    if (mappedCount > 0) {
      console.log(`Auto-mapped ${mappedCount} accounts to journal templates`);
      await loadTemplates();
    }
  }, [accounts, templates, loadTemplates]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!loading && accounts.length > 0 && templates.length > 0) {
      autoMapOnInit();
    }
  }, [loading, accounts.length, templates.length, autoMapOnInit]);

  const updateTemplate = async (templateId: string, updates: Partial<JournalTemplate>) => {
    try {
      const userId = await getCurrentUserId();
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.lines !== undefined) dbUpdates.lines = linesToJson(updates.lines);

      const { error } = await supabase
        .from('journal_templates')
        .update(dbUpdates)
        .eq('id', templateId);

      if (error) throw error;

      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, ...updates } : t
      ));
      toast.success('Template berhasil diperbarui');
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Gagal memperbarui template');
    }
  };

  const updateTemplateLine = async (templateId: string, lineIndex: number, accountId: string) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const account = accounts.find(a => a.id === accountId);
      const newLines = [...template.lines];
      newLines[lineIndex] = {
        ...newLines[lineIndex],
        accountId,
        accountCode: account?.account_code,
        accountName: account?.account_name,
      };

      const userId = await getCurrentUserId();
      const { error } = await supabase
        .from('journal_templates')
        .update({ 
          lines: linesToJson(newLines),
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', templateId);

      if (error) throw error;

      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, lines: newLines } : t
      ));
    } catch (error) {
      console.error('Error updating template line:', error);
      toast.error('Gagal memperbarui akun template');
    }
  };

  const toggleTemplate = async (templateId: string) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const userId = await getCurrentUserId();
      const newActive = !template.isActive;
      
      const { error } = await supabase
        .from('journal_templates')
        .update({ 
          is_active: newActive,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', templateId);

      if (error) throw error;

      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, isActive: newActive } : t
      ));
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Gagal mengubah status template');
    }
  };

  const getTemplateByType = (type: TemplateType): JournalTemplate | undefined => {
    return templates.find(t => t.type === type && t.isActive);
  };

  const resetToDefaults = async () => {
    try {
      const userId = await getCurrentUserId();
      
      // Delete all existing templates
      await supabase.from('journal_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Reinitialize defaults
      await supabase.rpc('initialize_journal_templates');
      
      // Log the reset action
      await supabase.from('journal_template_audit_logs').insert({
        action: 'reset',
        changed_by: userId,
        change_summary: 'Semua template jurnal direset ke konfigurasi default',
      });
      
      await loadTemplates();
      toast.success('Template direset ke default');
    } catch (error) {
      console.error('Error resetting templates:', error);
      toast.error('Gagal mereset template');
    }
  };

  const autoMapAccounts = useCallback(async () => {
    if (accounts.length === 0) {
      toast.error('Tidak ada akun tersedia untuk di-mapping');
      return { success: false, mapped: 0, total: 0 };
    }

    let mappedCount = 0;
    let totalLines = 0;
    const userId = await getCurrentUserId();

    for (const template of templates) {
      let hasChanges = false;
      const newLines = template.lines.map(line => {
        totalLines++;
        if (line.accountId) return line;

        const targetCodes = TEMPLATE_ACCOUNT_MAPPING[line.description];
        if (!targetCodes) return line;

        const account = findAccountByCodeArray(targetCodes, accounts);
        if (account) {
          mappedCount++;
          hasChanges = true;
          return {
            ...line,
            accountId: account.id,
            accountCode: account.account_code,
            accountName: account.account_name,
          };
        }
        return line;
      });

      if (hasChanges) {
        await supabase
          .from('journal_templates')
          .update({ 
            lines: linesToJson(newLines),
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq('id', template.id);
      }
    }

    // Log auto-map action
    if (mappedCount > 0) {
      await supabase.from('journal_template_audit_logs').insert({
        action: 'auto_map',
        changed_by: userId,
        change_summary: `Auto-mapping ${mappedCount} akun ke template jurnal`,
      });
    }

    await loadTemplates();

    if (mappedCount > 0) {
      toast.success(`${mappedCount} akun berhasil di-mapping ke template`);
    } else {
      toast.info('Tidak ada akun baru yang dapat di-mapping');
    }

    return { success: true, mapped: mappedCount, total: totalLines };
  }, [accounts, templates, loadTemplates]);

  const getAutoMappingStats = useCallback(() => {
    let totalLines = 0;
    let configuredLines = 0;
    let mappableLines = 0;

    templates.forEach(template => {
      template.lines.forEach(line => {
        totalLines++;
        if (line.accountId) {
          configuredLines++;
        } else {
          const targetCodes = TEMPLATE_ACCOUNT_MAPPING[line.description];
          if (targetCodes) {
            const account = findAccountByCodeArray(targetCodes, accounts);
            if (account) mappableLines++;
          }
        }
      });
    });

    return { totalLines, configuredLines, mappableLines, unconfiguredLines: totalLines - configuredLines };
  }, [accounts, templates]);

  const isTemplateFullyConfigured = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return false;
    return template.lines.slice(0, 2).every(line => !!line.accountId);
  }, [templates]);

  const getConfiguredTemplatesCount = useCallback(() => {
    return templates.filter(t => 
      t.isActive && t.lines.slice(0, 2).every(line => !!line.accountId)
    ).length;
  }, [templates]);

  return {
    templates,
    loading,
    updateTemplate,
    updateTemplateLine,
    toggleTemplate,
    getTemplateByType,
    resetToDefaults,
    refetch: loadTemplates,
    autoMapAccounts,
    getAutoMappingStats,
    isTemplateFullyConfigured,
    getConfiguredTemplatesCount,
  };
};

// Utility function to create journal entry from transaction
export const createJournalFromTransaction = async (
  transactionType: TemplateType,
  amount: number,
  description: string,
  memberName: string,
  template: JournalTemplate,
  businessUnitId?: string,
  additionalData?: {
    principalAmount?: number;
    interestAmount?: number;
    penaltyAmount?: number;
    savingsInterestAmount?: number;
  }
) => {
  try {
    const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');
    if (!entryNumber) throw new Error('Failed to generate entry number');

    const requiredLines = template.lines.filter((_, idx) => idx < 2);
    const unconfiguredRequiredLines = requiredLines.filter(l => !l.accountId);
    if (unconfiguredRequiredLines.length > 0) {
      console.warn('Template has unconfigured required accounts, skipping auto-journal');
      return null;
    }

    let lines: { account_id: string; debit_amount: number; credit_amount: number; description: string }[] = [];
    
    if (transactionType === 'bayar_angsuran_pinjaman' && additionalData) {
      const { principalAmount = 0, interestAmount = 0, penaltyAmount = 0 } = additionalData;
      const totalAmount = principalAmount + interestAmount + penaltyAmount;
      
      const debitLine = template.lines.find(l => l.isDebit);
      const creditLines = template.lines.filter(l => !l.isDebit);
      
      if (debitLine?.accountId) {
        lines.push({
          account_id: debitLine.accountId,
          debit_amount: totalAmount,
          credit_amount: 0,
          description: `Penerimaan angsuran - ${memberName}`,
        });
      }
      
      if (creditLines[0]?.accountId && principalAmount > 0) {
        lines.push({
          account_id: creditLines[0].accountId,
          debit_amount: 0,
          credit_amount: principalAmount,
          description: `Angsuran pokok - ${memberName}`,
        });
      }
      
      if (creditLines[1]?.accountId && interestAmount > 0) {
        lines.push({
          account_id: creditLines[1].accountId,
          debit_amount: 0,
          credit_amount: interestAmount,
          description: `Pendapatan bunga pinjaman - ${memberName}`,
        });
      }
      
      if (creditLines[2]?.accountId && penaltyAmount > 0) {
        lines.push({
          account_id: creditLines[2].accountId,
          debit_amount: 0,
          credit_amount: penaltyAmount,
          description: `Pendapatan denda keterlambatan - ${memberName}`,
        });
      } else if (penaltyAmount > 0 && !creditLines[2]?.accountId) {
        if (creditLines[1]?.accountId) {
          const interestLineIdx = lines.findIndex(l => l.description.includes('Pendapatan bunga'));
          if (interestLineIdx >= 0) {
            lines[interestLineIdx].credit_amount += penaltyAmount;
            lines[interestLineIdx].description = `Pendapatan bunga + denda - ${memberName}`;
          }
        }
      }
      
    } else if (transactionType === 'penarikan_simpanan_sukarela' && additionalData?.savingsInterestAmount) {
      const { savingsInterestAmount = 0 } = additionalData;
      const totalAmount = amount + savingsInterestAmount;
      
      const debitLines = template.lines.filter(l => l.isDebit);
      const creditLine = template.lines.find(l => !l.isDebit);
      
      if (debitLines[0]?.accountId) {
        lines.push({
          account_id: debitLines[0].accountId,
          debit_amount: amount,
          credit_amount: 0,
          description: `Penarikan simpanan sukarela - ${memberName}`,
        });
      }
      
      if (debitLines[1]?.accountId && savingsInterestAmount > 0) {
        lines.push({
          account_id: debitLines[1].accountId,
          debit_amount: savingsInterestAmount,
          credit_amount: 0,
          description: `Beban bunga simpanan sukarela - ${memberName}`,
        });
      }
      
      if (creditLine?.accountId) {
        lines.push({
          account_id: creditLine.accountId,
          debit_amount: 0,
          credit_amount: totalAmount,
          description: `Pengeluaran kas - ${memberName}`,
        });
      }
      
    } else if (['saldo_awal_pokok', 'saldo_awal_wajib', 'saldo_awal_sukarela'].includes(transactionType)) {
      const debitLine = template.lines.find(l => l.isDebit);
      const creditLine = template.lines.find(l => !l.isDebit);
      
      if (debitLine?.accountId) {
        lines.push({
          account_id: debitLine.accountId,
          debit_amount: amount,
          credit_amount: 0,
          description: `Modal migrasi saldo awal - ${memberName}`,
        });
      }
      
      if (creditLine?.accountId) {
        const savingsTypeLabel = transactionType === 'saldo_awal_pokok' ? 'pokok' 
          : transactionType === 'saldo_awal_wajib' ? 'wajib' : 'sukarela';
        lines.push({
          account_id: creditLine.accountId,
          debit_amount: 0,
          credit_amount: amount,
          description: `Hutang simpanan ${savingsTypeLabel} - Saldo awal migrasi ${memberName}`,
        });
      }
    } else if (transactionType === 'saldo_awal_pinjaman') {
      const debitLine = template.lines.find(l => l.isDebit);
      const creditLine = template.lines.find(l => !l.isDebit);
      
      if (debitLine?.accountId) {
        lines.push({
          account_id: debitLine.accountId,
          debit_amount: amount,
          credit_amount: 0,
          description: `Piutang pinjaman - Saldo awal migrasi ${memberName}`,
        });
      }
      
      if (creditLine?.accountId) {
        lines.push({
          account_id: creditLine.accountId,
          debit_amount: 0,
          credit_amount: amount,
          description: `Modal migrasi saldo awal pinjaman - ${memberName}`,
        });
      }
    } else {
      template.lines.forEach(line => {
        if (line.accountId) {
          lines.push({
            account_id: line.accountId,
            debit_amount: line.isDebit ? amount : 0,
            credit_amount: !line.isDebit ? amount : 0,
            description: `${line.description} - ${memberName}`,
          });
        }
      });
    }

    if (lines.length === 0) {
      console.warn('No valid lines for journal entry');
      return null;
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debit_amount, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit_amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.error('Journal not balanced:', { totalDebit, totalCredit });
      return null;
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: new Date().toISOString().split('T')[0],
        description: `${description} - ${memberName}`,
        business_unit_id: businessUnitId || null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_balanced: true,
        status: 'posted',
        reference_type: 'transaction',
      })
      .select()
      .single();

    if (entryError) throw entryError;

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines.map(l => ({
        journal_entry_id: entry.id,
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
        description: l.description,
      })));

    if (linesError) throw linesError;

    for (const line of lines) {
      const account = await supabase
        .from('chart_of_accounts')
        .select('balance, account_type')
        .eq('id', line.account_id)
        .maybeSingle();

      if (account.data) {
        const currentBalance = account.data.balance || 0;
        const isDebitNormal = ['asset', 'expense'].includes(account.data.account_type);
        const balanceChange = line.debit_amount - line.credit_amount;
        const newBalance = isDebitNormal 
          ? currentBalance + balanceChange 
          : currentBalance - balanceChange;

        await supabase
          .from('chart_of_accounts')
          .update({ balance: newBalance })
          .eq('id', line.account_id);
      }
    }

    return entry;
  } catch (error) {
    console.error('Error creating journal from transaction:', error);
    return null;
  }
};
