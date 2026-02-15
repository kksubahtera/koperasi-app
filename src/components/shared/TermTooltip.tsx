import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Info } from 'lucide-react';
import {
  formatTermTooltip,
  getSynonyms,
  getTermDescription,
  getAccountTypeDisplay,
  ACCOUNT_TYPE_TERMINOLOGY,
  BALANCE_SHEET_TERMINOLOGY,
  INCOME_STATEMENT_TERMINOLOGY,
  AccountTypeCode,
  TerminologyEntry,
} from '@/lib/accountingTerminology';

interface TermTooltipProps {
  /** Kunci terminologi atau istilah yang akan ditampilkan */
  term: string;
  /** Children yang akan dibungkus tooltip */
  children?: ReactNode;
  /** Tampilkan icon info */
  showIcon?: boolean;
  /** Ukuran icon */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Posisi tooltip */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Custom className */
  className?: string;
}

/**
 * Mendapatkan entry terminologi dari key atau term
 */
const getTerminologyEntry = (term: string): TerminologyEntry | null => {
  // Pertama coba lookup by key di BALANCE_SHEET_TERMINOLOGY
  if (BALANCE_SHEET_TERMINOLOGY[term]) {
    return BALANCE_SHEET_TERMINOLOGY[term];
  }
  
  // Coba lookup by key di INCOME_STATEMENT_TERMINOLOGY
  if (INCOME_STATEMENT_TERMINOLOGY[term]) {
    return INCOME_STATEMENT_TERMINOLOGY[term];
  }
  
  // Fallback ke pencarian by term value
  const allTerminologies = [
    ...Object.values(BALANCE_SHEET_TERMINOLOGY),
    ...Object.values(INCOME_STATEMENT_TERMINOLOGY),
  ];
  
  const normalizedTerm = term.toLowerCase().trim();
  for (const entry of allTerminologies) {
    if (entry.synonyms.some(s => s.toLowerCase() === normalizedTerm)) {
      return entry;
    }
  }
  
  return null;
};

/**
 * Komponen untuk menampilkan tooltip dengan istilah alternatif
 */
export const TermTooltip = ({
  term,
  children,
  showIcon = true,
  iconSize = 'sm',
  side = 'top',
  className = '',
}: TermTooltipProps) => {
  const entry = getTerminologyEntry(term);
  
  // Jika tidak ada info tambahan, render tanpa tooltip
  if (!entry) {
    // Fallback ke getSynonyms original
    const synonyms = getSynonyms(term);
    const description = getTermDescription(term);
    
    if (!synonyms && !description) {
      return <>{children || term}</>;
    }
    
    const iconSizeClass = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    }[iconSize];

    const alternatives = synonyms?.filter(
      (s) => s.toLowerCase() !== term.toLowerCase()
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
            {children || term}
            {showIcon && (
              <Info className={`${iconSizeClass} text-muted-foreground opacity-50 hover:opacity-100 transition-opacity`} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <div className="space-y-2">
            {alternatives && alternatives.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Juga dikenal sebagai:
                </p>
                <div className="flex flex-wrap gap-1">
                  {alternatives.map((alt) => (
                    <Badge
                      key={alt}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {alt}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  const iconSizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[iconSize];

  // Get display text - if children not provided, use the standard term
  const displayText = children || entry.standard;
  
  // Get alternatives (exclude the standard term from the list)
  const alternatives = entry.synonyms.filter(
    (s) => s.toLowerCase() !== entry.standard.toLowerCase()
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
          {displayText}
          {showIcon && (
            <Info className={`${iconSizeClass} text-muted-foreground opacity-50 hover:opacity-100 transition-opacity`} />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        <div className="space-y-2">
          {alternatives.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Juga dikenal sebagai:
              </p>
              <div className="flex flex-wrap gap-1">
                {alternatives.map((alt) => (
                  <Badge
                    key={alt}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {alt}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {entry.description && (
            <p className="text-xs text-muted-foreground">{entry.description}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
interface AccountTypeBadgeProps {
  /** Tipe akun */
  type: AccountTypeCode;
  /** Tampilkan tooltip */
  showTooltip?: boolean;
  /** Ukuran badge */
  size?: 'sm' | 'md';
}

/**
 * Badge untuk tipe akun dengan tooltip istilah alternatif
 */
export const AccountTypeBadge = ({
  type,
  showTooltip = true,
  size = 'md',
}: AccountTypeBadgeProps) => {
  const display = getAccountTypeDisplay(type);
  const terminology = ACCOUNT_TYPE_TERMINOLOGY[type];
  const alternatives = terminology.synonyms.filter(
    (s) => s !== terminology.standard
  );

  const badge = (
    <Badge
      className={`${display.bgColor} ${display.color} ${
        size === 'sm' ? 'text-xs px-2 py-0' : ''
      }`}
    >
      {display.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Istilah setara:
            </p>
            <div className="flex flex-wrap gap-1">
              {alternatives.map((alt) => (
                <Badge
                  key={alt}
                  variant="outline"
                  className="text-xs font-normal"
                >
                  {alt}
                </Badge>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {terminology.description}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

interface BalanceSheetSectionTitleProps {
  /** Judul utama (Aktiva/Pasiva) */
  title: string;
  /** Subtitle opsional */
  subtitle?: string;
  /** Icon opsional */
  icon?: ReactNode;
  /** Tampilkan persamaan */
  showEquation?: boolean;
}

/**
 * Judul section neraca dengan tooltip terminologi
 */
export const BalanceSheetSectionTitle = ({
  title,
  subtitle,
  icon,
  showEquation = false,
}: BalanceSheetSectionTitleProps) => {
  const isAktiva = ['aktiva', 'aset', 'harta', 'asset'].some(
    (t) => title.toLowerCase().includes(t)
  );
  const isPasiva = ['pasiva', 'kewajiban', 'modal', 'liability', 'equity'].some(
    (t) => title.toLowerCase().includes(t)
  );

  let alternativeTerms: string[] = [];
  let description = '';

  if (isAktiva) {
    alternativeTerms = ['Aktiva', 'Aset', 'Harta'];
    description = 'Sisi kiri neraca - sumber daya yang dimiliki';
  } else if (isPasiva) {
    alternativeTerms = ['Pasiva', 'Kewajiban + Modal', 'Utang + Ekuitas'];
    description = 'Sisi kanan neraca - sumber pendanaan';
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-help group">
          {icon}
          <div>
            <h3 className="font-semibold flex items-center gap-1">
              {title}
              <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-2">
          {alternativeTerms.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Istilah yang sama:
              </p>
              <div className="flex flex-wrap gap-1">
                {alternativeTerms.map((alt) => (
                  <Badge
                    key={alt}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {alt}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
          {showEquation && (
            <div className="pt-1 border-t">
              <p className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {isAktiva ? 'Aktiva = Pasiva' : 'Pasiva = Kewajiban + Modal'}
              </p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

interface AccountingEquationDisplayProps {
  /** Tampilkan versi lengkap */
  expanded?: boolean;
}

/**
 * Komponen untuk menampilkan persamaan akuntansi dasar
 */
export const AccountingEquationDisplay = ({
  expanded = false,
}: AccountingEquationDisplayProps) => {
  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary" />
        Persamaan Dasar Akuntansi
      </h4>
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-sm bg-background rounded px-3 py-2">
          <TermTooltip term="Aktiva" showIcon={false}>
            <span className="text-blue-600 font-medium">Aktiva</span>
          </TermTooltip>
          <span>=</span>
          <TermTooltip term="Kewajiban" showIcon={false}>
            <span className="text-red-600 font-medium">Kewajiban</span>
          </TermTooltip>
          <span>+</span>
          <TermTooltip term="Modal" showIcon={false}>
            <span className="text-green-600 font-medium">Modal</span>
          </TermTooltip>
        </div>
        {expanded && (
          <>
            <p className="text-xs text-muted-foreground">
              Atau dalam istilah lain:
            </p>
            <div className="flex items-center gap-2 font-mono text-xs bg-background rounded px-3 py-2">
              <span className="text-blue-600">Aset</span>
              <span>=</span>
              <span className="text-red-600">Liabilitas</span>
              <span>+</span>
              <span className="text-green-600">Ekuitas</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs bg-background rounded px-3 py-2">
              <span className="text-blue-600">Harta</span>
              <span>=</span>
              <span className="text-red-600">Utang</span>
              <span>+</span>
              <span className="text-green-600">Kekayaan Bersih</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
