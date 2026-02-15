import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/mockData';
import { useCooperativeSummary } from '@/hooks/useCooperativeSummary';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  Wallet, 
  Building2, 
  Receipt, 
  TrendingUp, 
  AlertTriangle,
  Users,
  CreditCard,
  UserX,
  Coins,
  Shield,
  Landmark,
  Loader2,
  FileDown,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  HandCoins,
  Gift,
  GraduationCap,
  Heart,
  Hammer
} from 'lucide-react';

export const CooperativeSummaryView = () => {
  const { loading, summary, danaCadangan, bookkeeping } = useCooperativeSummary();
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { data: settingsData } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', ['cooperative_name', 'cooperative_address']);
      
      const settings: Record<string, string> = {};
      settingsData?.forEach(s => {
        settings[s.key] = typeof s.value === 'string' ? s.value : String(s.value);
      });

      const cooperativeName = settings['cooperative_name'] || 'Koperasi';
      const cooperativeAddress = settings['cooperative_address'] || '';

      const totalHarta = summary.totalSimpananPokok + summary.totalSimpananWajib + summary.totalSimpananSukarela + danaCadangan;
      const piutang = summary.totalReceivables;
      const pendapatan = summary.totalInterestReceived + summary.totalPenaltyReceived;
      const kas = totalHarta - piutang + pendapatan;
      const asetLancar = kas + piutang;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(cooperativeName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += 7;

      if (cooperativeAddress) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(cooperativeAddress, pageWidth / 2, y, { align: 'center' });
        y += 7;
      }

      doc.setLineWidth(0.5);
      doc.line(14, y, pageWidth - 14, y);
      y += 10;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN RINGKASAN KEUANGAN', pageWidth / 2, y, { align: 'center' });
      y += 5;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const currentDate = new Date().toLocaleDateString('id-ID', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });
      doc.text(`Per ${currentDate}`, pageWidth / 2, y, { align: 'center' });
      y += 15;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('STATISTIK ANGGOTA', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Keterangan', 'Jumlah']],
        body: [
          ['Anggota Aktif', summary.totalMembers.toString()],
          ['Memiliki Pinjaman', summary.membersWithLoans.toString()],
          ['Menunggak', summary.membersDefaulting.toString()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 10 },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('LABA RUGI (TAHUN BERJALAN)', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Keterangan', 'Jumlah']],
        body: [
          ['Total Pendapatan', formatCurrency(bookkeeping.totalIncome)],
          ['Total Beban', formatCurrency(bookkeeping.totalExpense)],
          ['Laba/Rugi Bersih', formatCurrency(bookkeeping.netIncome)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 10 },
        willDrawCell: (data) => {
          if (data.row.index === 2) {
            doc.setFont('helvetica', 'bold');
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ASET LANCAR', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Keterangan', 'Jumlah']],
        body: [
          ['Kas', formatCurrency(bookkeeping.kas)],
          ['Bank', formatCurrency(bookkeeping.bank)],
          ['Piutang Usaha', formatCurrency(piutang)],
          ['Total Aset Lancar', formatCurrency(asetLancar)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 10 },
        willDrawCell: (data) => {
          if (data.row.index === 3) {
            doc.setFont('helvetica', 'bold');
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('MODAL KOPERASI', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Keterangan', 'Jumlah']],
        body: [
          ['Simpanan Pokok', formatCurrency(summary.totalSimpananPokok)],
          ['Simpanan Wajib', formatCurrency(summary.totalSimpananWajib)],
          ['Simpanan Sukarela', formatCurrency(summary.totalSimpananSukarela)],
          ['Dana Cadangan', formatCurrency(danaCadangan)],
          ['Modal Penyertaan', formatCurrency(bookkeeping.modalPenyertaan)],
          ['Modal Pinjaman', formatCurrency(bookkeeping.modalPinjaman)],
          ['Hibah/Donasi', formatCurrency(bookkeeping.hibahDonasi)],
          ['Total Modal', formatCurrency(totalHarta + bookkeeping.modalPenyertaan + bookkeeping.modalPinjaman + bookkeeping.hibahDonasi)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], textColor: 255 },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 10 },
        willDrawCell: (data) => {
          if (data.row.index === 7) {
            doc.setFont('helvetica', 'bold');
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DANA-DANA SHU', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Keterangan', 'Jumlah']],
        body: [
          ['Dana Pendidikan', formatCurrency(bookkeeping.danaPendidikan)],
          ['Dana Sosial', formatCurrency(bookkeeping.danaSosial)],
          ['Dana Pembangunan', formatCurrency(bookkeeping.danaPembangunan)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: 255 },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 10 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, finalY);

      doc.save(`Ringkasan-Keuangan-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalHartaKoperasi = 
    summary.totalSimpananPokok + 
    summary.totalSimpananWajib + 
    summary.totalSimpananSukarela +
    danaCadangan;

  const piutangUsaha = summary.totalReceivables;
  const totalPendapatan = summary.totalInterestReceived + summary.totalPenaltyReceived;
  const kasBank = totalHartaKoperasi - piutangUsaha + totalPendapatan;
  const totalAsetLancar = kasBank + piutangUsaha;

  const memberStats = [
    { title: 'Anggota Aktif', value: summary.totalMembers, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Memiliki Pinjaman', value: summary.membersWithLoans, icon: CreditCard, color: 'text-accent', bgColor: 'bg-accent/10' },
    { title: 'Menunggak', value: summary.membersDefaulting, icon: UserX, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  ];

  const asetLancarCards = [
    { title: 'Kas', value: bookkeeping.kas, icon: Coins, color: 'text-emerald-500' },
    { title: 'Bank', value: bookkeeping.bank, icon: Landmark, color: 'text-blue-500' },
    { title: 'Piutang Usaha', value: piutangUsaha, icon: Receipt, color: 'text-warning' },
  ];

  const hartaCards = [
    { title: 'Simpanan Pokok', value: summary.totalSimpananPokok, icon: Coins, color: 'text-blue-500' },
    { title: 'Simpanan Wajib', value: summary.totalSimpananWajib, icon: Wallet, color: 'text-green-500' },
    { title: 'Simpanan Sukarela', value: summary.totalSimpananSukarela, icon: Wallet, color: 'text-teal-500' },
    { title: 'Dana Cadangan', value: danaCadangan, icon: Shield, color: 'text-amber-500' },
  ];

  const modalTambahanCards = [
    { title: 'Modal Penyertaan', value: bookkeeping.modalPenyertaan, icon: Landmark, color: 'text-indigo-500' },
    { title: 'Modal Pinjaman', value: bookkeeping.modalPinjaman, icon: HandCoins, color: 'text-cyan-500' },
    { title: 'Hibah/Donasi', value: bookkeeping.hibahDonasi, icon: Gift, color: 'text-pink-500' },
  ];

  const danaCards = [
    { title: 'Dana Pendidikan', value: bookkeeping.danaPendidikan, icon: GraduationCap, color: 'text-blue-500' },
    { title: 'Dana Sosial', value: bookkeeping.danaSosial, icon: Heart, color: 'text-rose-500' },
    { title: 'Dana Pembangunan', value: bookkeeping.danaPembangunan, icon: Hammer, color: 'text-orange-500' },
  ];

  const incomeCards = [
    { title: 'Bunga Pinjaman Diterima', value: summary.totalInterestReceived, icon: TrendingUp, color: 'text-success' },
    { title: 'Denda Diterima', value: summary.totalPenaltyReceived, icon: AlertTriangle, color: 'text-warning' },
  ];

  // Data untuk chart perbandingan pendapatan vs beban
  const incomeExpenseData = [
    { name: 'Pendapatan', value: bookkeeping.totalIncome, fill: 'hsl(var(--success))' },
    { name: 'Beban', value: bookkeeping.totalExpense, fill: 'hsl(var(--destructive))' },
  ];

  const barChartData = [
    { 
      category: 'Bunga Pinjaman', 
      pendapatan: summary.totalInterestReceived, 
      beban: 0 
    },
    { 
      category: 'Denda', 
      pendapatan: summary.totalPenaltyReceived, 
      beban: 0 
    },
    { 
      category: 'Pendapatan Lain', 
      pendapatan: bookkeeping.totalIncome - summary.totalInterestReceived - summary.totalPenaltyReceived, 
      beban: 0 
    },
    { 
      category: 'Beban Operasional', 
      pendapatan: 0, 
      beban: bookkeeping.totalExpense 
    },
  ];

  // Data untuk pie chart komposisi modal
  const modalPieData = [
    { name: 'Simpanan Pokok', value: summary.totalSimpananPokok, fill: '#3b82f6' },
    { name: 'Simpanan Wajib', value: summary.totalSimpananWajib, fill: '#22c55e' },
    { name: 'Simpanan Sukarela', value: summary.totalSimpananSukarela, fill: '#14b8a6' },
    { name: 'Dana Cadangan', value: danaCadangan, fill: '#f59e0b' },
  ].filter(item => item.value > 0);

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value);
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleExportPdf} disabled={exporting} size="sm" className="text-xs sm:text-sm h-8 sm:h-9">
          {exporting ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" /> : <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />}
          Export PDF
        </Button>
      </div>

      {/* Statistik Anggota */}
      <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-3">
        {memberStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} variant="gradient">
              <CardContent className="flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-6">
                <div className={`flex h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 items-center justify-center rounded-lg sm:rounded-xl ${stat.bgColor} shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 ${stat.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground truncate">{stat.title}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Laba Rugi */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
        <CardHeader className="pb-2 p-3 sm:p-4 md:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-emerald-500/20 shrink-0">
              <BookOpen className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 text-emerald-500" />
            </div>
            <CardTitle className="text-sm sm:text-base md:text-lg">Laba Rugi (Tahun Berjalan)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 md:p-6 pt-0 sm:pt-0 md:pt-4">
          <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border border-border bg-card p-2.5 sm:p-3 md:p-4">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-success/20 shrink-0">
                <ArrowUpRight className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground truncate">Total Pendapatan</p>
                <p className="text-sm sm:text-base md:text-lg font-bold text-success truncate">{formatCurrency(bookkeeping.totalIncome)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border border-border bg-card p-2.5 sm:p-3 md:p-4">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-destructive/20 shrink-0">
                <ArrowDownRight className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground truncate">Total Beban</p>
                <p className="text-sm sm:text-base md:text-lg font-bold text-destructive truncate">{formatCurrency(bookkeeping.totalExpense)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border border-border bg-card p-2.5 sm:p-3 md:p-4">
              <div className={`flex h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-lg shrink-0 ${bookkeeping.netIncome >= 0 ? 'bg-success/20' : 'bg-destructive/20'}`}>
                <TrendingUp className={`h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 ${bookkeeping.netIncome >= 0 ? 'text-success' : 'text-destructive'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground truncate">Laba/Rugi Bersih</p>
                <p className={`text-sm sm:text-base md:text-lg font-bold truncate ${bookkeeping.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(bookkeeping.netIncome)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grafik Pendapatan vs Beban */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Perbandingan Pendapatan vs Beban</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}jt`}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatTooltipValue(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="pendapatan" name="Pendapatan" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="beban" name="Beban" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Komposisi Modal Koperasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modalPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {modalPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatTooltipValue(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Aset Lancar */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 items-center justify-center rounded-xl bg-primary/20 shrink-0">
              <Landmark className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Aset Lancar</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate">{formatCurrency(totalAsetLancar)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Kas + Bank + Piutang Usaha</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rincian Aset Lancar */}
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6">
          <CardTitle className="text-sm sm:text-base md:text-lg">Rincian Aset Lancar</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
            {asetLancarCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="flex flex-col gap-1.5 sm:gap-2 rounded-lg border border-border p-2.5 sm:p-3 md:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Icon className={`h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 ${card.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground truncate">{card.title}</p>
                      <p className="text-sm sm:text-base md:text-lg font-bold text-foreground truncate">{formatCurrency(card.value)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Total Harta Koperasi */}
      <Card className="border-secondary/30 bg-gradient-to-br from-secondary/10 to-secondary/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/20">
              <Building2 className="h-7 w-7 text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Total Modal Koperasi</p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(totalHartaKoperasi + bookkeeping.modalPenyertaan + bookkeeping.modalPinjaman + bookkeeping.hibahDonasi)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Simpanan + Dana Cadangan + Modal Penyertaan + Modal Pinjaman + Hibah
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rincian Modal Koperasi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rincian Modal Koperasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {hartaCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="flex flex-col gap-2 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{card.title}</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(card.value)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {modalTambahanCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="flex flex-col gap-2 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{card.title}</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(card.value)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dana-Dana SHU */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
              <Coins className="h-5 w-5 text-amber-500" />
            </div>
            <CardTitle className="text-lg">Dana-Dana SHU</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {danaCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(card.value)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pendapatan Koperasi */}
      <Card className="border-success/30 bg-gradient-to-br from-success/10 to-success/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <CardTitle className="text-lg text-success">Pendapatan Pinjaman</CardTitle>
              <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalPendapatan)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {incomeCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(card.value)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
