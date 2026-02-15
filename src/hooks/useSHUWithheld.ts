import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSHUWithheldJournal } from './useSHUWithheldJournal';

export interface WithheldSHURecord {
  id: string;
  userId: string;
  year: number;
  shuAmount: number;
  simpananShare: number;
  jasaUsahaShare: number;
  arrearsAmount: number;
  withholdReason: 'arrears' | 'manual';
  manualExclusion: boolean;
  exclusionNote?: string;
  status: 'withheld' | 'released' | 'used_for_arrears';
  releasedAt?: string;
  releasedBy?: string;
  releasedAmount?: number;
  usedForArrears?: number;
}

export const useSHUWithheld = () => {
  const [loading, setLoading] = useState(false);
  const { createArrearsPaymentJournal, createReleaseJournal } = useSHUWithheldJournal();

  // Fetch withheld SHU for a user
  const fetchWithheldSHU = useCallback(async (userId: string): Promise<WithheldSHURecord[]> => {
    const { data, error } = await supabase
      .from('shu_withheld')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'withheld')
      .order('year', { ascending: false });

    if (error) {
      console.error('Error fetching withheld SHU:', error);
      return [];
    }

    return (data || []).map(record => ({
      id: record.id,
      userId: record.user_id,
      year: record.year,
      shuAmount: record.shu_amount,
      simpananShare: record.simpanan_share,
      jasaUsahaShare: record.jasa_usaha_share,
      arrearsAmount: record.arrears_amount,
      withholdReason: record.withhold_reason as 'arrears' | 'manual',
      manualExclusion: record.manual_exclusion,
      exclusionNote: record.exclusion_note || undefined,
      status: record.status as 'withheld' | 'released' | 'used_for_arrears',
      releasedAt: record.released_at || undefined,
      releasedBy: record.released_by || undefined,
      releasedAmount: record.released_amount || undefined,
      usedForArrears: record.used_for_arrears || undefined,
    }));
  }, []);

  // Get total withheld SHU for a user
  const getTotalWithheldSHU = useCallback(async (userId: string): Promise<number> => {
    const withheldRecords = await fetchWithheldSHU(userId);
    return withheldRecords.reduce((sum, record) => sum + record.shuAmount, 0);
  }, [fetchWithheldSHU]);

  // Save withheld SHU record
  const saveWithheldSHU = useCallback(async (record: {
    userId: string;
    year: number;
    shuAmount: number;
    simpananShare: number;
    jasaUsahaShare: number;
    arrearsAmount: number;
    withholdReason: 'arrears' | 'manual';
    manualExclusion: boolean;
    exclusionNote?: string;
  }) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('shu_withheld')
        .upsert({
          user_id: record.userId,
          year: record.year,
          shu_amount: record.shuAmount,
          simpanan_share: record.simpananShare,
          jasa_usaha_share: record.jasaUsahaShare,
          arrears_amount: record.arrearsAmount,
          withhold_reason: record.withholdReason,
          manual_exclusion: record.manualExclusion,
          exclusion_note: record.exclusionNote,
          status: 'withheld',
        }, {
          onConflict: 'user_id,year',
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving withheld SHU:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Release withheld SHU (when arrears are cleared) with automatic journal
  const releaseWithheldSHU = useCallback(async (
    userId: string,
    year: number,
    releasedBy: string,
    paymentMethod: 'cash' | 'bank' = 'bank'
  ) => {
    setLoading(true);
    try {
      const { data: record, error: fetchError } = await supabase
        .from('shu_withheld')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('status', 'withheld')
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!record) {
        toast.info('Tidak ada SHU ditahan untuk tahun ini');
        return false;
      }

      // Get member name for journal
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', userId)
        .single();
      
      const memberName = profile?.name || 'Anggota';

      // Update status to released
      const { error: updateError } = await supabase
        .from('shu_withheld')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          released_by: releasedBy,
          released_amount: record.shu_amount,
        })
        .eq('id', record.id);

      if (updateError) throw updateError;

      // Create SHU record for the member
      const { error: shuError } = await supabase
        .from('shu_records')
        .insert({
          user_id: userId,
          year: year,
          amount: record.shu_amount,
          notes: `SHU ditahan dirilis - Simpanan: ${record.simpanan_share}, Jasa Usaha: ${record.jasa_usaha_share}`,
          distributed_at: new Date().toISOString(),
        });

      if (shuError) console.error('Error creating SHU record:', shuError);

      // Create automatic journal entry for release
      const journalResult = await createReleaseJournal(
        userId,
        memberName,
        year,
        record.shu_amount,
        paymentMethod
      );

      if (journalResult.success && journalResult.journalNumber) {
        toast.success(`Jurnal ${journalResult.journalNumber} dibuat otomatis`);
      } else if (journalResult.error) {
        toast.warning('Jurnal tidak dibuat: ' + journalResult.error);
      }

      // Send notification to member
      await supabase.from('member_notifications').insert({
        user_id: userId,
        title: `SHU Tahun ${year} Telah Dibagikan`,
        message: `Selamat! SHU Anda yang sebelumnya ditahan karena tunggakan telah dibagikan sebesar Rp ${record.shu_amount.toLocaleString('id-ID')}.`,
        notification_type: 'shu_released',
        metadata: {
          year,
          amount: record.shu_amount,
          previously_withheld: true,
          journal_number: journalResult.journalNumber,
        },
      });

      toast.success('SHU berhasil dirilis');
      return true;
    } catch (error) {
      console.error('Error releasing withheld SHU:', error);
      toast.error('Gagal merilis SHU');
      return false;
    } finally {
      setLoading(false);
    }
  }, [createReleaseJournal]);

  // Use withheld SHU for resignation arrears payment with automatic journal
  const useWithheldSHUForArrears = useCallback(async (
    userId: string,
    arrearsToPayOff: number,
    memberName?: string
  ): Promise<{ totalUsed: number; remainingArrears: number }> => {
    setLoading(true);
    try {
      // Get all withheld SHU for user
      const withheldRecords = await fetchWithheldSHU(userId);
      
      if (withheldRecords.length === 0) {
        return { totalUsed: 0, remainingArrears: arrearsToPayOff };
      }

      // Get member name if not provided
      let name = memberName;
      if (!name) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', userId)
          .single();
        name = profile?.name || 'Anggota';
      }

      let remainingArrears = arrearsToPayOff;
      let totalUsed = 0;

      // Use withheld SHU to pay off arrears (oldest first)
      for (const record of withheldRecords.sort((a, b) => a.year - b.year)) {
        if (remainingArrears <= 0) break;

        const amountToUse = Math.min(record.shuAmount, remainingArrears);
        
        const { error } = await supabase
          .from('shu_withheld')
          .update({
            status: 'used_for_arrears',
            used_for_arrears: amountToUse,
            released_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (error) {
          console.error('Error updating withheld SHU:', error);
          continue;
        }

        // Create journal entry for each arrears payment
        const journalResult = await createArrearsPaymentJournal(
          userId,
          name!,
          record.year,
          amountToUse
        );

        if (journalResult.success && journalResult.journalNumber) {
          console.log(`Journal ${journalResult.journalNumber} created for arrears payment`);
        }

        totalUsed += amountToUse;
        remainingArrears -= amountToUse;
      }

      return { totalUsed, remainingArrears };
    } catch (error) {
      console.error('Error using withheld SHU for arrears:', error);
      return { totalUsed: 0, remainingArrears: arrearsToPayOff };
    } finally {
      setLoading(false);
    }
  }, [fetchWithheldSHU, createArrearsPaymentJournal]);

  // Toggle manual exclusion for a member
  const toggleManualExclusion = useCallback(async (
    userId: string,
    year: number,
    exclude: boolean,
    note?: string
  ) => {
    setLoading(true);
    try {
      if (exclude) {
        // Create or update withheld record with manual exclusion
        const { error } = await supabase
          .from('shu_withheld')
          .upsert({
            user_id: userId,
            year: year,
            manual_exclusion: true,
            exclusion_note: note,
            withhold_reason: 'manual',
            status: 'withheld',
          }, {
            onConflict: 'user_id,year',
          });

        if (error) throw error;
      } else {
        // Remove manual exclusion (but keep if has arrears)
        const { data: existing } = await supabase
          .from('shu_withheld')
          .select('arrears_amount')
          .eq('user_id', userId)
          .eq('year', year)
          .maybeSingle();

        if (existing && existing.arrears_amount > 0) {
          // Keep record but update reason
          await supabase
            .from('shu_withheld')
            .update({
              manual_exclusion: false,
              exclusion_note: null,
              withhold_reason: 'arrears',
            })
            .eq('user_id', userId)
            .eq('year', year);
        } else {
          // Delete record if no arrears
          await supabase
            .from('shu_withheld')
            .delete()
            .eq('user_id', userId)
            .eq('year', year);
        }
      }

      return true;
    } catch (error) {
      console.error('Error toggling manual exclusion:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    fetchWithheldSHU,
    getTotalWithheldSHU,
    saveWithheldSHU,
    releaseWithheldSHU,
    useWithheldSHUForArrears,
    toggleManualExclusion,
  };
};
