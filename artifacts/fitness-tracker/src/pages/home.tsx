import { Layout } from "@/components/layout";
import { UploadZone } from "@/components/upload-zone";
import { BatchUploadZone } from "@/components/batch-upload-zone";
import { Link } from "wouter";
import { ArrowRight, Lock } from "lucide-react";
import { useAllowedStatus } from "@/hooks/use-allowed-status";

function SignInPrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-10 flex flex-col items-center text-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <div>
        <div className="font-medium text-foreground mb-1">Sign in to upload activities</div>
        <p className="text-sm text-muted-foreground">
          This app is private. Sign in with the owner account to upload and manage your workouts.
        </p>
      </div>
      <Link href="/sign-in">
        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm label-mono hover:bg-primary/90 transition-colors cursor-pointer">
          Sign in
          <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
    </div>
  );
}

function UploadSection() {
  const status = useAllowedStatus();

  if (status.state === "loading") return null;

  if (status.state === "not_signed_in") {
    return <SignInPrompt />;
  }

  if (status.state === "allowed") {
    return (
      <>
        <UploadZone />
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-border" />
          <span className="label-mono text-muted-foreground text-[11px]">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <BatchUploadZone />
      </>
    );
  }

  // wrong_email: auto sign-out is handled globally in App.tsx — show prompt while signing out
  return <SignInPrompt />;
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
