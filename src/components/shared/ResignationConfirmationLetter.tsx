import { useRef, useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Building2, FileText, UserMinus, Loader2, Heart, Award, HandHeart } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { SignatorySelector } from './SignatorySelector';
import { SignatureBlock } from './SignatureBlock';
import { useIssuedLetters } from '@/hooks/useLetterNumbering';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStylesForPrint, LogoFrameType } from '@/lib/logoFrameUtils';
import { useSignatoryOfficers, useSignatureLayout } from '@/hooks/useSignatoryOfficers';
import { useLetterTemplate } from '@/hooks/useLetterTemplate';
import { useAuth } from '@/contexts/AuthContext';

interface ResignationData {
  id: string;
  memberName: string;
  memberNumber: string;
  memberEmail?: string;
  memberPhone?: string;
  joinDate?: string;
  exitDate: string;
  totalSavings: number;
  totalArrears: number;
  refundAmount: number;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  remainingLoanPrincipal: number;
  totalPenalties: number;
  reason: string;
  approvedDate?: string;
}

interface ResignationConfirmationLetterProps {
  data: ResignationData;
  open: boolean;
  onClose: () => void;
}

export const ResignationConfirmationLetter = ({ data, open, onClose }: ResignationConfirmationLetterProps) => {
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
  const { layoutSettings } = useSignatureLayout('resignation');
  const { template, parseText, getBadgeColorClass, getBadgeIconColorClass } = useLetterTemplate('resignation');

  useEffect(() => {
    const loadedSettings = getCooperativeSettings();
    setSettings(loadedSettings);

    if (open && data.id) {
      getExistingLetterNumber(data.id, 'resignation').then(num => {
        setLetterNumber(num);
      });
    }
    
    const fetchLogoSettings = async () => {
      const { data: settingsData } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', ['bank_contact_settings']);
      
      if (settingsData) {
        const bankContact = settingsData.find(d => d.key === 'bank_contact_settings');
        if (bankContact?.value) {
          const val = bankContact.value as Record<string, unknown>;
          setLogoFrame((val.logo_frame as LogoFrameType) || 'circle');
        }
      }
    };
    if (open) fetchLogoSettings();
  }, [open, data.id]);

  const handleDownload = async () => {
    if (!letterRef.current) return;
    
    setIsGenerating(true);
    try {
      let currentLetterNumber = letterNumber;
      if (!currentLetterNumber) {
        currentLetterNumber = await issueLetterNumber(
          'resignation',
          data.id,
          data.memberName,
          data.memberNumber,
          { 
            refundAmount: data.refundAmount,
            exitDate: data.exitDate
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
      link.download = `surat-pengunduran-diri-${currentLetterNumber?.replace(/\//g, '-') || data.id}-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to download letter:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const frameStyles = getLogoFrameStylesForPrint(logoFrame, 'h-16 w-16');
  const exitDate = data.exitDate || new Date().toISOString();

  // Calculate years of membership
  const yearsOfMembership = data.joinDate 
    ? Math.floor((new Date(exitDate).getTime() - new Date(data.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  const renderLogo = () => {
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

  // Template data for parsing variables
  const templateData: import('@/lib/templateVariables').TemplateData = {
    member: {
      name: data.memberName,
      memberNumber: data.memberNumber || '',
      joinDate: data.joinDate,
    },
    savings: {
      principal: data.simpananPokok,
      mandatory: data.simpananWajib,
      voluntary: data.simpananSukarela,
      total: data.totalSavings,
    },
    resignation: {
      date: data.exitDate,
      reason: data.reason,
      totalRefund: data.refundAmount,
      loanDeduction: data.remainingLoanPrincipal + data.totalPenalties,
    },
    cooperative: {
      name: settings?.name || 'Koperasi',
      address: settings?.address || '',
    },
  };

  // Get template values with fallbacks
  const letterTitle = template?.title || t('Surat Keterangan Pengunduran Diri', 'Resignation Confirmation Letter');
  const openingText = template?.opening_text 
    ? parseText(template.opening_text, templateData) 
    : t('Dengan ini menerangkan bahwa:', 'This is to certify that:');
  const closingText = template?.closing_text 
    ? parseText(template.closing_text, templateData) 
    : t('Demikian surat keterangan ini dibuat sebagai bukti bahwa yang bersangkutan telah mengundurkan diri dari keanggotaan koperasi dan seluruh hak kewajiban keuangan telah diselesaikan dengan baik.', 'This letter is issued as proof that the above-named person has resigned from cooperative membership and all financial rights and obligations have been properly settled.');
  const footerText = template?.footer_text 
    ? parseText(template.footer_text, templateData) 
    : t('Dokumen ini sah dan dicetak secara digital', 'This document is valid and digitally printed');
  const badgeText = template?.status_badge_text || t('Keanggotaan Telah Berakhir', 'Membership Has Ended');
  const badgeColor = template?.status_badge_color || 'amber';
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
            <span>{t('Surat Konfirmasi Pengunduran Diri', 'Resignation Confirmation Letter')}</span>
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

            {/* Resignation Notice - Dynamic Badge */}
            <div className={`flex items-center gap-3 rounded-lg p-4 mb-6 border ${getBadgeColorClass(badgeColor)}`}>
              <UserMinus className={`h-8 w-8 flex-shrink-0 ${getBadgeIconColorClass(badgeColor)}`} />
              <div>
                <p className="font-semibold">
                  {badgeText}
                </p>
                <p className="text-sm opacity-90">
                  {t('Tanggal Efektif', 'Effective Date')}: {formatDate(exitDate)}
                </p>
              </div>
            </div>

            {/* Member Info */}
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-2">
                {openingText}
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('Nama Anggota', 'Member Name')}</span>
                  <span className="font-semibold text-gray-900">{data.memberName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('Nomor Anggota', 'Member Number')}</span>
                  <span className="font-semibold text-gray-900">{data.memberNumber}</span>
                </div>
                {data.joinDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('Tanggal Bergabung', 'Join Date')}</span>
                    <span className="font-semibold text-gray-900">{formatDate(data.joinDate)}</span>
                  </div>
                )}
                {yearsOfMembership > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('Lama Keanggotaan', 'Membership Duration')}</span>
                    <span className="font-semibold text-gray-900">{yearsOfMembership} {t('Tahun', 'Years')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Settlement */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {t('Rincian Penyelesaian Keuangan:', 'Financial Settlement Details:')}
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Simpanan Pokok', 'Principal Savings')}</td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{formatCurrency(data.simpananPokok)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Simpanan Wajib', 'Mandatory Savings')}</td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{formatCurrency(data.simpananWajib)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Simpanan Sukarela', 'Voluntary Savings')}</td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{formatCurrency(data.simpananSukarela)}</td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-blue-50">
                      <td className="px-4 py-2 text-blue-700 font-semibold">{t('Total Simpanan', 'Total Savings')}</td>
                      <td className="px-4 py-2 font-bold text-blue-800">{formatCurrency(data.totalSavings)}</td>
                    </tr>
                    {data.totalArrears > 0 && (
                      <>
                        <tr className="border-b border-gray-200">
                          <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Pelunasan Pinjaman', 'Loan Settlement')}</td>
                          <td className="px-4 py-2 font-semibold text-red-600">- {formatCurrency(data.remainingLoanPrincipal)}</td>
                        </tr>
                        {data.totalPenalties > 0 && (
                          <tr className="border-b border-gray-200">
                            <td className="px-4 py-2 bg-gray-50 text-gray-600">{t('Denda Keterlambatan', 'Late Penalties')}</td>
                            <td className="px-4 py-2 font-semibold text-orange-600">- {formatCurrency(data.totalPenalties)}</td>
                          </tr>
                        )}
                      </>
                    )}
                    <tr className="bg-green-50">
                      <td className="px-4 py-2 text-green-700 font-semibold">{t('Dana Dikembalikan', 'Refund Amount')}</td>
                      <td className="px-4 py-2 font-bold text-green-800">{formatCurrency(data.refundAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Thank You Message */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Heart className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {t('Terima Kasih Atas Keanggotaan Anda', 'Thank You for Your Membership')}
                  </h4>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    {t(
                      `Kami mengucapkan terima kasih yang sebesar-besarnya atas kepercayaan dan partisipasi ${data.memberName} selama menjadi anggota koperasi kami. Kontribusi dan kesetiaan Anda selama ini sangat kami hargai.`,
                      `We would like to express our deepest gratitude for ${data.memberName}'s trust and participation as a member of our cooperative. Your contributions and loyalty are greatly appreciated.`
                    )}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                    <HandHeart className="h-4 w-4" />
                    <span>{t('Semoga sukses dalam perjalanan selanjutnya!', 'Wishing you success in your future journey!')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Statement */}
            <div className="text-sm text-gray-700 mb-6 leading-relaxed">
              <p>{closingText}</p>
              <p className="mt-2 text-gray-600">
                {t(
                  'Anggota dapat bergabung kembali setelah 6 bulan sejak tanggal pengunduran diri.',
                  'The member may rejoin after 6 months from the resignation date.'
                )}
              </p>
            </div>

            {/* Signature Section */}
            <div className="mt-8">
              <p className="text-sm text-gray-600 text-right mb-4">{formatDate(data.approvedDate || exitDate)}</p>
              
              <div className="flex justify-between items-end">
                {/* Member signature - conditional */}
                {showRecipientSignature && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{t('Anggota', 'Member')}</p>
                    <div className="h-14 mt-1 mb-1 border-b border-gray-400 w-28"></div>
                    <p className="text-xs font-semibold text-gray-700">{data.memberName}</p>
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

        <div className="p-4 pt-0">
          <Button onClick={handleDownload} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isGenerating ? t('Memproses...', 'Processing...') : t('Unduh Surat Pengunduran Diri', 'Download Resignation Letter')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
