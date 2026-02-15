import { SignatoryOfficer, SignatureLayoutSettings, getSignatureContainerClasses, getSignatureSizeClasses } from '@/hooks/useSignatoryOfficers';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

interface SignatureBlockProps {
  signatories: SignatoryOfficer[];
  selectedIds: string[];
  layoutSettings: SignatureLayoutSettings;
  showStamp?: boolean;
  stampPosition?: 'left' | 'right' | 'center' | 'with-first';
  filterByPositions?: string[] | null;
}

/**
 * Reusable signature block component for letters
 * Supports multiple roles (Ketua, Wakil Ketua, Sekretaris, Bendahara) with configurable layouts
 */
export const SignatureBlock = ({
  signatories,
  selectedIds,
  layoutSettings,
  showStamp = true,
  stampPosition = 'left',
  filterByPositions = null,
}: SignatureBlockProps) => {
  const settings = getCooperativeSettings();
  const sizeClasses = getSignatureSizeClasses(layoutSettings.signature_size || 'medium');
  
  // Filter by selected IDs first, then optionally by positions
  let selectedSignatories = signatories.filter(s => selectedIds.includes(s.role_assignment_id));
  
  // If filterByPositions is provided, filter by those positions
  if (filterByPositions && filterByPositions.length > 0) {
    selectedSignatories = selectedSignatories.filter(s => filterByPositions.includes(s.position));
  }
  
  // Sort by position priority
  selectedSignatories = selectedSignatories.sort((a, b) => {
    const order: Record<string, number> = { 
      'Ketua': 1, 
      'Wakil Ketua': 2, 
      'Sekretaris': 3, 
      'Bendahara': 4 
    };
    return (order[a.position] || 99) - (order[b.position] || 99);
  });

  // No signatories selected, don't render anything
  if (selectedSignatories.length === 0 && !showStamp) {
    return null;
  }

  const containerClasses = getSignatureContainerClasses(
    layoutSettings.signature_layout,
    layoutSettings.signature_alignment,
    layoutSettings.max_signatories_per_row
  );

  const renderStamp = () => {
    if (!showStamp) return null;
    
    if (settings.stampBase64) {
      return (
        <img 
          src={settings.stampBase64} 
          alt="Stempel" 
          className={`${sizeClasses.stamp} object-contain opacity-80`}
        />
      );
    }
    
    return (
      <div className={`${sizeClasses.stamp} rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center`}>
        <span className="text-[8px] text-gray-400 text-center">STEMPEL<br/>KOPERASI</span>
      </div>
    );
  };

  const renderSignatory = (officer: SignatoryOfficer) => (
    <div key={officer.role_assignment_id} className="text-center flex-shrink-0">
      <p className={`${sizeClasses.text} font-semibold text-gray-800`}>{officer.position}</p>
      {officer.signature_base64 ? (
        <img 
          src={officer.signature_base64} 
          alt={`TTD ${officer.name}`} 
          className={`${sizeClasses.sig} object-contain mx-auto my-1`}
        />
      ) : (
        <div className={`${sizeClasses.sig} mt-1 mb-1 border-b border-gray-400 mx-auto`}></div>
      )}
      <p className={`${sizeClasses.name} font-semibold text-gray-800`}>
        {officer.name || '____________________'}
      </p>
    </div>
  );

  // If no signatories selected, only render stamp with placeholder
  if (selectedSignatories.length === 0) {
    return (
      <div className="flex justify-between items-end">
        {renderStamp()}
        <div className="text-center">
          <p className={`${sizeClasses.text} font-semibold text-gray-800`}>Ketua Koperasi</p>
          <div className={`${sizeClasses.sig} mt-1 mb-1 border-b border-gray-400`}></div>
          <p className={`${sizeClasses.name} font-semibold text-gray-800`}>____________________</p>
        </div>
      </div>
    );
  }

  // Position alignment for main container
  const positionAlignmentClass = (() => {
    switch (layoutSettings.signature_position) {
      case 'bottom-left': return 'justify-start';
      case 'bottom-center': return 'justify-center';
      case 'bottom-right': return 'justify-end';
      default: return 'justify-between';
    }
  })();

  // Handle special stamp position "with-first" - stamp appears next to first signatory
  if (stampPosition === 'with-first' && showStamp && selectedSignatories.length > 0) {
    const firstSignatory = selectedSignatories[0];
    const restSignatories = selectedSignatories.slice(1);
    
    return (
      <div className={`flex items-end gap-4 sm:gap-8 ${positionAlignmentClass}`}>
        {/* First signatory with stamp */}
        <div className="flex items-end gap-3">
          <div className="flex-shrink-0">
            {renderStamp()}
          </div>
          {renderSignatory(firstSignatory)}
        </div>

        {/* Rest of signatories */}
        {restSignatories.length > 0 && (
          <div className={containerClasses}>
            {restSignatories.map(renderSignatory)}
          </div>
        )}
      </div>
    );
  }

  // Handle grid layout for multiple signatories (2x2 or custom grid)
  if (layoutSettings.signature_layout === 'grid' && selectedSignatories.length > 2) {
    const maxPerRow = layoutSettings.max_signatories_per_row || 2;
    const rows: SignatoryOfficer[][] = [];
    
    for (let i = 0; i < selectedSignatories.length; i += maxPerRow) {
      rows.push(selectedSignatories.slice(i, i + maxPerRow));
    }

    return (
      <div className={`flex flex-col gap-6 ${positionAlignmentClass}`}>
        {/* Stamp at top if position is center or left */}
        {showStamp && (stampPosition === 'center' || stampPosition === 'left') && (
          <div className={`flex ${stampPosition === 'center' ? 'justify-center' : 'justify-start'}`}>
            {renderStamp()}
          </div>
        )}
        
        {/* Grid of signatories */}
        <div className="space-y-4">
          {rows.map((row, rowIndex) => (
            <div 
              key={rowIndex} 
              className={`flex gap-6 sm:gap-10 ${
                layoutSettings.signature_alignment === 'center' ? 'justify-center' :
                layoutSettings.signature_alignment === 'right' ? 'justify-end' :
                layoutSettings.signature_alignment === 'space-between' ? 'justify-between' :
                'justify-start'
              }`}
            >
              {row.map(renderSignatory)}
            </div>
          ))}
        </div>

        {/* Stamp at bottom-right */}
        {showStamp && stampPosition === 'right' && (
          <div className="flex justify-end">
            {renderStamp()}
          </div>
        )}
      </div>
    );
  }

  // Handle vertical layout
  if (layoutSettings.signature_layout === 'vertical') {
    return (
      <div className={`flex items-start gap-4 sm:gap-8 ${positionAlignmentClass}`}>
        {/* Stamp on left */}
        {showStamp && stampPosition === 'left' && (
          <div className="flex-shrink-0 self-center">
            {renderStamp()}
          </div>
        )}

        {/* Vertical stack of signatories */}
        <div className="flex flex-col gap-6">
          {selectedSignatories.map(renderSignatory)}
        </div>

        {/* Stamp on right */}
        {showStamp && stampPosition === 'right' && (
          <div className="flex-shrink-0 self-center">
            {renderStamp()}
          </div>
        )}
      </div>
    );
  }

  // Default: Horizontal layout
  return (
    <div className={`flex items-end gap-4 sm:gap-8 ${positionAlignmentClass}`}>
      {/* Stamp on left */}
      {showStamp && stampPosition === 'left' && (
        <div className="flex-shrink-0">
          {renderStamp()}
        </div>
      )}

      {/* Signatories */}
      <div className={containerClasses}>
        {selectedSignatories.map(renderSignatory)}
      </div>

      {/* Stamp on right */}
      {showStamp && stampPosition === 'right' && (
        <div className="flex-shrink-0">
          {renderStamp()}
        </div>
      )}
    </div>
  );
};

export default SignatureBlock;
