import { useState, useRef } from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileWarning, Files } from "lucide-react";
import {
  getUploadActivityBatchUrl,
  getListActivitiesQueryKey,
  getGetActivityStatsQueryKey,
  type UploadActivityBatchResponse,
  type UploadActivityBatchItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const BATCH_SIZE = 10;

type Phase = "idle" | "uploading" | "done";

interface BatchSummary {
  success: number;
  duplicate: number;
  failed: number;
  failedItems: Array<{ filename: string; error: string }>;
  duplicateItems: string[];
}

const emptySummary: BatchSummary = {
  success: 0,
  duplicate: 0,
  failed: 0,
  failedItems: [],
  duplicateItems: [],
};

function isAcceptedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".fit") ||
    lower.endsWith(".fit.gz") ||
    lower.endsWith(".tcx")
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function BatchUploadZone() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [summary, setSummary] = useState<BatchSummary>(emptySummary);
  const [topLevelError, setTopLevelError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setPhase("idle");
    setBatchIndex(0);
    setBatchTotal(0);
    setProcessed(0);
    setTotalFiles(0);
    setSummary(emptySummary);
    setTopLevelError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFiles = async (rawFiles: File[]) => {
    const files = rawFiles.filter((f) => isAcceptedFile(f.name));
    const skippedByExt = rawFiles.length - files.length;

    if (files.length === 0) {
      setTopLevelError(
        skippedByExt > 0
          ? "No .fit or .fit.gz files in your selection."
          : "Please pick at least one file.",
      );
      return;
    }

    const batches = chunk(files, BATCH_SIZE);
    const acc: BatchSummary = {
      success: 0,
      duplicate: 0,
      failed: skippedByExt,
      failedItems: [],
      duplicateItems: [],
    };

    if (skippedByExt > 0) {
      for (const f of rawFiles) {
        if (!isAcceptedFile(f.name)) {
          acc.failedItems.push({
            filename: f.name,
            error: "Not a .fit or .fit.gz file",
          });
        }
      }
    }

    setPhase("uploading");
    setTopLevelError(null);
    setBatchTotal(batches.length);
    setBatchIndex(0);
    setProcessed(0);
    setTotalFiles(files.length);
    setSummary(acc);

    let processedCount = 0;
    for (let i = 0; i < batches.length; i++) {
      setBatchIndex(i + 1);
      const batch = batches[i];

      const formData = new FormData();
      for (const file of batch) {
        formData.append("files", file);
      }

      try {
        const resp = await fetch(getUploadActivityBatchUrl(), {
          method: "POST",
          body: formData,
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string })?.error ?? `Batch upload failed: ${resp.status}`,
          );
        }

        const body = (await resp.json()) as UploadActivityBatchResponse;
        acc.success += body.success;
        acc.duplicate += body.duplicate;
        acc.failed += body.failed;
        for (const item of body.results as UploadActivityBatchItem[]) {
          if (item.status === "failed") {
            acc.failedItems.push({
              filename: item.filename,
              error: item.error ?? "Unknown error",
            });
          } else if (item.status === "duplicate") {
            acc.duplicateItems.push(item.filename);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        acc.failed += batch.length;
        for (const f of batch) {
          acc.failedItems.push({ filename: f.name, error: msg });
        }
      }

      processedCount += batch.length;
      setProcessed(processedCount);
      setSummary({ ...acc });
    }

    setPhase("done");
    queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActivityStatsQueryKey() });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const isUploading = phase === "uploading";
  const isDone = phase === "done";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-card p-8",
        topLevelError ? "border-destructive/60 bg-destructive/5" : "border-border",
      )}
      data-testid="batch-upload-zone"
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
          <Files className="w-5 h-5" />
        </div>
        <div>
          <div className="label-mono text-foreground">Batch upload</div>
          <p className="text-sm text-muted-foreground mt-1">
            Pick many <code className="text-xs">.fit</code>,{" "}
            <code className="text-xs">.fit.gz</code>, or{" "}
            <code className="text-xs">.tcx</code> files at once. Processed in batches of {BATCH_SIZE}.
          </p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept=".fit,.gz,.fit.gz,.tcx,application/gzip,application/octet-stream"
        multiple
        className="hidden"
        disabled={isUploading}
        data-testid="batch-input-file"
      />

      {phase === "idle" && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/60 transition-colors"
          data-testid="batch-pick-button"
        >
          <UploadCloud className="w-7 h-7 text-muted-foreground" />
          <div className="label-mono text-foreground">Choose files</div>
          <div className="text-xs text-muted-foreground">
            Click to select multiple .fit or .fit.gz files
          </div>
        </button>
      )}

      {isUploading && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
          data-testid="batch-progress"
        >
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <div className="label-mono text-foreground" data-testid="batch-progress-batches">
            Uploading batch {batchIndex} of {batchTotal}
          </div>
          <div className="text-xs text-muted-foreground" data-testid="batch-progress-files">
            Processed {processed} of {totalFiles} files
          </div>
          <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${totalFiles > 0 ? (processed / totalFiles) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {isDone && (
        <div className="space-y-4" data-testid="batch-summary">
          <div className="grid grid-cols-3 gap-3">
            <SummaryStat
              icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
              label="Created"
              value={summary.success}
              tone="success"
              testId="batch-summary-success"
            />
            <SummaryStat
              icon={<FileWarning className="w-4 h-4 text-amber-600" />}
              label="Duplicates"
              value={summary.duplicate}
              tone="warning"
              testId="batch-summary-duplicate"
            />
            <SummaryStat
              icon={<AlertCircle className="w-4 h-4 text-destructive" />}
              label="Failed"
              value={summary.failed}
              tone="error"
              testId="batch-summary-failed"
            />
          </div>

          {summary.failedItems.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="label-mono text-destructive mb-2">Failed files</div>
              <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
                {summary.failedItems.map((item, i) => (
                  <li key={i} className="flex flex-col" data-testid={`batch-failed-${i}`}>
                    <span className="font-medium text-foreground truncate">{item.filename}</span>
                    <span className="text-xs text-muted-foreground">{item.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.duplicateItems.length > 0 && (
            <div className="rounded-xl border border-amber-300/40 bg-amber-50/60 p-4">
              <div className="label-mono text-amber-700 mb-2">Already in library</div>
              <ul className="space-y-1 text-sm max-h-32 overflow-y-auto">
                {summary.duplicateItems.map((name, i) => (
                  <li key={i} className="text-foreground truncate" data-testid={`batch-duplicate-${i}`}>
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm label-mono hover:bg-primary/90 transition-colors"
              data-testid="batch-upload-more"
            >
              Upload more
            </button>
          </div>
        </div>
      )}

      {topLevelError && phase === "idle" && (
        <div
          className="mt-4 text-xs text-destructive text-center"
          data-testid="batch-error"
        >
          {topLevelError}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  tone,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "success" | "warning" | "error";
  testId: string;
}) {
  const toneClasses =
    tone === "success"
      ? "border-green-300/40 bg-green-50/60"
      : tone === "warning"
        ? "border-amber-300/40 bg-amber-50/60"
        : "border-destructive/30 bg-destructive/5";

  return (
    <div className={cn("rounded-xl border p-4", toneClasses)} data-testid={testId}>
      <div className="flex items-center gap-1.5 label-mono text-foreground/80 text-[11px]">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-medium text-foreground mt-1 tabular-nums">{value}</div>
    </div>
  );
}
