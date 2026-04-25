import { useListActivities, useGetActivityStats } from "@workspace/api-client-react";
import { UploadZone } from "@/components/upload-zone";
import { Layout } from "@/components/layout";
import { formatDistance, formatDuration, formatDate } from "@/lib/format";
import { Link } from "wouter";
import { Activity, Clock, Route, ChevronRight, ActivitySquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StatsOverview() {
  const { data: stats, isLoading } = useGetActivityStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="bg-card/50 border-border">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-2 bg-border" />
              <Skeleton className="h-8 w-24 bg-border" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="stats-overview">
      <Card className="bg-card/50 border-border">
        <CardContent className="p-4 sm:p-6 flex flex-col justify-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Activities</p>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">{stats.totalActivities}</div>
        </CardContent>
      </Card>
      <Card className="bg-card/50 border-border">
        <CardContent className="p-4 sm:p-6 flex flex-col justify-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Distance</p>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">{formatDistance(stats.totalDistanceMeters)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card/50 border-border">
        <CardContent className="p-4 sm:p-6 flex flex-col justify-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Time</p>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">{formatDuration(stats.totalDurationSeconds)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card/50 border-border">
        <CardContent className="p-4 sm:p-6 flex flex-col justify-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Top Sport</p>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight capitalize">
            {stats.sportBreakdown.length > 0 ? stats.sportBreakdown.sort((a, b) => b.count - a.count)[0].sport : "-"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivitiesList() {
  const { data: activities, isLoading } = useListActivities();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 w-full bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-12 border border-border border-dashed rounded-lg bg-card/30">
        <ActivitySquare className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
        <h3 className="text-lg font-medium text-foreground mb-1">No activities yet</h3>
        <p className="text-sm text-muted-foreground">Upload a .fit file to see your data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="activities-list">
      {activities.map(activity => (
        <Link key={activity.id} href={`/activities/${activity.id}`}>
          <div 
            className="group flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer"
            data-testid={`activity-card-${activity.id}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground capitalize group-hover:text-primary transition-colors">
                  {activity.sport || "Activity"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(activity.startTime)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-foreground/80">
              <div className="hidden sm:flex items-center gap-1.5 w-24">
                <Route className="w-4 h-4 text-muted-foreground" />
                {formatDistance(activity.distanceMeters)}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 w-20">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {formatDuration(activity.durationSeconds)}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <StatsOverview />
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Recent Activities</h2>
            </div>
            <ActivitiesList />
          </div>
          
          <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Upload</h2>
            <UploadZone />
          </div>
        </div>
      </div>
    </Layout>
  );
}
