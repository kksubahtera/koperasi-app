import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SHUReconciliationDiscrepancy {
  userId: string;
  memberName: string;
  memberNumber: string | null;
  distributionAmount: number;  // From shu_distributions.member_distributions
  recordAmount: number;        // From shu_records
  difference: number;
  status: 'match' | 'mismatch' | 'missing_record' | 'orphan_record';
}

export interface SHUReconciliationResult {
  year: number;
  distributionStatus: 'confirmed' | 'draft' | 'not_found';
  totalFromDistribution: number;
  totalFromRecords: number;
  difference: number;
  matchRate: number;
  totalMembers: number;
  matchedCount: number;
  mismatchedCount: number;
  missingRecordsCount: number;
  orphanRecordsCount: number;
  discrepancies: SHUReconciliationDiscrepancy[];
  lastReconciled: string | null;
}

interface MemberDistributionEntry {
  userId: string;
  memberName: string;
  memberNumber?: string;
  simpananShare: number;
  jasaUsahaShare: number;
  totalShare: number;
}

export const useSHUReconciliation = (year: number) => {
  const [result, setResult] = useState<SHUReconciliationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const reconcile = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch confirmed distribution for the year
      const { data: distribution, error: distError } = await supabase
        .from('shu_distributions')
        .select('*')
        .eq('year', year)
        .single();

      if (distError && distError.code !== 'PGRST116') {
        throw distError;
      }

      // 2. Fetch all SHU records for the year
      const { data: records, error: recError } = await supabase
        .from('shu_records')
        .select('user_id, amount')
        .eq('year', year);

      if (recError) throw recError;

      // 3. If no distribution found
      if (!distribution) {
        // Only orphan records exist
        const orphanRecords = (records || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
        
        setResult({
          year,
          distributionStatus: 'not_found',
          totalFromDistribution: 0,
          totalFromRecords: orphanRecords,
          difference: -orphanRecords,
          matchRate: records?.length === 0 ? 100 : 0,
          totalMembers: records?.length || 0,
          matchedCount: 0,
          mismatchedCount: 0,
          missingRecordsCount: 0,
          orphanRecordsCount: records?.length || 0,
          discrepancies: (records || []).map(r => ({
            userId: r.user_id,
            memberName: 'Unknown',
            memberNumber: null,
            distributionAmount: 0,
            recordAmount: Number(r.amount || 0),
            difference: -Number(r.amount || 0),
            status: 'orphan_record' as const,
          })),
          lastReconciled: new Date().toISOString(),
        });
        return;
      }

      // 4. Parse member_distributions from JSONB
      const rawDistributions = distribution.member_distributions;
      const memberDistributions: MemberDistributionEntry[] = Array.isArray(rawDistributions)
        ? (rawDistributions as unknown as MemberDistributionEntry[])
        : [];

      // 5. Build maps for comparison
      const distMap = new Map<string, MemberDistributionEntry>();
      memberDistributions.forEach(m => {
        distMap.set(m.userId, m);
      });

      const recordMap = new Map<string, number>();
      (records || []).forEach(r => {
        const existing = recordMap.get(r.user_id) || 0;
        recordMap.set(r.user_id, existing + Number(r.amount || 0));
      });

      // 6. Calculate totals
      const totalFromDistribution = Number(distribution.shu_anggota_total || 0);
      const totalFromRecords = Array.from(recordMap.values()).reduce((sum, amt) => sum + amt, 0);

      // 7. Find discrepancies
      const discrepancies: SHUReconciliationDiscrepancy[] = [];
      const allUserIds = new Set([...distMap.keys(), ...recordMap.keys()]);
      
      let matchedCount = 0;
      let mismatchedCount = 0;
      let missingRecordsCount = 0;
      let orphanRecordsCount = 0;

      allUserIds.forEach(userId => {
        const distEntry = distMap.get(userId);
        const recordAmount = recordMap.get(userId) || 0;
        const distributionAmount = distEntry?.totalShare || 0;
        const diff = distributionAmount - recordAmount;

        if (distEntry && recordAmount > 0) {
          if (Math.abs(diff) < 1) { // Allow for rounding differences
            matchedCount++;
            // Don't add to discrepancies if matched
          } else {
            mismatchedCount++;
            discrepancies.push({
              userId,
              memberName: distEntry.memberName || 'Unknown',
              memberNumber: distEntry.memberNumber || null,
              distributionAmount,
              recordAmount,
              difference: diff,
              status: 'mismatch',
            });
          }
        } else if (distEntry && recordAmount === 0) {
          missingRecordsCount++;
          discrepancies.push({
            userId,
            memberName: distEntry.memberName || 'Unknown',
            memberNumber: distEntry.memberNumber || null,
            distributionAmount,
            recordAmount: 0,
            difference: distributionAmount,
            status: 'missing_record',
          });
        } else if (!distEntry && recordAmount > 0) {
          orphanRecordsCount++;
          discrepancies.push({
            userId,
            memberName: 'Unknown (Orphan)',
            memberNumber: null,
            distributionAmount: 0,
            recordAmount,
            difference: -recordAmount,
            status: 'orphan_record',
          });
        }
      });

      const totalMembers = allUserIds.size;
      const matchRate = totalMembers > 0 ? (matchedCount / totalMembers) * 100 : 100;

      setResult({
        year,
        distributionStatus: distribution.status === 'confirmed' ? 'confirmed' : 'draft',
        totalFromDistribution,
        totalFromRecords,
        difference: totalFromDistribution - totalFromRecords,
        matchRate,
        totalMembers,
        matchedCount,
        mismatchedCount,
        missingRecordsCount,
        orphanRecordsCount,
        discrepancies,
        lastReconciled: new Date().toISOString(),
      });

    } catch (error) {
      console.error('SHU Reconciliation error:', error);
      toast.error('Gagal melakukan rekonsiliasi SHU');
    } finally {
      setLoading(false);
    }
  }, [year]);

  // Auto-reconcile on mount and year change
  useEffect(() => {
    reconcile();
  }, [reconcile]);

  // Sync missing records from distribution
  const syncFromDistribution = useCallback(async (userIds?: string[]) => {
    if (!result) return;
    
    setSyncing(true);
    try {
      // Fetch distribution again to get fresh data
      const { data: distribution } = await supabase
        .from('shu_distributions')
        .select('member_distributions, confirmed_at')
        .eq('year', year)
        .eq('status', 'confirmed')
        .single();

      if (!distribution) {
        toast.error('Distribusi SHU belum dikonfirmasi untuk tahun ini');
        return;
      }

      const rawDistributions = distribution.member_distributions;
      const memberDistributions: MemberDistributionEntry[] = Array.isArray(rawDistributions)
        ? (rawDistributions as unknown as MemberDistributionEntry[])
        : [];

      // Filter to only missing records
      const toSync = memberDistributions.filter(m => {
        if (userIds && userIds.length > 0) {
          return userIds.includes(m.userId);
        }
        return result.discrepancies.some(
          d => d.userId === m.userId && d.status === 'missing_record'
        );
      });

      if (toSync.length === 0) {
        toast.info('Tidak ada data yang perlu disinkronkan');
        return;
      }

      // Insert missing records
      const recordsToInsert = toSync.map(m => ({
        user_id: m.userId,
        year,
        amount: m.totalShare,
        type: 'annual' as const,
        status: 'confirmed' as const,
        distributed_at: distribution.confirmed_at,
        description: `SHU Tahun ${year} (Sinkronisasi Rekonsiliasi)`,
      }));

      const { error } = await supabase
        .from('shu_records')
        .insert(recordsToInsert);

      if (error) throw error;

      toast.success(`Berhasil menyinkronkan ${toSync.length} data SHU`);
      
      // Re-reconcile
      await reconcile();

    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Gagal menyinkronkan data SHU');
    } finally {
      setSyncing(false);
    }
  }, [result, year, reconcile]);

  return {
    result,
    loading,
    syncing,
    reconcile,
    syncFromDistribution,
  };
};
