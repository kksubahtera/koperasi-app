import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/mockData';
import { BalanceSheet } from '@/lib/cooperativeSettings';
import { BalanceSheetCalculation } from '@/hooks/useBalanceSheetCalculation';
import { Building2, Wallet, CreditCard, Landmark, Shield, Plus, Minus, ArrowRight, Coins, HandCoins, Users, TrendingUp, Package, TrendingDown, Info, AlertTriangle } from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TermTooltip, AccountingEquationDisplay } from '@/components/shared/TermTooltip';
import { BALANCE_SHEET_TERMINOLOGY, ACCOUNT_TYPE_TERMINOLOGY } from '@/lib/accountingTerminology';
import { QuickEquationGuide } from './QuickEquationGuide';

interface BalanceSheetViewProps {
  balanceSheet: BalanceSheetCalculation | BalanceSheet | null;
}

export const BalanceSheetView = ({ balanceSheet }: BalanceSheetViewProps) => {
  if (!balanceSheet) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Data neraca tidak tersedia</p>
      </div>
    );
  }

  // Cast to get fixed asset properties if available
  const extendedSheet = balanceSheet as BalanceSheetCalculation;
  const hasFixedAssets = extendedSheet.asetTetap !== undefined && extendedSheet.asetTetap > 0;
  
  // Harta Koperasi items
  const hartaKoperasiItems = [
    {
      label: 'Simpanan Pokok',
      description: 'Simpanan awal anggota saat bergabung',
      icon: Coins,
      color: 'text-blue-500',
      saldoAwal: balanceSheet.saldoAwalSimpananPokok || 0,
      penambahan: balanceSheet.penambahanSimpananPokok || 0,
      pengurangan: balanceSheet.penguranganSimpananPokok || 0,
      saldoAkhir: balanceSheet.simpananPokok || 0,
      isAuto: true,
    },
    {
      label: 'Simpanan Wajib',
      description: 'Simpanan bulanan wajib anggota',
      icon: Wallet,
      color: 'text-green-500',
      saldoAwal: balanceSheet.saldoAwalSimpananWajib || 0,
      penambahan: balanceSheet.penambahanSimpananWajib || 0,
      pengurangan: balanceSheet.penguranganSimpananWajib || 0,
      saldoAkhir: balanceSheet.simpananWajib || 0,
      isAuto: true,
    },
    {
      label: 'Simpanan Sukarela',
      description: 'Simpanan fleksibel anggota',
      icon: Wallet,
      color: 'text-teal-500',
      saldoAwal: balanceSheet.saldoAwalSimpananSukarela || 0,
      penambahan: balanceSheet.penambahanSimpananSukarela || 0,
      pengurangan: balanceSheet.penguranganSimpananSukarela || 0,
      saldoAkhir: balanceSheet.simpananSukarela || 0,
      isAuto: true,
    },
    {
      label: 'Dana Cadangan',
      description: 'Dana cadangan dari alokasi SHU',
      icon: Shield,
      color: 'text-amber-500',
      saldoAwal: balanceSheet.saldoAwalDanaCadangan || 0,
      penambahan: balanceSheet.penambahanDanaCadangan || 0,
      pengurangan: balanceSheet.penguranganDanaCadangan || 0,
      saldoAkhir: balanceSheet.danaCadangan || 0,
      isAuto: true,
    },
    {
      label: 'Hibah / Donasi',
      description: 'Hibah atau donasi yang diterima (input manual)',
      icon: HandCoins,
      color: 'text-rose-500',
      saldoAwal: balanceSheet.saldoAwalHibahDonasi || 0,
      penambahan: balanceSheet.penambahanHibahDonasi || 0,
      pengurangan: balanceSheet.penguranganHibahDonasi || 0,
      saldoAkhir: balanceSheet.hibahDonasi || 0,
      isAuto: false,
    },
    {
      label: 'Pinjaman Diterima',
      description: 'Dari Anggota, Koperasi Lain, Lembaga Keuangan (input manual)',
      icon: Users,
      color: 'text-purple-500',
      saldoAwal: balanceSheet.saldoAwalPinjamanDiterima || 0,
      penambahan: balanceSheet.penambahanPinjamanDiterima || 0,
      pengurangan: balanceSheet.penguranganPinjamanDiterima || 0,
      saldoAkhir: balanceSheet.pinjamanDiterima || 0,
      isAuto: false,
    },
    {
      label: 'Modal Penyertaan',
      description: 'Modal penyertaan dari pihak lain (input manual)',
      icon: Landmark,
      color: 'text-indigo-500',
      saldoAwal: balanceSheet.saldoAwalModalPenyertaan || 0,
      penambahan: balanceSheet.penambahanModalPenyertaan || 0,
      pengurangan: balanceSheet.penguranganModalPenyertaan || 0,
      saldoAkhir: balanceSheet.modalPenyertaan || 0,
      isAuto: false,
    },
  ];

  const totalSaldoAwal = hartaKoperasiItems.reduce((sum, item) => sum + item.saldoAwal, 0);
  const totalPenambahan = hartaKoperasiItems.reduce((sum, item) => sum + item.penambahan, 0);
  const totalPengurangan = hartaKoperasiItems.reduce((sum, item) => sum + item.pengurangan, 0);
  const totalSaldoAkhir = hartaKoperasiItems.reduce((sum, item) => sum + item.saldoAkhir, 0);

  // Total Aset (including fixed assets if available)
  const totalAset = extendedSheet.totalAset || balanceSheet.totalAsetLancar || 0;
  const totalModal = totalSaldoAkhir + (extendedSheet.nilaiAsetTetapBersih || 0);
  
  // Check balance
  const isBalanced = Math.abs(totalAset - totalModal) < 1;
  const selisih = totalAset - totalModal;

  // Analyze imbalance causes
  const analyzeImbalance = () => {
    const issues: string[] = [];
    const tolerance = 1;
    
    // Detect direction
    if (selisih > 0) {
      issues.push('Aset lebih besar dari Modal/Kewajiban');
    } else if (selisih < 0) {
      issues.push('Modal/Kewajiban lebih besar dari Aset');
    }

    // Check if selisih matches specific components
    const absSelisih = Math.abs(selisih);
    
    if (Math.abs(absSelisih - (balanceSheet.kasBank || 0)) < tolerance && absSelisih > 0) {
      issues.push('Selisih sama dengan nilai Kas di Bank - kemungkinan tidak terhitung dalam modal');
    }
    if (Math.abs(absSelisih - (balanceSheet.piutangUsaha || 0)) < tolerance && absSelisih > 0) {
      issues.push('Selisih sama dengan nilai Piutang Usaha');
    }
    if (Math.abs(absSelisih - ((balanceSheet.pendapatanBungaPinjaman || 0) + (balanceSheet.pendapatanDenda || 0))) < tolerance && absSelisih > 0) {
      issues.push('Selisih sama dengan total pendapatan - kemungkinan pendapatan belum dialokasikan');
    }

    // Check manual input items
    if ((balanceSheet.hibahDonasi || 0) === 0) {
      issues.push('Hibah/Donasi belum diinput (komponen manual)');
    }
    if ((balanceSheet.pinjamanDiterima || 0) === 0) {
      issues.push('Pinjaman Diterima belum diinput (komponen manual)');
    }
    if ((balanceSheet.modalPenyertaan || 0) === 0) {
      issues.push('Modal Penyertaan belum diinput (komponen manual)');
    }

    // General suggestions based on direction
    if (selisih > 0) {
      issues.push('Saran: Periksa apakah ada pendapatan yang belum dicatat sebagai modal atau ada kewajiban yang belum tercatat');
    } else if (selisih < 0) {
      issues.push('Saran: Periksa apakah ada aset yang belum tercatat atau ada transaksi keluar yang tidak tercatat di kas');
    }

    return issues;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Quick Reference Accounting Equation Guide */}
      <QuickEquationGuide variant="balance-sheet" />
      
      <div className="text-center space-y-1.5 sm:space-y-2">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">Neraca Keuangan</h2>
        <p className="text-sm text-muted-foreground">Tahun Buku {balanceSheet.year}</p>
        <div className="flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground cursor-help bg-muted/50 px-2 sm:px-3 py-1 rounded-full">
                <Info className="h-3 w-3" />
                <span className="hidden xs:inline">Persamaan: Aktiva = Pasiva (Utang + Modal)</span>
                <span className="xs:hidden">Aktiva = Pasiva</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              <div className="space-y-2 text-xs">
                <p className="font-medium">Persamaan Dasar Akuntansi:</p>
                <div className="space-y-1">
                  <p className="font-mono bg-muted px-2 py-1 rounded">Aktiva = Kewajiban + Modal</p>
                  <p className="text-muted-foreground">Istilah lain:</p>
                  <p className="font-mono bg-muted px-2 py-1 rounded">Aset = Liabilitas + Ekuitas</p>
                  <p className="font-mono bg-muted px-2 py-1 rounded">Harta = Utang + Kekayaan Bersih</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ASET LANCAR Section */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-primary">
            <Landmark className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <TermTooltip term="Aset Lancar" showIcon={true} iconSize="sm">
              ASET LANCAR
            </TermTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 px-2 sm:px-6">
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px] text-xs sm:text-sm">Keterangan</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Jumlah</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">Jenis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium py-2 sm:py-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm">Kas di Bank</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                          = Harta Koperasi - Piutang + Pendapatan
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs sm:text-sm">{formatCurrency(balanceSheet.kasBank)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    <Badge variant="secondary" className="text-xs">Otomatis</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium py-2 sm:py-4">
                    <div className="flex items-start gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm">Piutang Usaha</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                          Sisa pokok pinjaman anggota
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs sm:text-sm">{formatCurrency(balanceSheet.piutangUsaha)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    <Badge variant="secondary" className="text-xs">Otomatis</Badge>
                  </TableCell>
                </TableRow>
                <TableRow className="border-t bg-muted/30">
                  <TableCell className="font-bold text-xs sm:text-sm">TOTAL ASET LANCAR</TableCell>
                  <TableCell className="text-right font-bold text-primary text-xs sm:text-sm">{formatCurrency(balanceSheet.totalAsetLancar || 0)}</TableCell>
                  <TableCell className="hidden sm:table-cell"></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Pendapatan Koperasi breakdown */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium">Rincian Pendapatan Koperasi:</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bunga Pinjaman Diterima:</span>
                <span className="font-medium text-green-600">{formatCurrency(balanceSheet.pendapatanBungaPinjaman || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Denda Diterima:</span>
                <span className="font-medium text-green-600">{formatCurrency(balanceSheet.pendapatanDenda || 0)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t flex justify-between text-sm">
              <span className="font-medium">Total Pendapatan:</span>
              <span className="font-bold text-green-600">
                {formatCurrency((balanceSheet.pendapatanBungaPinjaman || 0) + (balanceSheet.pendapatanDenda || 0))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ASET TETAP Section */}
      {hasFixedAssets && (
        <Card className="border-purple-500/20">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-purple-600">
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              <TermTooltip term="Aset Tetap" showIcon={true} iconSize="sm">
                ASET TETAP
              </TermTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] text-xs sm:text-sm">Keterangan</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">Jumlah</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">Jenis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium py-2 sm:py-4">
                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm">Harga Perolehan Aset Tetap</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                            Total harga beli seluruh aset tetap aktif
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs sm:text-sm">{formatCurrency(extendedSheet.asetTetap || 0)}</TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">Otomatis</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium py-2 sm:py-4">
                      <div className="flex items-start gap-2">
                        <TrendingDown className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm">Akumulasi Penyusutan</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                            Total penyusutan sampai saat ini
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-600 text-xs sm:text-sm">
                      ({formatCurrency(extendedSheet.akumulasiPenyusutan || 0)})
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">Otomatis</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t bg-purple-50/50 dark:bg-purple-900/10">
                    <TableCell className="font-bold text-xs sm:text-sm">NILAI BUKU ASET TETAP</TableCell>
                    <TableCell className="text-right font-bold text-purple-600 text-xs sm:text-sm">
                      {formatCurrency(extendedSheet.nilaiAsetTetapBersih || 0)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg">
              <p className="text-[10px] sm:text-sm text-muted-foreground">
                <strong>Rumus:</strong> Nilai Buku = Harga Perolehan - Akumulasi Penyusutan
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOTAL ASET Section */}
      {hasFixedAssets && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 sm:py-4 px-2 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-xs sm:text-sm">Total Aset Lancar</TableCell>
                    <TableCell className="text-right font-medium text-xs sm:text-sm">{formatCurrency(balanceSheet.totalAsetLancar || 0)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs sm:text-sm">Nilai Buku Aset Tetap</TableCell>
                    <TableCell className="text-right font-medium text-xs sm:text-sm">{formatCurrency(extendedSheet.nilaiAsetTetapBersih || 0)}</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold text-sm sm:text-lg">TOTAL ASET</TableCell>
                    <TableCell className="text-right font-bold text-sm sm:text-lg text-primary">
                      {formatCurrency(extendedSheet.totalAset || 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HARTA KOPERASI Section */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
            <RupiahIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help flex items-center gap-1 text-sm sm:text-base">
                  HARTA KOPERASI (MODAL)
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="space-y-2 text-xs">
                  <p className="font-medium">Istilah setara:</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Modal</Badge>
                    <Badge variant="secondary">Ekuitas</Badge>
                    <Badge variant="secondary">Equity</Badge>
                    <Badge variant="secondary">Kekayaan Bersih</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Merupakan sisi Pasiva (kanan) neraca. Rumus: Modal = Aset - Kewajiban
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px] text-[10px] sm:text-xs">Komponen</TableHead>
                  <TableHead className="text-right min-w-[80px] text-[10px] sm:text-xs hidden sm:table-cell">Saldo Awal</TableHead>
                  <TableHead className="text-right min-w-[80px] text-[10px] sm:text-xs hidden md:table-cell">
                    <div className="flex items-center justify-end gap-1 text-green-600">
                      <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span className="hidden lg:inline">Penambahan</span>
                      <span className="lg:hidden">+</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-right min-w-[80px] text-[10px] sm:text-xs hidden md:table-cell">
                    <div className="flex items-center justify-end gap-1 text-destructive">
                      <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span className="hidden lg:inline">Pengurangan</span>
                      <span className="lg:hidden">-</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-right min-w-[80px] text-[10px] sm:text-xs">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span className="hidden sm:inline">Saldo Akhir</span>
                      <span className="sm:hidden">Saldo</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-right min-w-[60px] text-[10px] sm:text-xs hidden lg:table-cell">Jenis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hartaKoperasiItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TableRow key={item.label}>
                      <TableCell className="py-2 sm:py-3">
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${item.color} shrink-0 mt-0.5`} />
                          <div className="min-w-0">
                            <p className="font-medium text-[10px] sm:text-sm truncate">{item.label}</p>
                            <p className="text-[9px] sm:text-xs text-muted-foreground line-clamp-1 hidden sm:block">{item.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-[10px] sm:text-sm hidden sm:table-cell py-2 sm:py-3">{formatCurrency(item.saldoAwal)}</TableCell>
                      <TableCell className="text-right text-green-600 text-[10px] sm:text-sm hidden md:table-cell py-2 sm:py-3">
                        {item.penambahan > 0 ? `+${formatCurrency(item.penambahan)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-destructive text-[10px] sm:text-sm hidden md:table-cell py-2 sm:py-3">
                        {item.pengurangan > 0 ? `-${formatCurrency(item.pengurangan)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[10px] sm:text-sm py-2 sm:py-3">{formatCurrency(item.saldoAkhir)}</TableCell>
                      <TableCell className="text-right hidden lg:table-cell py-2 sm:py-3">
                        <Badge variant={item.isAuto ? "secondary" : "outline"} className="text-[8px] sm:text-xs">
                          {item.isAuto ? 'Otomatis' : 'Manual'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {/* Total Row */}
                <TableRow className="border-t bg-muted/30">
                  <TableCell className="font-bold text-[10px] sm:text-sm py-2 sm:py-3">TOTAL HARTA KOPERASI</TableCell>
                  <TableCell className="text-right font-medium text-[10px] sm:text-sm hidden sm:table-cell py-2 sm:py-3">{formatCurrency(totalSaldoAwal)}</TableCell>
                  <TableCell className="text-right font-medium text-green-600 text-[10px] sm:text-sm hidden md:table-cell py-2 sm:py-3">+{formatCurrency(totalPenambahan)}</TableCell>
                  <TableCell className="text-right font-medium text-destructive text-[10px] sm:text-sm hidden md:table-cell py-2 sm:py-3">-{formatCurrency(totalPengurangan)}</TableCell>
                  <TableCell className="text-right font-bold text-[10px] sm:text-sm py-2 sm:py-3">{formatCurrency(totalSaldoAkhir)}</TableCell>
                  <TableCell className="hidden lg:table-cell"></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Balance Check */}
      <Card className={isBalanced ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}>
        <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <span className={`text-sm sm:text-lg font-bold ${isBalanced ? 'text-green-600' : 'text-destructive'}`}>
              {isBalanced ? '✓ Neraca Seimbang' : '⚠ Neraca Tidak Seimbang'}
            </span>
          </div>
          <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-8 text-xs sm:text-sm">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <p className="text-muted-foreground flex items-center justify-center gap-1 text-[10px] sm:text-sm">
                    {hasFixedAssets ? 'Total Aset' : 'Total Aset Lancar'}
                    <Info className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </p>
                  <p className="font-bold text-primary text-xs sm:text-base">{formatCurrency(totalAset)}</p>
                  {hasFixedAssets && (
                    <p className="text-[9px] sm:text-xs text-muted-foreground hidden sm:block">
                      (Lancar: {formatCurrency(balanceSheet.totalAsetLancar || 0)} + Tetap: {formatCurrency(extendedSheet.nilaiAsetTetapBersih || 0)})
                    </p>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Juga disebut: <strong>Aktiva</strong> atau <strong>Harta</strong></p>
              </TooltipContent>
            </Tooltip>
            <span className="text-muted-foreground text-lg sm:text-xl">=</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <p className="text-muted-foreground flex items-center justify-center gap-1 text-[10px] sm:text-sm">
                    Total Modal/Kewajiban
                    <Info className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </p>
                  <p className={`font-bold text-xs sm:text-base ${isBalanced ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(totalModal)}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Juga disebut: <strong>Pasiva</strong> = Utang + Ekuitas</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {!isBalanced && (
            <div className="mt-3 space-y-3">
              <p className="text-center text-[10px] sm:text-sm text-muted-foreground">
                Selisih: {formatCurrency(Math.abs(selisih))}
              </p>
              
              {/* Diagnostic Card */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mx-auto max-w-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-200">
                      Kemungkinan Penyebab:
                    </p>
                    <ul className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                      {analyzeImbalance().map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {/* Breakdown Comparison */}
                <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-800">
                  <p className="text-[10px] sm:text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                    Detail Perbandingan:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                    <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                      <p className="text-muted-foreground font-medium">Total Aset</p>
                      <p className="font-bold text-primary">{formatCurrency(totalAset)}</p>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 space-y-0.5">
                        <p>Kas: {formatCurrency(balanceSheet.kasBank || 0)}</p>
                        <p>Piutang: {formatCurrency(balanceSheet.piutangUsaha || 0)}</p>
                        {hasFixedAssets && <p>Aset Tetap: {formatCurrency(extendedSheet.nilaiAsetTetapBersih || 0)}</p>}
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                      <p className="text-muted-foreground font-medium">Total Modal</p>
                      <p className="font-bold text-destructive">{formatCurrency(totalModal)}</p>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 space-y-0.5">
                        <p>Simpanan: {formatCurrency((balanceSheet.simpananPokok || 0) + (balanceSheet.simpananWajib || 0) + (balanceSheet.simpananSukarela || 0))}</p>
                        <p>Dana Cadangan: {formatCurrency(balanceSheet.danaCadangan || 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
