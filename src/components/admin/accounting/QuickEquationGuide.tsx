import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Scale, Equal, ChevronDown, ChevronUp, Lightbulb, Minus, Plus, Info, Users, Shield, GraduationCap, Heart, Building2, ArrowRight, Wallet, ArrowUpRight, ArrowDownRight, Banknote, RefreshCw, BookOpen, ArrowLeftRight, Check, AlertTriangle, Coins, Calendar, Percent, Calculator, Activity, TrendingUp, PieChart, Package, TrendingDown, Target, Sparkles, BarChart3, FolderTree, Hash } from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';

export type QuickEquationGuideVariant = 'balance-sheet' | 'profit-loss' | 'shu-distribution' | 'cash-flow' | 'journal' | 'journal-templates' | 'interest-report' | 'financial-ratios' | 'depreciation' | 'bank-reconciliation' | 'projections' | 'chart-of-accounts' | 'full';

interface QuickEquationGuideProps {
  variant?: QuickEquationGuideVariant;
  defaultOpen?: boolean;
}

export const QuickEquationGuide = ({ variant = 'full', defaultOpen = false }: QuickEquationGuideProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getTitle = () => {
    switch (variant) {
      case 'shu-distribution':
        return 'Panduan Distribusi SHU';
      case 'cash-flow':
        return 'Panduan Arus Kas';
      case 'journal':
        return 'Panduan Double-Entry Bookkeeping';
      case 'journal-templates':
        return 'Panduan Template Jurnal Otomatis';
      case 'interest-report':
        return 'Panduan Bunga Simpanan';
      case 'financial-ratios':
        return 'Panduan Rasio Keuangan';
      case 'depreciation':
        return 'Panduan Penyusutan Aset';
      case 'bank-reconciliation':
        return 'Panduan Rekonsiliasi Bank';
      case 'projections':
        return 'Panduan Proyeksi Keuangan';
      case 'chart-of-accounts':
        return 'Panduan Bagan Akun';
      default:
        return 'Panduan Persamaan Akuntansi';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-between bg-gradient-to-r from-primary/5 to-transparent border-primary/20 hover:bg-primary/10"
        >
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <span className="font-medium">{getTitle()}</span>
            <Badge variant="secondary" className="text-xs">Quick Reference</Badge>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 animate-fade-in">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4 space-y-4">
            {/* Balance Sheet Equation - Show for balance-sheet and full variants */}
            {(variant === 'balance-sheet' || variant === 'full') && (
              <BalanceSheetEquation />
            )}

            {/* Profit Loss Equation - Show for profit-loss and full variants */}
            {(variant === 'profit-loss' || variant === 'full') && (
              <ProfitLossEquation />
            )}

            {/* SHU Distribution Equation - Show for shu-distribution variant */}
            {variant === 'shu-distribution' && (
              <SHUDistributionEquation />
            )}

            {/* Cash Flow Equation - Show for cash-flow variant */}
            {variant === 'cash-flow' && (
              <CashFlowEquation />
            )}

            {/* Journal / Double-Entry Equation - Show for journal variant */}
            {variant === 'journal' && (
              <JournalEquation />
            )}

            {/* Interest Report Equation - Show for interest-report variant */}
            {variant === 'interest-report' && (
              <InterestReportEquation />
            )}

            {/* Financial Ratios Equation - Show for financial-ratios variant */}
            {variant === 'financial-ratios' && (
              <FinancialRatiosEquation />
            )}

            {/* Depreciation Equation - Show for depreciation variant */}
            {variant === 'depreciation' && (
              <DepreciationEquation />
            )}

            {/* Bank Reconciliation Equation - Show for bank-reconciliation variant */}
            {variant === 'bank-reconciliation' && (
              <BankReconciliationEquation />
            )}

            {/* Projections Equation - Show for projections variant */}
            {variant === 'projections' && (
              <ProjectionsEquation />
            )}

            {/* Chart of Accounts Equation - Show for chart-of-accounts variant */}
            {variant === 'chart-of-accounts' && (
              <ChartOfAccountsEquation />
            )}

            {/* Journal Templates Equation - Show for journal-templates variant */}
            {variant === 'journal-templates' && (
              <JournalTemplatesEquation />
            )}

            {/* Connection between P&L and Balance Sheet - Show for profit-loss and full */}
            {(variant === 'profit-loss' || variant === 'full') && (
              <ConnectionInfo />
            )}

            {/* Debit Credit Rules - Show for balance-sheet, profit-loss, journal, and full variants */}
            {(variant === 'balance-sheet' || variant === 'profit-loss' || variant === 'journal' || variant === 'full') && (
              <DebitCreditRules variant={variant} />
            )}

            {/* Balance Check Info - Show for balance-sheet variant */}
            {variant === 'balance-sheet' && (
              <div className="text-center text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                <span className="font-medium">Neraca Seimbang:</span> Total Aset harus sama dengan Total Modal/Kewajiban
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Balance Sheet Equation Component
const BalanceSheetEquation = () => (
  <>
    {/* Main Equation */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Persamaan Dasar Akuntansi</p>
      <div className="flex items-center justify-center gap-3 text-lg font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          AKTIVA
        </span>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <span className="px-3 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          PASIVA
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        (Aset / Harta) = (Utang + Modal)
      </p>
    </div>

    {/* Equation Components Grid */}
    <div className="grid gap-3 md:grid-cols-2">
      {/* AKTIVA */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300">AKTIVA (Sisi Kiri)</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Istilah lain: <span className="font-medium">Aset, Harta, Assets</span></p>
          <div className="text-xs space-y-1 mt-2">
            <p>• <strong>Aset Lancar:</strong> Kas, Bank, Piutang</p>
            <p>• <strong>Aset Tetap:</strong> Gedung, Peralatan, Kendaraan</p>
          </div>
        </div>
      </div>

      {/* PASIVA */}
      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="font-semibold text-green-700 dark:text-green-300">PASIVA (Sisi Kanan)</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Rumus: <span className="font-medium">Utang + Modal</span></p>
          <div className="text-xs space-y-1 mt-2">
            <p>• <strong>Utang:</strong> Liabilitas, Kewajiban</p>
            <p>• <strong>Modal:</strong> Ekuitas, Equity, Kekayaan Bersih</p>
          </div>
        </div>
      </div>
    </div>
  </>
);

// Profit Loss Equation Component
const ProfitLossEquation = () => (
  <>
    {/* Main P&L Equation */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Rumus Laba Rugi</p>
      <div className="flex items-center justify-center gap-3 text-lg font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          SHU
        </span>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <span className="px-3 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          Pendapatan
        </span>
        <Minus className="h-5 w-5 text-muted-foreground" />
        <span className="px-3 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
          Beban
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Sisa Hasil Usaha = Total Pendapatan - Total Biaya
      </p>
    </div>

    {/* Equation Components Grid */}
    <div className="grid gap-3 md:grid-cols-3">
      {/* SHU */}
      <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-semibold text-amber-700 dark:text-amber-300 text-sm">SHU (Hasil)</span>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">Istilah lain:</p>
          <p className="font-medium">Laba Bersih, Net Income, Profit/Loss</p>
        </div>
      </div>

      {/* Pendapatan */}
      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">Pendapatan</span>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">Istilah lain:</p>
          <p className="font-medium">Revenue, Income, Penerimaan</p>
        </div>
      </div>

      {/* Beban */}
      <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-semibold text-red-700 dark:text-red-300 text-sm">Beban/Biaya</span>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">Istilah lain:</p>
          <p className="font-medium">Expense, Cost, Pengeluaran</p>
        </div>
      </div>
    </div>
  </>
);

// SHU Distribution Equation Component
const SHUDistributionEquation = () => (
  <>
    {/* Main SHU Distribution Formula */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Rumus Distribusi SHU</p>
      <div className="flex items-center justify-center gap-2 text-base font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          SHU Bruto
        </span>
        <Equal className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-sm">
          Anggota
        </span>
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-sm">
          Pengurus
        </span>
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-sm">
          Dana
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        100% SHU didistribusikan sesuai ketentuan AD/ART Koperasi
      </p>
    </div>

    {/* SHU Distribution Components */}
    <div className="space-y-3">
      {/* SHU Anggota Section */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">SHU Anggota</span>
          <Badge variant="outline" className="text-xs">Biasanya 40-60%</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 text-xs mt-2">
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-blue-600 dark:text-blue-400">Jasa Simpanan</p>
            <p className="text-muted-foreground">Berdasarkan proporsi simpanan pokok + wajib anggota terhadap total simpanan</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-blue-600 dark:text-blue-400">Jasa Usaha</p>
            <p className="text-muted-foreground">Berdasarkan proporsi bunga pinjaman yang dibayar anggota</p>
          </div>
        </div>
      </div>

      {/* Pengurus/Pengawas Section */}
      <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-purple-500" />
          <span className="font-semibold text-purple-700 dark:text-purple-300 text-sm">Jasa Pengurus & Pengawas</span>
          <Badge variant="outline" className="text-xs">Biasanya 15-25%</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-3 text-xs mt-2">
          <div className="p-2 rounded bg-background border text-center">
            <p className="font-medium">Pengurus</p>
            <p className="text-muted-foreground">Ketua, Sekretaris, Bendahara</p>
          </div>
          <div className="p-2 rounded bg-background border text-center">
            <p className="font-medium">Pengawas</p>
            <p className="text-muted-foreground">Mengawasi jalannya koperasi</p>
          </div>
          <div className="p-2 rounded bg-background border text-center">
            <p className="font-medium">Penasihat</p>
            <p className="text-muted-foreground">Memberikan arahan strategis</p>
          </div>
        </div>
      </div>

      {/* Dana Alokasi Section */}
      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">Dana Alokasi</span>
          <Badge variant="outline" className="text-xs">Biasanya 15-25%</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-xs mt-2">
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <Shield className="h-3 w-3 text-amber-500" />
              <p className="font-medium text-amber-600 dark:text-amber-400">Dana Cadangan</p>
            </div>
            <p className="text-muted-foreground">Cadangan untuk risiko kerugian & pengembangan</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <GraduationCap className="h-3 w-3 text-blue-500" />
              <p className="font-medium text-blue-600 dark:text-blue-400">Dana Pendidikan</p>
            </div>
            <p className="text-muted-foreground">Pelatihan & pendidikan anggota/pengurus</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <Heart className="h-3 w-3 text-rose-500" />
              <p className="font-medium text-rose-600 dark:text-rose-400">Dana Sosial</p>
            </div>
            <p className="text-muted-foreground">Bantuan sosial & kegiatan kemasyarakatan</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3 text-indigo-500" />
              <p className="font-medium text-indigo-600 dark:text-indigo-400">Dana Pembangunan</p>
            </div>
            <p className="text-muted-foreground">Pembangunan & perluasan usaha koperasi</p>
          </div>
        </div>
      </div>
    </div>

    {/* Important Notes */}
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">Catatan Penting</span>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Persentase distribusi diatur dalam AD/ART dan dapat berbeda tiap koperasi</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Dana Cadangan minimal 20% dari SHU (sesuai UU Perkoperasian)</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>SHU Anggota dibagikan proporsional berdasarkan jasa simpanan dan jasa usaha</span>
        </li>
      </ul>
    </div>
  </>
);

// Journal / Double-Entry Equation Component
const JournalEquation = () => (
  <>
    {/* Main Double-Entry Formula */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Prinsip Double-Entry Bookkeeping</p>
      <div className="flex items-center justify-center gap-3 text-lg font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Total DEBIT
        </span>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <span className="px-3 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          Total KREDIT
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Setiap transaksi harus dicatat minimal di 2 akun dengan jumlah yang seimbang
      </p>
    </div>

    {/* Double-Entry Concept */}
    <div className="grid gap-3 md:grid-cols-2">
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <ArrowLeftRight className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">DEBIT (Sisi Kiri)</span>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">Akun yang BERTAMBAH di sisi Debit:</p>
          <div className="mt-2 space-y-1">
            <p>• <strong>Aset/Harta:</strong> Kas, Bank, Piutang, Peralatan</p>
            <p>• <strong>Beban/Biaya:</strong> Biaya listrik, Gaji, Beban operasional</p>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <ArrowLeftRight className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">KREDIT (Sisi Kanan)</span>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">Akun yang BERTAMBAH di sisi Kredit:</p>
          <div className="mt-2 space-y-1">
            <p>• <strong>Kewajiban/Utang:</strong> Utang usaha, Pinjaman</p>
            <p>• <strong>Modal/Ekuitas:</strong> Modal penyertaan, Simpanan</p>
            <p>• <strong>Pendapatan:</strong> Pendapatan bunga, Jasa</p>
          </div>
        </div>
      </div>
    </div>

    {/* Journal Entry Examples */}
    <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-4 w-4 text-purple-500" />
        <span className="font-semibold text-purple-700 dark:text-purple-300 text-sm">Contoh Jurnal</span>
      </div>
      <div className="space-y-3 text-xs">
        {/* Example 1 */}
        <div className="p-2 rounded bg-background border">
          <p className="font-medium mb-2">Penerimaan Simpanan Pokok Rp 100.000:</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="font-medium text-left">Akun</div>
            <div className="font-medium text-blue-600">Debit</div>
            <div className="font-medium text-green-600">Kredit</div>
            <div className="text-left">Kas</div>
            <div className="text-blue-600">100.000</div>
            <div className="text-muted-foreground">-</div>
            <div className="text-left">Simpanan Pokok</div>
            <div className="text-muted-foreground">-</div>
            <div className="text-green-600">100.000</div>
          </div>
        </div>
        
        {/* Example 2 */}
        <div className="p-2 rounded bg-background border">
          <p className="font-medium mb-2">Pembayaran Biaya Listrik Rp 50.000:</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="font-medium text-left">Akun</div>
            <div className="font-medium text-blue-600">Debit</div>
            <div className="font-medium text-green-600">Kredit</div>
            <div className="text-left">Beban Listrik</div>
            <div className="text-blue-600">50.000</div>
            <div className="text-muted-foreground">-</div>
            <div className="text-left">Kas</div>
            <div className="text-muted-foreground">-</div>
            <div className="text-green-600">50.000</div>
          </div>
        </div>
      </div>
    </div>

    {/* Balance Validation */}
    <div className="grid gap-3 md:grid-cols-2">
      <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2 mb-2">
          <Check className="h-4 w-4 text-emerald-500" />
          <span className="font-medium text-emerald-700 dark:text-emerald-300 text-sm">Jurnal Seimbang</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Total Debit = Total Kredit. Jurnal dapat disimpan dan diposting.
        </p>
      </div>
      
      <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <span className="font-medium text-rose-700 dark:text-rose-300 text-sm">Jurnal Tidak Seimbang</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Total Debit ≠ Total Kredit. Periksa kembali pencatatan Anda.
        </p>
      </div>
    </div>

    {/* Tips */}
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">Tips Membuat Jurnal</span>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Identifikasi akun-akun yang terlibat dalam transaksi</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Tentukan apakah akun tersebut bertambah atau berkurang</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Pastikan total Debit = total Kredit sebelum menyimpan</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Gunakan deskripsi yang jelas untuk referensi di masa depan</span>
        </li>
      </ul>
    </div>
  </>
);

// Interest Report Equation Component
const InterestReportEquation = () => (
  <>
    {/* Main Interest Formula */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Rumus Bunga Simpanan Sukarela</p>
      <div className="flex items-center justify-center gap-2 text-base font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Bunga
        </span>
        <Equal className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-sm">
          Saldo Eligible
        </span>
        <span className="text-muted-foreground">×</span>
        <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-sm">
          Tingkat Bunga
        </span>
        <span className="text-muted-foreground">÷</span>
        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300 text-sm">
          12
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Bunga dihitung bulanan dari saldo yang memenuhi syarat
      </p>
    </div>

    {/* Components Explanation */}
    <div className="space-y-3">
      {/* Eligible Balance */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Saldo Eligible (Qualifying Balance)</span>
        </div>
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">Saldo yang memenuhi syarat untuk mendapatkan bunga:</p>
          <div className="grid gap-2 md:grid-cols-2 mt-2">
            <div className="p-2 rounded bg-background border">
              <div className="flex items-center gap-1 mb-1">
                <Check className="h-3 w-3 text-emerald-500" />
                <p className="font-medium text-emerald-600 dark:text-emerald-400">Termasuk</p>
              </div>
              <p className="text-muted-foreground">Saldo awal bulan + setoran sebelum tanggal cut-off</p>
            </div>
            <div className="p-2 rounded bg-background border">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3 text-rose-500" />
                <p className="font-medium text-rose-600 dark:text-rose-400">Tidak Termasuk</p>
              </div>
              <p className="text-muted-foreground">Setoran setelah tanggal cut-off (biasanya tanggal 15)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Interest Rate */}
      <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-2">
          <Percent className="h-4 w-4 text-amber-500" />
          <span className="font-semibold text-amber-700 dark:text-amber-300 text-sm">Tingkat Bunga</span>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">Tingkat bunga tahunan yang ditetapkan koperasi (dapat diubah di pengaturan).</p>
          <div className="p-2 rounded bg-background border mt-2">
            <p className="font-medium">Contoh: Bunga 4.8% per tahun</p>
            <p className="text-muted-foreground mt-1">= 0.4% per bulan = 0.4/100 = 0.004</p>
          </div>
        </div>
      </div>

      {/* Calculation Period */}
      <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-purple-500" />
          <span className="font-semibold text-purple-700 dark:text-purple-300 text-sm">Periode Perhitungan</span>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-muted-foreground">Bunga dihitung dan dikreditkan setiap akhir bulan saat tutup buku:</p>
          <ul className="mt-2 space-y-1">
            <li className="flex items-start gap-2">
              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Cut-off date: tanggal tertentu (default tanggal 15)</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Bunga dikreditkan langsung ke simpanan sukarela anggota</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Tercatat sebagai beban bunga di Laporan Laba Rugi</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    {/* Calculation Example */}
    <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-4 w-4 text-emerald-500" />
        <span className="font-medium text-sm">Contoh Perhitungan</span>
      </div>
      <div className="text-xs space-y-2">
        <div className="p-2 rounded bg-background border">
          <p className="font-medium mb-1">Anggota A:</p>
          <ul className="text-muted-foreground space-y-1">
            <li>• Saldo awal: Rp 1.000.000</li>
            <li>• Setoran 10 Januari: Rp 500.000 (sebelum cut-off)</li>
            <li>• Setoran 20 Januari: Rp 300.000 (setelah cut-off)</li>
            <li>• <strong>Saldo Eligible:</strong> Rp 1.500.000</li>
            <li>• Bunga (0.4%): Rp 1.500.000 × 0.4% = <strong className="text-emerald-600">Rp 6.000</strong></li>
          </ul>
        </div>
      </div>
    </div>

    {/* Tips */}
    <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-slate-500" />
        <span className="font-medium text-sm">Catatan Penting</span>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Bunga hanya diberikan untuk simpanan sukarela, bukan simpanan pokok/wajib</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Anggota akan menerima notifikasi saat bunga dikreditkan</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Total bunga tercatat sebagai beban operasional koperasi</span>
        </li>
      </ul>
    </div>
  </>
);

// Cash Flow Equation Component
const CashFlowEquation = () => (
  <>
    {/* Main Cash Flow Formula */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Rumus Arus Kas</p>
      <div className="flex items-center justify-center gap-2 text-base font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Saldo Akhir
        </span>
        <Equal className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300 text-sm">
          Saldo Awal
        </span>
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-sm">
          Arus Masuk
        </span>
        <Minus className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-sm">
          Arus Keluar
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Cash Flow Statement menunjukkan pergerakan kas selama periode tertentu
      </p>
    </div>

    {/* Three Categories of Cash Flow */}
    <div className="space-y-3">
      {/* Operating Activities */}
      <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="h-4 w-4 text-emerald-500" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">Aktivitas Operasi</span>
          <Badge variant="outline" className="text-xs">Operating Activities</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 text-xs mt-2">
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <p className="font-medium text-emerald-600 dark:text-emerald-400">Arus Masuk</p>
            </div>
            <p className="text-muted-foreground">Penerimaan simpanan, angsuran pinjaman, bunga, denda</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <ArrowDownRight className="h-3 w-3 text-rose-500" />
              <p className="font-medium text-rose-600 dark:text-rose-400">Arus Keluar</p>
            </div>
            <p className="text-muted-foreground">Pencairan pinjaman, penarikan simpanan, biaya operasional</p>
          </div>
        </div>
      </div>

      {/* Investing Activities */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Aktivitas Investasi</span>
          <Badge variant="outline" className="text-xs">Investing Activities</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 text-xs mt-2">
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <p className="font-medium text-emerald-600 dark:text-emerald-400">Arus Masuk</p>
            </div>
            <p className="text-muted-foreground">Penjualan aset tetap, pendapatan investasi</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <ArrowDownRight className="h-3 w-3 text-rose-500" />
              <p className="font-medium text-rose-600 dark:text-rose-400">Arus Keluar</p>
            </div>
            <p className="text-muted-foreground">Pembelian aset tetap, pengeluaran investasi</p>
          </div>
        </div>
      </div>

      {/* Financing Activities */}
      <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <Banknote className="h-4 w-4 text-purple-500" />
          <span className="font-semibold text-purple-700 dark:text-purple-300 text-sm">Aktivitas Pendanaan</span>
          <Badge variant="outline" className="text-xs">Financing Activities</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 text-xs mt-2">
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <p className="font-medium text-emerald-600 dark:text-emerald-400">Arus Masuk</p>
            </div>
            <p className="text-muted-foreground">Penerimaan pinjaman dari luar, penambahan modal</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <div className="flex items-center gap-1 mb-1">
              <ArrowDownRight className="h-3 w-3 text-rose-500" />
              <p className="font-medium text-rose-600 dark:text-rose-400">Arus Keluar</p>
            </div>
            <p className="text-muted-foreground">Pembayaran hutang, distribusi SHU</p>
          </div>
        </div>
      </div>
    </div>

    {/* Cash Flow Connection */}
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">Hubungan dengan Laporan Lain</span>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span><strong>Neraca:</strong> Saldo akhir kas di Arus Kas = Kas di Bank di Neraca</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span><strong>Laba Rugi:</strong> Arus kas operasi berhubungan dengan pendapatan dan beban</span>
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span><strong>Likuiditas:</strong> Arus kas positif menunjukkan koperasi sehat secara likuiditas</span>
        </li>
      </ul>
    </div>
  </>
);

// Financial Ratios Equation Component
const FinancialRatiosEquation = () => (
  <>
    {/* Main Concept */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Analisis Rasio Keuangan Koperasi</p>
      <div className="flex items-center justify-center gap-3 text-base font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Rasio
        </span>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-sm">
          Angka A
        </span>
        <span className="text-muted-foreground">÷</span>
        <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-sm">
          Angka B
        </span>
        <span className="text-muted-foreground">× 100%</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Rasio membandingkan dua angka untuk menilai kesehatan keuangan koperasi
      </p>
    </div>

    {/* Ratio Categories */}
    <div className="space-y-3">
      {/* Likuiditas */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <RupiahIcon className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Rasio Likuiditas</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Mengukur kemampuan koperasi membayar kewajiban jangka pendek
        </p>
        <div className="grid gap-2 md:grid-cols-2 text-xs">
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-blue-600 dark:text-blue-400">Current Ratio</p>
            <p className="text-muted-foreground font-mono">= Aset Lancar ÷ Kewajiban Lancar</p>
            <p className="text-muted-foreground mt-1">Ideal: {">"} 1.5 (150%)</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-blue-600 dark:text-blue-400">Cash Ratio</p>
            <p className="text-muted-foreground font-mono">= Kas ÷ Kewajiban Lancar</p>
            <p className="text-muted-foreground mt-1">Ideal: {">"} 0.2 (20%)</p>
          </div>
        </div>
      </div>

      {/* Profitabilitas */}
      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">Rasio Profitabilitas</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Mengukur kemampuan koperasi menghasilkan keuntungan
        </p>
        <div className="grid gap-2 md:grid-cols-2 text-xs">
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-green-600 dark:text-green-400">ROA (Return on Assets)</p>
            <p className="text-muted-foreground font-mono">= SHU ÷ Total Aset × 100%</p>
            <p className="text-muted-foreground mt-1">Ideal: {">"} 5%</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-green-600 dark:text-green-400">ROE (Return on Equity)</p>
            <p className="text-muted-foreground font-mono">= SHU ÷ Modal × 100%</p>
            <p className="text-muted-foreground mt-1">Ideal: {">"} 10%</p>
          </div>
        </div>
      </div>

      {/* Solvabilitas */}
      <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <PieChart className="h-4 w-4 text-purple-500" />
          <span className="font-semibold text-purple-700 dark:text-purple-300 text-sm">Rasio Solvabilitas</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Mengukur kemampuan koperasi membayar seluruh utang dengan aset
        </p>
        <div className="grid gap-2 md:grid-cols-2 text-xs">
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-purple-600 dark:text-purple-400">Debt to Equity Ratio</p>
            <p className="text-muted-foreground font-mono">= Total Utang ÷ Modal × 100%</p>
            <p className="text-muted-foreground mt-1">Ideal: {"<"} 100%</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-purple-600 dark:text-purple-400">Debt to Asset Ratio</p>
            <p className="text-muted-foreground font-mono">= Total Utang ÷ Total Aset × 100%</p>
            <p className="text-muted-foreground mt-1">Ideal: {"<"} 50%</p>
          </div>
        </div>
      </div>

      {/* Aktivitas */}
      <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-amber-500" />
          <span className="font-semibold text-amber-700 dark:text-amber-300 text-sm">Rasio Aktivitas</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Mengukur efisiensi pengelolaan aset dan piutang koperasi
        </p>
        <div className="grid gap-2 md:grid-cols-2 text-xs">
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-amber-600 dark:text-amber-400">Perputaran Piutang</p>
            <p className="text-muted-foreground font-mono">= Pendapatan ÷ Rata-rata Piutang</p>
            <p className="text-muted-foreground mt-1">Semakin tinggi semakin baik</p>
          </div>
          <div className="p-2 rounded bg-background border">
            <p className="font-medium text-amber-600 dark:text-amber-400">Perputaran Aset</p>
            <p className="text-muted-foreground font-mono">= Pendapatan ÷ Total Aset</p>
            <p className="text-muted-foreground mt-1">Semakin tinggi semakin efisien</p>
          </div>
        </div>
      </div>
    </div>

    {/* Health Score Info */}
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Skor Kesehatan Koperasi</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs text-center">
        <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
          <p className="font-medium text-green-600">80-100</p>
          <p className="text-muted-foreground">Sangat Sehat</p>
        </div>
        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
          <p className="font-medium text-blue-600">60-79</p>
          <p className="text-muted-foreground">Sehat</p>
        </div>
        <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
          <p className="font-medium text-yellow-600">40-59</p>
          <p className="text-muted-foreground">Cukup</p>
        </div>
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="font-medium text-red-600">0-39</p>
          <p className="text-muted-foreground">Kurang</p>
        </div>
      </div>
    </div>
  </>
);

// Depreciation Equation Component
const DepreciationEquation = () => (
  <>
    {/* Main Concept */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Rumus Nilai Buku Aset</p>
      <div className="flex items-center justify-center gap-3 text-base font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          Nilai Buku
        </span>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-sm">
          Harga Perolehan
        </span>
        <Minus className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-sm">
          Akum. Penyusutan
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Nilai buku mencerminkan nilai aset setelah dikurangi penyusutan
      </p>
    </div>

    {/* Depreciation Methods */}
    <div className="space-y-3">
      {/* Garis Lurus (Straight Line) */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <ArrowRight className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Metode Garis Lurus (Straight Line)</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Penyusutan tetap sama setiap periode. Cocok untuk aset dengan penggunaan merata.
        </p>
        <div className="p-3 rounded bg-background border">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Rumus:</p>
          <div className="font-mono text-sm text-center p-2 bg-muted/50 rounded">
            Penyusutan/Bulan = Harga Perolehan ÷ Umur Ekonomis (Bulan)
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Contoh:</p>
            <p>Laptop Rp 12.000.000, Umur 60 bulan</p>
            <p>→ Penyusutan/bulan = Rp 12.000.000 ÷ 60 = <strong>Rp 200.000</strong></p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-muted-foreground">Mudah dihitung dan diprediksi</span>
        </div>
      </div>

      {/* Saldo Menurun (Declining Balance) */}
      <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-4 w-4 text-amber-500" />
          <span className="font-semibold text-amber-700 dark:text-amber-300 text-sm">Metode Saldo Menurun (Declining Balance)</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Penyusutan lebih besar di awal, semakin kecil seiring waktu. Cocok untuk aset teknologi.
        </p>
        <div className="p-3 rounded bg-background border">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">Rumus:</p>
          <div className="font-mono text-sm text-center p-2 bg-muted/50 rounded space-y-1">
            <p>Tarif = (1 ÷ Umur Ekonomis) × 2</p>
            <p>Penyusutan = Nilai Buku × Tarif ÷ 12</p>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Contoh:</p>
            <p>Laptop Rp 12.000.000, Umur 5 tahun (60 bulan)</p>
            <p>→ Tarif = (1÷5) × 2 = 40%/tahun</p>
            <p>→ Tahun 1: Rp 12.000.000 × 40% = <strong>Rp 4.800.000</strong></p>
            <p>→ Tahun 2: Rp 7.200.000 × 40% = <strong>Rp 2.880.000</strong></p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span className="text-muted-foreground">Lebih kompleks, mencerminkan penurunan nilai riil</span>
        </div>
      </div>
    </div>

    {/* Key Terms */}
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Istilah Penting</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 text-xs">
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-primary">Harga Perolehan</p>
          <p className="text-muted-foreground">Harga beli aset termasuk biaya pengiriman & instalasi</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-primary">Umur Ekonomis</p>
          <p className="text-muted-foreground">Estimasi masa manfaat aset dalam bulan/tahun</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-primary">Akumulasi Penyusutan</p>
          <p className="text-muted-foreground">Total penyusutan dari awal hingga saat ini</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-primary">Nilai Residu</p>
          <p className="text-muted-foreground">Nilai sisa aset di akhir umur ekonomis (biasanya 0)</p>
        </div>
      </div>
    </div>

    {/* Impact on Financial Statements */}
    <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-2">
        <Package className="h-4 w-4 text-purple-500" />
        <span className="font-medium text-sm">Dampak pada Laporan Keuangan</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• <strong>Neraca:</strong> Mengurangi nilai Aset Tetap melalui Akumulasi Penyusutan</p>
        <p>• <strong>Laba Rugi:</strong> Beban Penyusutan mengurangi SHU (Laba Bersih)</p>
        <p>• <strong>Arus Kas:</strong> Penyusutan adalah beban non-tunai (tidak mengurangi kas)</p>
      </div>
    </div>
  </>
);

// Bank Reconciliation Equation Component
const BankReconciliationEquation = () => (
  <>
    {/* Main Concept */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Tujuan Rekonsiliasi Bank</p>
      <div className="flex items-center justify-center gap-3 text-base font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Saldo Buku
        </span>
        <span className="text-muted-foreground">disesuaikan</span>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <span className="px-3 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          Saldo Bank
        </span>
        <span className="text-muted-foreground">disesuaikan</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Mencocokkan catatan internal dengan laporan rekening koran dari bank
      </p>
    </div>

    {/* Two-Column Reconciliation */}
    <div className="grid gap-3 md:grid-cols-2">
      {/* Saldo Buku */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Saldo Menurut Buku</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Saldo kas/bank berdasarkan catatan pembukuan koperasi
        </p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <Plus className="h-3 w-3 text-green-500" />
            <span>Bunga bank yang belum dicatat</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-red-500" />
            <span>Biaya administrasi bank</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3 w-3 text-amber-500" />
            <span>Koreksi kesalahan pencatatan</span>
          </div>
        </div>
        <div className="mt-2 p-2 rounded bg-background border text-xs">
          <span className="font-medium">= Saldo Buku Disesuaikan</span>
        </div>
      </div>

      {/* Saldo Bank */}
      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">Saldo Menurut Bank</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Saldo berdasarkan rekening koran dari bank
        </p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <Plus className="h-3 w-3 text-green-500" />
            <span>Setoran dalam perjalanan (deposit in transit)</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-red-500" />
            <span>Cek beredar (outstanding check)</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3 w-3 text-amber-500" />
            <span>Koreksi kesalahan bank</span>
          </div>
        </div>
        <div className="mt-2 p-2 rounded bg-background border text-xs">
          <span className="font-medium">= Saldo Bank Disesuaikan</span>
        </div>
      </div>
    </div>

    {/* Common Reconciling Items */}
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">Item-item Rekonsiliasi Umum</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 text-xs">
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-blue-600 dark:text-blue-400">Setoran dalam Perjalanan</p>
          <p className="text-muted-foreground">Setoran sudah dicatat di buku tapi belum masuk rekening bank</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-amber-600 dark:text-amber-400">Cek Beredar</p>
          <p className="text-muted-foreground">Cek sudah diterbitkan tapi belum dicairkan oleh penerima</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-green-600 dark:text-green-400">Bunga Bank</p>
          <p className="text-muted-foreground">Pendapatan bunga yang tercatat di bank tapi belum di buku</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-red-600 dark:text-red-400">Biaya Administrasi</p>
          <p className="text-muted-foreground">Potongan bank yang belum dicatat di buku</p>
        </div>
      </div>
    </div>

    {/* Process Steps */}
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Langkah Rekonsiliasi</span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="mt-0.5 px-2 py-0 text-xs">1</Badge>
          <span>Bandingkan saldo akhir buku dengan saldo rekening koran</span>
        </div>
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="mt-0.5 px-2 py-0 text-xs">2</Badge>
          <span>Identifikasi item yang ada di satu catatan tapi tidak di yang lain</span>
        </div>
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="mt-0.5 px-2 py-0 text-xs">3</Badge>
          <span>Sesuaikan saldo buku dengan item dari bank (bunga, biaya admin)</span>
        </div>
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="mt-0.5 px-2 py-0 text-xs">4</Badge>
          <span>Sesuaikan saldo bank dengan item belum tercatat (setoran/cek)</span>
        </div>
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="mt-0.5 px-2 py-0 text-xs">5</Badge>
          <span>Verifikasi kedua saldo disesuaikan sama = rekonsiliasi selesai</span>
        </div>
      </div>
    </div>

    {/* Status Indicator */}
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-center">
        <Check className="h-4 w-4 mx-auto text-green-500 mb-1" />
        <p className="font-medium text-green-600">Selisih = 0</p>
        <p className="text-muted-foreground">Rekonsiliasi Seimbang</p>
      </div>
      <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
        <AlertTriangle className="h-4 w-4 mx-auto text-red-500 mb-1" />
        <p className="font-medium text-red-600">Selisih ≠ 0</p>
        <p className="text-muted-foreground">Perlu Investigasi</p>
      </div>
    </div>
  </>
);

// Projections Equation Component
const ProjectionsEquation = () => (
  <>
    {/* Main Concept */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Prinsip Proyeksi Keuangan</p>
      <div className="flex items-center justify-center gap-3 text-base font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
          Proyeksi
        </span>
        <Equal className="h-5 w-5 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-sm">
          Data Historis
        </span>
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-sm">
          Tren
        </span>
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-sm">
          Asumsi
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Memprediksi kinerja keuangan masa depan berdasarkan pola historis
      </p>
    </div>

    {/* Projection Methods */}
    <div className="space-y-3">
      {/* Linear Trend */}
      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Metode Tren Linear</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Menggunakan rata-rata pertumbuhan historis untuk proyeksi
        </p>
        <div className="p-2 rounded bg-background border text-xs">
          <p className="font-mono text-center">Proyeksi = Nilai Terakhir × (1 + Rata-rata Pertumbuhan)</p>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          <p><strong>Cocok untuk:</strong> Data dengan pola pertumbuhan stabil</p>
        </div>
      </div>

      {/* Moving Average */}
      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-green-700 dark:text-green-300 text-sm">Metode Rata-rata Bergerak</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Menghaluskan fluktuasi dengan rata-rata periode terakhir
        </p>
        <div className="p-2 rounded bg-background border text-xs">
          <p className="font-mono text-center">Proyeksi = (Σ Nilai n Bulan Terakhir) ÷ n</p>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          <p><strong>Cocok untuk:</strong> Data dengan fluktuasi musiman</p>
        </div>
      </div>
    </div>

    {/* Key Components */}
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">Komponen Proyeksi</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 text-xs">
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-green-600 dark:text-green-400">Proyeksi Pendapatan</p>
          <p className="text-muted-foreground">Estimasi pendapatan bunga pinjaman, denda, dan jasa lainnya</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-red-600 dark:text-red-400">Proyeksi Pengeluaran</p>
          <p className="text-muted-foreground">Estimasi biaya operasional, bunga simpanan, dan beban lainnya</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-blue-600 dark:text-blue-400">Proyeksi Simpanan</p>
          <p className="text-muted-foreground">Pertumbuhan simpanan pokok, wajib, dan sukarela</p>
        </div>
        <div className="p-2 rounded bg-background border">
          <p className="font-medium text-purple-600 dark:text-purple-400">Proyeksi Pinjaman</p>
          <p className="text-muted-foreground">Estimasi penyaluran dan pengembalian pinjaman</p>
        </div>
      </div>
    </div>

    {/* Assumptions */}
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Asumsi Proyeksi</span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span><strong>Tren berlanjut:</strong> Pola historis akan berlanjut di masa depan</span>
        </div>
        <div className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span><strong>Kondisi stabil:</strong> Tidak ada perubahan signifikan (kebijakan, ekonomi)</span>
        </div>
        <div className="flex items-start gap-2">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span><strong>Data representatif:</strong> Data historis cukup untuk prediksi akurat</span>
        </div>
      </div>
    </div>

    {/* Interpretation Guide */}
    <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <span className="font-medium text-sm">Interpretasi Hasil</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-1 mb-1">
            <ArrowUpRight className="h-3 w-3 text-green-500" />
            <span className="font-medium text-green-600">Tren Positif</span>
          </div>
          <p className="text-muted-foreground">Pertumbuhan yang sehat, lanjutkan strategi</p>
        </div>
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-1 mb-1">
            <ArrowDownRight className="h-3 w-3 text-red-500" />
            <span className="font-medium text-red-600">Tren Negatif</span>
          </div>
          <p className="text-muted-foreground">Perlu evaluasi dan penyesuaian strategi</p>
        </div>
      </div>
    </div>

    {/* Disclaimer */}
    <div className="text-center text-xs text-muted-foreground p-2 bg-muted/30 rounded">
      <AlertTriangle className="h-3 w-3 inline mr-1" />
      Proyeksi adalah estimasi berdasarkan data historis dan bukan jaminan hasil aktual
    </div>
  </>
);

// Chart of Accounts Equation Component
const ChartOfAccountsEquation = () => (
  <>
    {/* Main Concept */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Struktur Bagan Akun</p>
      <div className="flex items-center justify-center gap-2 text-base font-bold flex-wrap">
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-sm">
          1. Aset
        </span>
        <span className="px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-sm">
          2. Kewajiban
        </span>
        <span className="px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-sm">
          3. Modal
        </span>
        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-sm">
          4. Pendapatan
        </span>
        <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 text-sm">
          5. Beban
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        5 klasifikasi utama akun dalam sistem akuntansi koperasi
      </p>
    </div>

    {/* Account Numbering System */}
    <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <Hash className="h-4 w-4 text-blue-500" />
        <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Sistem Penomoran Akun</span>
      </div>
      <div className="grid gap-2 text-xs">
        <div className="grid grid-cols-5 gap-1">
          <div className="p-2 rounded bg-blue-500/20 text-center">
            <p className="font-bold text-blue-600">1-xxx</p>
            <p className="text-muted-foreground">Aset</p>
          </div>
          <div className="p-2 rounded bg-red-500/20 text-center">
            <p className="font-bold text-red-600">2-xxx</p>
            <p className="text-muted-foreground">Kewajiban</p>
          </div>
          <div className="p-2 rounded bg-green-500/20 text-center">
            <p className="font-bold text-green-600">3-xxx</p>
            <p className="text-muted-foreground">Modal</p>
          </div>
          <div className="p-2 rounded bg-emerald-500/20 text-center">
            <p className="font-bold text-emerald-600">4-xxx</p>
            <p className="text-muted-foreground">Pendapatan</p>
          </div>
          <div className="p-2 rounded bg-orange-500/20 text-center">
            <p className="font-bold text-orange-600">5-xxx</p>
            <p className="text-muted-foreground">Beban</p>
          </div>
        </div>
      </div>
    </div>

    {/* Account Types Details */}
    <div className="space-y-2">
      {/* Neraca Accounts */}
      <div className="p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 mb-2">
          <FolderTree className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Akun Neraca (Riil)</span>
          <Badge variant="outline" className="text-xs">Saldo berlanjut</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-3 text-xs">
          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
            <p className="font-medium text-blue-600">ASET (1-xxx)</p>
            <p className="text-muted-foreground">Kas, Bank, Piutang, Aset Tetap</p>
            <p className="text-muted-foreground mt-1 italic">Bertambah di DEBIT</p>
          </div>
          <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="font-medium text-red-600">KEWAJIBAN (2-xxx)</p>
            <p className="text-muted-foreground">Utang, Simpanan Anggota</p>
            <p className="text-muted-foreground mt-1 italic">Bertambah di KREDIT</p>
          </div>
          <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
            <p className="font-medium text-green-600">MODAL (3-xxx)</p>
            <p className="text-muted-foreground">Dana Cadangan, Modal Penyertaan</p>
            <p className="text-muted-foreground mt-1 italic">Bertambah di KREDIT</p>
          </div>
        </div>
      </div>

      {/* Laba Rugi Accounts */}
      <div className="p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 mb-2">
          <FolderTree className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Akun Laba Rugi (Nominal)</span>
          <Badge variant="outline" className="text-xs">Di-nolkan tiap periode</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 text-xs">
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
            <p className="font-medium text-emerald-600">PENDAPATAN (4-xxx)</p>
            <p className="text-muted-foreground">Bunga Pinjaman, Jasa Usaha, Denda</p>
            <p className="text-muted-foreground mt-1 italic">Bertambah di KREDIT</p>
          </div>
          <div className="p-2 rounded bg-orange-500/10 border border-orange-500/20">
            <p className="font-medium text-orange-600">BEBAN (5-xxx)</p>
            <p className="text-muted-foreground">Bunga Simpanan, Operasional, Penyusutan</p>
            <p className="text-muted-foreground mt-1 italic">Bertambah di DEBIT</p>
          </div>
        </div>
      </div>
    </div>

    {/* Example Account Codes */}
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">Contoh Kode Akun Koperasi</span>
      </div>
      <div className="grid gap-1 text-xs font-mono">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-blue-600">1-100</span> Kas
          </div>
          <div>
            <span className="text-blue-600">1-200</span> Bank
          </div>
          <div>
            <span className="text-blue-600">1-300</span> Piutang Pinjaman
          </div>
          <div>
            <span className="text-red-600">2-100</span> Simpanan Pokok
          </div>
          <div>
            <span className="text-red-600">2-200</span> Simpanan Wajib
          </div>
          <div>
            <span className="text-green-600">3-100</span> Dana Cadangan
          </div>
          <div>
            <span className="text-emerald-600">4-100</span> Pendapatan Bunga
          </div>
          <div>
            <span className="text-orange-600">5-100</span> Beban Operasional
          </div>
        </div>
      </div>
    </div>

    {/* Tips */}
    <div className="text-center text-xs text-muted-foreground p-2 bg-muted/30 rounded">
      <Info className="h-3 w-3 inline mr-1" />
      Gunakan kode akun yang konsisten untuk memudahkan pelaporan dan analisis
    </div>
  </>
);

// Connection between P&L and Balance Sheet
const ConnectionInfo = () => (
  <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
    <div className="flex items-center gap-2 mb-2">
      <Info className="h-4 w-4 text-blue-500" />
      <span className="font-medium text-sm">Hubungan dengan Neraca</span>
    </div>
    <p className="text-xs text-muted-foreground">
      SHU (Laba/Rugi) akan menambah atau mengurangi <strong>Modal/Ekuitas</strong> di Neraca.
      Jika SHU positif (Surplus), modal bertambah. Jika SHU negatif (Defisit), modal berkurang.
    </p>
  </div>
);

// Journal Templates Equation Component
const JournalTemplatesEquation = () => (
  <>
    {/* Main Concept */}
    <div className="text-center p-4 rounded-lg bg-background border">
      <p className="text-xs text-muted-foreground mb-2">Konsep Template Jurnal Otomatis</p>
      <div className="flex items-center justify-center gap-3 text-lg font-bold flex-wrap">
        <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Transaksi Anggota
        </span>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Template
        </span>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <span className="px-3 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Jurnal Otomatis
        </span>
      </div>
    </div>

    {/* Template Types */}
    <div className="p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Jenis Template Standar</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-medium text-emerald-600 mb-2 flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Simpanan
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-500" /> Simpanan Pokok
            </li>
            <li className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-500" /> Simpanan Wajib
            </li>
            <li className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-500" /> Simpanan Sukarela
            </li>
            <li className="flex items-center gap-1">
              <ArrowDownRight className="h-3 w-3 text-rose-500" /> Penarikan
            </li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-blue-600 mb-2 flex items-center gap-1">
            <Banknote className="h-3 w-3" /> Pinjaman
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-blue-500" /> Pencairan Pinjaman
            </li>
            <li className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-500" /> Angsuran (Pokok + Bunga)
            </li>
          </ul>
        </div>
      </div>
    </div>

    {/* How it Works */}
    <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <Info className="h-4 w-4 text-blue-500" />
        <span className="font-medium text-sm">Cara Kerja</span>
      </div>
      <ol className="text-xs text-muted-foreground space-y-2">
        <li className="flex items-start gap-2">
          <span className="font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 rounded-full w-5 h-5 flex items-center justify-center shrink-0">1</span>
          <span>Anggota mengajukan transaksi (simpanan/angsuran)</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 rounded-full w-5 h-5 flex items-center justify-center shrink-0">2</span>
          <span>Admin menyetujui transaksi</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 rounded-full w-5 h-5 flex items-center justify-center shrink-0">3</span>
          <span>Sistem otomatis membuat jurnal berdasarkan template</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 rounded-full w-5 h-5 flex items-center justify-center shrink-0">4</span>
          <span>Saldo akun (COA) diperbarui otomatis</span>
        </li>
      </ol>
    </div>

    {/* Example */}
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-sm">Contoh: Simpanan Wajib Rp 100.000</span>
      </div>
      <div className="bg-background rounded p-2 font-mono text-xs">
        <div className="flex justify-between border-b pb-1 mb-1">
          <span className="text-muted-foreground">Akun</span>
          <span className="text-muted-foreground">Debit | Kredit</span>
        </div>
        <div className="flex justify-between">
          <span>1-100 Kas/Bank</span>
          <span className="text-emerald-600">100.000 | -</span>
        </div>
        <div className="flex justify-between">
          <span className="pl-4">2-120 Simpanan Wajib</span>
          <span className="text-rose-600">- | 100.000</span>
        </div>
      </div>
    </div>

    {/* Tips */}
    <div className="text-center text-xs text-muted-foreground p-2 bg-muted/30 rounded">
      <span className="font-medium">Tips:</span> Pastikan semua template terkonfigurasi dengan akun yang benar sebelum menyetujui transaksi untuk hasil jurnal yang akurat.
    </div>
  </>
);

// Debit Credit Rules Component
const DebitCreditRules = ({ variant }: { variant: QuickEquationGuideVariant }) => (
  <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
    <div className="flex items-center gap-2 mb-2">
      <Lightbulb className="h-4 w-4 text-amber-500" />
      <span className="font-medium text-sm">
        {variant === 'profit-loss' ? 'Aturan Debit & Kredit untuk Laba Rugi' : 'Aturan Debit & Kredit'}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      {variant === 'profit-loss' ? (
        <>
          <div>
            <p className="font-medium text-green-600 mb-1">Pendapatan:</p>
            <p className="text-muted-foreground">Bertambah di KREDIT</p>
          </div>
          <div>
            <p className="font-medium text-red-600 mb-1">Beban/Biaya:</p>
            <p className="text-muted-foreground">Bertambah di DEBIT</p>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Plus className="h-3 w-3 text-green-500" />
              <span className="font-medium">Bertambah di DEBIT:</span>
            </div>
            <p className="text-muted-foreground pl-5">Aset, Beban</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Plus className="h-3 w-3 text-green-500" />
              <span className="font-medium">Bertambah di KREDIT:</span>
            </div>
            <p className="text-muted-foreground pl-5">Utang, Modal, Pendapatan</p>
          </div>
        </>
      )}
    </div>
  </div>
);

export default QuickEquationGuide;
