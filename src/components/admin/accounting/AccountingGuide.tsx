import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, TrendingUp, PieChart, Wallet, FileText, 
  Calculator, Scale, BarChart3, Building2, 
  HelpCircle, Lightbulb, AlertCircle, CheckCircle2,
  ChevronRight, X, Equal, Plus, Minus, ArrowRight, Info,
  Hash, Layers, Calendar
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { YearEndClosingGuide } from './YearEndClosingGuide';

// Accounting Equation Interactive Guide
interface EquationComponent {
  id: string;
  term: string;
  alternatives: string[];
  definition: string;
  examples: string[];
  formula?: string;
  subComponents?: {
    name: string;
    alternatives: string[];
    description: string;
  }[];
}

const equationComponents: EquationComponent[] = [
  {
    id: 'aktiva',
    term: 'AKTIVA',
    alternatives: ['Aset', 'Harta', 'Assets'],
    definition: 'Semua sumber daya ekonomi yang dimiliki koperasi yang diharapkan memberikan manfaat di masa depan.',
    examples: ['Kas', 'Bank', 'Piutang Anggota', 'Perlengkapan', 'Peralatan', 'Gedung'],
    subComponents: [
      {
        name: 'Aset Lancar',
        alternatives: ['Current Assets', 'Aktiva Lancar'],
        description: 'Aset yang dapat dikonversi menjadi kas dalam waktu 1 tahun (Kas, Bank, Piutang)'
      },
      {
        name: 'Aset Tetap',
        alternatives: ['Fixed Assets', 'Aktiva Tetap'],
        description: 'Aset jangka panjang untuk operasional (Gedung, Peralatan, Kendaraan)'
      }
    ]
  },
  {
    id: 'pasiva',
    term: 'PASIVA',
    alternatives: ['Liabilitas + Ekuitas', 'Sumber Dana', 'Liabilities + Equity'],
    definition: 'Sumber pendanaan koperasi yang terdiri dari kewajiban (utang) dan modal sendiri.',
    formula: 'Pasiva = Utang + Modal',
    examples: ['Simpanan Anggota', 'Pinjaman Bank', 'Modal Sendiri', 'Dana Cadangan'],
    subComponents: [
      {
        name: 'Utang / Kewajiban',
        alternatives: ['Liabilities', 'Liabilitas', 'Hutang'],
        description: 'Kewajiban membayar kepada pihak lain (Simpanan Sukarela, Pinjaman Diterima)'
      },
      {
        name: 'Modal / Ekuitas',
        alternatives: ['Equity', 'Capital', 'Kekayaan Bersih'],
        description: 'Hak pemilik atas aset setelah dikurangi kewajiban (Simpanan Pokok, Wajib, Dana Cadangan)'
      }
    ]
  }
];

const equationFormulas = [
  {
    name: 'Persamaan Dasar Akuntansi',
    formula: 'Aktiva = Pasiva',
    explanation: 'Harta yang dimiliki harus sama dengan sumber pendanaannya',
    expanded: 'Aset = Utang + Modal',
    color: 'primary'
  },
  {
    name: 'Rumus Modal/Ekuitas',
    formula: 'Modal = Aktiva - Utang',
    explanation: 'Modal adalah selisih antara total aset dan total utang',
    expanded: 'Equity = Assets - Liabilities',
    color: 'green'
  },
  {
    name: 'Neraca Seimbang',
    formula: 'Total Aset = Total Kewajiban + Total Ekuitas',
    explanation: 'Neraca harus selalu seimbang (balance)',
    expanded: 'Jika tidak seimbang, ada kesalahan pencatatan',
    color: 'blue'
  }
];

const AccountingEquationGuide = () => {
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Main Equation Display */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
        <div className="text-center mb-4">
          <h4 className="text-lg font-semibold text-primary mb-2">Persamaan Dasar Akuntansi</h4>
          <p className="text-sm text-muted-foreground">Fondasi utama pembukuan koperasi</p>
        </div>
        
        {/* Interactive Equation */}
        <div className="flex items-center justify-center gap-2 flex-wrap text-lg font-bold py-4">
          <Collapsible open={expandedComponent === 'aktiva'}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:border-blue-800 dark:text-blue-300 transition-all"
                onClick={() => setExpandedComponent(expandedComponent === 'aktiva' ? null : 'aktiva')}
              >
                <span className="font-bold">AKTIVA</span>
                <Info className="h-4 w-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          
          <Equal className="h-6 w-6 text-muted-foreground" />
          
          <Collapsible open={expandedComponent === 'pasiva'}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-800 dark:text-green-300 transition-all"
                onClick={() => setExpandedComponent(expandedComponent === 'pasiva' ? null : 'pasiva')}
              >
                <span className="font-bold">PASIVA</span>
                <Info className="h-4 w-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Alternative Names Display */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="text-blue-600 dark:text-blue-400">(Aset / Harta)</span>
          <span>=</span>
          <span className="text-green-600 dark:text-green-400">(Utang + Modal)</span>
        </div>
      </div>

      {/* Expanded Component Details */}
      {expandedComponent && (
        <div className="animate-fade-in">
          {equationComponents
            .filter(c => c.id === expandedComponent)
            .map(component => (
              <Card key={component.id} className={`border-2 ${
                component.id === 'aktiva' 
                  ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50' 
                  : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50'
              }`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className={component.id === 'aktiva' ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'}>
                      {component.term}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-muted-foreground font-normal text-base">
                      {component.alternatives.join(' / ')}
                    </span>
                  </CardTitle>
                  <CardDescription>{component.definition}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {component.formula && (
                    <div className="p-3 rounded-lg bg-background border">
                      <span className="text-sm font-medium">Rumus: </span>
                      <span className="font-mono text-primary">{component.formula}</span>
                    </div>
                  )}
                  
                  {/* Sub Components */}
                  {component.subComponents && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {component.subComponents.map((sub, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-background border">
                          <div className="font-medium text-sm">{sub.name}</div>
                          <div className="text-xs text-muted-foreground mb-1">
                            ({sub.alternatives.join(' / ')})
                          </div>
                          <p className="text-sm text-muted-foreground">{sub.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Examples */}
                  <div>
                    <div className="text-sm font-medium mb-2">Contoh dalam Koperasi:</div>
                    <div className="flex flex-wrap gap-2">
                      {component.examples.map((ex, idx) => (
                        <Badge key={idx} variant="secondary">{ex}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Formula Cards */}
      <div className="grid gap-3 md:grid-cols-3">
        {equationFormulas.map((formula, idx) => (
          <div 
            key={idx} 
            className={`p-4 rounded-lg border bg-gradient-to-br ${
              formula.color === 'primary' 
                ? 'from-primary/5 to-transparent border-primary/20' 
                : formula.color === 'green'
                ? 'from-green-500/5 to-transparent border-green-500/20'
                : 'from-blue-500/5 to-transparent border-blue-500/20'
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground mb-1">{formula.name}</div>
            <div className={`font-mono font-bold text-sm mb-2 ${
              formula.color === 'primary' 
                ? 'text-primary' 
                : formula.color === 'green'
                ? 'text-green-600 dark:text-green-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}>
              {formula.formula}
            </div>
            <p className="text-xs text-muted-foreground">{formula.explanation}</p>
            <div className="mt-2 text-xs text-muted-foreground/70 italic">{formula.expanded}</div>
          </div>
        ))}
      </div>

      {/* Debit Credit Rules */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Aturan Debit & Kredit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-500" />
                <span className="font-medium">Bertambah di DEBIT:</span>
              </div>
              <ul className="pl-6 space-y-1 text-muted-foreground">
                <li>• Aset (Aktiva/Harta)</li>
                <li>• Beban (Biaya)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-500" />
                <span className="font-medium">Bertambah di KREDIT:</span>
              </div>
              <ul className="pl-6 space-y-1 text-muted-foreground">
                <li>• Utang (Kewajiban/Liabilitas)</li>
                <li>• Modal (Ekuitas)</li>
                <li>• Pendapatan</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 p-2 rounded bg-background text-xs text-center border">
            <span className="font-medium">Ingat: </span>
            <span className="text-muted-foreground">Total Debit harus selalu sama dengan Total Kredit</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Account Code Numbering Guide Component
const accountCodeStructure = {
  format: 'X-XXXX',
  description: 'Format: [Tipe Akun]-[Kategori][Sub-Kategori][Urutan]',
  legend: [
    { position: 'Digit 1', meaning: 'Tipe Akun (1-5)', example: '1 = Aset, 2 = Kewajiban' },
    { position: 'Digit 2-3', meaning: 'Kategori (10-99)', example: '10 = Kas, 20 = Piutang' },
    { position: 'Digit 4-5', meaning: 'Sub-kategori/Urutan (00-99)', example: '00 = Umum, 01 = Pertama' },
  ]
};

const accountCodeCategories = [
  {
    code: '1-XXXX',
    type: 'ASET',
    color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    headerColor: 'bg-blue-500',
    description: 'Semua harta/kekayaan yang dimiliki koperasi',
    rule: 'Bertambah di DEBIT, berkurang di KREDIT',
    subCategories: [
      { range: '1-10XX', name: 'Kas & Setara Kas', accounts: [
        { code: '1-1000', name: 'Kas', description: 'Uang tunai di tangan/brankas' },
      ]},
      { range: '1-11XX', name: 'Bank', accounts: [
        { code: '1-1100', name: 'Bank', description: 'Saldo rekening bank' },
      ]},
      { range: '1-20XX', name: 'Piutang', accounts: [
        { code: '1-2000', name: 'Piutang Pinjaman Anggota', description: 'Pinjaman yang belum dilunasi anggota' },
      ]},
    ]
  },
  {
    code: '2-XXXX',
    type: 'KEWAJIBAN',
    color: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
    headerColor: 'bg-red-500',
    description: 'Utang/kewajiban yang harus dibayar koperasi kepada anggota',
    rule: 'Bertambah di KREDIT, berkurang di DEBIT',
    subCategories: [
      { range: '2-10XX', name: 'Hutang Simpanan Anggota', accounts: [
        { code: '2-1010', name: 'Hutang Simpanan Pokok', description: 'Total simpanan pokok seluruh anggota' },
        { code: '2-1020', name: 'Hutang Simpanan Wajib', description: 'Total simpanan wajib seluruh anggota' },
        { code: '2-1030', name: 'Hutang Simpanan Sukarela', description: 'Total simpanan sukarela seluruh anggota (dapat diambil)' },
      ]},
      { range: '2-30XX', name: 'Hutang SHU', accounts: [
        { code: '2-3050', name: 'Hutang SHU Ditahan', description: 'SHU anggota yang ditahan karena tunggakan pinjaman' },
      ]},
    ]
  },
  {
    code: '3-XXXX',
    type: 'EKUITAS',
    color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    headerColor: 'bg-green-500',
    description: 'Modal/kekayaan bersih koperasi',
    rule: 'Bertambah di KREDIT, berkurang di DEBIT',
    subCategories: [
      { range: '3-10XX', name: 'Dana Cadangan & Dana Khusus', accounts: [
        { code: '3-1000', name: 'Dana Cadangan', description: 'Cadangan dari alokasi SHU' },
        { code: '3-1010', name: 'Dana Pendidikan', description: 'Dana pendidikan dari alokasi SHU' },
        { code: '3-1020', name: 'Dana Sosial', description: 'Dana sosial dari alokasi SHU' },
        { code: '3-1030', name: 'Dana Pembangunan', description: 'Dana pembangunan dari alokasi SHU' },
      ]},
      { range: '3-20XX', name: 'Modal Lainnya', accounts: [
        { code: '3-2000', name: 'Modal Penyertaan', description: 'Modal penyertaan dari pihak lain' },
        { code: '3-2050', name: 'Cadangan SHU Ditahan', description: 'Cadangan untuk SHU yang ditahan dari anggota bermasalah' },
      ]},
      { range: '3-30XX', name: 'Sisa Hasil Usaha (SHU)', accounts: [
        { code: '3-3000', name: 'SHU Tahun Berjalan', description: 'Sisa Hasil Usaha tahun berjalan' },
        { code: '3-3010', name: 'SHU Anggota - Jasa Simpanan', description: 'Bagian SHU anggota dari jasa simpanan' },
        { code: '3-3020', name: 'SHU Anggota - Jasa Pinjaman', description: 'Bagian SHU anggota dari jasa pinjaman' },
        { code: '3-3030', name: 'SHU Pengurus', description: 'Bagian SHU untuk pengurus koperasi' },
        { code: '3-3040', name: 'SHU Pengawas', description: 'Bagian SHU untuk pengawas koperasi' },
        { code: '3-3050', name: 'SHU Penasihat', description: 'Bagian SHU untuk penasihat koperasi' },
      ]},
    ]
  },
  {
    code: '4-XXXX',
    type: 'PENDAPATAN',
    color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
    headerColor: 'bg-emerald-500',
    description: 'Penghasilan dari kegiatan usaha koperasi',
    rule: 'Bertambah di KREDIT, berkurang di DEBIT',
    subCategories: [
      { range: '4-10XX', name: 'Pendapatan Utama', accounts: [
        { code: '4-1000', name: 'Pendapatan Bunga Pinjaman', description: 'Pendapatan bunga dari angsuran pinjaman' },
      ]},
      { range: '4-20XX', name: 'Pendapatan Denda', accounts: [
        { code: '4-2000', name: 'Pendapatan Denda Keterlambatan', description: 'Pendapatan denda dari angsuran terlambat' },
      ]},
      { range: '4-30XX', name: 'Pendapatan Jasa Usaha', accounts: [
        { code: '4-3000', name: 'Pendapatan Jasa Usaha', description: 'Pendapatan dari unit usaha koperasi' },
      ]},
      { range: '4-40XX', name: 'Pendapatan Lainnya', accounts: [
        { code: '4-4000', name: 'Pendapatan Administrasi', description: 'Pendapatan biaya administrasi' },
      ]},
    ]
  },
  {
    code: '5-XXXX',
    type: 'BEBAN',
    color: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700',
    headerColor: 'bg-orange-500',
    description: 'Biaya/pengeluaran operasional koperasi',
    rule: 'Bertambah di DEBIT, berkurang di KREDIT',
    subCategories: [
      { range: '5-10XX', name: 'Beban Bunga', accounts: [
        { code: '5-1000', name: 'Beban Bunga Simpanan Sukarela', description: 'Beban bunga yang dibayarkan ke anggota' },
      ]},
      { range: '5-20XX', name: 'Beban Operasional', accounts: [
        { code: '5-2000', name: 'Beban Operasional', description: 'Biaya operasional koperasi' },
      ]},
      { range: '5-30XX', name: 'Beban Administrasi', accounts: [
        { code: '5-3000', name: 'Beban Administrasi', description: 'Biaya administrasi dan kantor' },
      ]},
      { range: '5-40XX', name: 'Beban Penyusutan', accounts: [
        { code: '5-4000', name: 'Beban Penyusutan', description: 'Beban penyusutan aset tetap' },
      ]},
    ]
  },
];

const AccountCodeNumberingGuide = () => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Format Overview */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
        <div className="text-center mb-4">
          <h4 className="text-lg font-semibold text-primary mb-1">Format Penomoran Kode Akun</h4>
          <p className="text-sm text-muted-foreground">Sistem penomoran standar untuk koperasi simpan pinjam</p>
        </div>
        
        {/* Format Display */}
        <div className="flex items-center justify-center gap-1 text-2xl font-mono font-bold py-4 mb-4">
          <span className="px-3 py-2 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700">
            X
          </span>
          <span className="text-muted-foreground">-</span>
          <span className="px-3 py-2 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-700">
            X
          </span>
          <span className="px-3 py-2 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-700">
            X
          </span>
          <span className="px-3 py-2 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700">
            X
          </span>
          <span className="px-3 py-2 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700">
            X
          </span>
        </div>

        {/* Legend */}
        <div className="grid gap-2 md:grid-cols-3">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-center">
            <div className="font-mono font-bold text-blue-700 dark:text-blue-300 text-lg">X</div>
            <div className="text-xs font-medium text-blue-800 dark:text-blue-200">Tipe Akun</div>
            <div className="text-xs text-muted-foreground">1-5</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-center">
            <div className="font-mono font-bold text-amber-700 dark:text-amber-300 text-lg">XX</div>
            <div className="text-xs font-medium text-amber-800 dark:text-amber-200">Kategori</div>
            <div className="text-xs text-muted-foreground">10-99</div>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-center">
            <div className="font-mono font-bold text-green-700 dark:text-green-300 text-lg">XX</div>
            <div className="text-xs font-medium text-green-800 dark:text-green-200">Sub-Kategori</div>
            <div className="text-xs text-muted-foreground">00-99</div>
          </div>
        </div>
      </div>

      {/* Type Overview Cards */}
      <div className="grid gap-2 grid-cols-5">
        {accountCodeCategories.map((cat) => (
          <div 
            key={cat.code}
            className={`p-2 rounded-lg border cursor-pointer transition-all hover:scale-105 ${cat.color} ${
              expandedCategory === cat.code ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setExpandedCategory(expandedCategory === cat.code ? null : cat.code)}
          >
            <div className="text-center">
              <div className="font-mono font-bold text-sm">{cat.code.charAt(0)}</div>
              <div className="text-xs font-medium truncate">{cat.type}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Category Details */}
      {expandedCategory && (
        <div className="animate-fade-in">
          {accountCodeCategories
            .filter(c => c.code === expandedCategory)
            .map(category => (
              <Card key={category.code} className={`border-2 ${category.color}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="font-mono bg-background px-2 py-1 rounded border">
                        {category.code}
                      </span>
                      <span>{category.type}</span>
                    </CardTitle>
                    <Badge variant="outline" className="font-normal">
                      {category.rule}
                    </Badge>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {category.subCategories.map((sub, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono">
                          {sub.range}
                        </Badge>
                        <span className="font-medium text-sm">{sub.name}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[100px] text-xs">Kode</TableHead>
                              <TableHead className="text-xs">Nama Akun</TableHead>
                              <TableHead className="text-xs hidden md:table-cell">Keterangan</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sub.accounts.map((account, accIdx) => (
                              <TableRow key={accIdx} className="hover:bg-background/50">
                                <TableCell className="font-mono text-xs font-medium">
                                  {account.code}
                                </TableCell>
                                <TableCell className="text-xs">{account.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                                  {account.description}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Quick Reference - All Account Types */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Referensi Cepat - Semua Tipe Akun
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Awalan</TableHead>
                  <TableHead className="w-[100px]">Tipe</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="hidden md:table-cell">Aturan D/K</TableHead>
                  <TableHead className="hidden lg:table-cell">Contoh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountCodeCategories.map((cat) => (
                  <TableRow key={cat.code} className="hover:bg-muted/50">
                    <TableCell className="font-mono font-bold text-lg">{cat.code.charAt(0)}</TableCell>
                    <TableCell>
                      <Badge className={`${cat.color} border`}>
                        {cat.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{cat.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                      {cat.rule}
                    </TableCell>
                    <TableCell className="font-mono text-xs hidden lg:table-cell">
                      {cat.subCategories[0]?.accounts[0]?.code}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Tips Penomoran Akun
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
              <span><strong>Konsisten:</strong> Gunakan format yang sama untuk semua akun</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
              <span><strong>Ruang Ekspansi:</strong> Sisakan nomor untuk akun baru (misal: 1-1100, 1-1110, 1-1120)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
              <span><strong>Kelompokkan:</strong> Akun sejenis dalam range yang sama (Bank: 1-11XX)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
              <span><strong>Dokumentasi:</strong> Catat deskripsi setiap akun untuk referensi</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

interface GuideItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  details: string[];
  tips?: string[];
}

const guideData: GuideItem[] = [
  {
    title: 'Neraca (Balance Sheet)',
    description: 'Laporan posisi keuangan yang menunjukkan aset, kewajiban, dan ekuitas pada suatu titik waktu',
    icon: <BookOpen className="h-5 w-5" />,
    category: 'Laporan Keuangan',
    details: [
      'Aset = Kewajiban + Ekuitas (Persamaan Dasar Akuntansi)',
      'Aset Lancar: Kas, Bank, Piutang',
      'Kewajiban: Simpanan Anggota, Pinjaman Diterima',
      'Ekuitas: Modal Sendiri, Dana Cadangan, SHU'
    ],
    tips: [
      'Pastikan neraca selalu seimbang (balance)',
      'Periksa saldo awal di awal tahun buku'
    ]
  },
  {
    title: 'Laba Rugi (Income Statement)',
    description: 'Laporan yang menunjukkan pendapatan, beban, dan laba/rugi selama periode tertentu',
    icon: <TrendingUp className="h-5 w-5" />,
    category: 'Laporan Keuangan',
    details: [
      'Pendapatan: Bunga Pinjaman, Denda, Jasa Lainnya',
      'Beban: Bunga Simpanan, Operasional, Administrasi',
      'SHU Bruto = Total Pendapatan - Total Beban',
      'SHU adalah istilah khusus koperasi untuk Laba/Rugi'
    ],
    tips: [
      'Catat semua transaksi tepat waktu',
      'Pisahkan pendapatan operasional dan non-operasional'
    ]
  },
  {
    title: 'Distribusi SHU',
    description: 'Pembagian Sisa Hasil Usaha kepada anggota berdasarkan jasa simpanan dan jasa usaha',
    icon: <PieChart className="h-5 w-5" />,
    category: 'Laporan Keuangan',
    details: [
      'SHU Anggota dibagi berdasarkan: Jasa Simpanan & Jasa Usaha',
      'Jasa Simpanan: Proporsi simpanan pokok + wajib anggota',
      'Jasa Usaha: Proporsi bunga pinjaman yang dibayar anggota',
      'Alokasi Dana: Cadangan, Pendidikan, Sosial, Pembangunan'
    ],
    tips: [
      'Konfirmasi distribusi sebelum RAT',
      'Simpan bukti distribusi untuk audit'
    ]
  },
  {
    title: 'Arus Kas (Cash Flow)',
    description: 'Laporan pergerakan kas dari aktivitas operasi, investasi, dan pendanaan',
    icon: <Wallet className="h-5 w-5" />,
    category: 'Laporan Keuangan',
    details: [
      'Operasi: Penerimaan angsuran, pembayaran bunga',
      'Investasi: Pembelian/penjualan aset tetap',
      'Pendanaan: Penerimaan simpanan, pencairan pinjaman',
      'Saldo Akhir = Saldo Awal + Arus Masuk - Arus Keluar'
    ],
    tips: [
      'Monitor arus kas untuk likuiditas',
      'Proyeksikan kebutuhan kas bulanan'
    ]
  },
  {
    title: 'Buku Kas/Bank',
    description: 'Catatan harian mutasi kas dan bank beserta saldo berjalan',
    icon: <RupiahIcon className="h-5 w-5" />,
    category: 'Buku Besar',
    details: [
      'Catat setiap transaksi kas masuk dan keluar',
      'Pisahkan buku kas dan buku bank',
      'Rekonsiliasi dengan rekening koran bank',
      'Saldo harus selalu positif (tidak boleh minus)'
    ],
    tips: [
      'Tutup buku kas setiap hari',
      'Cocokkan dengan bukti fisik kas'
    ]
  },
  {
    title: 'Jurnal Umum',
    description: 'Pencatatan transaksi dengan sistem debit-kredit sesuai standar akuntansi',
    icon: <FileText className="h-5 w-5" />,
    category: 'Buku Besar',
    details: [
      'Setiap jurnal harus balance (Debit = Kredit)',
      'Aset bertambah di Debit, berkurang di Kredit',
      'Kewajiban/Ekuitas bertambah di Kredit',
      'Pendapatan di Kredit, Beban di Debit'
    ],
    tips: [
      'Gunakan template untuk transaksi rutin',
      'Review jurnal sebelum posting ke buku besar'
    ]
  },
  {
    title: 'Bagan Akun (COA)',
    description: 'Daftar semua akun yang digunakan dalam sistem pembukuan koperasi',
    icon: <Calculator className="h-5 w-5" />,
    category: 'Pengaturan',
    details: [
      '1xxx: Aset (Kas, Bank, Piutang)',
      '2xxx: Kewajiban (Simpanan, Hutang)',
      '3xxx: Ekuitas (Modal, Dana Cadangan)',
      '4xxx: Pendapatan',
      '5xxx: Beban'
    ],
    tips: [
      'Jangan ubah akun sistem',
      'Tambah sub-akun sesuai kebutuhan'
    ]
  },
  {
    title: 'Rekonsiliasi Bank',
    description: 'Pencocokan saldo buku dengan saldo rekening koran bank',
    icon: <Scale className="h-5 w-5" />,
    category: 'Verifikasi',
    details: [
      'Outstanding Deposit: Setoran belum masuk ke bank',
      'Outstanding Check: Cek belum dicairkan',
      'Selisih harus nol setelah penyesuaian',
      'Lakukan rekonsiliasi setiap akhir bulan'
    ],
    tips: [
      'Simpan bukti rekonsiliasi',
      'Investigasi selisih yang tidak wajar'
    ]
  },
  {
    title: 'Proyeksi Keuangan',
    description: 'Prediksi pendapatan dan pengeluaran berdasarkan tren data historis',
    icon: <BarChart3 className="h-5 w-5" />,
    category: 'Analisis',
    details: [
      'Menggunakan regresi linear untuk proyeksi',
      'Proyeksi 3, 6, atau 12 bulan ke depan',
      'Membantu perencanaan anggaran',
      'Identifikasi tren pertumbuhan/penurunan'
    ],
    tips: [
      'Minimal 6 bulan data historis untuk akurasi',
      'Gunakan sebagai acuan, bukan kepastian'
    ]
  },
  {
    title: 'Unit Usaha',
    description: 'Pengelolaan keuangan per unit usaha untuk analisis profitabilitas',
    icon: <Building2 className="h-5 w-5" />,
    category: 'Pengaturan',
    details: [
      'Pisahkan pendapatan dan beban per unit',
      'Analisis kontribusi setiap unit',
      'Laporan laba rugi per unit usaha',
      'Alokasi biaya overhead ke unit'
    ],
    tips: [
      'Tetapkan unit utama (Simpan Pinjam)',
      'Konsisten dalam alokasi biaya'
    ]
  }
];

export const AccountingGuide = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(guideData.map(item => item.category))];
  const filteredGuide = selectedCategory 
    ? guideData.filter(item => item.category === selectedCategory)
    : guideData;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <HelpCircle className="h-4 w-4" />
        Panduan Akuntansi
      </Button>
    );
  }

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Panduan Pembukuan Koperasi</CardTitle>
              <CardDescription>
                Penjelasan fitur dan konsep akuntansi untuk pengelola
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Year-End Closing Guide - New Section */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="year-end-guide" className="border-amber-500/30">
            <AccordionTrigger className="hover:no-underline bg-gradient-to-r from-amber-500/10 to-transparent rounded-lg px-3">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="font-semibold text-amber-700 dark:text-amber-400">Panduan Tutup Buku Tahunan</div>
                  <div className="text-sm text-muted-foreground">
                    Langkah-langkah tutup buku, rollover dana, dan penanganan pinjaman lintas tahun
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <YearEndClosingGuide />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Account Code Numbering Guide - New Section */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="account-code-guide" className="border-primary/30">
            <AccordionTrigger className="hover:no-underline bg-gradient-to-r from-emerald-500/10 to-transparent rounded-lg px-3">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Hash className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">Panduan Penomoran Kode Akun</div>
                  <div className="text-sm text-muted-foreground">
                    Format X-XXXX • 1=Aset, 2=Kewajiban, 3=Ekuitas, 4=Pendapatan, 5=Beban
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <AccountCodeNumberingGuide />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Accounting Equation Guide - Interactive Section */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="equation-guide" className="border-primary/30">
            <AccordionTrigger className="hover:no-underline bg-gradient-to-r from-primary/5 to-transparent rounded-lg px-3">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-primary">Panduan Persamaan Akuntansi</div>
                  <div className="text-sm text-muted-foreground">
                    Aktiva = Pasiva • Aset = Utang + Modal • Klik untuk mempelajari lebih lanjut
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <AccountingEquationGuide />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant={selectedCategory === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
          >
            Semua
          </Badge>
          {categories.map(cat => (
            <Badge 
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Guide Items */}
        <Accordion type="single" collapsible className="w-full">
          {filteredGuide.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 rounded-lg bg-muted">
                    {item.icon}
                  </div>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-12 space-y-4">
                  {/* Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertCircle className="h-4 w-4 text-blue-500" />
                      Penjelasan:
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {item.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tips */}
                  {item.tips && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Tips:
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {item.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};
