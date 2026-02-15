import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { BusinessUnitReport } from '../BusinessUnitReport';

export const BusinessUnitReportCombined = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Laporan Unit Usaha
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Laporan transaksi unit usaha untuk kontribusi SHU anggota
          </p>
        </CardHeader>
      </Card>

      <BusinessUnitReport />
    </div>
  );
};

export default BusinessUnitReportCombined;
