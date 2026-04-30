import { Link } from "wouter";
import { Activity as ActivityIcon } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity" data-testid="link-home">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <ActivityIcon className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium tracking-tight text-foreground">Fitness Logbook</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
