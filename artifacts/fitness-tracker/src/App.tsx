import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import ManifestoPage from "@/pages/manifesto";
import UploadPage from "@/pages/upload";
import ActivitiesListPage from "@/pages/activities-list";
import ActivitiesTablePage from "@/pages/activities-table";
import ActivityDetail from "@/pages/activity";
import { ActivitySharePage } from "@/pages/activity-share";
import GlobePage from "@/pages/globe";
import AgentPage from "@/pages/agent";
import CalendarPage from "@/pages/calendar";
import StatsPage from "@/pages/stats";
import { useAllowedStatus } from "@/hooks/use-allowed-status";
import { usePreviousLocationTracker } from "@/hooks/use-previous-location";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkProxyUrl = (import.meta.env.VITE_CLERK_PROXY_URL as string) || undefined;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#EA580C",
    colorForeground: "#2C2A28",
    colorMutedForeground: "#736E67",
    colorDanger: "#DC2626",
    colorBackground: "#FFFFFF",
    colorInput: "#FCFBFA",
    colorInputForeground: "#2C2A28",
    colorNeutral: "#EAE6DF",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-card",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-medium tracking-tight",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground text-sm",
    footerActionLink: "text-primary hover:text-primary/80",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "flex items-center justify-center",
    logoImage: "w-10 h-10",
    socialButtonsBlockButton: "border border-border bg-card hover:bg-muted/40 transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    formFieldInput: "bg-card border-border text-foreground",
    footerAction: "bg-muted/40",
    dividerLine: "bg-border",
    alert: "border-border bg-muted/40",
    otpCodeFieldInput: "border-border bg-card text-foreground",
    formFieldRow: "",
    main: "",
  },
};

/**
 * Read the `redirect` (or `next`) query param once on mount and return a safe,
 * same-origin path. We only allow paths that start with a single `/` (and not
 * `//`) to avoid open redirect vulnerabilities. The value is captured in
 * state so it remains stable even if Clerk navigates within the sign-in
 * flow and drops the query string.
 */
function useSafeRedirectParam(): string | undefined {
  const [redirect] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("redirect") ?? params.get("next");
    if (!raw) return undefined;
    if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
    return raw;
  });
  return redirect;
}

function buildAuthUrl(path: string, redirect: string | undefined): string {
  const base = `${basePath}${path}`;
  if (!redirect) return base;
  return `${base}?redirect=${encodeURIComponent(redirect)}`;
}

function SignInPage() {
  const redirect = useSafeRedirectParam();
  const fallbackRedirectUrl = redirect ? `${basePath}${redirect}` : undefined;
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={buildAuthUrl("/sign-up", redirect)}
        fallbackRedirectUrl={fallbackRedirectUrl}
        signUpFallbackRedirectUrl={fallbackRedirectUrl}
      />
    </div>
  );
}

function SignUpPage() {
  const redirect = useSafeRedirectParam();
  const fallbackRedirectUrl = redirect ? `${basePath}${redirect}` : undefined;
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={buildAuthUrl("/sign-in", redirect)}
        fallbackRedirectUrl={fallbackRedirectUrl}
        signInFallbackRedirectUrl={fallbackRedirectUrl}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

/**
 * Automatically signs out any user whose email doesn't match the server's
 * ALLOWED_USER_EMAIL — determined by calling GET /api/auth/allowed.
 * This fires as soon as Clerk and the API both confirm the user is wrong.
 */
// Routes where signed-in non-owners are allowed to remain (read-only views).
// They are still blocked from privileged actions server-side via
// `requireAllowedUser`, but the UI does not forcibly sign them out.
const PUBLIC_READ_ROUTES = ["/agent"];

function WrongEmailAutoSignOut() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const status = useAllowedStatus();
  const [location, setLocation] = useLocation();
  const didSignOutRef = useRef(false);

  useEffect(() => {
    const onPublicReadRoute = PUBLIC_READ_ROUTES.some(
      (p) => location === p || location.startsWith(`${p}/`),
    );
    if (
      status.state === "wrong_email" &&
      !didSignOutRef.current &&
      !onPublicReadRoute
    ) {
      didSignOutRef.current = true;
      void signOut().then(() => {
        setLocation("/");
        toast({
          title: "This app is private",
          description: "Only the owner can sign in. You have been signed out.",
          variant: "destructive",
        });
      });
    }
    // Reset flag when user changes (new sign-in attempt)
    if (!user) {
      didSignOutRef.current = false;
    }
  }, [status.state, signOut, setLocation, user, location]);

  return null;
}

function PreviousLocationTracker() {
  usePreviousLocationTracker();
  return null;
}

function RedirectToManifesto() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/manifesto", { replace: true });
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AgentPage} />
      <Route path="/manifesto" component={ManifestoPage} />
      <Route path="/why" component={RedirectToManifesto} />
      <Route path="/fitness" component={RedirectToManifesto} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/table" component={ActivitiesTablePage} />
      <Route path="/activities" component={ActivitiesListPage} />
      <Route path="/activities/:id/share" component={ActivitySharePage} />
      <Route path="/activities/:id" component={ActivityDetail} />
      <Route path="/globe" component={GlobePage} />
      <Route path="/agent" component={AgentPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/stats" component={StatsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to access your Evolve Log",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get started with Evolve Log",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <WrongEmailAutoSignOut />
        <PreviousLocationTracker />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
