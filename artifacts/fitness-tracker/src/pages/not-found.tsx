import { AlertCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-32 max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-6 border border-destructive/20">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground mb-2">
          Page not found
        </h1>
        <p className="label-mono text-muted-foreground mb-8">404</p>
        <Link href="/">
          <button className="label-mono px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
            Go home
          </button>
        </Link>
      </div>
    </Layout>
  );
}
