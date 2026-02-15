import { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  ShoppingCart,
  Package,
  Wrench,
  Ticket,
  Building2,
  Settings2,
  LucideIcon,
} from 'lucide-react';
import { LoanManagement } from './LoanManagement';
import { BusinessUnitTransactions } from './BusinessUnitTransactions';
import { BusinessUnitsManagement } from './accounting/BusinessUnitsManagement';
import { useBusinessUnits, BusinessUnit } from '@/hooks/useBusinessUnits';
import { TabNavigation, TabItem } from '@/components/shared/TabNavigation';
import { supabase } from '@/integrations/supabase/client';

// Default units sebagai fallback jika database kosong
const DEFAULT_UNITS: BusinessUnit[] = [
  {
    id: 'default-sp',
    code: 'SP',
    name: 'Simpan Pinjam',
    description: 'Unit usaha simpan pinjam koperasi',
    is_active: true,
    is_primary: true,
    display_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'default-tk',
    code: 'TK',
    name: 'Toko',
    description: 'Unit usaha toko koperasi',
    is_active: true,
    is_primary: false,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'default-prd',
    code: 'PRD',
    name: 'Produksi',
    description: 'Unit usaha produksi koperasi',
    is_active: true,
    is_primary: false,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'default-js',
    code: 'JS',
    name: 'Jasa',
    description: 'Unit usaha jasa koperasi',
    is_active: true,
    is_primary: false,
    display_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'default-prw',
    code: 'PRW',
    name: 'Pariwisata',
    description: 'Unit usaha pariwisata koperasi',
    is_active: true,
    is_primary: false,
    display_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const getUnitIcon = (code: string): LucideIcon => {
  switch (code) {
    case 'SP':
      return CreditCard;
    case 'TK':
      return ShoppingCart;
    case 'PRD':
      return Package;
    case 'JS':
      return Wrench;
    case 'PRW':
      return Ticket;
    default:
      return Building2;
  }
};

export const BusinessUnitsHub = () => {
  const { units, loading, refetch } = useBusinessUnits();
  const [activeUnit, setActiveUnit] = useState('SP');

  // Subscribe to realtime changes for business_units table
  useEffect(() => {
    const channel = supabase
      .channel('business-units-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_units',
        },
        () => {
          // Refetch when any change happens
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Sort units: SP (primary) first, then by display_order. Use fallback if database empty
  const sortedUnits = useMemo(() => {
    const sourceUnits = units.length > 0 ? units : DEFAULT_UNITS;
    
    return [...sourceUnits].sort((a, b) => {
      // Primary selalu di posisi pertama
      if (a.is_primary) return -1;
      if (b.is_primary) return 1;
      // Sisanya berdasarkan display_order
      const orderA = a.display_order ?? 999;
      const orderB = b.display_order ?? 999;
      return orderA - orderB;
    });
  }, [units]);

  // Filter only active units
  const activeUnits = useMemo(() => sortedUnits.filter(u => u.is_active), [sortedUnits]);

  // Build tabs dynamically
  const unitTabs: TabItem[] = useMemo(() => {
    const tabs: TabItem[] = activeUnits.map(unit => ({
      value: unit.code,
      icon: getUnitIcon(unit.code),
      label: unit.name,
      tooltip: unit.description || unit.name,
      badge: unit.is_primary ? 'Utama' : undefined,
    }));

    // Add Settings/Management tab
    tabs.push({
      value: 'SETTINGS',
      icon: Settings2,
      label: 'Kelola',
      tooltip: 'Kelola unit usaha',
    });
    
    return tabs;
  }, [activeUnits]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Unit Usaha Koperasi
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Kelola pinjaman dan transaksi unit usaha lainnya
        </p>
      </div>

      <TabNavigation
        tabs={unitTabs}
        activeTab={activeUnit}
        onTabChange={setActiveUnit}
      />

      {/* Simpan Pinjam - Default */}
      {activeUnit === 'SP' && (
        <div className="animate-fade-in">
          <LoanManagement />
        </div>
      )}

      {/* Other Business Units */}
      {activeUnits
        .filter(u => u.code !== 'SP')
        .map((unit) => (
          activeUnit === unit.code && (
            <div key={unit.id} className="animate-fade-in">
              <BusinessUnitTransactions selectedUnitCode={unit.code} />
            </div>
          )
        ))}

      {/* Settings/Management Tab */}
      {activeUnit === 'SETTINGS' && (
        <div className="animate-fade-in">
          <BusinessUnitsManagement />
        </div>
      )}
    </div>
  );
};

export default BusinessUnitsHub;
