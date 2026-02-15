import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Shield, FileText, User } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface CollateralFormData {
  collateralType: string;
  collateralDescription: string;
  estimatedValue: number;
  documentNumber: string;
}

interface CollateralFormProps {
  collateralTypes: string[];
  custodianName?: string;
  custodianPosition?: string;
  onCollateralChange: (data: CollateralFormData) => void;
  minValue?: number;
}

export function CollateralForm({
  collateralTypes,
  custodianName,
  custodianPosition,
  onCollateralChange,
  minValue = 0
}: CollateralFormProps) {
  const { t } = useThemeLanguage();
  const [formData, setFormData] = useState<CollateralFormData>({
    collateralType: '',
    collateralDescription: '',
    estimatedValue: 0,
    documentNumber: ''
  });

  const handleChange = (field: keyof CollateralFormData, value: string | number) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onCollateralChange(newData);
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Shield className="h-4 w-4" />
          {t('Informasi Agunan', 'Collateral Information')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Custodian Info */}
        {custodianName && (
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-background rounded-lg border">
            <User className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                {t('Pengurus Penanggung Jawab Agunan', 'Collateral Custodian')}
              </p>
              <p className="text-sm text-muted-foreground">
                {custodianName}
                {custodianPosition && ` - ${custodianPosition}`}
              </p>
            </div>
          </div>
        )}

        {/* Collateral Type */}
        <div className="space-y-2">
          <Label htmlFor="collateralType">
            {t('Jenis Agunan', 'Collateral Type')} <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.collateralType}
            onValueChange={(value) => handleChange('collateralType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('Pilih jenis agunan', 'Select collateral type')} />
            </SelectTrigger>
            <SelectContent>
              {collateralTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Document Number */}
        <div className="space-y-2">
          <Label htmlFor="documentNumber">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('Nomor Dokumen (Sertifikat/BPKB/dll)', 'Document Number (Certificate/BPKB/etc)')}
            </div>
          </Label>
          <Input
            id="documentNumber"
            value={formData.documentNumber}
            onChange={(e) => handleChange('documentNumber', e.target.value)}
            placeholder={t('Masukkan nomor dokumen', 'Enter document number')}
          />
        </div>

        {/* Estimated Value */}
        <div className="space-y-2">
          <Label htmlFor="estimatedValue">
            {t('Perkiraan Nilai Agunan', 'Estimated Collateral Value')}
            {minValue > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                ({t(`Min. ${new Intl.NumberFormat('id-ID').format(minValue)}`, `Min. ${new Intl.NumberFormat('id-ID').format(minValue)}`)})
              </span>
            )}
          </Label>
          <CurrencyInput
            value={formData.estimatedValue}
            onChange={(value) => handleChange('estimatedValue', value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="collateralDescription">
            {t('Deskripsi Agunan', 'Collateral Description')}
          </Label>
          <Textarea
            id="collateralDescription"
            value={formData.collateralDescription}
            onChange={(e) => handleChange('collateralDescription', e.target.value)}
            placeholder={t(
              'Jelaskan detail agunan (merk, tahun, kondisi, dll)',
              'Describe collateral details (brand, year, condition, etc)'
            )}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
