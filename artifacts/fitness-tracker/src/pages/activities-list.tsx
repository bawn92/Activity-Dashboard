import { useListActivities, useGetActivityStats } from "@workspace/api-client-react";
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
        {[1, 2, 3, 4].map((i) => (
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

  const topSport =
    stats.sportBreakdown.length > 0
      ? [...stats.sportBreakdown].sort((a, b) => b.count - a.count)[0].sport
      : "-";

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
      data-testid="stats-overview"
    >
      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-6 sm:p-8 flex flex-col justify-center">
          <p className="label-mono text-muted-foreground mb-2">Activities</p>
          <div className="text-3xl sm:text-4xl font-medium tracking-tight">
            {stats.totalActivities}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-6 sm:p-8 flex flex-col justify-center">
          <p className="label-mono text-muted-foreground mb-2">Total Distance</p>
          <div className="text-3xl sm:text-4xl font-medium tracking-tight">
            {formatDistance(stats.totalDistanceMeters)}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-6 sm:p-8 flex flex-col justify-center">
          <p className="label-mono text-muted-foreground mb-2">Total Time</p>
          <div className="text-3xl sm:text-4xl font-medium tracking-tight">
            {formatDuration(stats.totalDurationSeconds)}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-6 sm:p-8 flex flex-col justify-center">
          <p className="label-mono text-muted-foreground mb-2">Top Sport</p>
          <div className="text-3xl sm:text-4xl font-medium tracking-tight capitalize">
            {topSport}
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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 w-full bg-card border border-border rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-12 border border-border border-dashed rounded-lg bg-card/30">
        <ActivitySquare className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
        <h3 className="text-lg font-medium text-foreground mb-1">
          No activities yet
        </h3>
        <p className="text-sm text-muted-foreground">
          Upload a .fit file to see your data.
        </p>
        <Link href="/">
          <span className="inline-block mt-4 text-sm text-primary hover:underline cursor-pointer" data-testid="link-upload">
            Upload your first activity
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="activities-list">
      {activities.map((activity) => (
        <Link key={activity.id} href={`/activities/${activity.id}`} className="block">
          <div
            className="group flex items-center justify-between p-5 bg-card border border-border rounded-xl shadow-card hover:border-primary/40 transition-all duration-200 cursor-pointer"
            data-testid={`activity-card-${activity.id}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-foreground capitalize group-hover:text-primary transition-colors">
                  {activity.sport || "Activity"}
                </h3>
                <p className="label-mono text-muted-foreground mt-1">
                  {formatDate(activity.startTime)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-1.5 w-24 label-mono text-muted-foreground">
                <Route className="w-3.5 h-3.5" />
                {formatDistance(activity.distanceMeters ?? null)}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 w-20 label-mono text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(activity.durationSeconds ?? null)}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ActivitiesListPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-medium tracking-tight" data-testid="page-title-activities">Activities</h1>
          <Link href="/">
            <button
              className="label-mono px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
              data-testid="button-upload-new"
            >
              Upload Activity
            </button>
          </Link>
        </div>
        <StatsOverview />
        <ActivitiesList />
      </div>
    </Layout>
  );
}
