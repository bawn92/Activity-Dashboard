import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetActivity, type ActivityDetail } from "@workspace/api-client-react";
import { SHARE_THEMES, renderShareCard, generateShareImage, type ShareTheme } from "@/lib/share-image";
import { formatDate } from "@/lib/format";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VideoGeneratorPanel } from "@/components/video-generator-panel";
import {
  ActivityMapPreview,
  type ActivityMapPreviewHandle,
} from "@/components/activity-map-preview";

function ThemeCard({
  theme,
  activity,
  onDownload,
}: {
  theme: ShareTheme;
  activity: ActivityDetail;
  onDownload: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    renderShareCard(canvas, activity, theme);
    canvas.toBlob((blob) => {
      if (!blob || !imgRef.current) return;
      const url = URL.createObjectURL(blob);
      imgRef.current.src = url;
      setRendered(true);
      return () => URL.revokeObjectURL(url);
    }, "image/png");
  }, [activity, theme]);

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="relative aspect-[9/16] bg-muted overflow-hidden">
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <img
          ref={imgRef}
          alt={theme.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          style={{ display: rendered ? "block" : "none" }}
        />
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="font-semibold text-foreground leading-tight">{theme.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{theme.tagline}</p>
        </div>
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={onDownload}
        >
          <Download className="w-3.5 h-3.5" />
          Download PNG
        </Button>
      </div>
    </div>
  );
}

function ShareCardsTab({ activity }: { activity: ActivityDetail }) {
  return (
    <div className="mt-6">
      <p className="text-muted-foreground mb-8 text-sm">
        Download any style as a 1080×1920 PNG for Instagram Stories.
      </p>
      {(["solid", "transparent", "bare"] as const).map((cat) => {
        const themes = SHARE_THEMES.filter((t) => t.category === cat);
        const label =
          cat === "solid"
            ? "Solid"
            : cat === "transparent"
              ? "Transparent"
              : "No Background";
        const hint =
          cat === "transparent"
            ? "photo shows through"
            : cat === "bare"
              ? "pure PNG — no background at all, just stats and route"
              : null;
        return (
          <div key={cat} className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </h2>
              <div className="flex-1 h-px bg-border" />
              {hint && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                  {hint}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {themes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  activity={activity}
                  onDownload={() => generateShareImage(activity, theme)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The Video tab is split into two sub-styles. We deliberately mount BOTH
 * sub-style components and toggle visibility with CSS rather than using
 * Radix `TabsContent` (which unmounts inactive panels). This preserves
 * in-flight render state and the interactive map's camera position when the
 * user switches between Cinematic and Map sub-tabs.
 */
function VideoTab({ activity }: { activity: ActivityDetail }) {
  const [subStyle, setSubStyle] = useState<"cinematic" | "map">("cinematic");
  const [cameraMode, setCameraMode] = useState<"static" | "follow">("static");
  const mapRef = useRef<ActivityMapPreviewHandle>(null);

  const hasMapData =
    activity.dataPoints?.some((dp) => dp.lat != null && dp.lng != null) ??
    false;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-3">
        <div
          role="tablist"
          aria-label="Video style"
          className="inline-flex items-center rounded-lg border border-border bg-muted p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subStyle === "cinematic"}
            onClick={() => setSubStyle("cinematic")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              subStyle === "cinematic"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="sub-tab-cinematic"
          >
            Cinematic
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subStyle === "map"}
            onClick={() => setSubStyle("map")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              subStyle === "map"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="sub-tab-map"
          >
            Map
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Compare looks side-by-side — switching tabs keeps any in-flight
          render running.
        </p>
      </div>

      {/* Cinematic — kept mounted so render state persists across tab switches */}
      <div
        style={{ display: subStyle === "cinematic" ? "block" : "none" }}
        data-testid="video-pane-cinematic"
      >
        <VideoGeneratorPanel
          activityId={activity.id}
          style="cinematic"
          description="A 12-second vertical clip (1080×1920) of your route and stats."
        />
      </div>

      {/* Map — kept mounted so the map camera and render state persist */}
      <div
        style={{ display: subStyle === "map" ? "block" : "none" }}
        data-testid="video-pane-map"
      >
        {hasMapData ? (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Frame your shot
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pan, zoom, rotate, and tilt to choose the starting camera —
                  then hit Generate to render a 6-second MP4 of the route.
                </p>
              </div>
              <ActivityMapPreview
                ref={mapRef}
                dataPoints={activity.dataPoints}
              />

              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    role="radiogroup"
                    aria-label="Camera mode"
                    className="inline-flex items-center rounded-lg border border-border bg-muted p-1"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={cameraMode === "static"}
                      onClick={() => setCameraMode("static")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        cameraMode === "static"
                          ? "bg-background text-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid="camera-mode-static"
                    >
                      Static frame
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={cameraMode === "follow"}
                      onClick={() => setCameraMode("follow")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        cameraMode === "follow"
                          ? "bg-background text-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid="camera-mode-follow"
                    >
                      Follow runner
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cameraMode === "static"
                      ? "The camera stays put — what you see in the preview is exactly what gets rendered."
                      : "The camera flies along with the runner marker, zooming in for a fly-along feel. Preview shows the starting frame."}
                  </p>
                </div>
              </div>
            </div>

            <VideoGeneratorPanel
              activityId={activity.id}
              style="map"
              description="A 6-second vertical clip (1080×1920) of your route on the framed map."
              getCamera={() => mapRef.current?.getCamera() ?? null}
              cameraMode={cameraMode}
            />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            This activity has no GPS data, so a map render isn't available.
          </div>
        )}
      </div>
    </div>
  );
}

export function ActivitySharePage() {
  const { id } = useParams<{ id: string }>();
  const { data: activity, isLoading, isError } = useGetActivity(Number(id));

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-48 mb-10" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <Skeleton className="aspect-[9/16] w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !activity) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-5xl text-center">
          <p className="text-muted-foreground">Activity not found.</p>
          <Link href="/activities">
            <Button variant="outline" className="mt-4">Back to activities</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link
          href={`/activities/${id}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to activity
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Share this activity
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {activity.sport ? activity.sport.charAt(0).toUpperCase() + activity.sport.slice(1) : "Activity"}
            {" · "}
            {formatDate(activity.startTime)}
          </p>
        </div>

        <Tabs defaultValue="cards" className="w-full">
          <TabsList>
            <TabsTrigger value="cards" data-testid="top-tab-cards">
              Share cards
            </TabsTrigger>
            <TabsTrigger value="video" data-testid="top-tab-video">
              Video
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cards">
            <ShareCardsTab activity={activity} />
          </TabsContent>
          <TabsContent value="video">
            <VideoTab activity={activity} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
