import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MemberProfile {
  id: string;
  user_id: string;
  name: string;
  member_number: string | null;
  join_date: string | null;
  created_at: string | null;
  is_active: boolean | null;
}

export const useMemberNumberRegeneration = () => {
  const [isRegenerating, setIsRegenerating] = useState(false);

  /**
   * Get member number prefix from cooperative settings
   */
  const getMemberNumberPrefix = async (): Promise<string> => {
    const { data } = await supabase
      .from('cooperative_settings')
      .select('value')
      .eq('key', 'member_number_prefix')
      .single();
    
    return (data?.value as string) || 'ANG';
  };

  /**
   * Generate new member number with sequential format
   * Format: PREFIX-YYYYMMDD-XXXX where XXXX is sequential number
   */
  const generateSequentialNumber = (
    prefix: string,
    joinDate: string | null,
    sequenceNumber: number
  ): string => {
    const date = joinDate ? new Date(joinDate) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const sequence = String(sequenceNumber).padStart(4, '0');
    
    return `${prefix}-${year}${month}${day}-${sequence}`;
  };

  /**
   * Regenerate member number for a single member
   */
  const regenerateSingleMemberNumber = async (
    userId: string,
    isAdmin: boolean = false
  ): Promise<string | null> => {
    setIsRegenerating(true);
    try {
      // Get prefix from cooperative settings
      const prefix = await getMemberNumberPrefix();
      
      // Get current member info
      const { data: member, error: memberError } = await supabase
        .from('profiles')
        .select('id, user_id, name, member_number, join_date, created_at')
        .eq('user_id', userId)
        .single();

      if (memberError) throw memberError;
      
      // Count existing members with same prefix and date to get sequence
      const joinDate = member.join_date || member.created_at;
      const date = joinDate ? new Date(joinDate) : new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get highest sequence for this prefix and date
      const { data: existingMembers, error: countError } = await supabase
        .from('profiles')
        .select('member_number')
        .like('member_number', `${prefix}-${dateStr}-%`)
        .neq('user_id', userId);

      if (countError) throw countError;

      // Find the highest sequence number
      let maxSequence = 0;
      (existingMembers || []).forEach(m => {
        if (m.member_number) {
          const parts = m.member_number.split('-');
          if (parts.length === 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSequence) {
              maxSequence = seq;
            }
          }
        }
      });

      const newNumber = generateSequentialNumber(prefix, joinDate, maxSequence + 1);

      // Update the member number
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ member_number: newNumber })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      toast.success(`Nomor anggota berhasil diperbarui menjadi ${newNumber}`);
      return newNumber;
    } catch (error: any) {
      console.error('Error regenerating member number:', error);
      toast.error(`Gagal regenerate nomor anggota: ${error.message}`);
      return null;
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * Regenerate all member numbers with sequential format
   * Groups by join date and assigns sequential numbers
   */
  const regenerateAllMemberNumbers = async (): Promise<boolean> => {
    setIsRegenerating(true);
    try {
      // Get prefix from cooperative settings
      const prefix = await getMemberNumberPrefix();
      
      // Get all active profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, name, member_number, join_date, created_at, is_active')
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      // Group profiles by date for sequential numbering
      const dateGroups: Record<string, MemberProfile[]> = {};

      (profiles || []).forEach(profile => {
        const joinDate = profile.join_date || profile.created_at;
        const date = joinDate ? new Date(joinDate) : new Date();
        const dateKey = date.toISOString().slice(0, 10).replace(/-/g, '');
        
        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push(profile);
      });

      // Generate new numbers for each profile using consistent prefix
      const updates: { userId: string; newNumber: string }[] = [];

      Object.entries(dateGroups).forEach(([dateKey, members]) => {
        // Assign sequential numbers to all members
        members.forEach((member, index) => {
          const newNumber = `${prefix}-${dateKey}-${String(index + 1).padStart(4, '0')}`;
          updates.push({ userId: member.user_id, newNumber });
        });
      });

      // Update all member numbers
      let successCount = 0;
      for (const update of updates) {
        const { error } = await supabase
          .from('profiles')
          .update({ member_number: update.newNumber })
          .eq('user_id', update.userId);

        if (!error) {
          successCount++;
        } else {
          console.error(`Failed to update member ${update.userId}:`, error);
        }
      }

      toast.success(`${successCount} nomor anggota berhasil diperbarui`);
      return true;
    } catch (error: any) {
      console.error('Error regenerating all member numbers:', error);
      toast.error(`Gagal regenerate nomor anggota: ${error.message}`);
      return false;
    } finally {
      setIsRegenerating(false);
    }
  };

  return {
    isRegenerating,
    regenerateSingleMemberNumber,
    regenerateAllMemberNumbers,
  };
};
