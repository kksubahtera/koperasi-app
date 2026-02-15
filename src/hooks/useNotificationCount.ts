import { useMemo } from 'react';
import { useUserLoans } from './useUserLoans';
import { useUserSavings } from './useUserSavings';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationCount {
  total: number;
  overdueInstallments: number;
  unpaidInstallments: number;
  underpaidSavings: number;
}

export const useNotificationCount = (): NotificationCount => {
  const { user } = useAuth();
  const { installments } = useUserLoans();
  const { savings } = useUserSavings();

  return useMemo(() => {
    if (!user) {
      return { total: 0, overdueInstallments: 0, unpaidInstallments: 0, underpaidSavings: 0 };
    }

    // Count overdue installments (with penalty)
    const overdueInstallments = installments.filter(
      inst => inst.status === 'overdue' || inst.status === 'partial'
    ).length;

    // Count unpaid installments (past due but no penalty yet)
    const unpaidInstallments = installments.filter(
      inst => inst.status === 'unpaid'
    ).length;

    // Check for underpaid mandatory savings
    const joinDate = new Date(user.joinDate);
    const today = new Date();
    const monthsJoined = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                         (today.getMonth() - joinDate.getMonth()) + 1;
    const expectedMonthlySaving = 50000; // Rp50,000 per month for simpanan wajib
    const expectedSimpananWajib = monthsJoined * expectedMonthlySaving;
    const underpaidSavings = savings.simpananWajib < expectedSimpananWajib ? 1 : 0;

    const total = overdueInstallments + unpaidInstallments + underpaidSavings;

    return { total, overdueInstallments, unpaidInstallments, underpaidSavings };
  }, [user, installments, savings]);
};
