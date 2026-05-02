import { Link, useLocation } from "wouter";
import { Activity as ActivityIcon, Globe2, MessageSquareText, CalendarDays, LogIn, LogOut } from "lucide-react";
import { useUser, useClerk, Show } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthControl() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  if (!isLoaded) return null;

  return (
    <>
      <Show when="signed-out">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 label-mono text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
          data-testid="sign-in-link"
        >
          <LogIn className="w-3.5 h-3.5 opacity-80" aria-hidden />
          Sign in
        </Link>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]" data-testid="user-email">
            {user?.primaryEmailAddress?.emailAddress ?? ""}
          </span>
          <button
            onClick={() => signOut().then(() => setLocation("/"))}
            className="inline-flex items-center gap-1.5 label-mono text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
            data-testid="sign-out-button"
          >
            <LogOut className="w-3.5 h-3.5 opacity-80" aria-hidden />
            Sign out
          </button>
        </div>
      </Show>
    </>
  );
}

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
              <span className="font-medium tracking-tight text-foreground">Gearóid Fitness Diary</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1 label-mono text-sm">
              <Link href="/activities" className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors" data-testid="link-nav-activities">
                Activities
              </Link>
              <Link href="/table" className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors" data-testid="link-nav-table">
                Table
              </Link>
              <Link
                href="/globe"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
                data-testid="link-nav-globe"
              >
                <Globe2 className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Globe
              </Link>
              <Link
                href="/agent"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
                data-testid="link-nav-agent"
              >
                <MessageSquareText className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Coach
              </Link>
              <Link
                href="/calendar"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
                data-testid="link-nav-calendar"
              >
                <CalendarDays className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Calendar
              </Link>
            </nav>
          </div>
          <AuthControl />
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
