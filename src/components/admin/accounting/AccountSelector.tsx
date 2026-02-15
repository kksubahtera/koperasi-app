import { useState, useMemo, useCallback } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChartOfAccount, AccountType } from '@/hooks/useChartOfAccounts';

interface AccountSelectorProps {
  accounts: ChartOfAccount[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, { label: string; color: string }> = {
  asset: { label: 'Aset', color: 'text-blue-600' },
  liability: { label: 'Kewajiban', color: 'text-red-600' },
  equity: { label: 'Modal', color: 'text-green-600' },
  income: { label: 'Pendapatan', color: 'text-emerald-600' },
  expense: { label: 'Beban', color: 'text-orange-600' },
};

const ACCOUNT_TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

export const AccountSelector = ({
  accounts,
  value,
  onValueChange,
  placeholder = 'Pilih akun...',
  disabled = false,
  className,
}: AccountSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBounce, setShowBounce] = useState(false);
  const [bounceDirection, setBounceDirection] = useState<'top' | 'bottom'>('bottom');

  // Filter active accounts and remove duplicates
  const activeAccounts = useMemo(() => {
    const seen = new Set<string>();
    return accounts.filter(account => {
      if (!account.is_active) return false;
      // Create unique key based on account code and name
      const key = `${account.account_code}-${account.account_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [accounts]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, ChartOfAccount[]> = {
      asset: [],
      liability: [],
      equity: [],
      income: [],
      expense: [],
    };

    activeAccounts.forEach(account => {
      if (groups[account.account_type]) {
        groups[account.account_type].push(account);
      }
    });

    // Sort each group by account code
    Object.keys(groups).forEach(type => {
      groups[type as AccountType].sort((a, b) => 
        a.account_code.localeCompare(b.account_code)
      );
    });

    return groups;
  }, [activeAccounts]);

  // Filter accounts based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedAccounts;

    const query = searchQuery.toLowerCase();
    const filtered: Record<AccountType, ChartOfAccount[]> = {
      asset: [],
      liability: [],
      equity: [],
      income: [],
      expense: [],
    };

    Object.entries(groupedAccounts).forEach(([type, accounts]) => {
      filtered[type as AccountType] = accounts.filter(account =>
        account.account_code.toLowerCase().includes(query) ||
        account.account_name.toLowerCase().includes(query)
      );
    });

    return filtered;
  }, [groupedAccounts, searchQuery]);

  // Get selected account display
  const selectedAccount = useMemo(() => 
    activeAccounts.find(account => account.id === value),
    [activeAccounts, value]
  );

  const hasResults = Object.values(filteredGroups).some(group => group.length > 0);

  // Handle scroll with bounce effect
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtTop = target.scrollTop <= 0;
    const isAtBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 1;

    if (isAtTop || isAtBottom) {
      setBounceDirection(isAtTop ? 'top' : 'bottom');
      setShowBounce(true);
      setTimeout(() => setShowBounce(false), 400);
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-9",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedAccount 
              ? `${selectedAccount.account_code} - ${selectedAccount.account_name}`
              : placeholder
            }
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[350px] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 pl-1"
              placeholder="Cari kode atau nama akun..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            {/* Top bounce indicator */}
            <div 
              className={cn(
                "absolute top-0 left-0 right-0 h-6 pointer-events-none z-10 transition-opacity duration-300",
                "bg-gradient-to-b from-primary/10 to-transparent",
                showBounce && bounceDirection === 'top' ? "opacity-100 animate-overscroll-bounce" : "opacity-0"
              )}
            />
            
            <div 
              className="max-h-[300px] overflow-y-auto overscroll-contain scroll-smooth"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
              onScroll={handleScroll}
            >
              <CommandList className="max-h-none overflow-visible">
                {!hasResults && (
                  <CommandEmpty>Tidak ada akun ditemukan.</CommandEmpty>
                )}
                {ACCOUNT_TYPE_ORDER.map(type => {
                  const accounts = filteredGroups[type];
                  if (accounts.length === 0) return null;
                  
                  const typeConfig = ACCOUNT_TYPE_LABELS[type];
                  
                  return (
                    <CommandGroup 
                      key={type} 
                      heading={
                        <span className={cn("font-semibold", typeConfig.color)}>
                          {typeConfig.label}
                        </span>
                      }
                    >
                      {accounts.map(account => (
                        <CommandItem
                          key={account.id}
                          value={account.id}
                          onSelect={() => {
                            onValueChange(account.id === value ? '' : account.id);
                            setOpen(false);
                            setSearchQuery('');
                          }}
                          className="cursor-pointer touch-manipulation"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 flex-shrink-0",
                              value === account.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono text-xs mr-2 text-muted-foreground flex-shrink-0">
                            {account.account_code}
                          </span>
                          <span className="truncate">{account.account_name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </div>
            
            {/* Bottom bounce indicator */}
            <div 
              className={cn(
                "absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-10 transition-opacity duration-300",
                "bg-gradient-to-t from-primary/10 to-transparent",
                showBounce && bounceDirection === 'bottom' ? "opacity-100 animate-overscroll-bounce" : "opacity-0"
              )}
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AccountSelector;
