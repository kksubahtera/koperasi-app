import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserCheck, Scale, ChevronRight } from 'lucide-react';
import { UnclaimedAccountsReport } from './UnclaimedAccountsReport';
import { MigrationReconciliationReport } from './MigrationReconciliationReport';

interface MigrationReportsHubProps {
  onBack: () => void;
}

type ReportView = 'hub' | 'unclaimed-accounts' | 'reconciliation';

export const MigrationReportsHub = ({ onBack }: MigrationReportsHubProps) => {
  const [currentView, setCurrentView] = useState<ReportView>('hub');

  if (currentView === 'unclaimed-accounts') {
    return <UnclaimedAccountsReport onBack={() => setCurrentView('hub')} />;
  }

  if (currentView === 'reconciliation') {
    return <MigrationReconciliationReport onBack={() => setCurrentView('hub')} />;
  }

  const reports = [
    {
      id: 'unclaimed-accounts' as ReportView,
      title: 'Akun Belum Diklaim',
      description: 'Laporan status claim akun migrasi, kelengkapan jurnal, dan data anggota',
      icon: UserCheck,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
    {
      id: 'reconciliation' as ReportView,
      title: 'Rekonsiliasi Migrasi',
      description: 'Bandingkan data sebelum dan sesudah migrasi untuk validasi',
      icon: Scale,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Laporan Migrasi</h1>
          <p className="text-muted-foreground">Kelola dan validasi data hasil migrasi</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setCurrentView(report.id)}
            >
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className={`p-3 rounded-lg ${report.bgColor}`}>
                  <Icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center justify-between">
                    {report.title}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {report.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
