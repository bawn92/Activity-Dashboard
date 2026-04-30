import { useState, useRef } from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getUploadActivityUrl,
  getListActivitiesQueryKey,
  getGetActivityStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".fit")) {
      setUploadError("Only .fit files are accepted");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsPending(true);
    setIsSuccess(false);
    setUploadError(null);

    try {
      const resp = await fetch(getUploadActivityUrl(), {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? `Upload failed: ${resp.status}`);
      }

      const body = await resp.json().catch(() => ({}));
      const isDuplicate = body?.duplicate === true;

      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetActivityStatsQueryKey() });

      if (isDuplicate) {
        toast({
          title: "Already uploaded",
          description: "This activity is already in your library.",
        });
      } else {
        toast({
          title: "Activity uploaded",
          description: "Redirecting to your activities...",
        });
      }

      setTimeout(() => setLocation("/activities"), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setUploadError(msg);
    } finally {
      setIsPending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-8 rounded-lg border border-dashed transition-colors cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : uploadError
            ? "border-destructive/60 bg-destructive/5"
            : "border-border bg-card hover:bg-secondary/50",
        isPending && "pointer-events-none opacity-50",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      data-testid="upload-zone"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".fit"
        className="hidden"
        data-testid="input-file"
      />

      {isPending ? (
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      ) : isSuccess ? (
        <CheckCircle2 className="w-8 h-8 text-green-500 mb-4" />
      ) : uploadError ? (
        <AlertCircle className="w-8 h-8 text-destructive mb-4" />
      ) : (
        <UploadCloud className="w-8 h-8 text-muted-foreground mb-4" />
      )}

      <div className="text-sm font-medium text-center" data-testid="upload-status">
        {isPending
          ? "Uploading..."
          : isSuccess
            ? "Uploaded!"
            : uploadError
              ? "Upload failed"
              : "Upload .fit file"}
      </div>
      {uploadError ? (
        <div
          className="text-xs text-destructive mt-1 text-center max-w-xs"
          data-testid="upload-error"
        >
          {uploadError}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mt-1 text-center">
          Drag & drop or click to select
        </div>
      )}
    </div>
  );
}
