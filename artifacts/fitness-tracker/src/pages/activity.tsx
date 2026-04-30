import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { 
  useGetActivity, 
  getGetActivityQueryKey,
  useDeleteActivity,
  getListActivitiesQueryKey,
  getGetActivityStatsQueryKey
} from "@workspace/api-client-react";
import { ActivityMap } from "@/components/activity-map";
import { ActivityCharts } from "@/components/activity-charts";
import { ActivitySplits } from "@/components/activity-splits";
import { formatDistance, formatDuration, formatPace, formatDate } from "@/lib/format";
import { ArrowLeft, Trash2, Activity, Mountain, Timer, Zap, Map, Heart, Flame, Footprints, TrendingDown, Gauge, MoveVertical, Clock, Percent, ArrowRight, Share2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function MetricCard({ title, value, icon: Icon, unit }: { title: string; value: string | React.ReactNode; icon: LucideIcon; unit?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-5 flex flex-col justify-center relative overflow-hidden">
      <Icon className="w-24 h-24 text-muted-foreground/5 absolute -right-6 -bottom-6" />
      <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="label-mono">{title}</span>
      </div>
      <div className="flex items-baseline gap-1 relative z-10">
        <span className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground">{value}</span>
        {unit && <span className="label-mono text-muted-foreground ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

export default function ActivityDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: activity, isLoading, isError } = useGetActivity(id, {
    query: {
      enabled: !!id && !isNaN(id),
      queryKey: getGetActivityQueryKey(id),
    }
  });

  const deleteMutation = useDeleteActivity();

  const handleDelete = () => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Activity deleted", description: "The activity has been removed." });
        queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivityStatsQueryKey() });
        setLocation("/");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete activity.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-8 w-64 mb-8 bg-border" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full bg-border rounded-lg" />)}
          </div>
          <Skeleton className="h-[400px] w-full bg-border rounded-lg mb-8" />
        </div>
      </Layout>
    );
  }

  if (isError || !activity || isNaN(id)) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-5xl text-center">
          <h2 className="text-2xl font-medium mb-4">Activity not found</h2>
          <Link href="/">
            <Button variant="outline" className="border-border hover:bg-card">Return home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const hasMapData = activity.dataPoints?.some((dp) => dp.lat != null && dp.lng != null) ?? false;
  const hasChartData = (activity.dataPoints?.length ?? 0) > 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to activities
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-medium tracking-tight capitalize text-foreground">
                  {activity.sport || "Activity"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(activity.startTime)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href={`/activities/${id}/share`}>
              <Button variant="outline" className="border-border text-foreground hover:bg-accent">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </Link>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground" data-testid="button-delete">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-popover border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this activity and all associated data points.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border hover:bg-card">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4" data-testid="activity-metrics">
          <MetricCard 
            title="Distance" 
            value={activity.distanceMeters ? (activity.distanceMeters / 1000).toFixed(2) : "0.00"} 
            unit="km"
            icon={Map} 
          />
          <MetricCard 
            title="Time" 
            value={formatDuration(activity.durationSeconds)} 
            icon={Timer} 
          />
          <MetricCard 
            title="Pace" 
            value={formatPace(activity.avgPaceSecPerKm).split(" ")[0]} 
            unit="/km"
            icon={Zap} 
          />
          <MetricCard 
            title="Elevation" 
            value={activity.totalElevGainMeters ? activity.totalElevGainMeters.toFixed(0) : "0"} 
            unit="m"
            icon={Mountain} 
          />
        </div>

        {(activity.avgHeartRate != null || activity.maxHeartRate != null || activity.totalCalories != null || activity.avgCadence != null || activity.totalElevDescMeters != null || activity.maxSpeedMps != null || activity.avgPower != null) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {activity.avgHeartRate != null && (
              <MetricCard
                title="Avg HR"
                value={Math.round(activity.avgHeartRate).toString()}
                unit="bpm"
                icon={Heart}
              />
            )}
            {activity.maxHeartRate != null && (
              <MetricCard
                title="Max HR"
                value={Math.round(activity.maxHeartRate).toString()}
                unit="bpm"
                icon={Heart}
              />
            )}
            {activity.totalCalories != null && (
              <MetricCard
                title="Calories"
                value={Math.round(activity.totalCalories).toString()}
                unit="kcal"
                icon={Flame}
              />
            )}
            {activity.avgCadence != null && (
              <MetricCard
                title="Cadence"
                value={Math.round(activity.avgCadence).toString()}
                unit="spm"
                icon={Footprints}
              />
            )}
            {activity.totalElevDescMeters != null && (
              <MetricCard
                title="Descent"
                value={activity.totalElevDescMeters.toFixed(0)}
                unit="m"
                icon={TrendingDown}
              />
            )}
            {activity.maxSpeedMps != null && (
              <MetricCard
                title="Max Pace"
                value={formatPace(1000 / activity.maxSpeedMps).split(" ")[0]}
                unit="/km"
                icon={Zap}
              />
            )}
            {activity.avgPower != null && (
              <MetricCard
                title="Avg Power"
                value={Math.round(activity.avgPower).toString()}
                unit="W"
                icon={Gauge}
              />
            )}
          </div>
        )}

        {(activity.normalizedPower != null || activity.avgVerticalOscillationMm != null || activity.avgStanceTimeMs != null || activity.avgVerticalRatio != null || activity.avgStepLengthMm != null) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {activity.normalizedPower != null && (
              <MetricCard
                title="Norm. Power"
                value={Math.round(activity.normalizedPower).toString()}
                unit="W"
                icon={Zap}
              />
            )}
            {activity.avgVerticalOscillationMm != null && (
              <MetricCard
                title="Vert. Oscillation"
                value={(activity.avgVerticalOscillationMm / 10).toFixed(1)}
                unit="cm"
                icon={MoveVertical}
              />
            )}
            {activity.avgStanceTimeMs != null && (
              <MetricCard
                title="Gnd Contact"
                value={Math.round(activity.avgStanceTimeMs).toString()}
                unit="ms"
                icon={Clock}
              />
            )}
            {activity.avgVerticalRatio != null && (
              <MetricCard
                title="Vert. Ratio"
                value={activity.avgVerticalRatio.toFixed(1)}
                unit="%"
                icon={Percent}
              />
            )}
            {activity.avgStepLengthMm != null && (
              <MetricCard
                title="Step Length"
                value={(activity.avgStepLengthMm / 1000).toFixed(2)}
                unit="m"
                icon={ArrowRight}
              />
            )}
          </div>
        )}

        {hasMapData && (
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4 tracking-tight flex items-center gap-2">
              <Map className="w-5 h-5 text-muted-foreground" />
              GPS Route
            </h2>
            <ActivityMap dataPoints={activity.dataPoints} />
          </div>
        )}

        {hasChartData && (
          <div>
            <h2 className="text-lg font-medium mb-4 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              Metrics
            </h2>
            <div className="bg-card border border-border rounded-lg p-6">
              <ActivityCharts dataPoints={activity.dataPoints} />
            </div>
          </div>
        )}

        {activity.dataPoints.some((p) => p.distance != null) && (
          <div className="mb-8">
            <ActivitySplits dataPoints={activity.dataPoints} />
          </div>
        )}
      </div>
    </Layout>
  );
}
