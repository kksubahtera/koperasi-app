import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCooperativeSettings, CooperativeSettings, Signatory } from '@/lib/cooperativeSettings';
import { parseTemplateVariables, TemplateData } from '@/lib/templateVariables';

export interface LetterTemplate {
  id: string;
  letter_type: string;
  title: string;
  opening_text: string | null;
  closing_text: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_legal_number: boolean;
  show_address: boolean;
  show_print_date: boolean;
  show_auto_print_disclaimer: boolean;
  stamp_position: string;
  default_signatory_count: number;
  show_recipient_signature: boolean;
  is_active: boolean;
  element_order: string[];
  status_badge_text: string | null;
  status_badge_color: string | null;
  signature_size: string | null;
  selected_signatory_positions: string[] | null;
}

const DEFAULT_ELEMENT_ORDER = ['header', 'letter_number', 'title', 'opening', 'content', 'closing', 'signature', 'footer'];

const DEFAULT_BADGES: Record<string, { text: string; color: string }> = {
  loan_approval: { text: 'Pinjaman Disetujui', color: 'green' },
  withdrawal: { text: 'Penarikan Diproses', color: 'blue' },
  loan_settlement: { text: 'Pinjaman Lunas', color: 'green' },
  resignation: { text: 'Pengunduran Diri Disetujui', color: 'amber' },
  refund: { text: 'Pengembalian Dana', color: 'blue' },
};

export const useLetterTemplate = (letterType: string) => {
  const [template, setTemplate] = useState<LetterTemplate | null>(null);
  const [cooperativeSettings, setCooperativeSettings] = useState<CooperativeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch template from database
        const { data, error: fetchError } = await supabase
          .from('letter_templates')
          .select('*')
          .eq('letter_type', letterType)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (data) {
          const template: LetterTemplate = {
            ...data,
            element_order: Array.isArray(data.element_order) 
              ? (data.element_order as string[]) 
              : DEFAULT_ELEMENT_ORDER,
            status_badge_text: data.status_badge_text || DEFAULT_BADGES[letterType]?.text || null,
            status_badge_color: data.status_badge_color || DEFAULT_BADGES[letterType]?.color || 'green',
            signature_size: data.signature_size || 'medium',
            show_auto_print_disclaimer: data.show_auto_print_disclaimer ?? true,
            selected_signatory_positions: Array.isArray(data.selected_signatory_positions) 
              ? (data.selected_signatory_positions as string[]) 
              : ['Ketua', 'Bendahara'],
          };
          setTemplate(template);
        }

        // Fetch cooperative settings from localStorage
        const settings = getCooperativeSettings();
        setCooperativeSettings(settings);
      } catch (err) {
        console.error('Error fetching letter template:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    if (letterType) {
      fetchData();
    }
  }, [letterType]);

  // Parse template text with actual data
  const parseText = (text: string | null, data: TemplateData): string => {
    if (!text) return '';
    return parseTemplateVariables(text, data, false);
  };

  // Get selected signatories based on IDs
  const getSelectedSignatories = (selectedIds: string[]): Signatory[] => {
    if (!cooperativeSettings?.signatories) return [];
    return cooperativeSettings.signatories.filter(s => selectedIds.includes(s.id));
  };

  // Get active signatories
  const getActiveSignatories = (): Signatory[] => {
    if (!cooperativeSettings?.signatories) return [];
    return cooperativeSettings.signatories.filter(s => s.isActive);
  };

  // Get badge color class
  const getBadgeColorClass = (color: string | null): string => {
    switch (color) {
      case 'green':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'blue':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'amber':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'red':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'purple':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  // Get badge icon color class
  const getBadgeIconColorClass = (color: string | null): string => {
    switch (color) {
      case 'green':
        return 'text-green-600';
      case 'blue':
        return 'text-blue-600';
      case 'amber':
        return 'text-amber-600';
      case 'red':
        return 'text-red-600';
      case 'purple':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  return {
    template,
    cooperativeSettings,
    isLoading,
    error,
    parseText,
    getSelectedSignatories,
    getActiveSignatories,
    getBadgeColorClass,
    getBadgeIconColorClass,
    defaultElementOrder: DEFAULT_ELEMENT_ORDER,
    defaultBadge: DEFAULT_BADGES[letterType] || null,
  };
};

export default useLetterTemplate;
