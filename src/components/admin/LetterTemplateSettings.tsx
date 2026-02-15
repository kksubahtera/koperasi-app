import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs'; // Updated: using Button group for navigation
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { VariablePicker } from './VariablePicker';
import { useSignatoryOfficers } from '@/hooks/useSignatoryOfficers';
import { parseTemplateVariables, SAMPLE_DATA } from '@/lib/templateVariables';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  FileText, 
  CreditCard, 
  UserMinus, 
  RefreshCcw, 
  CheckCircle,
  Save,
  RotateCcw,
  Eye,
  Building2,
  GripVertical,
  FileSignature,
  AlignLeft,
  Table,
  Hash,
  Type,
  Check
} from 'lucide-react';

interface LetterTemplate {
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
  // Signature layout settings
  signature_layout: 'horizontal' | 'grid' | 'vertical';
  signature_alignment: 'left' | 'center' | 'right' | 'space-between';
  max_signatories_per_row: number;
  signature_position: 'bottom-left' | 'bottom-right' | 'bottom-center';
  signature_size: 'small' | 'medium' | 'large';
  selected_signatory_positions: string[];
}

const DEFAULT_BADGES: Record<string, { text: string; color: string }> = {
  loan_approval: { text: 'Pinjaman Disetujui', color: 'green' },
  withdrawal: { text: 'Penarikan Diproses', color: 'blue' },
  loan_settlement: { text: 'Pinjaman Lunas', color: 'green' },
  resignation: { text: 'Pengunduran Diri Disetujui', color: 'amber' },
  refund: { text: 'Pengembalian Dana', color: 'blue' },
};

const TEMPLATE_TYPES = [
  { value: 'loan_approval', label: 'Persetujuan Pinjaman', icon: FileText },
  { value: 'withdrawal', label: 'Penarikan Simpanan', icon: CreditCard },
  { value: 'resignation', label: 'Pengunduran Diri', icon: UserMinus },
  { value: 'refund', label: 'Pengembalian Dana', icon: RefreshCcw },
  { value: 'loan_settlement', label: 'Pelunasan Pinjaman', icon: CheckCircle },
];

const ELEMENT_LABELS: Record<string, { label: string; icon: any }> = {
  header: { label: 'Header (Logo & Identitas)', icon: Building2 },
  letter_number: { label: 'Nomor & Tanggal Surat', icon: Hash },
  title: { label: 'Judul Surat', icon: Type },
  opening: { label: 'Teks Pembuka', icon: AlignLeft },
  content: { label: 'Konten/Data', icon: Table },
  closing: { label: 'Teks Penutup', icon: AlignLeft },
  signature: { label: 'Tanda Tangan', icon: FileSignature },
  footer: { label: 'Footer', icon: AlignLeft },
};

const DEFAULT_ORDER = ['header', 'letter_number', 'title', 'opening', 'content', 'closing', 'signature', 'footer'];

interface SortableElementProps {
  id: string;
  element: { label: string; icon: any };
}

function SortableElement({ id, element }: SortableElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = element.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-background border rounded-lg ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm flex-1">{element.label}</span>
      <Badge variant="secondary" className="text-[10px]">
        {id}
      </Badge>
    </div>
  );
}

export default function LetterTemplateSettings() {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedType, setSelectedType] = useState('loan_approval');
  const [currentTemplate, setCurrentTemplate] = useState<LetterTemplate | null>(null);
  const [cooperativeSettings, setCooperativeSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [elementOrder, setElementOrder] = useState<string[]>(DEFAULT_ORDER);
  
  // Use database signatories instead of localStorage
  const { signatories: dbSignatories } = useSignatoryOfficers();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchTemplates();
    fetchCooperativeSettings();
  }, []);

  useEffect(() => {
    const template = templates.find(t => t.letter_type === selectedType);
    setCurrentTemplate(template || null);
    if (template?.element_order) {
      setElementOrder(template.element_order);
    } else {
      setElementOrder(DEFAULT_ORDER);
    }
  }, [selectedType, templates]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .order('letter_type');
      
      if (error) throw error;
      
      // Parse element_order from JSON and ensure it's string[]
      const parsed = (data || []).map(t => ({
        ...t,
        element_order: Array.isArray(t.element_order) 
          ? (t.element_order as string[]) 
          : DEFAULT_ORDER,
        status_badge_text: t.status_badge_text || DEFAULT_BADGES[t.letter_type]?.text || null,
        status_badge_color: t.status_badge_color || DEFAULT_BADGES[t.letter_type]?.color || 'green',
        signature_layout: t.signature_layout || 'horizontal',
        signature_alignment: t.signature_alignment || 'right',
        max_signatories_per_row: t.max_signatories_per_row || 3,
        signature_position: t.signature_position || 'bottom-right',
        signature_size: t.signature_size || 'medium',
        selected_signatory_positions: Array.isArray(t.selected_signatory_positions) 
          ? (t.selected_signatory_positions as string[]) 
          : ['Ketua', 'Bendahara'],
      })) as LetterTemplate[];
      setTemplates(parsed);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Gagal memuat template surat');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCooperativeSettings = async () => {
    try {
      const settings = await getCooperativeSettings();
      setCooperativeSettings(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setElementOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    if (!currentTemplate) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('letter_templates')
        .update({
          title: currentTemplate.title,
          opening_text: currentTemplate.opening_text,
          closing_text: currentTemplate.closing_text,
          footer_text: currentTemplate.footer_text,
          show_logo: currentTemplate.show_logo,
          show_legal_number: currentTemplate.show_legal_number,
          show_address: currentTemplate.show_address,
          show_print_date: currentTemplate.show_print_date,
          stamp_position: currentTemplate.stamp_position,
          default_signatory_count: currentTemplate.default_signatory_count,
          show_recipient_signature: currentTemplate.show_recipient_signature,
          is_active: currentTemplate.is_active,
          element_order: elementOrder,
          status_badge_text: currentTemplate.status_badge_text,
          status_badge_color: currentTemplate.status_badge_color,
          signature_layout: currentTemplate.signature_layout || 'horizontal',
          signature_alignment: currentTemplate.signature_alignment || 'right',
          max_signatories_per_row: currentTemplate.max_signatories_per_row || 3,
          signature_position: currentTemplate.signature_position || 'bottom-right',
          signature_size: currentTemplate.signature_size || 'medium',
          selected_signatory_positions: currentTemplate.selected_signatory_positions || ['Ketua', 'Bendahara'],
        })
        .eq('id', currentTemplate.id);
      
      if (error) throw error;
      
      toast.success('Template berhasil disimpan');
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Gagal menyimpan template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    await fetchTemplates();
    toast.info('Template dikembalikan ke pengaturan tersimpan');
  };

  const updateTemplate = (field: keyof LetterTemplate, value: any) => {
    if (!currentTemplate) return;
    setCurrentTemplate({ ...currentTemplate, [field]: value });
  };

  // Get badge color classes
  const getBadgeClasses = (color: string | null) => {
    switch (color) {
      case 'green':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'blue':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'amber':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'red':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getBadgeIconColor = (color: string | null) => {
    switch (color) {
      case 'green': return 'text-green-600';
      case 'blue': return 'text-blue-600';
      case 'amber': return 'text-amber-600';
      case 'red': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get stamp from localStorage (stamp is still stored there)
  const getStamp = () => {
    try {
      const stored = localStorage.getItem('cooperativeSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.stampBase64 || null;
      }
    } catch (e) {
      console.error('Error reading stamp:', e);
    }
    return null;
  };

  // Render preview element based on order
  const renderPreviewElement = (elementId: string) => {
    if (!currentTemplate) return null;
    const stamp = getStamp();
    // Use database signatories filtered by is_active
    const activeSignatories = dbSignatories
      .filter(s => s.is_active)
      .slice(0, currentTemplate.default_signatory_count);

    switch (elementId) {
      case 'header':
        return (
          <div key={elementId} className="text-center border-b-2 border-gray-800 pb-3 mb-4">
            {currentTemplate.show_logo && (
              <div className="flex justify-center mb-2">
                {cooperativeSettings?.cooperative_logo_base64 ? (
                  <img 
                    src={cooperativeSettings.cooperative_logo_base64} 
                    alt="Logo" 
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-gray-500" />
                  </div>
                )}
              </div>
            )}
            <h2 className="font-bold text-sm uppercase">
              {cooperativeSettings?.cooperative_name || 'KOPERASI CONTOH'}
            </h2>
            {currentTemplate.show_legal_number && (
              <p className="text-[10px] text-gray-600">
                Badan Hukum: {cooperativeSettings?.cooperative_legal_number || '123/BH/2024'}
              </p>
            )}
            {currentTemplate.show_address && (
              <p className="text-[10px] text-gray-600">
                {cooperativeSettings?.cooperative_address || 'Jl. Contoh No. 123, Kota'}
              </p>
            )}
          </div>
        );

      case 'letter_number':
        return (
          <div key={elementId} className="mb-4">
            <p className="text-[10px]">Nomor: 001/SP/I/2026</p>
            <p className="text-[10px]">Tanggal: 8 Januari 2026</p>
          </div>
        );

      case 'title':
        return (
          <div key={elementId} className="text-center mb-4">
            <h3 className="font-bold text-sm underline uppercase tracking-wide">
              {currentTemplate.title}
            </h3>
            {/* Status Badge */}
            {currentTemplate.status_badge_text && (
              <div className={`flex items-center justify-center gap-2 mt-3 p-2 rounded-lg border ${getBadgeClasses(currentTemplate.status_badge_color)}`}>
                <Check className={`h-4 w-4 ${getBadgeIconColor(currentTemplate.status_badge_color)}`} />
                <span className="text-[11px] font-semibold">
                  {currentTemplate.status_badge_text}
                </span>
              </div>
            )}
          </div>
        );

      case 'opening':
        return currentTemplate.opening_text ? (
          <p key={elementId} className="text-[10px] mb-3 whitespace-pre-line">
            {parseTemplateVariables(currentTemplate.opening_text, SAMPLE_DATA, true)}
          </p>
        ) : null;

      case 'content':
        // Render different content based on letter type
        return (
          <div key={elementId} className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-[10px]">
              <tbody>
                <tr className="border-b">
                  <td className="py-1 px-2 bg-gray-100 font-medium w-2/5">Nama Anggota</td>
                  <td className="py-1 px-2 font-semibold">Budi Santoso</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1 px-2 bg-gray-100 font-medium">No. Anggota</td>
                  <td className="py-1 px-2">2024-001</td>
                </tr>
                {selectedType === 'loan_approval' && (
                  <>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Jumlah Pinjaman</td>
                      <td className="py-1 px-2 font-bold text-primary">Rp 5.000.000</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Jangka Waktu</td>
                      <td className="py-1 px-2">12 Bulan</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Suku Bunga</td>
                      <td className="py-1 px-2">1.5% / bulan</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 bg-gray-100 font-medium">Angsuran/Bulan</td>
                      <td className="py-1 px-2 font-bold">Rp 491.667</td>
                    </tr>
                  </>
                )}
                {selectedType === 'withdrawal' && (
                  <>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Jumlah Penarikan</td>
                      <td className="py-1 px-2 font-bold text-primary">Rp 1.000.000</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 bg-gray-100 font-medium">Sisa Saldo</td>
                      <td className="py-1 px-2">Rp 2.500.000</td>
                    </tr>
                  </>
                )}
                {selectedType === 'loan_settlement' && (
                  <>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Total Pinjaman</td>
                      <td className="py-1 px-2">Rp 5.000.000</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Total Bunga</td>
                      <td className="py-1 px-2">Rp 450.000</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 bg-gray-100 font-medium">Total Dibayar</td>
                      <td className="py-1 px-2 font-bold text-green-600">Rp 5.450.000</td>
                    </tr>
                  </>
                )}
                {selectedType === 'resignation' && (
                  <>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Tanggal Pengunduran</td>
                      <td className="py-1 px-2">8 Januari 2026</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Total Simpanan</td>
                      <td className="py-1 px-2">Rp 3.500.000</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 bg-gray-100 font-medium">Dana Dikembalikan</td>
                      <td className="py-1 px-2 font-bold text-primary">Rp 3.500.000</td>
                    </tr>
                  </>
                )}
                {selectedType === 'refund' && (
                  <>
                    <tr className="border-b">
                      <td className="py-1 px-2 bg-gray-100 font-medium">Total Pengembalian</td>
                      <td className="py-1 px-2 font-bold text-primary">Rp 3.500.000</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 bg-gray-100 font-medium">Metode Pembayaran</td>
                      <td className="py-1 px-2">Transfer Bank</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        );

      case 'closing':
        return currentTemplate.closing_text ? (
          <p key={elementId} className="text-[10px] mb-4 whitespace-pre-line">
            {parseTemplateVariables(currentTemplate.closing_text, SAMPLE_DATA, true)}
          </p>
        ) : null;

      case 'signature':
        // Dynamic layout based on settings
        const layout = currentTemplate.signature_layout || 'horizontal';
        const alignment = currentTemplate.signature_alignment || 'right';
        const maxPerRow = currentTemplate.max_signatories_per_row || 3;
        const stampPos = currentTemplate.stamp_position || 'left';
        const signatureSize = currentTemplate.signature_size || 'medium';

        // Size classes based on signature_size setting
        const getSizeClasses = () => {
          switch (signatureSize) {
            case 'small': return { text: 'text-[8px]', sig: 'h-8 w-16', line: 'w-16', stamp: 'h-12 w-12' };
            case 'large': return { text: 'text-[12px]', sig: 'h-14 w-28', line: 'w-28', stamp: 'h-20 w-20' };
            default: return { text: 'text-[10px]', sig: 'h-10 w-20', line: 'w-20', stamp: 'h-16 w-16' };
          }
        };
        const sizeClasses = getSizeClasses();

        // Generate container classes based on layout and alignment
        const getContainerClasses = () => {
          let classes = 'mt-6 ';
          
          // Alignment for the entire signature block
          if (alignment === 'left') classes += 'flex justify-start';
          else if (alignment === 'center') classes += 'flex justify-center';
          else if (alignment === 'right') classes += 'flex justify-end';
          else if (alignment === 'space-between') classes += 'flex justify-between';
          
          return classes;
        };

        // Generate signatory container classes based on layout
        const getSignatoryContainerClasses = () => {
          if (layout === 'horizontal') return 'flex flex-wrap gap-4 items-end';
          if (layout === 'vertical') return 'flex flex-col gap-4';
          if (layout === 'grid') return `grid gap-4`;
          return 'flex flex-wrap gap-4 items-end';
        };

        const getGridStyle = () => {
          if (layout === 'grid') {
            return { gridTemplateColumns: `repeat(${maxPerRow}, minmax(0, 1fr))` };
          }
          return {};
        };

        // Filter signatories based on selected positions
        const selectedPositions = currentTemplate.selected_signatory_positions || ['Ketua', 'Bendahara'];
        const previewSignatories = dbSignatories.length > 0
          ? dbSignatories.filter(s => selectedPositions.includes(s.position))
          : selectedPositions.map((position, i) => ({
              id: `sample-${i}`,
              name: `Nama ${position}`,
              position,
              signature_base64: null,
              is_active: false
            }));

        const renderStamp = () => (
          <div className="flex-shrink-0">
            {stamp ? (
              <img 
                src={stamp} 
                alt="Stempel" 
                className={`${sizeClasses.stamp} object-contain opacity-80`}
              />
            ) : (
              <div className={`${sizeClasses.stamp} rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center`}>
                <span className="text-[7px] text-gray-400 text-center">STEMPEL<br/>KOPERASI</span>
              </div>
            )}
          </div>
        );

        const renderSignatory = (signatory: any, index: number) => (
          <div key={signatory.id || index} className={`text-center min-w-[60px] ${!signatory.is_active ? 'opacity-50' : ''}`}>
            <p className={`${sizeClasses.text} mb-1`}>
              {signatory.position}
              {!signatory.is_active && <span className="text-[6px] text-destructive ml-0.5">(nonaktif)</span>}
            </p>
            {signatory.signature_base64 ? (
              <img 
                src={signatory.signature_base64} 
                alt={`TTD ${signatory.name}`} 
                className={`${sizeClasses.sig} object-contain mx-auto`}
              />
            ) : (
              <div className={`${sizeClasses.sig} mx-auto border-b border-dashed border-gray-300`}></div>
            )}
            <div className={`border-b border-black ${sizeClasses.line} mx-auto mb-1 mt-1`}></div>
            <p className={`${sizeClasses.text} font-medium`}>{signatory.name}</p>
          </div>
        );

        return (
          <div key={elementId} className="mt-6">
            <p className="text-[10px] text-right mb-4">8 Januari 2026</p>
            
            {/* Layout container */}
            <div className={`flex gap-6 items-end ${
              stampPos === 'left' ? 'flex-row' : 
              stampPos === 'right' ? 'flex-row-reverse' : 
              'flex-col items-center'
            }`}>
              {/* Stamp */}
              {renderStamp()}

              {/* Signatories with dynamic layout */}
              <div className={`flex-1 ${getContainerClasses()}`}>
                <div className={getSignatoryContainerClasses()} style={getGridStyle()}>
                  {currentTemplate.show_recipient_signature && (
                    <div className="text-center min-w-[60px]">
                      <p className={`${sizeClasses.text} mb-1`}>Penerima</p>
                      <div className={`${sizeClasses.sig} mx-auto border-b border-dashed border-gray-300`}></div>
                      <div className={`border-b border-black ${sizeClasses.line} mx-auto mb-1 mt-1`}></div>
                      <p className={sizeClasses.text}>(Nama Anggota)</p>
                    </div>
                  )}
                  {previewSignatories.map((signatory: any, index: number) => 
                    renderSignatory(signatory, index)
                  )}
                </div>
              </div>
              
              {dbSignatories.length > 0 && (
                <p className="text-[6px] text-muted-foreground mt-1 text-center">
                  * Hanya penandatangan aktif yang muncul di surat cetak
                </p>
              )}
            </div>

            {/* Layout indicator badge */}
            <div className="mt-3 flex gap-2 justify-center flex-wrap">
              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                Layout: {layout === 'horizontal' ? 'Horizontal' : layout === 'vertical' ? 'Vertikal' : 'Grid'}
              </Badge>
              <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">
                Posisi: {alignment === 'left' ? 'Kiri' : alignment === 'center' ? 'Tengah' : alignment === 'right' ? 'Kanan' : 'Tersebar'}
              </Badge>
              <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                Ukuran: {signatureSize === 'small' ? 'Kecil' : signatureSize === 'large' ? 'Besar' : 'Sedang'}
              </Badge>
              {layout === 'grid' && (
                <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                  {maxPerRow}/baris
                </Badge>
              )}
            </div>
          </div>
        );

      case 'footer':
        return (
          <div key={elementId} className="mt-6 pt-3 border-t border-dashed text-center">
            {currentTemplate.footer_text && (
              <p className="text-[9px] text-gray-500 italic">
                {currentTemplate.footer_text}
              </p>
            )}
            {currentTemplate.show_print_date && (
              <p className="text-[9px] text-gray-400 mt-1">
                Dicetak: 8 Januari 2026, 10:00 WIB
              </p>
            )}
            {currentTemplate.show_auto_print_disclaimer && (
              <p className="text-[8px] text-gray-400 italic mt-1">
                Bukti ini dicetak secara otomatis dan sah tanpa tanda tangan basah
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Format Template Surat</h3>
          <p className="text-sm text-muted-foreground">
            Sesuaikan tampilan dan konten template surat resmi koperasi
          </p>
        </div>
      </div>

      {/* Button Group Navigation */}
      <div className="overflow-x-auto pb-2 -mx-2 sm:-mx-1 px-2 sm:px-1 scrollbar-hide">
        <div className="inline-flex w-max gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
          {TEMPLATE_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = selectedType === type.value;
            return (
              <Button
                key={type.value}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedType(type.value)}
                className={`
                  relative h-auto font-medium whitespace-nowrap
                  transition-all duration-200 rounded-lg
                  px-3 py-2 text-xs sm:text-sm gap-1.5
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden xs:inline sm:inline truncate">{type.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <Tabs value={selectedType} onValueChange={setSelectedType}>

        {TEMPLATE_TYPES.map((type) => (
          <TabsContent key={type.value} value={type.value} className="mt-4">
            {currentTemplate ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Settings Panel */}
                <div className="space-y-6">
                  {/* Element Order - Drag & Drop */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GripVertical className="h-5 w-5" />
                        Urutan Elemen Surat
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Seret dan lepas untuk mengatur urutan elemen
                      </p>
                    </CardHeader>
                    <CardContent>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={elementOrder}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {elementOrder.map((elementId) => (
                              <SortableElement
                                key={elementId}
                                id={elementId}
                                element={ELEMENT_LABELS[elementId]}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </CardContent>
                  </Card>

                  {/* Other Settings */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <type.icon className="h-5 w-5" />
                        Pengaturan Template
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Header Settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Header Surat
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="show_logo" className="text-sm">Tampilkan Logo</Label>
                            <Switch
                              id="show_logo"
                              checked={currentTemplate.show_logo}
                              onCheckedChange={(v) => updateTemplate('show_logo', v)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="show_legal_number" className="text-sm">Tampilkan No. Badan Hukum</Label>
                            <Switch
                              id="show_legal_number"
                              checked={currentTemplate.show_legal_number}
                              onCheckedChange={(v) => updateTemplate('show_legal_number', v)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="show_address" className="text-sm">Tampilkan Alamat</Label>
                            <Switch
                              id="show_address"
                              checked={currentTemplate.show_address}
                              onCheckedChange={(v) => updateTemplate('show_address', v)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Badge Status Settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Badge Status
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="badge_text" className="text-sm">Teks Badge</Label>
                            <Input
                              id="badge_text"
                              value={currentTemplate.status_badge_text || ''}
                              onChange={(e) => updateTemplate('status_badge_text', e.target.value)}
                              placeholder="Contoh: Pinjaman Disetujui"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="badge_color" className="text-sm">Warna Badge</Label>
                            <Select
                              value={currentTemplate.status_badge_color || 'green'}
                              onValueChange={(v) => updateTemplate('status_badge_color', v)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="green">Hijau (Sukses)</SelectItem>
                                <SelectItem value="blue">Biru (Info)</SelectItem>
                                <SelectItem value="amber">Kuning (Peringatan)</SelectItem>
                                <SelectItem value="red">Merah (Error)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Content Settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Konten Surat
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="title" className="text-sm">Judul Surat</Label>
                            <Input
                              id="title"
                              value={currentTemplate.title}
                              onChange={(e) => updateTemplate('title', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <Label htmlFor="opening_text" className="text-sm">Teks Pembuka</Label>
                              <VariablePicker 
                                letterType={selectedType} 
                                onInsert={(variable) => {
                                  const current = currentTemplate.opening_text || '';
                                  updateTemplate('opening_text', current + variable);
                                }}
                                compact
                              />
                            </div>
                            <Textarea
                              id="opening_text"
                              value={currentTemplate.opening_text || ''}
                              onChange={(e) => updateTemplate('opening_text', e.target.value)}
                              className="min-h-[80px] font-mono text-sm"
                              placeholder="Contoh: Yang terhormat {nama_anggota},"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Gunakan variabel seperti {'{nama_anggota}'} untuk data dinamis
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <Label htmlFor="closing_text" className="text-sm">Teks Penutup</Label>
                              <VariablePicker 
                                letterType={selectedType} 
                                onInsert={(variable) => {
                                  const current = currentTemplate.closing_text || '';
                                  updateTemplate('closing_text', current + variable);
                                }}
                                compact
                              />
                            </div>
                            <Textarea
                              id="closing_text"
                              value={currentTemplate.closing_text || ''}
                              onChange={(e) => updateTemplate('closing_text', e.target.value)}
                              className="min-h-[80px] font-mono text-sm"
                              placeholder="Teks penutup surat..."
                            />
                          </div>
                        </div>
                      </div>

                      {/* Signature Settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Tanda Tangan
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="signature_layout" className="text-sm">Layout Tanda Tangan</Label>
                            <Select
                              value={currentTemplate.signature_layout || 'horizontal'}
                              onValueChange={(v) => updateTemplate('signature_layout', v)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="horizontal">Horizontal (Berjajar)</SelectItem>
                                <SelectItem value="grid">Grid (Kotak)</SelectItem>
                                <SelectItem value="vertical">Vertikal (Bertumpuk)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Pilih tata letak untuk penandatangan surat
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="signature_alignment" className="text-sm">Posisi Blok TTD</Label>
                            <Select
                              value={currentTemplate.signature_alignment || 'right'}
                              onValueChange={(v) => updateTemplate('signature_alignment', v)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Kiri</SelectItem>
                                <SelectItem value="center">Tengah</SelectItem>
                                <SelectItem value="right">Kanan</SelectItem>
                                <SelectItem value="space-between">Tersebar Merata</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {currentTemplate.signature_layout === 'grid' && (
                            <div>
                              <Label htmlFor="max_per_row" className="text-sm">Maksimal per Baris</Label>
                              <Select
                                value={String(currentTemplate.max_signatories_per_row || 3)}
                                onValueChange={(v) => updateTemplate('max_signatories_per_row', parseInt(v))}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2">2 per Baris</SelectItem>
                                  <SelectItem value="3">3 per Baris</SelectItem>
                                  <SelectItem value="4">4 per Baris</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div>
                            <Label htmlFor="signature_size" className="text-sm">Ukuran Tanda Tangan</Label>
                            <Select
                              value={currentTemplate.signature_size || 'medium'}
                              onValueChange={(v) => updateTemplate('signature_size', v)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="small">Kecil</SelectItem>
                                <SelectItem value="medium">Sedang</SelectItem>
                                <SelectItem value="large">Besar</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Atur skala tanda tangan, nama, dan stempel
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="stamp_position" className="text-sm">Posisi Stempel</Label>
                            <Select
                              value={currentTemplate.stamp_position}
                              onValueChange={(v) => updateTemplate('stamp_position', v)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Kiri</SelectItem>
                                <SelectItem value="center">Tengah</SelectItem>
                                <SelectItem value="right">Kanan</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">Posisi Penandatangan</Label>
                            <p className="text-[10px] text-muted-foreground mb-2">
                              Pilih jabatan yang akan muncul di surat
                            </p>
                            <div className="space-y-2 mt-1">
                              {['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara'].map((position) => {
                                const isChecked = currentTemplate.selected_signatory_positions?.includes(position) || false;
                                const officer = dbSignatories.find(s => s.position === position && s.is_active);
                                return (
                                  <div key={position} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id={`pos-${position}`}
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const current = currentTemplate.selected_signatory_positions || [];
                                        const newPositions = e.target.checked
                                          ? [...current, position]
                                          : current.filter(p => p !== position);
                                        
                                        // Validasi: minimal 1 posisi harus dipilih
                                        if (newPositions.length === 0) {
                                          toast.error("Minimal harus ada 1 posisi penandatangan yang dipilih");
                                          return;
                                        }
                                        
                                        setCurrentTemplate({
                                          ...currentTemplate,
                                          selected_signatory_positions: newPositions,
                                          default_signatory_count: newPositions.length,
                                        });
                                      }}
                                      className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <Label htmlFor={`pos-${position}`} className="text-sm flex items-center gap-2">
                                      {position}
                                      {officer ? (
                                        <Badge variant="secondary" className="text-[9px]">{officer.name}</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Belum diisi</Badge>
                                      )}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="show_recipient" className="text-sm">Tampilkan Kolom Penerima</Label>
                            <Switch
                              id="show_recipient"
                              checked={currentTemplate.show_recipient_signature}
                              onCheckedChange={(v) => updateTemplate('show_recipient_signature', v)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Footer Surat
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="footer_text" className="text-sm">Teks Footer</Label>
                            <Textarea
                              id="footer_text"
                              value={currentTemplate.footer_text || ''}
                              onChange={(e) => updateTemplate('footer_text', e.target.value)}
                              className="mt-1"
                              placeholder="Teks footer surat..."
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="show_print_date" className="text-sm">Tampilkan Tanggal Cetak</Label>
                            <Switch
                              id="show_print_date"
                              checked={currentTemplate.show_print_date}
                              onCheckedChange={(v) => updateTemplate('show_print_date', v)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="show_auto_print_disclaimer" className="text-sm">
                              Tampilkan Disclaimer Cetak Otomatis
                            </Label>
                            <Switch
                              id="show_auto_print_disclaimer"
                              checked={currentTemplate.show_auto_print_disclaimer}
                              onCheckedChange={(v) => updateTemplate('show_auto_print_disclaimer', v)}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Menampilkan teks "Bukti ini dicetak secara otomatis dan sah tanpa tanda tangan basah"
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                          <Save className="h-4 w-4 mr-2" />
                          {isSaving ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                        <Button variant="outline" onClick={handleReset}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Preview Panel */}
                <Card className="lg:sticky lg:top-4 h-fit">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Preview Surat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg p-4 bg-white text-black text-xs overflow-auto max-h-[600px]">
                      {elementOrder.map((elementId) => renderPreviewElement(elementId))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Template tidak ditemukan</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h4 className="font-medium text-sm mb-2">Panduan Penggunaan</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Drag & Drop:</strong> Seret elemen pada panel "Urutan Elemen Surat" untuk mengatur posisi</li>
            <li>• <strong>Variabel:</strong> Gunakan tombol Variabel untuk menyisipkan data dinamis seperti {'{nama_anggota}'}</li>
            <li>• Variabel akan otomatis diganti dengan data anggota saat surat dicetak</li>
            <li>• Preview menampilkan contoh tampilan surat dengan data sampel</li>
            <li>• Perubahan template berlaku untuk surat baru, tidak mengubah arsip lama</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
