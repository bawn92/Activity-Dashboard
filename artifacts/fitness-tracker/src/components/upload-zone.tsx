import { useState, useRef } from "react";
import { UploadCloud, Loader2, CheckCircle2 } from "lucide-react";
import {
  getUploadActivityUrl,
  getListActivitiesQueryKey,
  getGetActivityStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({
        title: "Invalid file",
        description: "Please upload a .fit file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsPending(true);
    setIsSuccess(false);

    try {
      const resp = await fetch(getUploadActivityUrl(), {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? `Upload failed: ${resp.status}`);
      }

      setIsSuccess(true);
      toast({ title: "Upload successful", description: "Activity saved." });
      queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getGetActivityStatsQueryKey(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Upload failed",
        description: msg,
        variant: "destructive",
      });
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
      ) : (
        <UploadCloud className="w-8 h-8 text-muted-foreground mb-4" />
      )}

      <div className="text-sm font-medium text-foreground text-center">
        {isPending ? "Uploading..." : "Upload .fit file"}
      </div>
      <div className="text-xs text-muted-foreground mt-1 text-center">
        Drag & drop or click to select
      </div>
    </div>
  );
}
