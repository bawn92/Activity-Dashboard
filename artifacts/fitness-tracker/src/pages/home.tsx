import { Layout } from "@/components/layout";
import { UploadZone } from "@/components/upload-zone";
import { BatchUploadZone } from "@/components/batch-upload-zone";
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

function UploadSection() {
  const [, setLocation] = useLocation();
  const goToSignIn = () =>
    setLocation(`/sign-in?redirect=${encodeURIComponent("/")}`);

  return (
    <>
      <UploadZone onUnauthenticated={goToSignIn} />
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-muted-foreground text-[11px]">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <BatchUploadZone onUnauthenticated={goToSignIn} />
    </>
  );
}

export default function Home() {
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

        <div className="mt-8 text-center">
          <Link href="/activities">
            <span
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              data-testid="link-view-activities"
            >
              View all activities
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
