import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity as ActivityIcon, Globe2, MessageSquareText, CalendarDays, BarChart3, Upload, LogIn, LogOut, Menu, X, List, Table2 } from "lucide-react";
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
          href="/manifesto"
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

const navLinks = [
  { href: "/", label: "Coach", icon: <MessageSquareText className="w-4 h-4 opacity-70" aria-hidden /> },
  { href: "/activities", label: "Activities", icon: <List className="w-4 h-4 opacity-70" aria-hidden /> },
  { href: "/table", label: "Table", icon: <Table2 className="w-4 h-4 opacity-70" aria-hidden /> },
  { href: "/globe", label: "Globe", icon: <Globe2 className="w-4 h-4 opacity-70" aria-hidden /> },
  { href: "/calendar", label: "Calendar", icon: <CalendarDays className="w-4 h-4 opacity-70" aria-hidden /> },
  { href: "/stats", label: "Stats", icon: <BarChart3 className="w-4 h-4 opacity-70" aria-hidden /> },
  { href: "/upload", label: "Upload", icon: <Upload className="w-4 h-4 opacity-70" aria-hidden /> },
];

export function Layout({
  children,
  headerVariant = "default",
}: {
  children: React.ReactNode;
  headerVariant?: "default" | "black";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const isBlack = headerVariant === "black";
  const headerClass = isBlack
    ? "sticky top-0 z-10 border-b border-white/10 bg-black"
    : "sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm";
  const brandClass = isBlack ? "text-white" : "text-foreground";
  const navLinkClass = isBlack
    ? "text-white/70 hover:text-white px-2 py-1 rounded-md transition-colors"
    : "text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors";
  const navLinkIconClass = isBlack
    ? "inline-flex items-center gap-1.5 text-white/70 hover:text-white px-2 py-1 rounded-md transition-colors"
    : "inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors";
  const mobileToggleClass = isBlack
    ? "sm:hidden inline-flex items-center justify-center p-1.5 rounded-md text-white/70 hover:text-white transition-colors"
    : "sm:hidden inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors";
  const mobilePanelClass = isBlack
    ? "sm:hidden border-t border-white/10 bg-black"
    : "sm:hidden border-t border-border bg-background/95";
  const mobileLinkClass = isBlack
    ? "inline-flex items-center gap-2.5 text-white/70 hover:text-white px-2 py-3 rounded-md transition-colors border-b border-white/10 last:border-0"
    : "inline-flex items-center gap-2.5 text-muted-foreground hover:text-foreground px-2 py-3 rounded-md transition-colors border-b border-border last:border-0";

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className={headerClass} ref={menuRef}>
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity" data-testid="link-home">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <ActivityIcon className="w-4 h-4 text-primary" />
              </div>
              <span className={`font-medium tracking-tight ${brandClass}`}>Evolve Log</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1 label-mono text-sm">
              <Link href="/" className={navLinkIconClass} data-testid="link-nav-agent">
                <MessageSquareText className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Coach
              </Link>
              <Link href="/activities" className={navLinkIconClass} data-testid="link-nav-activities">
                <List className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Activities
              </Link>
              <Link href="/table" className={navLinkIconClass} data-testid="link-nav-table">
                <Table2 className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Table
              </Link>
              <Link href="/globe" className={navLinkIconClass} data-testid="link-nav-globe">
                <Globe2 className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Globe
              </Link>
              <Link href="/calendar" className={navLinkIconClass} data-testid="link-nav-calendar">
                <CalendarDays className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Calendar
              </Link>
              <Link href="/stats" className={navLinkIconClass} data-testid="link-nav-stats">
                <BarChart3 className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Stats
              </Link>
              <Link href="/upload" className={navLinkIconClass} data-testid="link-nav-upload">
                <Upload className="w-3.5 h-3.5 opacity-80" aria-hidden />
                Upload
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <AuthControl />
            <button
              className={mobileToggleClass}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="mobile-menu-button"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className={mobilePanelClass}>
            <nav className="container mx-auto px-4 py-2 flex flex-col label-mono text-sm">
              {navLinks.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={mobileLinkClass}
                  data-testid={`mobile-link-${label.toLowerCase()}`}
                >
                  {icon}
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
