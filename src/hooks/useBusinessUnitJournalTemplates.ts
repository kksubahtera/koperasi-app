import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessUnits, BusinessUnit } from './useBusinessUnits';
import { useChartOfAccounts } from './useChartOfAccounts';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface BusinessUnitTemplateLine {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  isDebit: boolean;
  description: string;
}

export interface BusinessUnitJournalTemplate {
  id: string;
  businessUnitId: string;
  businessUnitCode: string;
  businessUnitName: string;
  transactionType: string;
  name: string;
  description: string;
  lines: BusinessUnitTemplateLine[];
  isActive: boolean;
}

// Transaction types per business unit
export const BUSINESS_UNIT_TRANSACTION_TYPES: Record<string, { value: string; label: string; debitDesc: string; creditDesc: string }[]> = {
  TK: [
    { value: 'purchase', label: 'Penjualan Toko', debitDesc: 'Kas/Bank (penerimaan)', creditDesc: 'Pendapatan Penjualan Toko' }
  ],
  PRD: [
    { value: 'deposit', label: 'Penerimaan Produk', debitDesc: 'Persediaan Produk', creditDesc: 'Hutang Produksi Anggota' }
  ],
  JS: [
    { value: 'service', label: 'Pendapatan Jasa', debitDesc: 'Kas/Bank (penerimaan)', creditDesc: 'Pendapatan Jasa' }
  ],
  PRW: [
    { value: 'ticket', label: 'Penjualan Tiket/Paket', debitDesc: 'Kas/Bank (penerimaan)', creditDesc: 'Pendapatan Pariwisata' }
  ],
};

// Default account mappings for business unit templates
const BUSINESS_UNIT_ACCOUNT_MAPPING: Record<string, string[]> = {
  'Kas/Bank (penerimaan)': ['1-1100', '1-1000'],
  'Pendapatan Penjualan Toko': ['4-3000', '4-1000'],
  'Persediaan Produk': ['1-3000', '1-1000'],
  'Hutang Produksi Anggota': ['2-2000', '2-1000'],
  'Pendapatan Jasa': ['4-4000', '4-1000'],
  'Pendapatan Pariwisata': ['4-5000', '4-1000'],
};

const findAccountByCodeArray = (codes: string[], accounts: any[]): any => {
  for (const code of codes) {
    const account = accounts.find(a => a.account_code === code && a.is_active);
    if (account) return account;
  }
  return null;
};

const dbRecordToTemplate = (record: any, unit: BusinessUnit): BusinessUnitJournalTemplate => {
  const lines = Array.isArray(record.lines)
    ? record.lines
    : (typeof record.lines === 'string' ? JSON.parse(record.lines) : []);

  return {
    id: record.id,
    businessUnitId: unit.id,
    businessUnitCode: unit.code,
    businessUnitName: unit.name,
    transactionType: record.type.replace(`bu_${unit.code.toLowerCase()}_`, ''),
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

const linesToJson = (lines: BusinessUnitTemplateLine[]): Json => {
  return lines.map(line => ({
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    isDebit: line.isDebit,
    description: line.description,
  })) as Json;
};

export const useBusinessUnitJournalTemplates = () => {
  const [templates, setTemplates] = useState<BusinessUnitJournalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { units } = useBusinessUnits();
  const { accounts } = useChartOfAccounts();

  const getTemplateTypeKey = (unitCode: string, transactionType: string) => {
    return `bu_${unitCode.toLowerCase()}_${transactionType}`;
  };

  // Generate default templates for a business unit
  const generateDefaultTemplates = useCallback((unit: BusinessUnit) => {
    const transactionTypes = BUSINESS_UNIT_TRANSACTION_TYPES[unit.code] || [
      { value: 'transaction', label: `Transaksi ${unit.name}`, debitDesc: 'Kas/Bank (penerimaan)', creditDesc: `Pendapatan ${unit.name}` }
    ];

    return transactionTypes.map(txType => ({
      type: getTemplateTypeKey(unit.code, txType.value),
      name: txType.label,
      description: `Template jurnal otomatis untuk ${txType.label.toLowerCase()} di unit ${unit.name}`,
      lines: [
        { accountId: '', isDebit: true, description: txType.debitDesc },
        { accountId: '', isDebit: false, description: txType.creditDesc },
      ],
      is_active: true,
    }));
  }, []);

  // Ensure templates exist for all business units (excluding SP which uses main templates)
  const ensureTemplatesExist = useCallback(async () => {
    const nonPrimaryUnits = units.filter(u => !u.is_primary && u.is_active);
    
    for (const unit of nonPrimaryUnits) {
      const expectedTemplates = generateDefaultTemplates(unit);
      
      for (const template of expectedTemplates) {
        // Check if template exists
        const { data: existing } = await supabase
          .from('journal_templates')
          .select('id')
          .eq('type', template.type)
          .maybeSingle();

        if (!existing) {
          // Create the template
          await supabase
            .from('journal_templates')
            .insert({
              type: template.type,
              name: template.name,
              description: template.description,
              lines: template.lines as Json,
              is_active: template.is_active,
            });
        }
      }
    }
  }, [units, generateDefaultTemplates]);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      
      // Wait for units to load
      if (units.length === 0) {
        setLoading(false);
        return;
      }

      // Ensure all required templates exist
      await ensureTemplatesExist();

      // Fetch all business unit templates (type starts with 'bu_')
      const { data, error } = await supabase
        .from('journal_templates')
        .select('*')
        .like('type', 'bu_%')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Map templates to their business units
      const mappedTemplates: BusinessUnitJournalTemplate[] = [];
      
      for (const record of data || []) {
        // Extract unit code from type (e.g., 'bu_tk_purchase' -> 'TK')
        const typeMatch = record.type.match(/^bu_([a-z]+)_/i);
        if (typeMatch) {
          const unitCode = typeMatch[1].toUpperCase();
          const unit = units.find(u => u.code === unitCode);
          if (unit) {
            mappedTemplates.push(dbRecordToTemplate(record, unit));
          }
        }
      }

      setTemplates(mappedTemplates);
    } catch (error) {
      console.error('Error loading business unit templates:', error);
      toast.error('Gagal memuat template jurnal unit usaha');
    } finally {
      setLoading(false);
    }
  }, [units, ensureTemplatesExist]);

  // Auto-map accounts to templates
  const autoMapAccounts = useCallback(async () => {
    if (accounts.length === 0) return { success: false, mapped: 0 };

    let mappedCount = 0;
    const { data: { user } } = await supabase.auth.getUser();

    const { data: dbTemplates } = await supabase
      .from('journal_templates')
      .select('*')
      .like('type', 'bu_%');

    for (const template of dbTemplates || []) {
      const lines = Array.isArray(template.lines) ? template.lines : JSON.parse(template.lines as string || '[]');
      let hasChanges = false;

      const newLines = lines.map((line: any) => {
        if (line.accountId) return line;

        const targetCodes = BUSINESS_UNIT_ACCOUNT_MAPPING[line.description];
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
            lines: newLines as Json,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          })
          .eq('id', template.id);
      }
    }

    if (mappedCount > 0) {
      await loadTemplates();
      toast.success(`${mappedCount} akun berhasil di-mapping ke template unit usaha`);
    }

    return { success: true, mapped: mappedCount };
  }, [accounts, loadTemplates]);

  useEffect(() => {
    if (units.length > 0) {
      loadTemplates();
    }
  }, [units, loadTemplates]);

  // Auto-map on init when accounts are loaded
  useEffect(() => {
    if (!loading && accounts.length > 0 && templates.length > 0) {
      const needsMapping = templates.some(t => t.lines.some(l => !l.accountId));
      if (needsMapping) {
        autoMapAccounts();
      }
    }
  }, [loading, accounts.length, templates.length, autoMapAccounts]);

  const updateTemplateLine = async (templateId: string, lineIndex: number, accountId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

      const { error } = await supabase
        .from('journal_templates')
        .update({
          lines: linesToJson(newLines),
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
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
      const { data: { user } } = await supabase.auth.getUser();
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const newActive = !template.isActive;

      const { error } = await supabase
        .from('journal_templates')
        .update({
          is_active: newActive,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
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

  const getTemplateByUnitAndType = (unitCode: string, transactionType: string): BusinessUnitJournalTemplate | undefined => {
    return templates.find(t =>
      t.businessUnitCode === unitCode &&
      t.transactionType === transactionType &&
      t.isActive
    );
  };

  const getTemplatesByUnit = (unitCode: string): BusinessUnitJournalTemplate[] => {
    return templates.filter(t => t.businessUnitCode === unitCode);
  };

  const isTemplateConfigured = (template: BusinessUnitJournalTemplate): boolean => {
    return template.lines.every(l => l.accountId);
  };

  const getConfiguredCount = (): { configured: number; total: number } => {
    const activeTemplates = templates.filter(t => t.isActive);
    const configured = activeTemplates.filter(t => isTemplateConfigured(t)).length;
    return { configured, total: activeTemplates.length };
  };

  // Create templates for a new business unit
  const createTemplatesForUnit = async (unit: BusinessUnit) => {
    const defaultTemplates = generateDefaultTemplates(unit);

    for (const template of defaultTemplates) {
      await supabase
        .from('journal_templates')
        .insert({
          type: template.type,
          name: template.name,
          description: template.description,
          lines: template.lines as Json,
          is_active: template.is_active,
        });
    }

    await loadTemplates();
    toast.success(`Template jurnal untuk ${unit.name} berhasil dibuat`);
  };

  return {
    templates,
    loading,
    updateTemplateLine,
    toggleTemplate,
    getTemplateByUnitAndType,
    getTemplatesByUnit,
    isTemplateConfigured,
    getConfiguredCount,
    autoMapAccounts,
    createTemplatesForUnit,
    refetch: loadTemplates,
  };
};

// Utility function to create journal entry from business unit transaction
export const createJournalFromBusinessUnitTransaction = async (
  businessUnitCode: string,
  transactionType: string,
  amount: number,
  description: string,
  memberName: string,
  template: BusinessUnitJournalTemplate,
  businessUnitId: string
) => {
  try {
    // Check if template is configured
    const unconfiguredLines = template.lines.filter(l => !l.accountId);
    if (unconfiguredLines.length > 0) {
      console.warn('Business unit template has unconfigured accounts, skipping auto-journal');
      return null;
    }

    const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');
    if (!entryNumber) throw new Error('Failed to generate entry number');

    const lines: { account_id: string; debit_amount: number; credit_amount: number; description: string }[] = [];

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
        description: `${template.name} - ${memberName}: ${description || ''}`.trim(),
        business_unit_id: businessUnitId,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_balanced: true,
        status: 'posted',
        reference_type: 'business_unit_transaction',
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

    // Update account balances
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
    console.error('Error creating journal from business unit transaction:', error);
    return null;
  }
};
