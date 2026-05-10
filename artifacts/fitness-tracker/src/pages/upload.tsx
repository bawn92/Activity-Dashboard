import { Layout } from "@/components/layout";
import { UploadZone } from "@/components/upload-zone";
import { BatchUploadZone } from "@/components/batch-upload-zone";
import { useLocation } from "wouter";
import { useAllowedStatus } from "@/hooks/use-allowed-status";

function UploadSection() {
  const [, setLocation] = useLocation();
  const status = useAllowedStatus();

  const onUnauthenticated =
    status.state === "not_signed_in"
      ? () =>
          setLocation(`/manifesto?redirect=${encodeURIComponent("/upload")}`)
      : undefined;

  return (
    <>
      <UploadZone onUnauthenticated={onUnauthenticated} />
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-muted-foreground text-[11px]">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <BatchUploadZone onUnauthenticated={onUnauthenticated} />
    </>
  );
}

export default function UploadPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-medium tracking-tight text-foreground mb-2"
            data-testid="page-title-upload"
          >
            Upload Activity
          </h1>
          <p className="text-muted-foreground text-sm">
            Drop a Garmin .fit file to parse and store your workout data.
          </p>
        </div>

        <UploadSection />
      </div>
    </Layout>
  );
}
