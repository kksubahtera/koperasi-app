import { createAndDownloadExcel, SheetData } from './excelUtils';
import html2canvas from 'html2canvas';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { BalanceSheetCalculation } from '@/hooks/useBalanceSheetCalculation';
import { ProfitLoss } from '@/lib/cooperativeSettings';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Export Balance Sheet to Excel
export const exportBalanceSheetToExcel = async (
  balanceSheet: BalanceSheetCalculation,
  year: number
) => {
  const settings = getCooperativeSettings();
  
  const asetLancarData = [
    ['LAPORAN NERACA KEUANGAN', '', ''],
    [settings.name, '', ''],
    [`Tahun Buku ${year}`, '', ''],
    ['', '', ''],
    ['ASET LANCAR', '', ''],
    ['Keterangan', 'Jumlah', 'Jenis'],
    ['Kas di Bank', formatCurrency(balanceSheet.kasBank || 0), 'Otomatis'],
    ['Piutang Usaha', formatCurrency(balanceSheet.piutangUsaha || 0), 'Otomatis'],
    ['TOTAL ASET LANCAR', formatCurrency(balanceSheet.totalAsetLancar || 0), ''],
    ['', '', ''],
  ];

  const asetTetapData = balanceSheet.asetTetap ? [
    ['ASET TETAP', '', ''],
    ['Harga Perolehan', formatCurrency(balanceSheet.asetTetap || 0), 'Otomatis'],
    ['Akumulasi Penyusutan', `(${formatCurrency(balanceSheet.akumulasiPenyusutan || 0)})`, 'Otomatis'],
    ['NILAI BUKU ASET TETAP', formatCurrency(balanceSheet.nilaiAsetTetapBersih || 0), ''],
    ['', '', ''],
    ['TOTAL ASET', formatCurrency(balanceSheet.totalAset || 0), ''],
    ['', '', ''],
  ] : [];

  const hartaKoperasiData = [
    ['HARTA KOPERASI (MODAL)', 'Saldo Awal', 'Penambahan', 'Pengurangan', 'Saldo Akhir'],
    ['Simpanan Pokok', formatCurrency(balanceSheet.saldoAwalSimpananPokok || 0), formatCurrency(balanceSheet.penambahanSimpananPokok || 0), formatCurrency(balanceSheet.penguranganSimpananPokok || 0), formatCurrency(balanceSheet.simpananPokok || 0)],
    ['Simpanan Wajib', formatCurrency(balanceSheet.saldoAwalSimpananWajib || 0), formatCurrency(balanceSheet.penambahanSimpananWajib || 0), formatCurrency(balanceSheet.penguranganSimpananWajib || 0), formatCurrency(balanceSheet.simpananWajib || 0)],
    ['Simpanan Sukarela', formatCurrency(balanceSheet.saldoAwalSimpananSukarela || 0), formatCurrency(balanceSheet.penambahanSimpananSukarela || 0), formatCurrency(balanceSheet.penguranganSimpananSukarela || 0), formatCurrency(balanceSheet.simpananSukarela || 0)],
    ['Dana Cadangan', formatCurrency(balanceSheet.saldoAwalDanaCadangan || 0), formatCurrency(balanceSheet.penambahanDanaCadangan || 0), formatCurrency(balanceSheet.penguranganDanaCadangan || 0), formatCurrency(balanceSheet.danaCadangan || 0)],
    ['Hibah/Donasi', formatCurrency(balanceSheet.saldoAwalHibahDonasi || 0), formatCurrency(balanceSheet.penambahanHibahDonasi || 0), formatCurrency(balanceSheet.penguranganHibahDonasi || 0), formatCurrency(balanceSheet.hibahDonasi || 0)],
    ['Modal Penyertaan', formatCurrency(balanceSheet.saldoAwalModalPenyertaan || 0), formatCurrency(balanceSheet.penambahanModalPenyertaan || 0), formatCurrency(balanceSheet.penguranganModalPenyertaan || 0), formatCurrency(balanceSheet.modalPenyertaan || 0)],
    ['', '', '', '', ''],
    ['TOTAL HARTA KOPERASI', '', '', '', formatCurrency(balanceSheet.totalHartaKoperasi || 0)],
  ];

  const allData = [...asetLancarData, ...asetTetapData, ...hartaKoperasiData];
  
  const sheets: SheetData[] = [{ name: 'Neraca', data: allData }];
  await createAndDownloadExcel(sheets, `Neraca_${settings.name.replace(/\s+/g, '_')}_${year}.xlsx`);
};

// Export Profit Loss to Excel
export const exportProfitLossToExcel = async (
  profitLoss: ProfitLoss & { biayaPenyusutan?: number },
  incomeEntries: { description: string; amount: number; type: string }[],
  expenseEntries: { description: string; amount: number; type: string }[],
  year: number
) => {
  const settings = getCooperativeSettings();
  const manualIncomes = incomeEntries.filter(e => e.type === 'manual');
  const manualExpenses = expenseEntries.filter(e => e.type === 'manual');

  const data = [
    ['LAPORAN LABA RUGI', ''],
    [settings.name, ''],
    [`Tahun Buku ${year}`, ''],
    ['', ''],
    ['PENDAPATAN', ''],
    ['Pendapatan Bunga Pinjaman', formatCurrency(profitLoss.pendapatanBungaPinjaman || 0)],
    ['Pendapatan Denda Pinjaman', formatCurrency(profitLoss.pendapatanDendaPinjaman || 0)],
    ['Pendapatan Lainnya (Manual)', formatCurrency(profitLoss.pendapatanManual || 0)],
    ...manualIncomes.map(i => [`  - ${i.description}`, formatCurrency(i.amount)]),
    ['TOTAL PENDAPATAN', formatCurrency(profitLoss.totalPendapatan || 0)],
    ['', ''],
    ['BIAYA USAHA', ''],
    ['Biaya Bunga Simpanan Sukarela', formatCurrency(profitLoss.biayaBungaSimpanan || 0)],
    ['Biaya Operasional (Manual)', formatCurrency(profitLoss.biayaManual || 0)],
    ...manualExpenses.map(e => [`  - ${e.description}`, formatCurrency(e.amount)]),
    ['Beban Penyusutan Aset Tetap', formatCurrency(profitLoss.biayaPenyusutan || 0)],
    ['TOTAL BIAYA', formatCurrency(profitLoss.totalBiaya || 0)],
    ['', ''],
    ['SISA HASIL USAHA (SHU)', formatCurrency(profitLoss.shuBruto || 0)],
  ];

  const sheets: SheetData[] = [{ name: 'Laba Rugi', data: data }];
  await createAndDownloadExcel(sheets, `Laba_Rugi_${settings.name.replace(/\s+/g, '_')}_${year}.xlsx`);
};

// Print report to PDF
export const printReportToPDF = async (
  elementRef: React.RefObject<HTMLDivElement>,
  reportType: 'neraca' | 'labarugi' | 'aruskas' | 'shu',
  year: number,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<boolean> => {
  if (!elementRef.current) return false;

  const settings = getCooperativeSettings();
  const reportNames: Record<string, string> = {
    neraca: 'Neraca Keuangan',
    labarugi: 'Laba Rugi',
    aruskas: 'Arus Kas',
    shu: 'Distribusi SHU',
  };

  const isLandscape = orientation === 'landscape';

  try {
    const canvas = await html2canvas(elementRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');

    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan ${reportNames[reportType]} ${year} - ${settings.name}</title>
          <style>
            @page { 
              size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'}; 
              margin: 1cm; 
            }
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif; 
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px; 
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 { 
              margin: 0; 
              font-size: 20px; 
              font-weight: bold;
            }
            .header h2 { 
              margin: 5px 0; 
              font-size: 16px; 
              font-weight: normal;
            }
            .header p { 
              margin: 5px 0; 
              font-size: 12px; 
              color: #666; 
            }
            .orientation-badge {
              display: inline-block;
              background: ${isLandscape ? '#3b82f6' : '#10b981'};
              color: white;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
              margin-left: 8px;
              text-transform: uppercase;
            }
            img { 
              max-width: 100%; 
              height: auto; 
              display: block;
              margin: 0 auto;
            }
            .footer {
              margin-top: 30px;
              text-align: right;
              font-size: 11px;
              color: #666;
            }
            @media print { 
              body { padding: 0; } 
              .orientation-badge { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${settings.name}</h1>
            <p>${settings.address}</p>
            <h2>
              Laporan ${reportNames[reportType]}
              <span class="orientation-badge">${isLandscape ? 'Landscape' : 'Portrait'}</span>
            </h2>
            <p>Tahun Buku ${year}</p>
          </div>
          <img src="${imgData}" />
          <div class="footer">
            <p>Dicetak pada: ${new Date().toLocaleDateString('id-ID', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
};
