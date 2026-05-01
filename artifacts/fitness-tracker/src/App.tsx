import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ActivitiesListPage from "@/pages/activities-list";
import ActivitiesTablePage from "@/pages/activities-table";
import ActivityDetail from "@/pages/activity";
import { ActivitySharePage } from "@/pages/activity-share";
import GlobePage from "@/pages/globe";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/table" component={ActivitiesTablePage} />
      <Route path="/activities" component={ActivitiesListPage} />
      <Route path="/activities/:id/share" component={ActivitySharePage} />
      <Route path="/activities/:id" component={ActivityDetail} />
      <Route path="/globe" component={GlobePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
