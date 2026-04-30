import { Layout } from "@/components/layout";
import { UploadZone } from "@/components/upload-zone";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

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

        <UploadZone />

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
