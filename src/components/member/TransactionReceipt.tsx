import { useRef, useState, useEffect } from 'react';
import { Transaction } from '@/lib/types';
import { formatCurrency, formatDate, getTransactionTypeLabel, getStatusLabel } from '@/lib/mockData';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, CheckCircle, Clock, XCircle, Building2, Receipt } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStylesForPrint, LogoFrameType } from '@/lib/logoFrameUtils';

interface TransactionReceiptProps {
  transaction: Transaction;
  open: boolean;
  onClose: () => void;
}

export const TransactionReceipt = ({ transaction, open, onClose }: TransactionReceiptProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');

  useEffect(() => {
    setSettings(getCooperativeSettings());
    
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
  }, [open]);

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-6 w-6 text-success" />;
      case 'rejected':
        return <XCircle className="h-6 w-6 text-destructive" />;
      default:
        return <Clock className="h-6 w-6 text-warning" />;
    }
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `receipt-${transaction.id}-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to download receipt:', error);
    }
  };

  const frameStyles = getLogoFrameStylesForPrint(logoFrame, 'h-16 w-16');

  const renderLogo = () => {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            <span>{t('Bukti Transaksi', 'Transaction Receipt')}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Content */}
        <div className="p-4 overflow-auto max-h-[70vh]">
          <div 
            ref={receiptRef} 
            className="bg-white text-black p-6 rounded-lg border border-gray-200"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Header with Logo */}
            <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
              <div className="flex justify-center mb-3">
                {renderLogo()}
              </div>
              <h2 className="text-lg font-bold text-gray-900">{settings.name}</h2>
              <p className="text-xs text-gray-600">{settings.legalNumber}</p>
              <p className="text-xs text-gray-600">{settings.address}</p>
            </div>

            {/* Transaction Title */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                {t('Bukti Transaksi', 'Transaction Receipt')}
              </h3>
              <p className="text-xs text-gray-500">No: {transaction.id.toUpperCase()}</p>
            </div>

            {/* Transaction Details */}
            <div className="space-y-3 text-sm border-b border-dashed border-gray-300 pb-4 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('Jenis Transaksi', 'Transaction Type')}</span>
                <span className="font-medium text-gray-900">{getTransactionTypeLabel(transaction.type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('Tanggal', 'Date')}</span>
                <span className="font-medium text-gray-900">{formatDate(transaction.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(transaction.status)}
                  <span className="font-medium text-gray-900">{getStatusLabel(transaction.status)}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('Metode Pembayaran', 'Payment Method')}</span>
                <span className="font-medium text-gray-900">
                  {transaction.paymentMethod === 'transfer_bank' ? t('Transfer Bank', 'Bank Transfer') : 'E-Wallet'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('Nama Pengirim', 'Sender Name')}</span>
                <span className="font-medium text-gray-900">{transaction.accountHolderName}</span>
              </div>
              {transaction.notes && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('Catatan', 'Notes')}</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%]">{transaction.notes}</span>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="text-center py-4 bg-gray-50 rounded-lg mb-4">
              <p className="text-xs text-gray-600 mb-1">{t('Jumlah', 'Amount')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
            </div>

            {/* Member Info */}
            {user && (
              <div className="space-y-2 text-xs text-gray-600 border-b border-dashed border-gray-300 pb-4 mb-4">
                <div className="flex justify-between">
                  <span>{t('Nama Anggota', 'Member Name')}</span>
                  <span className="font-medium text-gray-900">{user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('No. Anggota', 'Member No.')}</span>
                  <span className="font-medium text-gray-900">{user.memberNumber}</span>
                </div>
              </div>
            )}

            {/* Approval Info */}
            {transaction.approvedAt && (
              <div className="space-y-2 text-xs text-gray-600 border-b border-dashed border-gray-300 pb-4 mb-4">
                <div className="flex justify-between">
                  <span>{t('Disetujui pada', 'Approved on')}</span>
                  <span className="font-medium text-gray-900">{formatDate(transaction.approvedAt)}</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 pt-2">
              <p>{t('Terima kasih atas kepercayaan Anda', 'Thank you for your trust')}</p>
              <p className="mt-1">{t('Dicetak pada', 'Printed on')}: {formatDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <div className="p-4 pt-0">
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            {t('Unduh Struk', 'Download Receipt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};