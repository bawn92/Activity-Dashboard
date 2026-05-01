import { Link } from "wouter";
import { Activity as ActivityIcon } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity" data-testid="link-home">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <ActivityIcon className="w-4 h-4 text-primary" />
              </div>
              <span className="font-medium tracking-tight text-foreground">Fitness Logbook</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1 label-mono text-sm">
              <Link href="/activities" className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors" data-testid="link-nav-activities">
                Activities
              </Link>
              <Link href="/table" className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors" data-testid="link-nav-table">
                Table
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
