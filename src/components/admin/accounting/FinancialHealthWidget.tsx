import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFinancialRatios, RatioItem } from '@/hooks/useFinancialRatios';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { 
  Heart, 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lightbulb,
  Target,
  Activity,
  Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinancialHealthWidgetProps {
  year: number;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  action: string;
  icon: React.ReactNode;
}

const getHealthColor = (score: number) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const getHealthBgColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
};

const getHealthGradient = (score: number) => {
  if (score >= 80) return 'from-green-500 to-emerald-600';
  if (score >= 60) return 'from-blue-500 to-indigo-600';
  if (score >= 40) return 'from-amber-500 to-orange-600';
  return 'from-red-500 to-rose-600';
};

const getPriorityBadge = (priority: 'high' | 'medium' | 'low', t: (id: string, en: string) => string) => {
  switch (priority) {
    case 'high':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">{t('Prioritas Tinggi', 'High Priority')}</Badge>;
    case 'medium':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">{t('Prioritas Sedang', 'Medium Priority')}</Badge>;
    case 'low':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">{t('Prioritas Rendah', 'Low Priority')}</Badge>;
  }
};

export const FinancialHealthWidget = ({ year }: FinancialHealthWidgetProps) => {
  const { t } = useThemeLanguage();
  const { ratios, ratioCategories, healthScore, healthStatus, loading } = useFinancialRatios(year);

  // Generate recommendations based on ratio analysis
  const recommendations = useMemo((): Recommendation[] => {
    if (!ratios || !ratioCategories) return [];

    const recs: Recommendation[] = [];

    // Analyze each category and generate recommendations
    ratioCategories.forEach(category => {
      category.ratios.forEach(ratio => {
        if (ratio.status === 'danger') {
          recs.push(generateRecommendation(ratio, 'high'));
        } else if (ratio.status === 'warning') {
          recs.push(generateRecommendation(ratio, 'medium'));
        }
      });
    });

    // Add positive recommendations for excellent performance
    const excellentRatios = ratioCategories.flatMap(c => c.ratios).filter(r => r.status === 'excellent');
    if (excellentRatios.length >= 3 && recs.filter(r => r.priority === 'high').length === 0) {
      recs.push({
        priority: 'low',
        category: t('Umum', 'General'),
        title: t('Pertahankan Kinerja Baik', 'Maintain Good Performance'),
        description: t(
          `${excellentRatios.length} rasio keuangan menunjukkan kinerja sangat baik. Pertahankan strategi dan kebijakan yang sudah berjalan.`,
          `${excellentRatios.length} financial ratios show excellent performance. Maintain current strategies and policies.`
        ),
        action: t('Lanjutkan monitoring rutin dan pertahankan praktik terbaik', 'Continue regular monitoring and maintain best practices'),
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />
      });
    }

    // Sort by priority
    return recs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [ratios, ratioCategories, t]);

  // Count ratios by status
  const statusCounts = useMemo(() => {
    if (!ratioCategories) return { excellent: 0, good: 0, warning: 0, danger: 0 };
    const allRatios = ratioCategories.flatMap(c => c.ratios);
    return {
      excellent: allRatios.filter(r => r.status === 'excellent').length,
      good: allRatios.filter(r => r.status === 'good').length,
      warning: allRatios.filter(r => r.status === 'warning').length,
      danger: allRatios.filter(r => r.status === 'danger').length
    };
  }, [ratioCategories]);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-32 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-red-500" />
          {t('Kesehatan Keuangan Koperasi', 'Cooperative Financial Health')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Score Circle */}
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="relative">
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center",
              "bg-gradient-to-br shadow-lg",
              getHealthGradient(healthScore)
            )}>
              <div className="w-24 h-24 rounded-full bg-background flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-bold", getHealthColor(healthScore))}>
                  {healthScore}
                </span>
                <span className="text-xs text-muted-foreground">{t('dari 100', 'of 100')}</span>
              </div>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <Badge className={cn(
                "px-3 py-1 text-white shadow-sm",
                getHealthBgColor(healthScore)
              )}>
                {healthStatus.label}
              </Badge>
            </div>
          </div>

          <div className="flex-1 space-y-3 w-full">
            {/* Status Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{statusCounts.excellent}</p>
                  <p className="text-xs text-muted-foreground">{t('Sangat Baik', 'Excellent')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{statusCounts.good}</p>
                  <p className="text-xs text-muted-foreground">{t('Baik', 'Good')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{statusCounts.warning}</p>
                  <p className="text-xs text-muted-foreground">{t('Perhatian', 'Warning')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                <XCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-lg font-bold text-red-700 dark:text-red-400">{statusCounts.danger}</p>
                  <p className="text-xs text-muted-foreground">{t('Kritis', 'Critical')}</p>
                </div>
              </div>
            </div>

            {/* Progress by category */}
            <div className="space-y-2">
              {ratioCategories.slice(0, 3).map((category, idx) => {
                const categoryRatios = category.ratios;
                const goodCount = categoryRatios.filter(r => r.status === 'excellent' || r.status === 'good').length;
                const progress = (goodCount / categoryRatios.length) * 100;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{category.name}</span>
                      <span className="font-medium">{goodCount}/{categoryRatios.length}</span>
                    </div>
                    <Progress 
                      value={progress} 
                      className="h-2"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Key Metrics Quick View */}
        {ratios && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="NPL"
              value={`${ratios.npl.toFixed(1)}%`}
              benchmark="≤5%"
              status={ratios.npl <= 5 ? 'good' : ratios.npl <= 8 ? 'warning' : 'danger'}
            />
            <MetricCard
              label="ROA"
              value={`${ratios.roa.toFixed(1)}%`}
              benchmark="≥3%"
              status={ratios.roa >= 3 ? 'good' : ratios.roa >= 1 ? 'warning' : 'danger'}
            />
            <MetricCard
              label="LDR"
              value={`${ratios.loanToDepositRatio.toFixed(1)}%`}
              benchmark="78-92%"
              status={ratios.loanToDepositRatio >= 78 && ratios.loanToDepositRatio <= 92 ? 'good' : 'warning'}
            />
            <MetricCard
              label="Current Ratio"
              value={`${ratios.currentRatio.toFixed(0)}%`}
              benchmark="≥200%"
              status={ratios.currentRatio >= 200 ? 'good' : ratios.currentRatio >= 100 ? 'warning' : 'danger'}
            />
          </div>
        )}

        {/* Recommendations */}
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            {t('Rekomendasi Perbaikan', 'Improvement Recommendations')}
          </h4>
          
          {recommendations.length === 0 ? (
            <div className="text-center py-6 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                {t('Semua rasio keuangan dalam kondisi baik!', 'All financial ratios are in good condition!')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('Tidak ada rekomendasi perbaikan yang mendesak', 'No urgent improvement recommendations')}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-4 rounded-lg border transition-all hover:shadow-sm",
                      rec.priority === 'high' ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800" :
                      rec.priority === 'medium' ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
                      "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {rec.icon}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">{rec.title}</span>
                          {getPriorityBadge(rec.priority, t)}
                          <Badge variant="outline" className="text-xs">
                            {rec.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rec.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-medium text-primary">
                          <Target className="h-3 w-3" />
                          <span>{rec.action}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper component for metric cards
const MetricCard = ({ 
  label, 
  value, 
  benchmark, 
  status 
}: { 
  label: string; 
  value: string; 
  benchmark: string;
  status: 'good' | 'warning' | 'danger';
}) => {
  const statusStyles = {
    good: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    warning: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    danger: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
  };

  const valueStyles = {
    good: 'text-green-700 dark:text-green-400',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-red-700 dark:text-red-400'
  };

  const icons = {
    good: <TrendingUp className="h-3 w-3 text-green-600" />,
    warning: <Activity className="h-3 w-3 text-amber-600" />,
    danger: <TrendingDown className="h-3 w-3 text-red-600" />
  };

  return (
    <div className={cn("p-3 rounded-lg border", statusStyles[status])}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icons[status]}
      </div>
      <p className={cn("text-xl font-bold mt-1", valueStyles[status])}>{value}</p>
      <p className="text-xs text-muted-foreground">Target: {benchmark}</p>
    </div>
  );
};

// Helper function to generate recommendations
function generateRecommendation(ratio: RatioItem, priority: 'high' | 'medium'): Recommendation {
  const iconMap: Record<string, React.ReactNode> = {
    'Current Ratio': <Gauge className="h-5 w-5 text-blue-600" />,
    'Quick Ratio': <Gauge className="h-5 w-5 text-blue-600" />,
    'Cash Ratio': <Gauge className="h-5 w-5 text-blue-600" />,
    'Return on Assets (ROA)': <TrendingUp className="h-5 w-5 text-green-600" />,
    'Return on Equity (ROE)': <TrendingUp className="h-5 w-5 text-green-600" />,
    'Net Profit Margin': <TrendingUp className="h-5 w-5 text-green-600" />,
    'Non-Performing Loan (NPL)': <AlertTriangle className="h-5 w-5 text-red-600" />,
    'NPL Coverage': <ShieldCheck className="h-5 w-5 text-amber-600" />,
    'Debt to Equity Ratio': <Activity className="h-5 w-5 text-orange-600" />,
    'Debt to Asset Ratio': <Activity className="h-5 w-5 text-orange-600" />,
    'Loan to Deposit Ratio (LDR)': <Target className="h-5 w-5 text-purple-600" />,
    'Pertumbuhan Simpanan': <TrendingUp className="h-5 w-5 text-green-600" />,
    'Pertumbuhan Anggota': <TrendingUp className="h-5 w-5 text-green-600" />
  };

  const recommendations: Record<string, { action: string; description: string }> = {
    'Current Ratio': {
      action: 'Tingkatkan aset lancar atau kurangi kewajiban jangka pendek',
      description: `Current ratio ${ratio.value.toFixed(1)}% di bawah benchmark ${ratio.benchmark}. Likuiditas jangka pendek perlu diperbaiki.`
    },
    'Quick Ratio': {
      action: 'Tingkatkan kas dan setara kas yang tersedia',
      description: `Quick ratio ${ratio.value.toFixed(1)}% menunjukkan kemampuan bayar cepat yang kurang memadai.`
    },
    'Cash Ratio': {
      action: 'Pertahankan cadangan kas yang lebih tinggi',
      description: `Cash ratio ${ratio.value.toFixed(1)}% di bawah standar. Perlu meningkatkan likuiditas kas.`
    },
    'Return on Assets (ROA)': {
      action: 'Optimalkan penggunaan aset untuk menghasilkan pendapatan',
      description: `ROA ${ratio.value.toFixed(2)}% menunjukkan efisiensi aset perlu ditingkatkan.`
    },
    'Return on Equity (ROE)': {
      action: 'Tingkatkan profitabilitas modal dengan diversifikasi pendapatan',
      description: `ROE ${ratio.value.toFixed(2)}% di bawah target. Modal belum bekerja optimal.`
    },
    'Net Profit Margin': {
      action: 'Kurangi biaya operasional atau tingkatkan pendapatan',
      description: `Margin laba bersih ${ratio.value.toFixed(2)}% perlu ditingkatkan.`
    },
    'Non-Performing Loan (NPL)': {
      action: 'Perketat analisis kredit dan intensifkan penagihan',
      description: `NPL ${ratio.value.toFixed(2)}% melebihi batas aman ${ratio.benchmark}. Risiko kredit tinggi.`
    },
    'NPL Coverage': {
      action: 'Tingkatkan dana cadangan untuk menutupi risiko kredit macet',
      description: `Coverage ratio ${ratio.value.toFixed(1)}% kurang memadai untuk menutup potensi kerugian.`
    },
    'Debt to Equity Ratio': {
      action: 'Kurangi ketergantungan pada hutang atau tingkatkan modal sendiri',
      description: `DER ${ratio.value.toFixed(1)}% menunjukkan leverage yang tinggi.`
    },
    'Debt to Asset Ratio': {
      action: 'Seimbangkan struktur pembiayaan aset',
      description: `Rasio hutang terhadap aset ${ratio.value.toFixed(1)}% perlu diperhatikan.`
    },
    'Loan to Deposit Ratio (LDR)': {
      action: ratio.value < 70 ? 'Tingkatkan penyaluran pinjaman' : 'Tingkatkan penghimpunan simpanan',
      description: `LDR ${ratio.value.toFixed(1)}% di luar rentang ideal ${ratio.benchmark}.`
    },
    'Pertumbuhan Simpanan': {
      action: 'Tingkatkan program promosi dan insentif menabung',
      description: `Pertumbuhan simpanan ${ratio.value.toFixed(1)}% di bawah target.`
    },
    'Pertumbuhan Anggota': {
      action: 'Perbanyak sosialisasi dan rekrutmen anggota baru',
      description: `Pertumbuhan anggota ${ratio.value.toFixed(1)}% perlu ditingkatkan.`
    }
  };

  const rec = recommendations[ratio.name] || {
    action: 'Tinjau dan perbaiki rasio ini',
    description: `${ratio.name} dengan nilai ${ratio.value.toFixed(2)}${ratio.unit} perlu diperhatikan.`
  };

  // Determine category from ratio name
  let category = 'Umum';
  if (ratio.name.includes('Ratio') || ratio.name.includes('Cash')) category = 'Likuiditas';
  else if (ratio.name.includes('Return') || ratio.name.includes('Margin')) category = 'Profitabilitas';
  else if (ratio.name.includes('NPL') || ratio.name.includes('Coverage')) category = 'Kualitas Aset';
  else if (ratio.name.includes('Debt')) category = 'Solvabilitas';
  else if (ratio.name.includes('Pertumbuhan') || ratio.name.includes('LDR')) category = 'Aktivitas';

  return {
    priority,
    category,
    title: `Perbaiki ${ratio.name}`,
    description: rec.description,
    action: rec.action,
    icon: iconMap[ratio.name] || <Activity className="h-5 w-5 text-muted-foreground" />
  };
}

export default FinancialHealthWidget;
