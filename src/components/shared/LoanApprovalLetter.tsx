import { useRef, useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Building2, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { SignatorySelector } from './SignatorySelector';
import { SignatureBlock } from './SignatureBlock';
import { useIssuedLetters } from '@/hooks/useLetterNumbering';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStylesForPrint, LogoFrameType } from '@/lib/logoFrameUtils';
import { useSignatoryOfficers, useSignatureLayout } from '@/hooks/useSignatoryOfficers';
import { useLetterTemplate } from '@/hooks/useLetterTemplate';
import { useAuth } from '@/contexts/AuthContext';

interface LoanData {
  id: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  approvedAt?: string;
  memberName: string;
  memberNumber: string;
}

interface LoanApprovalLetterProps {
  loan: LoanData;
  open: boolean;
  onClose: () => void;
}

export const LoanApprovalLetter = ({ loan, open, onClose }: LoanApprovalLetterProps) => {
  const letterRef = useRef<HTMLDivElement>(null);
  const { t } = useThemeLanguage();
  const { user } = useAuth();
  const isAdmin = user?.activeRole === 'admin';
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [selectedSignatoryIds, setSelectedSignatoryIds] = useState<string[]>([]);
  const [letterNumber, setLetterNumber] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const { issueLetterNumber, getExistingLetterNumber } = useIssuedLetters();
  const { signatories } = useSignatoryOfficers();
  const { layoutSettings } = useSignatureLayout('loan_approval');
  const { template, parseText, getBadgeColorClass, getBadgeIconColorClass } = useLetterTemplate('loan_approval');

  useEffect(() => {
    const loadedSettings = getCooperativeSettings();
    setSettings(loadedSettings);

    // Check for existing letter number
    if (open && loan.id) {
      getExistingLetterNumber(loan.id, 'loan_approval').then(num => {
        setLetterNumber(num);
      });
    }
    
    // Fetch logo frame settings from database
    const fetchLogoSettings = async () => {
      const { data } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', ['bank_contact_settings']);
      
      if (data) {
        const bankContact = data.find(d => d.key === 'bank_contact_settings');
        if (bankContact?.value) {
          const val = bankContact.value as Record<string, unknown>;
          setLogoFrame((val.logo_frame as LogoFrameType) || 'circle');
        }
      }
    };
    if (open) fetchLogoSettings();
  }, [open, loan.id]);

  const handleDownload = async () => {
    if (!letterRef.current) return;
    
    setIsGenerating(true);
    try {
      // Generate letter number if not exists
      let currentLetterNumber = letterNumber;
      if (!currentLetterNumber) {
        currentLetterNumber = await issueLetterNumber(
          'loan_approval',
          loan.id,
          loan.memberName,
          loan.memberNumber,
          { 
            principalAmount: loan.principalAmount, 
            tenor: loan.tenor,
            interestRate: loan.interestRate 
          }
        );
        setLetterNumber(currentLetterNumber);
      }

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(letterRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `surat-persetujuan-pinjaman-${currentLetterNumber?.replace(/\//g, '-') || loan.id}-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to download letter:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const frameStyles = getLogoFrameStylesForPrint(logoFrame, 'h-16 w-16');

  const renderLogo = () => {
    // Check template setting for show_logo
    if (template && template.show_logo === false) return null;
    
    if (settings.logoBase64) {
      return (
        <div className={frameStyles.containerClasses}>
          <img 
            src={settings.logoBase64} 
            alt={settings.name} 
            className={frameStyles.imageClasses}
          />
        </div>
      );
    }
    return (
      <div className={frameStyles.containerClasses}>
        <div className={frameStyles.iconContainerClasses}>
          <Building2 className={`h-8 w-8 ${frameStyles.iconClasses}`} />
        </div>
      </div>
    );
  };

  // Calculate monthly installment
  const monthlyPrincipal = loan.principalAmount / loan.tenor;
  const monthlyInterest = loan.principalAmount * loan.interestRate;
  const monthlyTotal = monthlyPrincipal + monthlyInterest;

  // Template data for parsing variables
  const templateData: import('@/lib/templateVariables').TemplateData = {
    member: {
      name: loan.memberName,
      memberNumber: loan.memberNumber || '',
    },
    loan: {
      amount: loan.principalAmount,
      tenor: loan.tenor,
      interestRate: loan.interestRate,
      disbursementDate: loan.disbursementDate,
    },
    cooperative: {
      name: settings?.name || 'Koperasi',
      address: settings?.address || '',
    },
  };

  // Get template values with fallbacks
  const letterTitle = template?.title || t('Surat Persetujuan Pinjaman', 'Loan Approval Letter');
  const openingText = template?.opening_text 
    ? parseText(template.opening_text, templateData) 
    : t('Dengan ini diberitahukan bahwa:', 'This is to inform that:');
  const closingText = template?.closing_text 
    ? parseText(template.closing_text, templateData) 
    : null;
  const footerText = template?.footer_text 
    ? parseText(template.footer_text, templateData) 
    : t('Dokumen ini sah dan dicetak secara digital', 'This document is valid and digitally printed');
  const badgeText = template?.status_badge_text || t('Pengajuan Pinjaman Disetujui', 'Loan Application Approved');
  const badgeColor = template?.status_badge_color || 'green';
  const showAddress = template?.show_address !== false;
  const showPrintDate = template?.show_print_date !== false;
  const showAutoDisclaimer = template?.show_auto_print_disclaimer !== false;
  const showRecipientSignature = template?.show_recipient_signature !== false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>{letterTitle}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Signatory Selector - hidden for members */}
        <div className="px-4 pt-2">
          <SignatorySelector
            selectedSignatoryIds={selectedSignatoryIds}
            onSelectionChange={setSelectedSignatoryIds}
            maxSelection={4}
            readOnly={!isAdmin}
          />
        </div>

        {/* Letter Content */}
        <div className="p-4 pt-2 overflow-auto max-h-[60vh]">
          <div 
            ref={letterRef} 
            className="bg-white text-black p-8 rounded-lg border border-gray-200"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Header with Logo */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
              <div className="flex justify-center mb-3">
                {renderLogo()}
              </div>
              <h2 className="text-xl font-bold text-gray-900 uppercase">{settings.name}</h2>
              {template?.show_legal_number !== false && (
                <p className="text-xs text-gray-600">{settings.legalNumber}</p>
              )}
              {showAddress && (
                <p className="text-xs text-gray-600">{settings.address}</p>
              )}
            </div>

            {/* Letter Title */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 underline uppercase tracking-wide">
                {letterTitle}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                No: {letterNumber || t('(akan digenerate saat unduh)', '(will be generated on download)')}
              </p>
            </div>

            {/* Approval Notice - Dynamic Badge */}
            <div className={`flex items-center gap-3 rounded-lg p-4 mb-6 border ${getBadgeColorClass(badgeColor)}`}>
              <CheckCircle className={`h-8 w-8 flex-shrink-0 ${getBadgeIconColorClass(badgeColor)}`} />
              <div>
                <p className="font-semibold">
                  {badgeText}
                </p>
                <p className="text-sm opacity-90">
                  {t('Tanggal Persetujuan', 'Approval Date')}: {formatDate(loan.approvedAt || loan.disbursementDate)}
                </p>
              </div>
            </div>

            {/* Member Info */}
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-2">{openingText}</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('Nama Anggota', 'Member Name')}</span>
                  <span className="font-semibold text-gray-900">{loan.memberName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('Nomor Anggota', 'Member Number')}</span>
                  <span className="font-semibold text-gray-900">{loan.memberNumber}</span>
                </div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {t('Detail Pinjaman yang Disetujui:', 'Approved Loan Details:')}
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Jumlah Pinjaman', 'Loan Amount')}</td>
                      <td className="px-4 py-2 font-bold text-gray-900">{formatCurrency(loan.principalAmount)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Jangka Waktu', 'Loan Term')}</td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{loan.tenor} {t('Bulan', 'Months')}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Suku Bunga', 'Interest Rate')}</td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{(loan.interestRate * 100).toFixed(1)}% / {t('bulan', 'month')}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Angsuran Pokok', 'Principal Installment')}</td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{formatCurrency(monthlyPrincipal)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Angsuran Bunga', 'Interest Installment')}</td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{formatCurrency(monthlyInterest)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 bg-gray-50 text-gray-600 font-semibold">{t('Total Angsuran/Bulan', 'Monthly Installment')}</td>
                      <td className="px-4 py-2 font-bold text-primary">{formatCurrency(monthlyTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Disbursement Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">{t('Tanggal Pencairan', 'Disbursement Date')}:</span> {formatDate(loan.disbursementDate)}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {t('Dana akan dicairkan ke rekening anggota yang terdaftar.', 'Funds will be disbursed to the registered member account.')}
              </p>
            </div>

            {/* Closing Text */}
            {closingText && (
              <div className="text-sm text-gray-700 mb-6 leading-relaxed">
                <p>{closingText}</p>
              </div>
            )}

            {/* Signature Section */}
            <div className="mt-8">
              <p className="text-sm text-gray-600 text-right mb-4">{formatDate(loan.approvedAt || loan.disbursementDate)}</p>
              
              <div className="flex justify-between items-end">
                {/* Member signature - conditional */}
                {showRecipientSignature && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{t('Penerima Pinjaman', 'Loan Recipient')}</p>
                    <div className="h-14 mt-1 mb-1 border-b border-gray-400 w-28"></div>
                    <p className="text-xs font-semibold text-gray-700">{loan.memberName}</p>
                  </div>
                )}
                
                <SignatureBlock
                  signatories={signatories}
                  selectedIds={selectedSignatoryIds}
                  layoutSettings={layoutSettings}
                  showStamp={true}
                  stampPosition="left"
                  filterByPositions={template?.selected_signatory_positions}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 pt-6 mt-6 border-t border-dashed border-gray-300">
              <p>{footerText}</p>
              {showPrintDate && (
                <p className="mt-1">{t('Dicetak pada', 'Printed on')}: {formatDate(new Date().toISOString())}</p>
              )}
              {showAutoDisclaimer && (
                <p className="mt-2 text-[10px] italic text-gray-400">
                  {t('Bukti ini dicetak secara otomatis dan sah tanpa tanda tangan basah', 'This document is automatically printed and valid without wet signature')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Download Button */}
        <div className="p-4 pt-0">
          <Button onClick={handleDownload} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isGenerating ? t('Memproses...', 'Processing...') : t('Unduh Surat Persetujuan', 'Download Approval Letter')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
