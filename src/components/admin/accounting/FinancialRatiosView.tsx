import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Activity,
  Shield,
  PieChart,
  Users
} from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { useFinancialRatios, RatioItem, RatioCategory } from '@/hooks/useFinancialRatios';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { QuickEquationGuide } from './QuickEquationGuide';

interface FinancialRatiosViewProps {
  year: number;
}

const getCategoryIcon = (categoryName: string) => {
  switch (categoryName) {
    case 'Rasio Likuiditas':
      return <RupiahIcon className="w-5 h-5" />;
    case 'Rasio Profitabilitas':
      return <TrendingUp className="w-5 h-5" />;
    case 'Rasio Kualitas Aset':
      return <Shield className="w-5 h-5" />;
    case 'Rasio Solvabilitas':
      return <PieChart className="w-5 h-5" />;
    case 'Rasio Aktivitas':
      return <Activity className="w-5 h-5" />;
    default:
      return <Info className="w-5 h-5" />;
  }
};

const getStatusColor = (status: RatioItem['status']) => {
  switch (status) {
    case 'excellent':
      return 'bg-green-500';
    case 'good':
      return 'bg-blue-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'danger':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusBadge = (status: RatioItem['status']) => {
  switch (status) {
    case 'excellent':
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Sangat Baik</Badge>;
    case 'good':
      return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">Baik</Badge>;
    case 'warning':
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Perhatian</Badge>;
    case 'danger':
      return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Kritis</Badge>;
    default:
      return <Badge variant="secondary">-</Badge>;
  }
};

const getStatusIcon = (status: RatioItem['status']) => {
  switch (status) {
    case 'excellent':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'good':
      return <TrendingUp className="w-5 h-5 text-blue-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'danger':
      return <TrendingDown className="w-5 h-5 text-red-500" />;
    default:
      return <Info className="w-5 h-5 text-muted-foreground" />;
  }
};

const RatioCard = ({ ratio }: { ratio: RatioItem }) => {
  return (
    <div className="p-3 sm:p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {getStatusIcon(ratio.status)}
          <span className="font-medium text-xs sm:text-sm truncate">{ratio.name}</span>
        </div>
        {getStatusBadge(ratio.status)}
      </div>
      
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-xl sm:text-2xl font-bold">{ratio.value.toFixed(2)}</span>
        <span className="text-muted-foreground text-xs sm:text-sm">{ratio.unit}</span>
      </div>
      
      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
          <span>Benchmark: {ratio.benchmark}</span>
        </div>
        <Progress 
          value={Math.min(Math.max(ratio.value, 0), 100)} 
          className="h-1.5 sm:h-2"
        />
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mt-2 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground cursor-help">
              <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
              <span className="line-clamp-1">{ratio.description}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{ratio.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

const CategorySection = ({ category }: { category: RatioCategory }) => {
  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
          {getCategoryIcon(category.name)}
          {category.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {category.ratios.map((ratio, index) => (
            <RatioCard key={index} ratio={ratio} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const HealthScoreCard = ({ 
  score, 
  status 
}: { 
  score: number; 
  status: { label: string; color: string } 
}) => {
  const getScoreColor = () => {
    if (score >= 80) return 'from-green-500 to-green-600';
    if (score >= 60) return 'from-blue-500 to-blue-600';
    if (score >= 40) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4 sm:pb-6">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h3 className="text-sm sm:text-lg font-semibold text-muted-foreground mb-1">
              Skor Kesehatan Koperasi
            </h3>
            <p className={`text-2xl sm:text-3xl font-bold ${status.color}`}>
              {status.label}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              Berdasarkan analisis {5} kategori rasio keuangan
            </p>
          </div>
          
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="42%"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="50%"
                cy="50%"
                r="42%"
                stroke="url(#gradient)"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(score / 100) * 264} 264`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className={`${score >= 60 ? 'stop-green-500' : 'stop-red-500'}`} stopColor={score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#eab308' : '#ef4444'} />
                  <stop offset="100%" className={`${score >= 60 ? 'stop-green-600' : 'stop-red-600'}`} stopColor={score >= 80 ? '#16a34a' : score >= 60 ? '#2563eb' : score >= 40 ? '#ca8a04' : '#dc2626'} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl sm:text-3xl font-bold">{score}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
          <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
            <div className="text-[10px] sm:text-xs text-muted-foreground">Sangat Sehat</div>
            <div className="text-xs sm:text-sm font-medium text-green-600">80-100</div>
          </div>
          <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
            <div className="text-[10px] sm:text-xs text-muted-foreground">Sehat</div>
            <div className="text-xs sm:text-sm font-medium text-blue-600">60-79</div>
          </div>
          <div className="p-1.5 sm:p-2 rounded-lg bg-yellow-500/10">
            <div className="text-[10px] sm:text-xs text-muted-foreground">Cukup Sehat</div>
            <div className="text-xs sm:text-sm font-medium text-yellow-600">40-59</div>
          </div>
          <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/10">
            <div className="text-[10px] sm:text-xs text-muted-foreground">Kurang Sehat</div>
            <div className="text-xs sm:text-sm font-medium text-red-600">0-39</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-4 sm:space-y-6">
    <Skeleton className="h-36 sm:h-48 w-full" />
    {[1, 2, 3].map((i) => (
      <div key={i} className="space-y-3 sm:space-y-4">
        <Skeleton className="h-6 sm:h-8 w-36 sm:w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-28 sm:h-36 w-full" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const FinancialRatiosView: React.FC<FinancialRatiosViewProps> = ({ year }) => {
  const { ratioCategories, healthScore, healthStatus, loading } = useFinancialRatios(year);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Reference Guide */}
      <QuickEquationGuide variant="financial-ratios" />
      
      {/* Health Score Overview */}
      <HealthScoreCard score={healthScore} status={healthStatus} />
      
      {/* Quick Summary */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            Ringkasan Rasio Keuangan Tahun {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {ratioCategories.slice(0, 4).map((category, idx) => {
              const excellentCount = category.ratios.filter(r => r.status === 'excellent' || r.status === 'good').length;
              const totalCount = category.ratios.length;
              
              return (
                <div key={idx} className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                  <div className="flex justify-center mb-1.5 sm:mb-2">
                    {getCategoryIcon(category.name)}
                  </div>
                  <div className="text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1 line-clamp-1">{category.name}</div>
                  <div className="text-lg sm:text-2xl font-bold text-primary">
                    {excellentCount}/{totalCount}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">rasio baik</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Ratios by Category */}
      {ratioCategories.map((category, index) => (
        <CategorySection key={index} category={category} />
      ))}
    </div>
  );
};

export default FinancialRatiosView;
