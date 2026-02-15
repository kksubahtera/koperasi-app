import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type LetterType = 'loan_approval' | 'loan_settlement' | 'withdrawal' | 'resignation';
export type ResetPeriod = 'yearly' | 'monthly';
export type DynamicSource = 'static' | 'branch' | 'unit' | 'none';

export interface LetterNumberSettings {
  // Basic settings
  resetPeriod: ResetPeriod;
  loanApprovalPrefix: string;
  loanSettlementPrefix: string;
  withdrawalPrefix: string;
  resignationPrefix: string;
  numberFormat: 'prefix_first' | 'number_first' | 'custom';
  
  // Flexible format settings
  prefixGlobal: string;      // Circumfix start (static)
  suffixGlobal: string;      // Circumfix end (static)
  infix: string;             // Infix text (static or with placeholder)
  includeRomanMonth: boolean; // Toggle Roman month
  customFormat: string;       // Custom format template with placeholders
  
  // Dynamic source settings
  infixSource: DynamicSource;
  suffixSource: DynamicSource;
}

export interface LetterFormatContext {
  sequence: number;
  prefix: string;
  year: number;
  month: number | null;
  prefixGlobal: string;
  suffixGlobal: string;
  infix: string;
  branchCode?: string;
  branchName?: string;
  unitCode?: string;
  unitName?: string;
  includeRomanMonth: boolean;
}

export interface IssuedLetter {
  id: string;
  letter_number: string;
  letter_type: LetterType;
  reference_id: string;
  member_name: string;
  member_number: string | null;
  issued_date: string;
  issued_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LetterSequence {
  id: string;
  letter_type: string;
  year: number;
  month: number | null;
  current_sequence: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: LetterNumberSettings = {
  resetPeriod: 'yearly',
  loanApprovalPrefix: 'SP',
  loanSettlementPrefix: 'PL',
  withdrawalPrefix: 'PS',
  resignationPrefix: 'PD',
  numberFormat: 'number_first',
  // New flexible format defaults
  prefixGlobal: '',
  suffixGlobal: '',
  infix: '',
  includeRomanMonth: false,
  customFormat: '',
  infixSource: 'static',
  suffixSource: 'static',
};

// Helper function to convert month number to Roman numeral
export function getRomanMonth(month: number): string {
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romanNumerals[month - 1] || '';
}

// Format letter number using template with placeholders
export function formatLetterNumber(
  template: string,
  context: LetterFormatContext
): string {
  const { 
    sequence, prefix, year, month, 
    prefixGlobal, suffixGlobal, infix,
    branchCode, branchName, unitCode, unitName,
    includeRomanMonth 
  } = context;

  const replacements: Record<string, string> = {
    '{SEQ}': String(sequence).padStart(3, '0'),
    '{PREFIX}': prefix,
    '{YEAR}': String(year),
    '{YEAR_SHORT}': String(year).slice(-2),
    '{MONTH}': month && includeRomanMonth ? getRomanMonth(month) : '',
    '{MONTH_NUM}': month ? String(month).padStart(2, '0') : '',
    '{PREFIX_GLOBAL}': prefixGlobal || '',
    '{SUFFIX_GLOBAL}': suffixGlobal || '',
    '{INFIX}': infix || '',
    '{BRANCH_CODE}': branchCode || '',
    '{BRANCH_NAME}': branchName || '',
    '{UNIT_CODE}': unitCode || '',
    '{UNIT_NAME}': unitName || '',
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  // Clean up empty placeholders and double slashes
  result = result
    .replace(/\/+/g, '/') // Replace multiple slashes with single
    .replace(/^\/|\/$/g, '') // Remove leading/trailing slashes
    .replace(/\/{2,}/g, '/'); // Clean any remaining double slashes

  return result;
}

// Generate preview for a specific letter type
export function generatePreviewNumber(
  settings: LetterNumberSettings,
  letterType: LetterType,
  context?: {
    branchCode?: string;
    branchName?: string;
    unitCode?: string;
    unitName?: string;
  }
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = settings.resetPeriod === 'monthly' ? now.getMonth() + 1 : null;

  let prefix = 'SR';
  switch (letterType) {
    case 'loan_approval':
      prefix = settings.loanApprovalPrefix || 'SP';
      break;
    case 'loan_settlement':
      prefix = settings.loanSettlementPrefix || 'PL';
      break;
    case 'withdrawal':
      prefix = settings.withdrawalPrefix || 'PS';
      break;
    case 'resignation':
      prefix = settings.resignationPrefix || 'PD';
      break;
  }

  // Resolve dynamic infix
  let resolvedInfix = settings.infix || '';
  if (settings.infixSource === 'branch' && context?.branchCode) {
    resolvedInfix = context.branchCode;
  } else if (settings.infixSource === 'unit' && context?.unitCode) {
    resolvedInfix = context.unitCode;
  }

  // Resolve dynamic suffix
  let resolvedSuffix = settings.suffixGlobal || '';
  if (settings.suffixSource === 'branch' && context?.branchCode) {
    resolvedSuffix = context.branchCode;
  } else if (settings.suffixSource === 'unit' && context?.unitCode) {
    resolvedSuffix = context.unitCode;
  }

  // Use custom format if defined
  if (settings.numberFormat === 'custom' && settings.customFormat) {
    return formatLetterNumber(settings.customFormat, {
      sequence: 1,
      prefix,
      year,
      month,
      prefixGlobal: settings.prefixGlobal,
      suffixGlobal: resolvedSuffix,
      infix: resolvedInfix,
      branchCode: context?.branchCode,
      branchName: context?.branchName,
      unitCode: context?.unitCode,
      unitName: context?.unitName,
      includeRomanMonth: settings.includeRomanMonth,
    });
  }

  // Fallback to legacy format
  const seq = '001';
  const monthStr = settings.includeRomanMonth && month ? getRomanMonth(month) : null;

  if (settings.numberFormat === 'prefix_first') {
    return monthStr 
      ? `${prefix}/${seq}/${monthStr}/${year}`
      : `${prefix}/${seq}/${year}`;
  } else {
    return monthStr 
      ? `${seq}/${prefix}/${monthStr}/${year}`
      : `${seq}/${prefix}/${year}`;
  }
}

export const useLetterNumberSettings = () => {
  const [settings, setSettings] = useState<LetterNumberSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', [
          'letter_reset_period',
          'letter_loan_prefix',
          'letter_settlement_prefix',
          'letter_withdrawal_prefix',
          'letter_resignation_prefix',
          'letter_number_format',
          // New keys for flexible format
          'letter_prefix_global',
          'letter_suffix_global',
          'letter_infix',
          'letter_include_roman_month',
          'letter_custom_format',
          'letter_infix_source',
          'letter_suffix_source',
        ]);

      if (error) throw error;

      const settingsMap = new Map(data?.map(d => [d.key, d.value]) || []);

      setSettings({
        resetPeriod: (settingsMap.get('letter_reset_period') as ResetPeriod) || 'yearly',
        loanApprovalPrefix: (settingsMap.get('letter_loan_prefix') as string) || 'SP',
        loanSettlementPrefix: (settingsMap.get('letter_settlement_prefix') as string) || 'PL',
        withdrawalPrefix: (settingsMap.get('letter_withdrawal_prefix') as string) || 'PS',
        resignationPrefix: (settingsMap.get('letter_resignation_prefix') as string) || 'PD',
        numberFormat: (settingsMap.get('letter_number_format') as 'prefix_first' | 'number_first' | 'custom') || 'number_first',
        // New flexible format settings
        prefixGlobal: (settingsMap.get('letter_prefix_global') as string) || '',
        suffixGlobal: (settingsMap.get('letter_suffix_global') as string) || '',
        infix: (settingsMap.get('letter_infix') as string) || '',
        includeRomanMonth: (settingsMap.get('letter_include_roman_month') as boolean) || false,
        customFormat: (settingsMap.get('letter_custom_format') as string) || '',
        infixSource: (settingsMap.get('letter_infix_source') as DynamicSource) || 'static',
        suffixSource: (settingsMap.get('letter_suffix_source') as DynamicSource) || 'static',
      });
    } catch (error) {
      console.error('Error fetching letter number settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSettings = async (newSettings: LetterNumberSettings) => {
    try {
      const updates = [
        { key: 'letter_reset_period', value: newSettings.resetPeriod },
        { key: 'letter_loan_prefix', value: newSettings.loanApprovalPrefix },
        { key: 'letter_settlement_prefix', value: newSettings.loanSettlementPrefix },
        { key: 'letter_withdrawal_prefix', value: newSettings.withdrawalPrefix },
        { key: 'letter_resignation_prefix', value: newSettings.resignationPrefix },
        { key: 'letter_number_format', value: newSettings.numberFormat },
        // New flexible format settings
        { key: 'letter_prefix_global', value: newSettings.prefixGlobal },
        { key: 'letter_suffix_global', value: newSettings.suffixGlobal },
        { key: 'letter_infix', value: newSettings.infix },
        { key: 'letter_include_roman_month', value: newSettings.includeRomanMonth },
        { key: 'letter_custom_format', value: newSettings.customFormat },
        { key: 'letter_infix_source', value: newSettings.infixSource },
        { key: 'letter_suffix_source', value: newSettings.suffixSource },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('cooperative_settings')
          .upsert(
            { key: update.key, value: update.value as Json, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
        if (error) throw error;
      }

      setSettings(newSettings);
      toast.success('Pengaturan nomor surat berhasil disimpan');
      return true;
    } catch (error) {
      console.error('Error saving letter number settings:', error);
      toast.error('Gagal menyimpan pengaturan nomor surat');
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, saveSettings, refetch: fetchSettings };
};

export const useIssuedLetters = () => {
  const [letters, setLetters] = useState<IssuedLetter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLetters = useCallback(async (filters?: { letterType?: LetterType; year?: number }) => {
    setLoading(true);
    try {
      let query = supabase
        .from('issued_letters')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.letterType) {
        query = query.eq('letter_type', filters.letterType);
      }
      if (filters?.year) {
        query = query.gte('issued_date', `${filters.year}-01-01`)
          .lte('issued_date', `${filters.year}-12-31`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setLetters((data || []) as IssuedLetter[]);
    } catch (error) {
      console.error('Error fetching issued letters:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getExistingLetterNumber = async (referenceId: string, letterType: LetterType): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('issued_letters')
        .select('letter_number')
        .eq('reference_id', referenceId)
        .eq('letter_type', letterType)
        .maybeSingle();

      if (error) throw error;
      return data?.letter_number || null;
    } catch (error) {
      console.error('Error checking existing letter:', error);
      return null;
    }
  };

  const issueLetterNumber = async (
    letterType: LetterType,
    referenceId: string,
    memberName: string,
    memberNumber: string | null,
    metadata?: Record<string, string | number | boolean | null>,
    dynamicContext?: {
      branchId?: string;
      branchCode?: string;
      branchName?: string;
      unitId?: string;
      unitCode?: string;
      unitName?: string;
    }
  ): Promise<string | null> => {
    try {
      // Check if letter already exists for this reference
      const existing = await getExistingLetterNumber(referenceId, letterType);
      if (existing) {
        return existing;
      }

      // Get all settings including new flexible format settings
      const { data: settingsData } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', [
          'letter_reset_period', 
          'letter_loan_prefix', 
          'letter_settlement_prefix', 
          'letter_withdrawal_prefix', 
          'letter_resignation_prefix', 
          'letter_number_format',
          'letter_prefix_global',
          'letter_suffix_global',
          'letter_infix',
          'letter_include_roman_month',
          'letter_custom_format',
          'letter_infix_source',
          'letter_suffix_source',
        ]);

      const settingsMap = new Map(settingsData?.map(d => [d.key, d.value]) || []);
      const resetPeriod = (settingsMap.get('letter_reset_period') as ResetPeriod) || 'yearly';
      const numberFormat = (settingsMap.get('letter_number_format') as string) || 'number_first';
      const prefixGlobal = (settingsMap.get('letter_prefix_global') as string) || '';
      const suffixGlobal = (settingsMap.get('letter_suffix_global') as string) || '';
      const infix = (settingsMap.get('letter_infix') as string) || '';
      const includeRomanMonth = (settingsMap.get('letter_include_roman_month') as boolean) || false;
      const customFormat = (settingsMap.get('letter_custom_format') as string) || '';
      const infixSource = (settingsMap.get('letter_infix_source') as DynamicSource) || 'static';
      const suffixSource = (settingsMap.get('letter_suffix_source') as DynamicSource) || 'static';

      let prefix = 'SR';
      switch (letterType) {
        case 'loan_approval':
          prefix = (settingsMap.get('letter_loan_prefix') as string) || 'SP';
          break;
        case 'loan_settlement':
          prefix = (settingsMap.get('letter_settlement_prefix') as string) || 'PL';
          break;
        case 'withdrawal':
          prefix = (settingsMap.get('letter_withdrawal_prefix') as string) || 'PS';
          break;
        case 'resignation':
          prefix = (settingsMap.get('letter_resignation_prefix') as string) || 'PD';
          break;
      }

      // Get current date parts
      const now = new Date();
      const year = now.getFullYear();
      const month = resetPeriod === 'monthly' ? now.getMonth() + 1 : null;

      // Get or create sequence
      const { data: seqData } = await supabase
        .from('letter_sequences')
        .select('current_sequence')
        .eq('letter_type', letterType)
        .eq('year', year)
        .eq('month', month as number)
        .maybeSingle();

      let nextSeq = 1;
      if (seqData) {
        nextSeq = seqData.current_sequence + 1;
        await supabase
          .from('letter_sequences')
          .update({ current_sequence: nextSeq, updated_at: new Date().toISOString() })
          .eq('letter_type', letterType)
          .eq('year', year)
          .eq('month', month as number);
      } else {
        await supabase
          .from('letter_sequences')
          .insert({ letter_type: letterType, year, month, current_sequence: 1 });
      }

      // Resolve dynamic values
      let resolvedInfix = infix;
      if (infixSource === 'branch' && dynamicContext?.branchCode) {
        resolvedInfix = dynamicContext.branchCode;
      } else if (infixSource === 'unit' && dynamicContext?.unitCode) {
        resolvedInfix = dynamicContext.unitCode;
      }

      let resolvedSuffix = suffixGlobal;
      if (suffixSource === 'branch' && dynamicContext?.branchCode) {
        resolvedSuffix = dynamicContext.branchCode;
      } else if (suffixSource === 'unit' && dynamicContext?.unitCode) {
        resolvedSuffix = dynamicContext.unitCode;
      }

      // Format letter number
      let letterNumber: string;

      if (numberFormat === 'custom' && customFormat) {
        // Use custom format template
        letterNumber = formatLetterNumber(customFormat, {
          sequence: nextSeq,
          prefix,
          year,
          month,
          prefixGlobal,
          suffixGlobal: resolvedSuffix,
          infix: resolvedInfix,
          branchCode: dynamicContext?.branchCode,
          branchName: dynamicContext?.branchName,
          unitCode: dynamicContext?.unitCode,
          unitName: dynamicContext?.unitName,
          includeRomanMonth,
        });
      } else {
        // Use legacy format
        const seqStr = String(nextSeq).padStart(3, '0');
        const monthStr = includeRomanMonth && month ? getRomanMonth(month) : null;
        
        if (numberFormat === 'prefix_first') {
          letterNumber = monthStr 
            ? `${prefix}/${seqStr}/${monthStr}/${year}`
            : `${prefix}/${seqStr}/${year}`;
        } else {
          letterNumber = monthStr 
            ? `${seqStr}/${prefix}/${monthStr}/${year}`
            : `${seqStr}/${prefix}/${year}`;
        }
      }

      // Save to issued_letters
      const { data: userData } = await supabase.auth.getUser();
      
      const { error: insertError } = await supabase
        .from('issued_letters')
        .insert([{
          letter_number: letterNumber,
          letter_type: letterType,
          reference_id: referenceId,
          member_name: memberName,
          member_number: memberNumber,
          issued_by: userData.user?.id,
          metadata: {
            ...(metadata || {}),
            branch_id: dynamicContext?.branchId,
            branch_code: dynamicContext?.branchCode,
            unit_id: dynamicContext?.unitId,
            unit_code: dynamicContext?.unitCode,
          } as unknown as Json,
        }]);

      if (insertError) {
        // Handle unique constraint error - letter might already exist
        if (insertError.code === '23505') {
          const existing = await getExistingLetterNumber(referenceId, letterType);
          return existing;
        }
        throw insertError;
      }

      return letterNumber;
    } catch (error) {
      console.error('Error issuing letter number:', error);
      toast.error('Gagal membuat nomor surat');
      return null;
    }
  };

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  return { 
    letters, 
    loading, 
    fetchLetters, 
    issueLetterNumber, 
    getExistingLetterNumber 
  };
};

export const useLetterSequences = () => {
  const [sequences, setSequences] = useState<LetterSequence[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letter_sequences')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setSequences((data || []) as LetterSequence[]);
    } catch (error) {
      console.error('Error fetching letter sequences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  return { sequences, loading, refetch: fetchSequences };
};
