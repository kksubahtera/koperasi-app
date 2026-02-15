import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useJournalTemplates, createJournalFromTransaction, TemplateType } from './useJournalTemplates';
import { toast } from 'sonner';

export interface TransactionData {
  id: string;
  type: TemplateType;
  amount: number;
  user_id: string;
  memberName: string;
  installment_id?: string;
}

export interface InstallmentData {
  principal_amount: number;
  interest_amount: number;
  penalty_amount?: number;
}

export const useAutoJournalFromTransaction = () => {
  const { getTemplateByType, templates } = useJournalTemplates();

  // Create journal entry when transaction is approved
  const createJournalOnApproval = useCallback(async (
    transaction: TransactionData,
    installmentData?: InstallmentData
  ): Promise<{ success: boolean; journalId?: string; journalNumber?: string }> => {
    try {
      const template = getTemplateByType(transaction.type);
      
      if (!template) {
        console.warn(`No active template found for transaction type: ${transaction.type}`);
        return { success: false };
      }

      // Check if template is fully configured
      const unconfiguredLines = template.lines.filter(l => !l.accountId);
      if (unconfiguredLines.length > 0) {
        console.warn(`Template ${transaction.type} has unconfigured accounts`);
        return { success: false };
      }

      // Get transaction type label for description
      const typeLabels: Record<TemplateType, string> = {
        simpanan_pokok: 'Simpanan Pokok',
        simpanan_wajib: 'Simpanan Wajib',
        simpanan_sukarela: 'Simpanan Sukarela',
        setor_simpanan_wajib: 'Setor Simpanan Wajib',
        setor_simpanan_sukarela: 'Setor Simpanan Sukarela',
        penarikan_simpanan_sukarela: 'Penarikan Simpanan Sukarela',
        pencairan_pinjaman: 'Pencairan Pinjaman',
        bayar_angsuran_pinjaman: 'Pembayaran Angsuran',
        // Migration templates
        saldo_awal_pokok: 'Saldo Awal Simpanan Pokok',
        saldo_awal_wajib: 'Saldo Awal Simpanan Wajib',
        saldo_awal_sukarela: 'Saldo Awal Simpanan Sukarela',
        saldo_awal_pinjaman: 'Saldo Awal Pinjaman',
      };

      const description = typeLabels[transaction.type] || transaction.type;

      // Handle installment data for loan payments
      const additionalData = transaction.type === 'bayar_angsuran_pinjaman' && installmentData
        ? {
            principalAmount: installmentData.principal_amount,
            interestAmount: installmentData.interest_amount,
            penaltyAmount: installmentData.penalty_amount || 0,
          }
        : undefined;

      const journalEntry = await createJournalFromTransaction(
        transaction.type,
        transaction.amount,
        description,
        transaction.memberName,
        template,
        undefined, // businessUnitId
        additionalData
      );

      if (journalEntry) {
        // Update transaction with reference to journal entry
        await supabase
          .from('transactions')
          .update({ notes: `Jurnal: ${journalEntry.entry_number}` })
          .eq('id', transaction.id);

        return {
          success: true,
          journalId: journalEntry.id,
          journalNumber: journalEntry.entry_number,
        };
      }

      return { success: false };
    } catch (error) {
      console.error('Error creating auto journal:', error);
      return { success: false };
    }
  }, [getTemplateByType]);

  // Get installment data for loan payment transactions
  const getInstallmentData = useCallback(async (installmentId: string): Promise<InstallmentData | null> => {
    const { data, error } = await supabase
      .from('loan_installments')
      .select('principal_amount, interest_amount, penalty_amount')
      .eq('id', installmentId)
      .single();

    if (error || !data) {
      console.error('Error fetching installment data:', error);
      return null;
    }

    return {
      principal_amount: data.principal_amount,
      interest_amount: data.interest_amount,
      penalty_amount: data.penalty_amount || 0,
    };
  }, []);

  // Check if template is ready for a given transaction type
  const isTemplateReady = useCallback((type: TemplateType): boolean => {
    const template = templates.find(t => t.type === type && t.isActive);
    if (!template) return false;
    return template.lines.every(l => l.accountId);
  }, [templates]);

  // Get configured template count
  const getTemplateStats = useCallback(() => {
    const activeTemplates = templates.filter(t => t.isActive);
    const configuredTemplates = activeTemplates.filter(t => 
      t.lines.every(l => l.accountId)
    );
    return {
      total: activeTemplates.length,
      configured: configuredTemplates.length,
      unconfigured: activeTemplates.length - configuredTemplates.length,
    };
  }, [templates]);

  return {
    createJournalOnApproval,
    getInstallmentData,
    isTemplateReady,
    getTemplateStats,
  };
};
