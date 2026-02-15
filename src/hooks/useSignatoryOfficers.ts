import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SIGNATORY_POSITIONS } from './useSHUCalculation';

export interface SignatoryOfficer {
  id: string;
  role_assignment_id: string;
  name: string;
  position: string;
  signature_base64: string | null;
  is_active: boolean;
}

export interface SignatureLayoutSettings {
  signature_layout: 'horizontal' | 'grid' | 'vertical';
  signature_alignment: 'left' | 'center' | 'right' | 'space-between';
  max_signatories_per_row: number;
  signature_position: 'bottom-left' | 'bottom-right' | 'bottom-center';
  signature_size: 'small' | 'medium' | 'large';
}

const DEFAULT_LAYOUT_SETTINGS: SignatureLayoutSettings = {
  signature_layout: 'horizontal',
  signature_alignment: 'right',
  max_signatories_per_row: 3,
  signature_position: 'bottom-right',
  signature_size: 'medium',
};

/**
 * Hook to fetch signatories from role_assignments table
 * Only returns officers with positions that can sign letters
 */
export const useSignatoryOfficers = () => {
  const [signatories, setSignatories] = useState<SignatoryOfficer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignatories = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch role assignments for pengurus with signatory positions
      const { data: assignments, error: assignmentError } = await supabase
        .from('role_assignments')
        .select('id, name, position')
        .eq('role', 'pengurus')
        .in('position', SIGNATORY_POSITIONS as unknown as string[])
        .order('position');

      if (assignmentError) throw assignmentError;

      if (!assignments || assignments.length === 0) {
        setSignatories([]);
        setLoading(false);
        return;
      }

      // Fetch signatures for these assignments
      const { data: signatures, error: sigError } = await supabase
        .from('signatory_signatures')
        .select('*')
        .in('role_assignment_id', assignments.map(a => a.id));

      if (sigError) throw sigError;

      // Map and merge data
      const signatoryList: SignatoryOfficer[] = assignments.map(assignment => {
        const sig = signatures?.find(s => s.role_assignment_id === assignment.id);
        return {
          id: sig?.id || assignment.id,
          role_assignment_id: assignment.id,
          name: assignment.name,
          position: assignment.position || '',
          signature_base64: sig?.signature_base64 || null,
          // Default to false if no entry exists - admin must explicitly activate
          is_active: sig?.is_active ?? false,
        };
      });

      // Sort by position priority
      const positionPriority: Record<string, number> = {
        'Ketua': 1,
        'Wakil Ketua': 2,
        'Sekretaris': 3,
        'Bendahara': 4,
      };
      signatoryList.sort((a, b) => {
        const pA = positionPriority[a.position] || 99;
        const pB = positionPriority[b.position] || 99;
        return pA - pB;
      });

      setSignatories(signatoryList);
    } catch (error) {
      console.error('Error fetching signatories:', error);
      setSignatories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update signature for an officer
  const updateSignature = async (roleAssignmentId: string, signatureBase64: string | null) => {
    try {
      // Upsert into signatory_signatures
      const { error } = await supabase
        .from('signatory_signatures')
        .upsert({
          role_assignment_id: roleAssignmentId,
          signature_base64: signatureBase64,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'role_assignment_id' });

      if (error) throw error;
      await fetchSignatories();
      return true;
    } catch (error) {
      console.error('Error updating signature:', error);
      return false;
    }
  };

  // Toggle signatory active status
  const toggleActive = async (roleAssignmentId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('signatory_signatures')
        .upsert({
          role_assignment_id: roleAssignmentId,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'role_assignment_id' });

      if (error) throw error;
      await fetchSignatories();
      return true;
    } catch (error) {
      console.error('Error toggling signatory status:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchSignatories();
  }, [fetchSignatories]);

  return {
    signatories,
    loading,
    refetch: fetchSignatories,
    updateSignature,
    toggleActive,
  };
};

/**
 * Hook to fetch letter template layout settings
 */
export const useSignatureLayout = (letterType: string) => {
  const [layoutSettings, setLayoutSettings] = useState<SignatureLayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLayout = async () => {
      if (!letterType) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('letter_templates')
          .select('signature_layout, signature_alignment, max_signatories_per_row, signature_position, signature_size')
          .eq('letter_type', letterType)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setLayoutSettings({
            signature_layout: (data.signature_layout as SignatureLayoutSettings['signature_layout']) || 'horizontal',
            signature_alignment: (data.signature_alignment as SignatureLayoutSettings['signature_alignment']) || 'right',
            max_signatories_per_row: data.max_signatories_per_row || 3,
            signature_position: (data.signature_position as SignatureLayoutSettings['signature_position']) || 'bottom-right',
            signature_size: (data.signature_size as SignatureLayoutSettings['signature_size']) || 'medium',
          });
        }
      } catch (error) {
        console.error('Error fetching layout settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLayout();
  }, [letterType]);

  return { layoutSettings, loading };
};

/**
 * Render signature block based on layout settings
 */
export const getSignatureContainerClasses = (
  layout: SignatureLayoutSettings['signature_layout'],
  alignment: SignatureLayoutSettings['signature_alignment'],
  maxPerRow: number
): string => {
  let classes = '';

  // Layout classes
  switch (layout) {
    case 'horizontal':
      classes = 'flex flex-wrap gap-4 sm:gap-6';
      break;
    case 'vertical':
      classes = 'flex flex-col gap-4';
      break;
    case 'grid':
      classes = `grid gap-4 sm:gap-6`;
      if (maxPerRow === 2) classes += ' grid-cols-2';
      else if (maxPerRow === 3) classes += ' grid-cols-2 sm:grid-cols-3';
      else classes += ' grid-cols-2 sm:grid-cols-4';
      break;
  }

  // Alignment classes
  switch (alignment) {
    case 'left':
      classes += ' justify-start';
      break;
    case 'center':
      classes += ' justify-center';
      break;
    case 'right':
      classes += ' justify-end';
      break;
    case 'space-between':
      classes += ' justify-between';
      break;
  }

  return classes;
};

/**
 * Get size classes for signature elements
 */
export const getSignatureSizeClasses = (size: SignatureLayoutSettings['signature_size']) => {
  switch (size) {
    case 'small': 
      return { 
        text: 'text-xs', 
        sig: 'h-10 w-20', 
        line: 'w-20', 
        stamp: 'h-14 w-14',
        name: 'text-[10px]'
      };
    case 'large': 
      return { 
        text: 'text-base', 
        sig: 'h-16 w-32', 
        line: 'w-32', 
        stamp: 'h-24 w-24',
        name: 'text-sm'
      };
    default: 
      return { 
        text: 'text-sm', 
        sig: 'h-14 w-28', 
        line: 'w-28', 
        stamp: 'h-20 w-20',
        name: 'text-xs'
      };
  }
};

export default useSignatoryOfficers;
