import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Building2, UserCheck } from 'lucide-react';
import { TabNavigation, TabItem } from '@/components/shared/TabNavigation';
import { RoleManagement } from './accounting/RoleManagement';
import { UnitRoleManagement } from './UnitRoleManagement';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';

interface OfficersManagementProps {
  onBack: () => void;
}

export const OfficersManagement = ({ onBack }: OfficersManagementProps) => {
  const [activeTab, setActiveTab] = useState('general');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const { units } = useBusinessUnits();

  const activeUnits = units.filter(u => u.is_active);

  const tabs: TabItem[] = [
    {
      value: 'general',
      icon: UserCheck,
      label: 'Peran Koperasi',
      tooltip: 'Pengurus, Pengawas, Penasihat tingkat koperasi',
    },
    {
      value: 'unit',
      icon: Building2,
      label: 'Pengurus Unit',
      tooltip: 'Pengurus per unit usaha',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Manajemen Pengurus
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Kelola peran pengurus koperasi dan pengurus per unit usaha
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* General Role Management */}
      {activeTab === 'general' && (
        <div className="animate-fade-in">
          <RoleManagement />
        </div>
      )}

      {/* Unit Officers */}
      {activeTab === 'unit' && (
        <div className="animate-fade-in space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="text-sm font-medium text-foreground">Pilih Unit:</label>
            <select
              className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
            >
              <option value="">-- Pilih Unit Usaha --</option>
              {activeUnits.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.code})
                </option>
              ))}
            </select>
          </div>
          
          {selectedUnitId ? (
            <UnitRoleManagement 
              businessUnitId={selectedUnitId}
              businessUnitName={activeUnits.find(u => u.id === selectedUnitId)?.name || ''}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Pilih unit usaha untuk mengelola pengurus</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfficersManagement;
