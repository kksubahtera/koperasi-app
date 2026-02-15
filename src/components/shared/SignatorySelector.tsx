import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { Users, Loader2, Info } from 'lucide-react';
import { useSignatoryOfficers, SignatoryOfficer } from '@/hooks/useSignatoryOfficers';

interface SignatorySelectorProps {
  selectedSignatoryIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxSelection?: number;
  readOnly?: boolean;
}

export const SignatorySelector = ({
  selectedSignatoryIds,
  onSelectionChange,
  maxSelection = 4, // Increased to support all 4 roles: Ketua, Wakil Ketua, Sekretaris, Bendahara
  readOnly = false
}: SignatorySelectorProps) => {
  const { t } = useThemeLanguage();
  const { signatories, loading } = useSignatoryOfficers();
  const [initialized, setInitialized] = useState(false);

  // Auto-select active signatories on first load
  useEffect(() => {
    if (!loading && signatories.length > 0 && !initialized) {
      const activeOfficers = signatories.filter(s => s.is_active);
      if (selectedSignatoryIds.length === 0 && activeOfficers.length > 0) {
        onSelectionChange(activeOfficers.slice(0, maxSelection).map(s => s.role_assignment_id));
      }
      setInitialized(true);
    }
  }, [loading, signatories, initialized, selectedSignatoryIds.length, maxSelection, onSelectionChange]);

  const handleToggle = (roleAssignmentId: string) => {
    if (selectedSignatoryIds.includes(roleAssignmentId)) {
      onSelectionChange(selectedSignatoryIds.filter(id => id !== roleAssignmentId));
    } else {
      if (selectedSignatoryIds.length < maxSelection) {
        onSelectionChange([...selectedSignatoryIds, roleAssignmentId]);
      }
    }
  };

  // Hide selector UI for read-only mode (member view)
  if (readOnly) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 mb-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t('Memuat penandatangan...', 'Loading signatories...')}
        </span>
      </div>
    );
  }

  if (signatories.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p>{t('Belum ada penandatangan yang dikonfigurasi.', 'No signatories configured yet.')}</p>
            <p className="text-xs mt-1">
              {t(
                'Tambahkan pengurus dengan jabatan (Ketua, Sekretaris, dll) di menu "Manajemen Pengurus".',
                'Add officers with positions (Chairman, Secretary, etc.) in the "Officers Management" menu.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {t('Pilih Penandatangan', 'Select Signatories')} ({selectedSignatoryIds.length}/{maxSelection})
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {signatories.map((officer) => (
          <div key={officer.role_assignment_id} className="flex items-center space-x-2">
            <Checkbox
              id={`signatory-${officer.role_assignment_id}`}
              checked={selectedSignatoryIds.includes(officer.role_assignment_id)}
              onCheckedChange={() => handleToggle(officer.role_assignment_id)}
              disabled={
                !selectedSignatoryIds.includes(officer.role_assignment_id) && 
                selectedSignatoryIds.length >= maxSelection
              }
            />
            <Label
              htmlFor={`signatory-${officer.role_assignment_id}`}
              className="text-sm cursor-pointer"
            >
              {officer.name} ({officer.position})
              {!officer.is_active && (
                <span className="text-xs text-muted-foreground ml-1">(nonaktif)</span>
              )}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
};

// Export a helper function to get signatories data for letters
export const getSignatoriesForLetter = (
  signatories: SignatoryOfficer[], 
  selectedIds: string[]
): SignatoryOfficer[] => {
  return signatories
    .filter(s => selectedIds.includes(s.role_assignment_id))
    .sort((a, b) => {
      const order: Record<string, number> = { 'Ketua': 1, 'Wakil Ketua': 2, 'Sekretaris': 3, 'Bendahara': 4 };
      return (order[a.position] || 99) - (order[b.position] || 99);
    });
};
