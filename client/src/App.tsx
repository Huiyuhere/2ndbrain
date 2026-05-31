import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider, useApp } from "./contexts/AppContext";
import SideNav from "./components/SideNav";
import BottomNav from "./components/BottomNav";

// Pages
import Board from "./pages/Board";
import Today from "./pages/Today";
import Calendar from "./pages/CalendarPage";
import Habits from "./pages/Habits";
import Reflections from "./pages/Reflections";
import Roadmap from "./pages/Roadmap";
import Analytics from "./pages/Analytics";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";
import More from "./pages/More";
import Profile from "./pages/Profile";
import JournalViewer from "./pages/JournalViewer";
import NotFound from "./pages/NotFound";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your 2nd Brain…</p>
      </div>
    </div>
  );
}

function AppLayout() {
  const { loading } = useApp();
  if (loading) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <SideNav />
      <main className="page-content">
        <Switch>
          <Route path="/"            component={Board} />
          <Route path="/board"       component={Board} />
          <Route path="/today"       component={Today} />
          <Route path="/calendar"    component={Calendar} />
          <Route path="/habits"      component={Habits} />
          <Route path="/reflections" component={Reflections} />
          <Route path="/roadmap"     component={Roadmap} />
          <Route path="/analytics"   component={Analytics} />
          <Route path="/goals"       component={Goals} />
          <Route path="/settings"    component={Settings} />
          <Route path="/more"        component={More} />
          <Route path="/profile"      component={Profile} />
          <Route path="/journal"      component={JournalViewer} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <AppLayout />
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
