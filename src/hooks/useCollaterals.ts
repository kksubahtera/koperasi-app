import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Collateral {
  id: string;
  loan_id: string;
  collateral_type: string;
  collateral_description: string | null;
  estimated_value: number;
  document_number: string | null;
  custodian_admin_id: string | null;
  storage_location: string | null;
  received_date: string | null;
  returned_date: string | null;
  status: 'pending' | 'verified' | 'active' | 'returned' | 'forfeited';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollateralWithDetails extends Collateral {
  loan?: {
    id: string;
    principal_amount: number;
    status: string;
    user_id: string;
  };
  custodian?: {
    name: string;
    email: string;
  };
  member?: {
    name: string;
    member_number: string;
  };
}

export function useCollaterals(loanId?: string) {
  const [collaterals, setCollaterals] = useState<CollateralWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCollaterals = useCallback(async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('loan_collaterals')
        .select('*')
        .order('created_at', { ascending: false });

      if (loanId) {
        query = query.eq('loan_id', loanId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch related data
      const collateralsWithDetails: CollateralWithDetails[] = [];
      
      for (const collateral of data || []) {
        const detailedCollateral: CollateralWithDetails = { ...collateral } as CollateralWithDetails;
        
        // Fetch loan details
        const { data: loanData } = await supabase
          .from('loans')
          .select('id, principal_amount, status, user_id')
          .eq('id', collateral.loan_id)
          .single();
        
        if (loanData) {
          detailedCollateral.loan = loanData;
          
          // Fetch member details
          const { data: memberData } = await supabase
            .from('profiles')
            .select('name, member_number')
            .eq('user_id', loanData.user_id)
            .single();
          
          if (memberData) {
            detailedCollateral.member = memberData;
          }
        }
        
        // Fetch custodian details
        if (collateral.custodian_admin_id) {
          const { data: custodianData } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('user_id', collateral.custodian_admin_id)
            .single();
          
          if (custodianData) {
            detailedCollateral.custodian = custodianData;
          }
        }
        
        collateralsWithDetails.push(detailedCollateral);
      }

      setCollaterals(collateralsWithDetails);
    } catch (err) {
      console.error('Error fetching collaterals:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [loanId]);

  const createCollateral = async (collateralData: {
    loan_id: string;
    collateral_type: string;
    collateral_description?: string;
    estimated_value?: number;
    document_number?: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('loan_collaterals')
        .insert({
          loan_id: collateralData.loan_id,
          collateral_type: collateralData.collateral_type,
          collateral_description: collateralData.collateral_description || null,
          estimated_value: collateralData.estimated_value || 0,
          document_number: collateralData.document_number || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Update loan to indicate it requires collateral
      await supabase
        .from('loans')
        .update({ 
          requires_collateral: true,
          collateral_status: 'submitted'
        })
        .eq('id', collateralData.loan_id);

      await fetchCollaterals();
      return { success: true, data };
    } catch (err) {
      console.error('Error creating collateral:', err);
      return { success: false, error: err };
    }
  };

  const verifyCollateral = async (
    collateralId: string, 
    custodianAdminId: string, 
    storageLocation: string
  ) => {
    try {
      const { error } = await supabase
        .from('loan_collaterals')
        .update({
          custodian_admin_id: custodianAdminId,
          storage_location: storageLocation,
          received_date: new Date().toISOString().split('T')[0],
          status: 'verified'
        })
        .eq('id', collateralId);

      if (error) throw error;

      // Get loan_id to update loan status
      const collateral = collaterals.find(c => c.id === collateralId);
      if (collateral) {
        await supabase
          .from('loans')
          .update({ collateral_status: 'verified' })
          .eq('id', collateral.loan_id);
      }

      await fetchCollaterals();
      return { success: true };
    } catch (err) {
      console.error('Error verifying collateral:', err);
      return { success: false, error: err };
    }
  };

  const activateCollateral = async (collateralId: string) => {
    try {
      const { error } = await supabase
        .from('loan_collaterals')
        .update({ status: 'active' })
        .eq('id', collateralId);

      if (error) throw error;

      await fetchCollaterals();
      return { success: true };
    } catch (err) {
      console.error('Error activating collateral:', err);
      return { success: false, error: err };
    }
  };

  const returnCollateral = async (collateralId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('loan_collaterals')
        .update({
          status: 'returned',
          returned_date: new Date().toISOString().split('T')[0],
          notes: notes || null
        })
        .eq('id', collateralId);

      if (error) throw error;

      // Get loan_id to update loan status
      const collateral = collaterals.find(c => c.id === collateralId);
      if (collateral) {
        await supabase
          .from('loans')
          .update({ collateral_status: 'returned' })
          .eq('id', collateral.loan_id);
      }

      await fetchCollaterals();
      return { success: true };
    } catch (err) {
      console.error('Error returning collateral:', err);
      return { success: false, error: err };
    }
  };

  const updateCollateral = async (collateralId: string, updates: Partial<Collateral>) => {
    try {
      const { error } = await supabase
        .from('loan_collaterals')
        .update(updates)
        .eq('id', collateralId);

      if (error) throw error;

      await fetchCollaterals();
      return { success: true };
    } catch (err) {
      console.error('Error updating collateral:', err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchCollaterals();
  }, [fetchCollaterals]);

  return {
    collaterals,
    isLoading,
    error,
    createCollateral,
    verifyCollateral,
    activateCollateral,
    returnCollateral,
    updateCollateral,
    refetch: fetchCollaterals
  };
}
