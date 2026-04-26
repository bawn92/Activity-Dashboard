import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetActivity, type ActivityDetail } from "@workspace/api-client-react";
import { SHARE_THEMES, renderShareCard, generateShareImage, type ShareTheme } from "@/lib/share-image";
import { formatDate } from "@/lib/format";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
            Share Card Styles
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {activity.sport ? activity.sport.charAt(0).toUpperCase() + activity.sport.slice(1) : "Activity"}
            {" · "}
            {formatDate(activity.startTime)}
            {" · "}
            Download any style as a 1080×1920 PNG for Instagram Stories
          </p>
        </div>

        {(["solid", "transparent", "bare"] as const).map((cat) => {
          const themes = SHARE_THEMES.filter((t) => t.category === cat);
          const label =
            cat === "solid" ? "Solid" : cat === "transparent" ? "Transparent" : "No Background";
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
    </Layout>
  );
}
