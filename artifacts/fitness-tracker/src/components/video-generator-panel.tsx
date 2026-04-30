import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateRenderJob,
  useGetRenderJob,
  useListActivityRenderJobs,
  getListActivityRenderJobsQueryKey,
  getGetRenderJobQueryKey,
  type RenderJob,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Film, Download, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type VideoStyle = "cinematic" | "map";
export type MapCameraMode = "static" | "follow";

export interface VideoGeneratorCamera {
  centerLat: number;
  centerLng: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

interface VideoGeneratorPanelProps {
  activityId: number;
  /**
   * Which video style this panel renders. The panel filters the activity's
   * render-job history to jobs matching this style, so two panels (one per
   * style) can coexist on the same page without stomping on each other's
   * "latest job" state.
   */
  style: VideoStyle;
  /** Human-readable description shown in the panel header. */
  description: string;
  /**
   * For style="map": a callback that returns the current camera state from
   * the parent's interactive map. Called at submit time to capture the
   * starting camera for the render.
   */
  getCamera?: () => VideoGeneratorCamera | null;
  /**
   * For style="map": whether the renderer should keep the framed camera
   * locked ("static") or pan it to follow the moving runner marker
   * ("follow"). Defaults to "static" when omitted.
   */
  cameraMode?: MapCameraMode;
}

/**
 * Generates and renders a vertical video for an activity.
 *
 * Flow:
 *   1. Fetch existing jobs for the activity, filter to ones matching `style`
 *   2. If the latest matching job is `queued` or `rendering`, poll it every 1.5s
 *   3. Show a "Generate" button when there's no in-progress job
 *   4. When complete, show a video player + download button
 *
 * Switching tabs/sub-tabs preserves any in-flight render: each panel reads
 * the latest job for its style independently from the same shared
 * activity-jobs cache, so unmounting/remounting doesn't cancel anything.
 */
export function VideoGeneratorPanel({
  activityId,
  style,
  description,
  getCamera,
  cameraMode,
}: VideoGeneratorPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobs, isLoading: jobsLoading } = useListActivityRenderJobs(
    activityId,
    {
      query: {
        queryKey: getListActivityRenderJobsQueryKey(activityId),
      },
    },
  );

  // Filter to jobs matching this panel's style. Older rows in the DB without
  // a style default to "cinematic" via the schema default, so existing
  // history shows up in the Cinematic tab automatically.
  const styledJobs = useMemo<RenderJob[]>(
    () => (jobs ?? []).filter((j) => (j.style ?? "cinematic") === style),
    [jobs, style],
  );

  const latest = styledJobs[0];
  const inProgress =
    latest && (latest.status === "queued" || latest.status === "rendering");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  // When the list shows an in-progress job for this style, poll it directly
  useEffect(() => {
    if (inProgress && latest) {
      setActiveJobId(latest.id);
    } else {
      setActiveJobId(null);
    }
  }, [inProgress, latest]);

  const { data: polledJob } = useGetRenderJob(activeJobId ?? 0, {
    query: {
      enabled: activeJobId != null,
      queryKey: getGetRenderJobQueryKey(activeJobId ?? 0),
      refetchInterval: 1500,
    },
  });

  // Track which job ids we've already toasted for so polling doesn't fire
  // the same "Video ready" / "Video render failed" toast on every refetch.
  const notifiedJobIdRef = useRef<number | null>(null);

  // When the polled job transitions to a terminal state, refresh the list
  // and notify the user — exactly once per job.
  useEffect(() => {
    if (
      polledJob &&
      (polledJob.status === "complete" || polledJob.status === "failed") &&
      notifiedJobIdRef.current !== polledJob.id
    ) {
      notifiedJobIdRef.current = polledJob.id;
      queryClient.invalidateQueries({
        queryKey: getListActivityRenderJobsQueryKey(activityId),
      });
      if (polledJob.status === "failed") {
        toast({
          title: "Video render failed",
          description: polledJob.errorMessage ?? "Try again in a moment.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Video ready",
          description: "Your shareable workout video is ready to download.",
        });
      }
    }
  }, [polledJob, queryClient, activityId, toast]);

  const createMutation = useCreateRenderJob();

  const handleGenerate = () => {
    let camera: VideoGeneratorCamera | null = null;
    if (style === "map") {
      camera = getCamera?.() ?? null;
      if (!camera) {
        toast({
          title: "Map not ready",
          description:
            "Wait for the map to finish loading and try again.",
          variant: "destructive",
        });
        return;
      }
    }

    createMutation.mutate(
      {
        id: activityId,
        data:
          style === "map" && camera
            ? {
                style,
                centerLat: camera.centerLat,
                centerLng: camera.centerLng,
                zoom: camera.zoom,
                bearing: camera.bearing,
                pitch: camera.pitch,
                cameraMode: cameraMode ?? "static",
              }
            : { style },
      },
      {
        onSuccess: (job) => {
          setActiveJobId(job.id);
          queryClient.invalidateQueries({
            queryKey: getListActivityRenderJobsQueryKey(activityId),
          });
        },
        onError: () => {
          toast({
            title: "Could not start render",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // Use the freshest data we have for the active job (poll trumps stale list)
  const display = polledJob ?? latest;
  const showInProgress =
    display && (display.status === "queued" || display.status === "rendering");
  const showComplete = display?.status === "complete" && display.videoUrl;
  const showFailed = display?.status === "failed";

  if (jobsLoading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
        <Skeleton className="h-8 w-64 bg-border" />
      </div>
    );
  }

  return (
    <div
      className="bg-card border border-border rounded-xl shadow-card p-6"
      data-testid={`video-generator-panel-${style}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-medium tracking-tight text-foreground">
              {style === "map" ? "Map style" : "Cinematic style"}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {!showInProgress && (
          <Button
            onClick={handleGenerate}
            disabled={createMutation.isPending}
            data-testid={`button-generate-video-${style}`}
          >
            {showComplete || showFailed ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            ) : (
              <>
                <Film className="w-4 h-4 mr-2" />
                Generate video
              </>
            )}
          </Button>
        )}
      </div>

      {showInProgress && display && (
        <div
          className="mt-4 space-y-3"
          data-testid={`video-generator-progress-${style}`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {display.status === "queued"
                ? "Queued — waiting for the renderer…"
                : `Rendering… ${Math.round(display.progress * 100)}%`}
            </span>
          </div>
          <div className="h-2 w-full bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{
                width: `${Math.max(2, Math.round(display.progress * 100))}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            First-time renders can take 30–60 seconds while the bundle warms
            up. Subsequent renders are faster.
          </p>
        </div>
      )}

      {showComplete && display?.videoUrl && (
        <div
          className="mt-4 space-y-4"
          data-testid={`video-generator-result-${style}`}
        >
          <div className="rounded-xl overflow-hidden border border-border bg-black flex items-center justify-center">
            <video
              src={display.videoUrl}
              controls
              playsInline
              className="w-full max-h-[640px] aspect-[9/16] object-contain"
              data-testid={`video-player-${style}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <a
              href={display.videoUrl}
              download={`workout-${activityId}-${style}.mp4`}
              data-testid={`link-download-video-${style}`}
            >
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download MP4
              </Button>
            </a>
          </div>
        </div>
      )}

      {showFailed && display?.errorMessage && (
        <div
          className="mt-4 flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm"
          data-testid={`video-generator-error-${style}`}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{display.errorMessage}</span>
        </div>
      )}
    </div>
  );
}
