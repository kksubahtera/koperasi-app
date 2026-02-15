import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/mockData';
import { SHUDistributionResult, CooperativeSettings, MemberSHUDistribution } from '@/lib/cooperativeSettings';
import { Users, UserCheck, Shield, BookOpen, Percent, Check, AlertCircle, CreditCard, Landmark, Info, GraduationCap, Heart, Building2, AlertTriangle, Clock, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { TermTooltip } from '@/components/shared/TermTooltip';
import { QuickEquationGuide } from './QuickEquationGuide';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SHUDistributionViewProps {
  distribution: SHUDistributionResult;
  onConfirm: (distribution: SHUDistributionResult) => void;
  settings?: CooperativeSettings;
  onToggleExclusion?: (memberId: string, excluded: boolean, note?: string) => void;
}

export const SHUDistributionView = ({ distribution, onConfirm, settings, onToggleExclusion }: SHUDistributionViewProps) => {
  const shuSettings = settings?.shuDistribution || { 
    shuAnggota: 60, 
    shuAnggotaSimpanan: 70, 
    shuAnggotaJasaUsaha: 30, 
    shuPengurus: 15, 
    shuPengawas: 5, 
    shuPenasihat: 5, 
    danaCadangan: 10,
    danaPendidikan: 2.5,
    danaSosial: 2.5,
    danaPembangunan: 0
  };
  const [isConfirming, setIsConfirming] = useState(false);
  const [exclusionDialogOpen, setExclusionDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSHUDistribution | null>(null);
  const [exclusionNote, setExclusionNote] = useState('');

  // Calculate summary statistics
  const withheldMembers = distribution.memberDistributions.filter(m => m.isWithheld);
  const distributedMembers = distribution.memberDistributions.filter(m => !m.isWithheld && m.totalShare > 0);
  const totalWithheldAmount = withheldMembers.reduce((sum, m) => sum + m.totalShare, 0);
  const totalDistributedAmount = distributedMembers.reduce((sum, m) => sum + m.totalShare, 0);

  const handleExclusionToggle = (member: MemberSHUDistribution, exclude: boolean) => {
    if (exclude && !member.hasArrears) {
      // Open dialog for manual exclusion note
      setSelectedMember(member);
      setExclusionNote('');
      setExclusionDialogOpen(true);
    } else {
      // Toggle off or auto-exclude due to arrears
      onToggleExclusion?.(member.memberId, exclude);
    }
  };

  const confirmManualExclusion = () => {
    if (selectedMember) {
      onToggleExclusion?.(selectedMember.memberId, true, exclusionNote);
      setExclusionDialogOpen(false);
      setSelectedMember(null);
      setExclusionNote('');
      toast.success(`${selectedMember.memberName} dikecualikan dari distribusi SHU`);
    }
  };

  const handleConfirm = () => {
    setIsConfirming(true);
    setTimeout(() => {
      onConfirm({
        ...distribution,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      });
      toast.success('Distribusi SHU telah dikonfirmasi');
      // Send notification to all members
      const memberCount = distribution.memberDistributions.length;
      toast.info(`Notifikasi dikirim ke ${memberCount} anggota`, {
        description: 'Semua anggota akan menerima pemberitahuan SHU via email/push notification',
        duration: 5000,
      });
      
      setIsConfirming(false);
    }, 500);
  };

  const roleGroups = {
    pengurus: distribution.roleDistributions.filter(r => r.role === 'pengurus'),
    pengawas: distribution.roleDistributions.filter(r => r.role === 'pengawas'),
    penasihat: distribution.roleDistributions.filter(r => r.role === 'penasihat'),
  };

  // Check if any member has business-related SHU
  const hasBusinessSHU = distribution.memberDistributions.some(m => m.jasaUsahaShare > 0);

  // Calculate fund amounts if available
  const danaPendidikan = (distribution as any).danaPendidikan || distribution.shuBruto * (shuSettings.danaPendidikan / 100);
  const danaSosial = (distribution as any).danaSosial || distribution.shuBruto * (shuSettings.danaSosial / 100);
  const danaPembangunan = (distribution as any).danaPembangunan || distribution.shuBruto * (shuSettings.danaPembangunan / 100);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Reference SHU Distribution Guide */}
      <QuickEquationGuide variant="shu-distribution" />
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            <TermTooltip term="shu" showIcon iconSize="sm">
              Distribusi SHU
            </TermTooltip>
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">Tahun Buku {distribution.year}</p>
        <Badge 
          variant={distribution.status === 'confirmed' ? 'default' : 'secondary'} 
          className="mt-2"
        >
          {distribution.status === 'confirmed' ? 'Dikonfirmasi' : 'Simulasi/Draft'}
        </Badge>
        {distribution.status !== 'confirmed' && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 justify-center">
            <AlertTriangle className="h-3 w-3" />
            Angka di bawah adalah estimasi simulasi, belum dikonfirmasi/disimpan
          </p>
        )}
        
        {/* SHU Distribution Formula Info */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-muted/30 px-2 sm:px-3 py-1.5 rounded-lg cursor-help mt-2">
                <Info className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="font-mono text-[10px] sm:text-xs break-words">SHU Bruto = Anggota + Pengurus + Dana Cadangan + Dana Lainnya</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="font-medium mb-1">Rumus Distribusi SHU</p>
              <p className="text-xs text-muted-foreground">
                SHU didistribusikan ke anggota, pengurus/pengawas/penasihat, dan dana-dana koperasi sesuai persentase yang ditetapkan dalam AD/ART.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* SHU Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 sm:py-6">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              <TermTooltip term="shuBruto" showIcon={false}>
                SHU Bruto
              </TermTooltip>
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(distribution.shuBruto)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Withheld SHU Summary - Show if there are withheld members */}
      {withheldMembers.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-600">
              <Clock className="h-4 w-4" />
              SHU Ditahan ({withheldMembers.length} Anggota)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <p className="text-xs text-muted-foreground">Total SHU Ditahan</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totalWithheldAmount)}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <p className="text-xs text-muted-foreground">
                  {distribution.status === 'confirmed' ? 'Total SHU Dibagikan' : 'Total SHU Layak Dibagikan'}
                </p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalDistributedAmount)}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <Info className="h-3 w-3 inline mr-1" />
              SHU ditahan untuk anggota dengan tunggakan atau yang dikecualikan manual. 
              SHU akan dibagikan setelah tunggakan dilunasi atau saat pengunduran diri untuk menambah pembayaran angsuran.
            </div>
            <div className="space-y-1">
              {withheldMembers.slice(0, 3).map(m => (
                <div key={m.memberId} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span className="truncate max-w-[120px] sm:max-w-none">{m.memberName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {m.exclusionReason === 'manual' ? 'Manual' : `Tunggakan ${formatCurrency(m.arrearsAmount)}`}
                    </Badge>
                  </div>
                  <span className="font-medium">{formatCurrency(m.totalShare)}</span>
                </div>
              ))}
              {withheldMembers.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{withheldMembers.length - 3} anggota lainnya
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {/* SHU Anggota */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              <TermTooltip term="shuAnggota" showIcon iconSize="sm">
                SHU Anggota ({shuSettings.shuAnggota}%)
              </TermTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Total SHU Anggota</span>
              <span className="font-medium">{formatCurrency(distribution.shuAnggotaTotal)}</span>
            </div>
            <div className="ml-3 space-y-2 border-l-2 border-primary/20 pl-3">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Landmark className="h-3 w-3" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help text-left">
                        SHU Jasa Simpanan ({shuSettings.shuAnggotaSimpanan}%)
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">SHU Jasa Simpanan</p>
                        <p className="text-xs text-muted-foreground">
                          Bagian SHU berdasarkan proporsi simpanan pokok dan wajib anggota.
                          Semakin besar simpanan, semakin besar bagian SHU.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span>{formatCurrency(distribution.shuAnggotaSimpanan)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help text-left">
                        SHU Jasa Usaha ({shuSettings.shuAnggotaJasaUsaha}%)
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">SHU Jasa Usaha</p>
                        <p className="text-xs text-muted-foreground">
                          Bagian SHU berdasarkan kontribusi transaksi/pinjaman anggota.
                          Anggota yang aktif bertransaksi mendapat bagian lebih besar.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span>{formatCurrency(distribution.shuAnggotaJasaUsaha)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dana Cadangan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              <TermTooltip term="danaCadangan" showIcon iconSize="sm">
                Dana Cadangan ({shuSettings.danaCadangan}%)
              </TermTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(distribution.danaCadangan)}</p>
            <p className="text-xs text-muted-foreground">Ditambahkan ke Dana Cadangan Koperasi untuk penguatan modal</p>
          </CardContent>
        </Card>
      </div>

      {/* Dana-dana Lainnya */}
      {(shuSettings.danaPendidikan > 0 || shuSettings.danaSosial > 0 || shuSettings.danaPembangunan > 0) && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {shuSettings.danaPendidikan > 0 && (
            <Card className="border-blue-500/20">
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-blue-600">
                  <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="truncate">
                    <TermTooltip term="danaPendidikan" showIcon iconSize="sm">
                      Dana Pendidikan ({shuSettings.danaPendidikan}%)
                    </TermTooltip>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <p className="text-base sm:text-lg font-bold text-blue-600">{formatCurrency(danaPendidikan)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Untuk pelatihan anggota & pengurus</p>
              </CardContent>
            </Card>
          )}

          {shuSettings.danaSosial > 0 && (
            <Card className="border-pink-500/20">
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-pink-600">
                  <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="truncate">
                    <TermTooltip term="danaSosial" showIcon iconSize="sm">
                      Dana Sosial ({shuSettings.danaSosial}%)
                    </TermTooltip>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <p className="text-base sm:text-lg font-bold text-pink-600">{formatCurrency(danaSosial)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Untuk bantuan & kegiatan sosial</p>
              </CardContent>
            </Card>
          )}

          {shuSettings.danaPembangunan > 0 && (
            <Card className="border-orange-500/20">
              <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-orange-600">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="truncate">
                    <TermTooltip term="danaPembangunan" showIcon iconSize="sm">
                      Dana Pembangunan ({shuSettings.danaPembangunan}%)
                    </TermTooltip>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <p className="text-base sm:text-lg font-bold text-orange-600">{formatCurrency(danaPembangunan)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Untuk pengembangan usaha</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Role Distributions */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {/* Pengurus */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <TermTooltip term="shuPengurus" showIcon iconSize="sm">
                Pengurus ({shuSettings.shuPengurus}%)
              </TermTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 sm:p-6 pt-0">
            <p className="text-base sm:text-lg font-bold">{formatCurrency(distribution.shuPengurus)}</p>
            {roleGroups.pengurus.length > 0 ? (
              <div className="space-y-1">
                {roleGroups.pengurus.map(r => (
                  <div key={r.assignmentId} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-1 truncate">
                      <span className="truncate">{r.name}</span>
                      {r.isMember && <Badge variant="outline" className="text-[8px] sm:text-[10px] flex-shrink-0">Anggota</Badge>}
                    </div>
                    <span className="flex-shrink-0 ml-2">{formatCurrency(r.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] sm:text-xs text-muted-foreground">Belum ada pengurus ditetapkan</p>
            )}
          </CardContent>
        </Card>

        {/* Pengawas */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <TermTooltip term="shuPengawas" showIcon iconSize="sm">
                Pengawas ({shuSettings.shuPengawas}%)
              </TermTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 sm:p-6 pt-0">
            <p className="text-base sm:text-lg font-bold">{formatCurrency(distribution.shuPengawas)}</p>
            {roleGroups.pengawas.length > 0 ? (
              <div className="space-y-1">
                {roleGroups.pengawas.map(r => (
                  <div key={r.assignmentId} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-1 truncate">
                      <span className="truncate">{r.name}</span>
                      {r.isMember && <Badge variant="outline" className="text-[8px] sm:text-[10px] flex-shrink-0">Anggota</Badge>}
                    </div>
                    <span className="flex-shrink-0 ml-2">{formatCurrency(r.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] sm:text-xs text-muted-foreground">Belum ada pengawas ditetapkan</p>
            )}
          </CardContent>
        </Card>

        {/* Penasihat */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <TermTooltip term="shuPenasihat" showIcon iconSize="sm">
                Penasihat ({shuSettings.shuPenasihat}%)
              </TermTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 sm:p-6 pt-0">
            <p className="text-base sm:text-lg font-bold">{formatCurrency(distribution.shuPenasihat)}</p>
            {roleGroups.penasihat.length > 0 ? (
              <div className="space-y-1">
                {roleGroups.penasihat.map(r => (
                  <div key={r.assignmentId} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-1 truncate">
                      <span className="truncate">{r.name}</span>
                      {r.isMember && <Badge variant="outline" className="text-[8px] sm:text-[10px] flex-shrink-0">Anggota</Badge>}
                    </div>
                    <span className="flex-shrink-0 ml-2">{formatCurrency(r.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] sm:text-xs text-muted-foreground">Belum ada penasihat ditetapkan</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member Distributions - Enhanced Table with Exclusion Controls */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            <TermTooltip term="shuAnggota" showIcon iconSize="sm">
              Distribusi SHU ke Anggota
            </TermTooltip>
            {distribution.status === 'draft' && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                Dapat Diatur
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {distribution.memberDistributions.length > 0 ? (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px] sm:min-w-[150px] text-[10px] sm:text-xs">Nama Anggota</TableHead>
                    <TableHead className="text-right text-[10px] sm:text-xs hidden sm:table-cell">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">SHU Simpanan</TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Berdasarkan proporsi simpanan pokok + wajib</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-right text-[10px] sm:text-xs hidden md:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <CreditCard className="h-3 w-3" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Jasa Usaha</TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Berdasarkan kontribusi transaksi/pinjaman</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableHead>
                    <TableHead className="text-right text-[10px] sm:text-xs">Total SHU</TableHead>
                    <TableHead className="text-center text-[10px] sm:text-xs">Status</TableHead>
                    {distribution.status === 'draft' && onToggleExclusion && (
                      <TableHead className="text-center text-[10px] sm:text-xs hidden lg:table-cell">Kecualikan</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distribution.memberDistributions.map(m => {
                    const hasBusinessContrib = m.jasaUsahaShare > 0;
                    const memberHasRole = (m as any).roleInfo;
                    
                    return (
                      <TableRow key={m.memberId} className={m.isWithheld ? 'bg-amber-500/5' : ''}>
                        <TableCell className="font-medium text-[10px] sm:text-sm p-2 sm:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                            <span className={`truncate max-w-[80px] sm:max-w-none ${m.isWithheld ? 'text-muted-foreground' : ''}`}>
                              {m.memberName}
                            </span>
                            {memberHasRole && (
                              <Badge variant="outline" className="text-[8px] sm:text-[10px] w-fit">
                                {memberHasRole === 'pengurus' ? 'Pengurus' : 
                                 memberHasRole === 'pengawas' ? 'Pengawas' : 'Penasihat'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right text-[10px] sm:text-sm p-2 sm:p-4 hidden sm:table-cell ${m.isWithheld ? 'text-muted-foreground' : ''}`}>
                          {formatCurrency(m.simpananShare)}
                        </TableCell>
                        <TableCell className="text-right text-[10px] sm:text-sm p-2 sm:p-4 hidden md:table-cell">
                          {hasBusinessContrib ? (
                            <span className={m.isWithheld ? 'text-muted-foreground' : 'text-green-600'}>
                              {formatCurrency(m.jasaUsahaShare)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-semibold text-[10px] sm:text-sm p-2 sm:p-4 ${m.isWithheld ? 'text-amber-600' : 'text-primary'}`}>
                          {formatCurrency(m.totalShare)}
                        </TableCell>
                        <TableCell className="text-center p-2 sm:p-4">
                          {m.isWithheld ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[8px] sm:text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    Ditahan
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {m.exclusionReason === 'manual' 
                                      ? `Dikecualikan manual: ${m.exclusionNote || 'Tidak ada catatan'}`
                                      : `Tunggakan: ${formatCurrency(m.arrearsAmount)}`
                                    }
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : m.hasArrears ? (
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              Tunggakan
                            </Badge>
                          ) : distribution.status === 'confirmed' ? (
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
                              <Check className="h-2.5 w-2.5 mr-0.5" />
                              Dibagikan
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                              <Check className="h-2.5 w-2.5 mr-0.5" />
                              Layak
                            </Badge>
                          )}
                        </TableCell>
                        {distribution.status === 'draft' && onToggleExclusion && (
                          <TableCell className="text-center p-2 sm:p-4 hidden lg:table-cell">
                            {m.hasArrears ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Ban className="h-4 w-4 text-muted-foreground mx-auto" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Otomatis ditahan karena tunggakan</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Switch
                                checked={m.isExcluded}
                                onCheckedChange={(checked) => handleExclusionToggle(m, checked)}
                              />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {/* Total Row */}
                  <TableRow className="border-t-2 bg-muted/30">
                    <TableCell className="font-bold text-[10px] sm:text-sm p-2 sm:p-4">TOTAL</TableCell>
                    <TableCell className="text-right font-bold text-[10px] sm:text-sm p-2 sm:p-4 hidden sm:table-cell">
                      {formatCurrency(distribution.memberDistributions.reduce((sum, m) => sum + m.simpananShare, 0))}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600 text-[10px] sm:text-sm p-2 sm:p-4 hidden md:table-cell">
                      {formatCurrency(distribution.memberDistributions.reduce((sum, m) => sum + m.jasaUsahaShare, 0))}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary text-[10px] sm:text-sm p-2 sm:p-4">
                      {formatCurrency(distribution.memberDistributions.reduce((sum, m) => sum + m.totalShare, 0))}
                    </TableCell>
                    <TableCell className="text-center p-2 sm:p-4">
                      <div className="flex flex-col items-center gap-0.5 text-[8px]">
                        <span className="text-green-600">
                          {distributedMembers.length} {distribution.status === 'confirmed' ? 'dibagikan' : 'layak'}
                        </span>
                        {withheldMembers.length > 0 && (
                          <span className="text-amber-600">{withheldMembers.length} ditahan</span>
                        )}
                      </div>
                    </TableCell>
                    {distribution.status === 'draft' && onToggleExclusion && (
                      <TableCell className="hidden lg:table-cell"></TableCell>
                    )}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">Belum ada data distribusi anggota</p>
          )}
          
          {/* Formula Explanation */}
          <div className="mt-4 p-2 sm:p-3 rounded-lg bg-muted/50 text-[10px] sm:text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1 mb-2">
              <Info className="h-3 w-3" />
              <span className="font-medium">Rumus Perhitungan:</span>
            </div>
            <p><strong>SHU Jasa Simpanan:</strong> (Simpanan Pokok + Wajib Anggota) ÷ Total Simpanan × {shuSettings.shuAnggotaSimpanan}% × SHU Anggota</p>
            <p><strong>SHU Jasa Usaha:</strong> Kontribusi Jasa Anggota ÷ Total Kontribusi × {shuSettings.shuAnggotaJasaUsaha}% × SHU Anggota</p>
          </div>
        </CardContent>
      </Card>

      {/* Terminology Info Box */}
      <Card className="border-muted">
        <CardContent className="py-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Istilah dalam Distribusi SHU
          </h4>
          <div className="grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">SHU Bruto:</span> Total laba sebelum distribusi
            </div>
            <div>
              <span className="font-medium text-foreground">SHU Anggota:</span> Bagian untuk anggota (simpanan + jasa)
            </div>
            <div>
              <span className="font-medium text-foreground">Dana Cadangan:</span> Penguatan modal koperasi
            </div>
            <div>
              <span className="font-medium text-foreground">Dana Pendidikan:</span> Pelatihan anggota/pengurus
            </div>
            <div>
              <span className="font-medium text-foreground">Dana Sosial:</span> Bantuan & kegiatan sosial
            </div>
            <div>
              <span className="font-medium text-foreground">Dana Pembangunan:</span> Pengembangan usaha
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Button */}
      {distribution.status === 'draft' && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Distribusi ini masih draft</span>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Setelah dikonfirmasi, SHU akan didistribusikan ke masing-masing anggota dan tidak dapat diubah.
              </p>
              <Button 
                onClick={handleConfirm} 
                disabled={isConfirming}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                {isConfirming ? 'Mengkonfirmasi...' : 'Konfirmasi Distribusi SHU'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {distribution.status === 'confirmed' && distribution.confirmedAt && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">
                Dikonfirmasi pada {new Date(distribution.confirmedAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Exclusion Dialog */}
      <Dialog open={exclusionDialogOpen} onOpenChange={setExclusionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-500" />
              Kecualikan dari Distribusi SHU
            </DialogTitle>
            <DialogDescription>
              {selectedMember && (
                <>
                  Anggota <strong>{selectedMember.memberName}</strong> akan dikecualikan dari 
                  distribusi SHU tahun {distribution.year}. SHU sebesar{' '}
                  <strong>{formatCurrency(selectedMember.totalShare)}</strong> akan ditahan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Alasan Pengecualian (Opsional)</label>
              <Input
                placeholder="Contoh: Tidak aktif dalam kegiatan koperasi"
                value={exclusionNote}
                onChange={(e) => setExclusionNote(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Catatan ini akan dicatat dalam riwayat SHU anggota
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-600 mb-1">Penting:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• SHU yang ditahan akan disimpan dan dapat dirilis kapan saja</li>
                <li>• Jika anggota mengundurkan diri, SHU ditahan akan digunakan untuk membayar tunggakan</li>
                <li>• Anggota akan menerima notifikasi tentang SHU yang ditahan</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExclusionDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmManualExclusion} className="gap-2">
              <Clock className="h-4 w-4" />
              Tahan SHU
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
