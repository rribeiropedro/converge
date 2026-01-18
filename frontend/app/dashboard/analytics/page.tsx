"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
  Tooltip,
  Legend,
} from "recharts";
import {
  Users,
  TrendingUp,
  Calendar,
  Building2,
  MapPin,
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  Target,
  Lightbulb,
} from "lucide-react";
import { getNetworkAnalytics, getNetworkRecommendations, NetworkAnalyticsData, NetworkRecommendation } from "@/lib/api";

// Chart color palette
const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted))",
  chart1: "#8b5cf6",
  chart2: "#06b6d4",
  chart3: "#10b981",
  chart4: "#f59e0b",
  chart5: "#ef4444",
  chart6: "#ec4899",
};

const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            <Badge variant={trend.positive ? "default" : "destructive"} className="text-xs">
              {trend.positive ? "+" : ""}{trend.value}%
            </Badge>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// Network Growth Chart
function NetworkGrowthChart({ data, loading }: { data: { date: string; count: number; cumulative: number }[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    cumulative: { label: "Total Connections", color: COLORS.chart1 },
    count: { label: "New Connections", color: COLORS.chart2 },
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Network Growth Over Time
        </CardTitle>
        <CardDescription>Cumulative connections and monthly additions</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.chart1} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.chart1} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={COLORS.chart1}
              fillOpacity={1}
              fill="url(#colorCumulative)"
              strokeWidth={2}
            />
            <Line type="monotone" dataKey="count" stroke={COLORS.chart2} strokeWidth={2} dot={{ r: 4 }} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Industry Breakdown Chart
function IndustryBreakdownChart({ data, loading }: { data: { name: string; value: number }[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Connections by Industry
        </CardTitle>
        <CardDescription>Distribution across industries</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Location Distribution Chart
function LocationChart({ data, loading }: { data: { city: string; count: number }[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Top Locations
        </CardTitle>
        <CardDescription>Where your network is concentrated</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.slice(0, 6)} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="city" type="category" tick={{ fontSize: 12 }} width={75} />
            <Tooltip />
            <Bar dataKey="count" fill={COLORS.chart3} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Company Distribution Chart
function CompanyChart({ data, loading }: { data: { company: string; count: number }[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Top Companies
        </CardTitle>
        <CardDescription>Most represented organizations</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.slice(0, 6)} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="company" type="category" tick={{ fontSize: 12 }} width={95} />
            <Tooltip />
            <Bar dataKey="count" fill={COLORS.chart4} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Event Type Distribution
function EventTypeChart({ data, loading }: { data: { type: string; count: number }[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Connections by Event Type
        </CardTitle>
        <CardDescription>Where you meet your network</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="count"
              label={({ type, percent }) => `${type} (${(percent * 100).toFixed(0)}%)`}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Follow-Up Status Chart
function FollowUpChart({ data, loading }: { data: { type: string; completed: number; pending: number }[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Follow-Up Progress
        </CardTitle>
        <CardDescription>Track your networking commitments</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="type" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" name="Completed" fill={COLORS.chart3} stackId="stack" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pending" name="Pending" fill={COLORS.chart5} stackId="stack" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Top Topics Chart
function TopicsChart({ data, loading }: { data: { topic: string; count: number }[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Most Discussed Topics
        </CardTitle>
        <CardDescription>Common themes in your conversations</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.slice(0, 8)} margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="topic" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill={COLORS.chart6} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// LLM Recommendations Component
function RecommendationsPanel({
  recommendations,
  loading,
  onRefresh,
}: {
  recommendations: NetworkRecommendation[];
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border rounded-lg">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "action":
        return <Target className="h-5 w-5 text-blue-500" />;
      case "insight":
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Sparkles className="h-5 w-5 text-purple-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription>Actionable insights based on your network data</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recommendations available yet.</p>
            <p className="text-sm">Add more connections to get personalized insights!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:border-primary/50 transition-colors bg-card"
              >
                <div className="flex items-start gap-3">
                  {getIcon(rec.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{rec.title}</h4>
                      <Badge variant={getPriorityColor(rec.priority) as "default" | "secondary" | "destructive"} className="text-xs shrink-0">
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    {rec.actionableStep && (
                      <p className="text-sm text-primary mt-2 font-medium">
                        Next step: {rec.actionableStep}
                      </p>
                    )}
                    {rec.relatedConnection && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Related: {rec.relatedConnection}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Analytics Page
export default function NetworkAnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<NetworkAnalyticsData | null>(null);
  const [recommendations, setRecommendations] = useState<NetworkRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNetworkAnalytics();
      setAnalyticsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      setRecommendationsLoading(true);
      const recs = await getNetworkRecommendations();
      setRecommendations(recs);
    } catch (err) {
      console.error("Failed to load recommendations:", err);
    } finally {
      setRecommendationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchRecommendations();
  }, [fetchAnalytics, fetchRecommendations]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">Failed to load analytics</p>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchAnalytics}>Try Again</Button>
      </div>
    );
  }

  const metrics = analyticsData?.metrics || {
    totalConnections: 0,
    newConnectionsThisMonth: 0,
    followUpCompletionRate: 0,
    needsReviewCount: 0,
    averageInteractions: 0,
    activeConnectionsCount: 0,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network Analytics</h1>
          <p className="text-muted-foreground">
            Insights and trends from your professional network
          </p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard
          title="Total Connections"
          value={metrics.totalConnections}
          subtitle="Approved connections in network"
          icon={Users}
          loading={loading}
        />
        <MetricCard
          title="New This Month"
          value={metrics.newConnectionsThisMonth}
          subtitle="Connections added recently"
          icon={TrendingUp}
          trend={metrics.newConnectionsThisMonth > 0 ? { value: 12, positive: true } : undefined}
          loading={loading}
        />
        <MetricCard
          title="Follow-Up Rate"
          value={`${metrics.followUpCompletionRate}%`}
          subtitle="Completed follow-ups"
          icon={CheckCircle2}
          loading={loading}
        />
        <MetricCard
          title="Needs Review"
          value={metrics.needsReviewCount}
          subtitle="Connections pending review"
          icon={Clock}
          loading={loading}
        />
        <MetricCard
          title="Avg. Interactions"
          value={metrics.averageInteractions.toFixed(1)}
          subtitle="Per connection"
          icon={MessageSquare}
          loading={loading}
        />
        <MetricCard
          title="Active Connections"
          value={metrics.activeConnectionsCount}
          subtitle="Contacted in last 30 days"
          icon={Target}
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Network Breakdown</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <NetworkGrowthChart data={analyticsData?.growthData || []} loading={loading} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <IndustryBreakdownChart data={analyticsData?.industryData || []} loading={loading} />
            <EventTypeChart data={analyticsData?.eventTypeData || []} loading={loading} />
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LocationChart data={analyticsData?.locationData || []} loading={loading} />
            <CompanyChart data={analyticsData?.companyData || []} loading={loading} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <IndustryBreakdownChart data={analyticsData?.industryData || []} loading={loading} />
            <TopicsChart data={analyticsData?.topicsData || []} loading={loading} />
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FollowUpChart data={analyticsData?.followUpData || []} loading={loading} />
            <TopicsChart data={analyticsData?.topicsData || []} loading={loading} />
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Recommendations */}
      <RecommendationsPanel
        recommendations={recommendations}
        loading={recommendationsLoading}
        onRefresh={fetchRecommendations}
      />
    </div>
  );
}
