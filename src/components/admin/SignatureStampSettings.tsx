import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload, X, Info, Loader2, Users, ExternalLink, Pencil, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { 
  CooperativeSettings, 
  getCooperativeSettings, 
  saveCooperativeSettings,
} from '@/lib/cooperativeSettings';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useSignatoryOfficers, useSignatureLayout, getSignatureContainerClasses, getSignatureSizeClasses } from '@/hooks/useSignatoryOfficers';
import { SignatureCanvas } from '@/components/shared/SignatureCanvas';
export const SignatureStampSettings = () => {
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const stampInputRef = useRef<HTMLInputElement>(null);
  const { signatories, loading, updateSignature, toggleActive, refetch } = useSignatoryOfficers();
  const [drawingForId, setDrawingForId] = useState<string | null>(null);
  const [previewLetterType, setPreviewLetterType] = useState<string>('loan_approval');
  const { layoutSettings } = useSignatureLayout(previewLetterType);
  
  // Get active signatories for preview
  const activeSignatories = signatories.filter(s => s.is_active);

  useEffect(() => {
    setSettings(getCooperativeSettings());
  }, []);

  const updateSettings = (updates: Partial<CooperativeSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveCooperativeSettings(newSettings);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      updateSettings({ stampBase64: base64 });
      toast.success('Stempel berhasil diupload');
    };
    reader.readAsDataURL(file);
  };

  const removeStamp = () => {
    updateSettings({ stampBase64: '' });
    toast.success('Stempel berhasil dihapus');
  };

  const handleSignatureUpload = async (roleAssignmentId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 1MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const success = await updateSignature(roleAssignmentId, base64);
      if (success) {
        toast.success('Tanda tangan berhasil diupload');
      } else {
        toast.error('Gagal mengupload tanda tangan');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = async (roleAssignmentId: string) => {
    const success = await updateSignature(roleAssignmentId, null);
    if (success) {
      toast.success('Tanda tangan berhasil dihapus');
    } else {
      toast.error('Gagal menghapus tanda tangan');
    }
  };

  const handleToggleActive = async (roleAssignmentId: string, isActive: boolean) => {
    const success = await toggleActive(roleAssignmentId, isActive);
    if (success) {
      toast.success(isActive ? 'Penandatangan diaktifkan' : 'Penandatangan dinonaktifkan');
    }
  };

  const handleDrawnSignatureSave = async (roleAssignmentId: string, base64: string) => {
    const success = await updateSignature(roleAssignmentId, base64);
    if (success) {
      toast.success('Tanda tangan berhasil disimpan');
      setDrawingForId(null);
    } else {
      toast.error('Gagal menyimpan tanda tangan');
    }
  };

  const getPositionBadgeColor = (position: string) => {
    switch (position) {
      case 'Ketua': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'Wakil Ketua': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'Sekretaris': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'Bendahara': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('Tanda Tangan & Stempel', 'Signature & Stamp')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                'Kelola tanda tangan pengurus untuk surat resmi. Data penandatangan diambil dari Manajemen Pengurus.',
                'Manage officer signatures for official letters. Signatory data is fetched from Officers Management.'
              )}
            </p>
          </div>

          {/* Stamp Upload */}
          <div className="space-y-3">
            <Label>{t('Stempel Koperasi', 'Cooperative Stamp')}</Label>
            <div className="flex items-start gap-4">
              {settings.stampBase64 ? (
                <div className="relative">
                  <img
                    src={settings.stampBase64}
                    alt="Stempel"
                    className="h-20 w-20 object-contain rounded-lg border border-border bg-white p-2"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeStamp}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground text-center px-2">Placeholder</span>
                </div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  ref={stampInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleStampUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stampInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {t('Upload Stempel', 'Upload Stamp')}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t('PNG transparan, maks 1MB', 'Transparent PNG, max 1MB')}
                </p>
              </div>
            </div>
          </div>

          {/* Signatories List from Database */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label>{t('Daftar Penandatangan', 'Signatories List')}</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="gap-1 text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                {t('Refresh', 'Refresh')}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : signatories.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-border bg-muted/30">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {t('Belum Ada Penandatangan', 'No Signatories Yet')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        'Untuk menambahkan penandatangan, tambahkan pengurus dengan jabatan (Ketua, Wakil Ketua, Sekretaris, atau Bendahara) di menu "Manajemen Pengurus" pada halaman "Manajemen SHU".',
                        'To add signatories, add officers with positions (Chairman, Vice Chairman, Secretary, or Treasurer) in the "Officers Management" menu on the "SHU Management" page.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              signatories.map((officer) => (
                <div 
                  key={officer.role_assignment_id} 
                  className="p-4 rounded-lg border border-border bg-muted/30 space-y-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{officer.name}</p>
                        <Badge variant="outline" className={`text-xs ${getPositionBadgeColor(officer.position)}`}>
                          {officer.position}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={officer.is_active}
                        onCheckedChange={(checked) => handleToggleActive(officer.role_assignment_id, checked)}
                      />
                      <Label className="text-xs text-muted-foreground">
                        {officer.is_active ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')}
                      </Label>
                    </div>
                  </div>

                  {/* Signature Upload or Draw */}
                  <div className="space-y-3">
                    <Label className="text-sm">{t('Tanda Tangan', 'Signature')}</Label>
                    
                    {drawingForId === officer.role_assignment_id ? (
                      <SignatureCanvas
                        onSave={(base64) => handleDrawnSignatureSave(officer.role_assignment_id, base64)}
                        onCancel={() => setDrawingForId(null)}
                      />
                    ) : (
                      <div className="flex items-start gap-4">
                        {officer.signature_base64 ? (
                          <div className="relative">
                            <img
                              src={officer.signature_base64}
                              alt={`TTD ${officer.name}`}
                              className="h-16 w-28 object-contain rounded-lg border border-border bg-white p-2"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-5 w-5"
                              onClick={() => handleRemoveSignature(officer.role_assignment_id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex h-16 w-28 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30">
                            <span className="text-[10px] text-muted-foreground text-center px-2">Placeholder</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept="image/*"
                            id={`sig-upload-${officer.role_assignment_id}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleSignatureUpload(officer.role_assignment_id, file);
                            }}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById(`sig-upload-${officer.role_assignment_id}`)?.click()}
                              className="gap-1"
                            >
                              <Upload className="h-3 w-3" />
                              Upload
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setDrawingForId(officer.role_assignment_id)}
                              className="gap-1"
                            >
                              <Pencil className="h-3 w-3" />
                              {t('Gambar', 'Draw')}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {t('Upload gambar atau gambar langsung', 'Upload image or draw directly')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Real-time Preview */}
            <div className="pt-4 border-t border-border mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <Label className="font-medium">{t('Preview Surat Real-time', 'Real-time Letter Preview')}</Label>
                </div>
                <Select value={previewLetterType} onValueChange={setPreviewLetterType}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loan_approval">{t('Surat Persetujuan Pinjaman', 'Loan Approval')}</SelectItem>
                    <SelectItem value="loan_settlement">{t('Surat Pelunasan', 'Loan Settlement')}</SelectItem>
                    <SelectItem value="resignation">{t('Surat Pengunduran Diri', 'Resignation')}</SelectItem>
                    <SelectItem value="refund">{t('Surat Konfirmasi Refund', 'Refund Confirmation')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview Card */}
              <div className="border border-border rounded-lg bg-white dark:bg-background p-4 overflow-hidden">
                {/* Simulated Letter Content */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {settings.logoBase64 ? (
                        <img src={settings.logoBase64} alt="Logo" className="h-8 w-8 object-contain" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-[8px] text-muted-foreground">Logo</div>
                      )}
                      <div>
                        <p className="font-bold text-[10px]">{settings.name || 'Nama Koperasi'}</p>
                        <p className="text-[8px] text-muted-foreground">{settings.address || 'Alamat Koperasi'}</p>
                      </div>
                    </div>
                    <div className="text-right text-[8px] text-muted-foreground">
                      <p>No: XXX/KOP/{new Date().getFullYear()}</p>
                      <p>{new Date().toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-2">
                    <p className="font-semibold text-center text-[10px] mb-2">
                      {previewLetterType === 'loan_approval' && 'SURAT PERSETUJUAN PINJAMAN'}
                      {previewLetterType === 'loan_settlement' && 'SURAT KETERANGAN PELUNASAN'}
                      {previewLetterType === 'resignation' && 'SURAT KONFIRMASI PENGUNDURAN DIRI'}
                      {previewLetterType === 'refund' && 'SURAT KONFIRMASI REFUND'}
                    </p>
                    <div className="h-12 bg-muted/30 rounded flex items-center justify-center">
                      <p className="text-[8px] text-muted-foreground italic">(Isi surat...)</p>
                    </div>
                  </div>

                  {/* Signature Block Preview */}
                  <div className="pt-3 border-t border-border">
                    {activeSignatories.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-[9px] text-muted-foreground italic">
                          {t('Aktifkan minimal satu penandatangan untuk melihat preview', 'Activate at least one signatory to see preview')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Layout: Grid for 3+ signatories, horizontal for 1-2 */}
                        {layoutSettings.signature_layout === 'grid' && activeSignatories.length > 2 ? (
                          <div className="space-y-3">
                            {/* Stamp */}
                            {settings.stampBase64 && (
                              <div className="flex justify-start">
                                <img 
                                  src={settings.stampBase64} 
                                  alt="Stempel" 
                                  className="h-12 w-12 object-contain opacity-80"
                                />
                              </div>
                            )}
                            {/* Grid of signatories */}
                            <div className={`grid gap-3 ${
                              layoutSettings.max_signatories_per_row === 2 ? 'grid-cols-2' : 
                              'grid-cols-2'
                            }`}>
                              {activeSignatories.slice(0, 4).map((signatory) => {
                                const sizeClasses = getSignatureSizeClasses(layoutSettings.signature_size || 'medium');
                                return (
                                  <div key={signatory.role_assignment_id} className="text-center">
                                    <p className="text-[8px] mb-0.5">{signatory.position}</p>
                                    {signatory.signature_base64 ? (
                                      <img 
                                        src={signatory.signature_base64} 
                                        alt={`TTD ${signatory.name}`}
                                        className="h-8 w-16 object-contain mx-auto"
                                      />
                                    ) : (
                                      <div className="h-8 w-16 border border-dashed border-muted-foreground/30 rounded mx-auto flex items-center justify-center">
                                        <span className="text-[5px] text-muted-foreground">(TTD)</span>
                                      </div>
                                    )}
                                    <p className="text-[7px] font-medium mt-0.5">{signatory.name}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : layoutSettings.signature_layout === 'vertical' ? (
                          <div className="flex items-start gap-3">
                            {/* Stamp on left */}
                            {settings.stampBase64 && (
                              <img 
                                src={settings.stampBase64} 
                                alt="Stempel" 
                                className="h-12 w-12 object-contain opacity-80"
                              />
                            )}
                            {/* Vertical stack */}
                            <div className="flex flex-col gap-2">
                              {activeSignatories.slice(0, 4).map((signatory) => (
                                <div key={signatory.role_assignment_id} className="text-center min-w-[60px]">
                                  <p className="text-[8px] mb-0.5">{signatory.position}</p>
                                  {signatory.signature_base64 ? (
                                    <img 
                                      src={signatory.signature_base64} 
                                      alt={`TTD ${signatory.name}`}
                                      className="h-6 w-14 object-contain mx-auto"
                                    />
                                  ) : (
                                    <div className="h-6 w-14 border-b border-muted-foreground/50 mx-auto" />
                                  )}
                                  <p className="text-[7px] font-medium">{signatory.name}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* Horizontal layout (default) */
                          <div className={`flex items-end gap-3 ${
                            layoutSettings.signature_alignment === 'center' ? 'justify-center' :
                            layoutSettings.signature_alignment === 'right' ? 'justify-end' :
                            layoutSettings.signature_alignment === 'space-between' ? 'justify-between' :
                            'justify-start'
                          }`}>
                            {/* Stamp */}
                            {settings.stampBase64 && (
                              <div className="flex items-center">
                                <img 
                                  src={settings.stampBase64} 
                                  alt="Stempel" 
                                  className="h-12 w-12 object-contain opacity-80"
                                />
                              </div>
                            )}
                            {/* Signatories */}
                            {activeSignatories.slice(0, 4).map((signatory) => {
                              const sizeClasses = getSignatureSizeClasses(layoutSettings.signature_size || 'medium');
                              return (
                                <div key={signatory.role_assignment_id} className="text-center min-w-[55px]">
                                  <p className="text-[8px] mb-0.5">{signatory.position}</p>
                                  {signatory.signature_base64 ? (
                                    <img 
                                      src={signatory.signature_base64} 
                                      alt={`TTD ${signatory.name}`}
                                      className="h-8 w-16 object-contain mx-auto"
                                    />
                                  ) : (
                                    <div className="h-8 w-16 border border-dashed border-muted-foreground/30 rounded mx-auto flex items-center justify-center">
                                      <span className="text-[5px] text-muted-foreground">(TTD)</span>
                                    </div>
                                  )}
                                  <p className="text-[7px] font-medium mt-0.5">{signatory.name}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Layout info */}
                    <div className="mt-3 pt-2 border-t border-dashed border-border">
                      <p className="text-[8px] text-muted-foreground text-center">
                        Layout: <span className="font-medium">{layoutSettings.signature_layout || 'horizontal'}</span> | 
                        Alignment: <span className="font-medium">{layoutSettings.signature_alignment || 'right'}</span> | 
                        Max/Row: <span className="font-medium">{layoutSettings.max_signatories_per_row || 3}</span> |
                        Aktif: <span className="font-medium">{activeSignatories.length}/4</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                {t(
                  '* Preview menampilkan penandatangan aktif. Atur layout di "Format Template Surat".',
                  '* Preview shows active signatories. Configure layout in "Letter Template Format".'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
