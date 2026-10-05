import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Navigate,
  NavLink,
  Link,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  PenLine,
  Lightbulb,
  ScanLine,
  Radio,
  MessageSquare,
  ChartNoAxesCombined,
  Images,
  Users,
  Settings,
  ChevronDown,
  Plus,
  Search,
  Bell,
  Menu,
  Sun,
  Moon,
  ArrowUpRight,
  ArrowRight,
  LogOut,
  Command,
  Shield,
  FlaskConical,
  Layers,
  Activity,
  PanelLeftClose,
  RotateCcw,
} from "lucide-react";
import { useConvexAuth } from "convex/react";
import {
  authClient,
  demoMode,
  backendConfigured,
  AuthBoundary,
} from "@/lib/auth-client";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  WorkspaceStoreProvider,
  useStore,
  useLocalState,
  useWorkspaceLocalState,
} from "@/lib/store";
import { AccountIcon, Status, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { OverviewPage } from "@/pages/Overview";
import { DraftsPage, ComposerPage } from "@/pages/Drafts";
import { CalendarPage } from "@/pages/Calendar";
import { IdeasPage, SignalsPage } from "@/pages/Ideas";
import { PlansPage } from "@/pages/Plans";
const ResearchPage = lazy(() =>
  import("@/pages/Research").then((m) => ({ default: m.ResearchPage })),
);
const AgentPage = lazy(() =>
  import("@/pages/Agent").then((m) => ({ default: m.AgentPage })),
);
const AnalyticsPage = lazy(() =>
  import("@/pages/Analytics").then((m) => ({ default: m.AnalyticsPage })),
);
const MediaPage = lazy(() =>
  import("@/pages/Media").then((m) => ({ default: m.MediaPage })),
);
const ExperimentsPage = lazy(() =>
  import("@/pages/Explore").then((m) => ({ default: m.ExperimentsPage })),
);
const RepurposePage = lazy(() =>
  import("@/pages/Explore").then((m) => ({ default: m.RepurposePage })),
);
const TrendsPage = lazy(() =>
  import("@/pages/Explore").then((m) => ({ default: m.TrendsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/Settings").then((m) => ({ default: m.SettingsPage })),
);
const TeamPage = lazy(() =>
  import("@/pages/Team").then((m) => ({ default: m.TeamPage })),
);
const OperationsPage = lazy(() =>
  import("@/pages/Operations").then((m) => ({ default: m.OperationsPage })),
);
const AuthPage = lazy(() =>
  import("@/pages/Public").then((m) => ({ default: m.AuthPage })),
);
const OnboardingPage = lazy(() =>
  import("@/pages/Public").then((m) => ({ default: m.OnboardingPage })),
);
const LandingPage = lazy(() =>
  import("@/pages/Public").then((m) => ({ default: m.LandingPage })),
);
const HelpPage = lazy(() =>
  import("@/pages/Public").then((m) => ({ default: m.HelpPage })),
);
const LegalPage = lazy(() =>
  import("@/pages/Public").then((m) => ({ default: m.LegalPage })),
);
const navigation = [
  { to: "/overview", label: "Übersicht", icon: LayoutDashboard },
  { to: "/calendar", label: "Kalender", icon: CalendarDays },
  { to: "/drafts", label: "Entwürfe", icon: PenLine },
  { to: "/ideas", label: "Ideen", icon: Lightbulb },
  { to: "/research", label: "Recherche", icon: ScanLine },
  { to: "/signals", label: "Signale", icon: Radio },
  { to: "/agent", label: "Agent", icon: MessageSquare },
  { to: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { to: "/media", label: "Medien", icon: Images },
  { to: "/team", label: "Team & Freigaben", icon: Users },
];
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div className="mx-auto max-w-lg p-8">
          <EmptyState
            title="Diese Ansicht konnte nicht geladen werden"
            description="Deine lokal gespeicherten Inhalte bleiben erhalten. Lade die Ansicht erneut."
            action={
              <Button onClick={() => window.location.reload()}>
                Erneut laden
              </Button>
            }
          />
        </div>
      );
    return this.props.children;
  }
}
function Logo() {
  return (
    <Link to="/overview" className="flex items-center gap-2.5">
      <img src="/dispatch.svg" alt="" className="size-8" />
      <span className="text-[22px] font-semibold tracking-[-1px]">
        dispatch<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
function AppShell() {
  const { state, setState, selectWorkspace, createDraft } = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [read, setRead] = useWorkspaceLocalState<string[]>(
    "notification-read",
    [],
  );
  const [theme, setTheme] = useLocalState<"light" | "dark">("theme", "light");
  const workspace = state.workspaces.find(
    (w) => w.id === state.activeWorkspaceId,
  );
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === state.activeWorkspaceId,
  );
  const account = accounts.find((a) => a.id === state.activeAccountId);
  const workspaceDrafts = state.drafts.filter(
    (d) => d.workspaceId === state.activeWorkspaceId,
  );
  const issues = state.schedules.filter(
    (s) =>
      s.workspaceId === state.activeWorkspaceId &&
      ["partial", "uncertain", "failed"].includes(s.status),
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  useEffect(() => {
    setMobile(false);
    setQuery("");
  }, [location.pathname]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const checkNavigate = (destination?: string) =>
    window.dispatchEvent(
      new CustomEvent("dispatch:navigate", {
        cancelable: true,
        detail: { destination },
      }),
    );
  const aside = (
    <>
      <div className="px-5 pt-6 pb-7">
        <Logo />
      </div>
      <div className="px-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mb-6 flex w-full items-center gap-2.5 rounded-md border bg-card px-3 py-2.5 text-left">
              <span className="grid size-7 shrink-0 place-items-center rounded bg-[#e2e7d9] text-[10px] font-semibold text-[#566747]">
                {workspace?.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs">
                  {workspace?.name}
                </strong>
                <span className="text-[10px] muted">
                  {state.role} · {demoMode ? "Demo-Workspace" : "Workspace"}
                </span>
              </span>
              <ChevronDown size={13} className="muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {state.workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => {
                  if (!checkNavigate("/overview")) return;
                  void selectWorkspace(w.id).then((ok) => {
                    if (ok) nav("/overview");
                  });
                }}
              >
                {w.name}
                {w.id === state.activeWorkspaceId ? " ✓" : ""}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => nav("/settings/profile")}>
              <Plus size={13} />
              Workspace verwalten
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="eyebrow mb-2 block px-3 text-[9px]">
          Dein Workspace
        </span>
        <nav aria-label="Hauptnavigation" className="space-y-0.5">
          {navigation.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-10 items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-medium transition-colors hover:bg-secondary",
                  isActive
                    ? "bg-[#eceee5] text-[#425039] dark:bg-secondary dark:text-foreground"
                    : "text-muted-foreground",
                )
              }
            >
              <n.icon size={16} strokeWidth={1.6} />
              <span className="flex-1">{n.label}</span>
              {n.to === "/drafts" && (
                <span className="text-[10px] muted">
                  {workspaceDrafts.length}
                </span>
              )}
              {n.to === "/research" && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </NavLink>
          ))}
        </nav>
        <span className="eyebrow mt-6 mb-2 block px-3 text-[9px]">
          Weiterdenken
        </span>
        <nav aria-label="Erweiterungen" className="space-y-0.5">
          {[
            { to: "/plans", label: "Planvorschläge", icon: Layers },
            { to: "/experiments", label: "Experimente", icon: FlaskConical },
            { to: "/repurpose", label: "Wiederverwertung", icon: ArrowUpRight },
            { to: "/trends", label: "Frühindikatoren", icon: Activity },
          ].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-9 items-center gap-3 rounded-md px-3 py-2 text-[11px] font-medium hover:bg-secondary",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground",
                )
              }
            >
              <n.icon size={14} strokeWidth={1.6} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-auto px-3 pt-6 pb-4">
        <NavLink
          to="/settings/profile"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs muted hover:bg-secondary"
        >
          <Settings size={16} />
          Einstellungen
        </NavLink>
        <NavLink
          to="/operations"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs muted hover:bg-secondary"
        >
          <Shield size={16} />
          Betriebsübersicht
        </NavLink>
        <div className="mt-3 border-t px-3 pt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium">
              Dein Raum für gute Inhalte
            </span>
            <span className="text-[9px] muted">
              {demoMode ? "Demo" : "Cloud"}
            </span>
          </div>
          <p className="mb-3 text-[10px] leading-relaxed muted">
            {demoMode
              ? "Alles lokal. Keine echten Veröffentlichungen."
              : "Profil und Workspaces werden sicher gespeichert."}
          </p>
          <Link to="/help" className="text-[10px] muted hover:text-primary">
            Hilfe & Feedback
            <ArrowUpRight size={11} className="ml-1 inline" />
          </Link>
        </div>
      </div>
    </>
  );
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Zum Inhalt springen
      </a>
      <aside className="app-sidebar">{aside}</aside>
      <div className="app-body">
        <header className="app-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Navigation öffnen"
              onClick={() => setMobile(true)}
            >
              <Menu size={18} />
            </Button>
            <span className="hidden text-xs muted sm:inline">
              Workspace <span className="mx-2 opacity-50">/</span>
            </span>
            <span className="truncate text-xs font-medium">
              {navigation.find((n) => location.pathname.startsWith(n.to))
                ?.label ??
                {
                  "/plans": "Planvorschläge",
                  "/settings": "Einstellungen",
                  "/operations": "Betriebsübersicht",
                  "/experiments": "Experimente",
                  "/repurpose": "Wiederverwertung",
                  "/trends": "Frühindikatoren",
                }[
                  Object.keys({
                    "/plans": 1,
                    "/settings": 1,
                    "/operations": 1,
                    "/experiments": 1,
                    "/repurpose": 1,
                    "/trends": 1,
                  }).find((k) => location.pathname.startsWith(k)) ?? ""
                ] ??
                "Workspace"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Status className="hidden sm:inline-flex">
              {demoMode ? "Mock-Modus" : "Cloud"}
            </Status>
            <select
              className="max-w-32 truncate border-0 bg-transparent py-2 text-[11px] sm:max-w-44"
              aria-label="Aktiver Account"
              value={state.activeAccountId}
              onChange={(e) => {
                if (checkNavigate())
                  setState((s) => ({ ...s, activeAccountId: e.target.value }));
              }}
            >
              {!accounts.length && (
                <option value="">Kein Account verbunden</option>
              )}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.channel} · {a.handle}
                </option>
              ))}
            </select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Suche öffnen"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={17} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Suche · ⌘K</TooltipContent>
            </Tooltip>
            <Button
              size="icon"
              variant="ghost"
              aria-label={
                theme === "light"
                  ? "Dunkles Design aktivieren"
                  : "Helles Design aktivieren"
              }
              onClick={() =>
                setTheme((t) => (t === "light" ? "dark" : "light"))
              }
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Benachrichtigungen öffnen"
              className="relative"
              onClick={() => setNotifications(true)}
            >
              <Bell size={17} />
              {issues.some((s) => !read.includes(s.id)) && (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid size-8 place-items-center rounded-full border bg-[#e0e5d9] text-[11px] font-semibold text-[#566545]"
                  aria-label="Profilmenü"
                >
                  {state.preferences.name.slice(0, 1)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => nav("/settings/profile")}>
                  Profil & Workspace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav("/welcome")}>
                  Produktseite ansehen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    if (!demoMode) {
                      const result = await authClient.signOut();
                      if (result.error) return;
                    }
                    nav("/login");
                  }}
                >
                  <LogOut size={14} />
                  {demoMode ? "Demo abmelden" : "Abmelden"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main-content" className="app-main" tabIndex={-1}>
          <ErrorBoundary key={state.activeWorkspaceId}>
            <Suspense
              fallback={
                <div className="py-20 text-center text-sm muted" role="status">
                  Ansicht wird geladen …
                </div>
              }
            >
              <div key={state.activeWorkspaceId}>
                {demoMode ||
                /^\/(overview|settings)(\/|$)/.test(location.pathname) ? (
                  <Outlet />
                ) : (
                  <EmptyState
                    title="Dieser Bereich wird noch angebunden"
                    description="Dein Workspace ist bereit. Hier liegen noch keine gespeicherten Inhalte vor."
                    action={
                      <Button asChild>
                        <Link to="/settings/profile">Profil einrichten</Link>
                      </Button>
                    }
                  />
                )}
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="app-footer">
          <span>
            dispatch. <span className="mx-2 opacity-40">/</span> Gute Arbeit
            verdient gute Geschichten.
          </span>
          <span>
            {state.preferences.timezone} ·{" "}
            {demoMode ? "Lokal gespeicherte Demo" : "Cloud-Workspace"}
          </span>
        </footer>
      </div>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="flex w-[260px] flex-col gap-0 overflow-y-auto p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace-Navigation</SheetTitle>
            <SheetDescription>
              Alle redaktionellen Ansichten und Einstellungen
            </SheetDescription>
          </SheetHeader>
          {aside}
        </SheetContent>
      </Sheet>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Deinen Workspace durchsuchen</DialogTitle>
            <DialogDescription>
              Entwürfe und Ansichten · ⌘K öffnet die Suche.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="Workspace-Suche"
            placeholder="Was suchst du?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto">
            {[
              ...navigation,
              ...[
                { to: "/plans", label: "Planvorschläge", icon: Layers },
                {
                  to: "/settings/profile",
                  label: "Einstellungen",
                  icon: Settings,
                },
              ],
            ]
              .filter((n) =>
                n.label.toLowerCase().includes(query.toLowerCase()),
              )
              .map((n) => (
                <button
                  key={n.to}
                  className="flex w-full items-center gap-3 rounded-md p-3 text-left text-xs hover:bg-secondary"
                  onClick={() => {
                    {
                      nav(n.to);
                      setSearchOpen(false);
                    }
                  }}
                >
                  <n.icon size={15} />
                  {n.label}
                  <ArrowRight size={12} className="ml-auto muted" />
                </button>
              ))}
            {query &&
              workspaceDrafts
                .filter((d) =>
                  d.title.toLowerCase().includes(query.toLowerCase()),
                )
                .map((d) => (
                  <button
                    key={d.id}
                    className="flex w-full gap-3 rounded-md p-3 text-left text-xs hover:bg-secondary"
                    onClick={() => {
                      {
                        nav(`/drafts/${d.id}`);
                        setSearchOpen(false);
                      }
                    }}
                  >
                    <PenLine size={15} />
                    {d.title}
                  </button>
                ))}
          </div>
        </DialogContent>
      </Dialog>
      <Sheet open={notifications} onOpenChange={setNotifications}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Dein Posteingang</SheetTitle>
            <SheetDescription>
              Wichtige Hinweise für deinen Workspace. Alle Zustände sind
              simuliert.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            {issues.map((s) => (
              <div
                className={cn(
                  "surface p-4",
                  read.includes(s.id) && "opacity-60",
                )}
                key={s.id}
              >
                <div className="mb-2 flex justify-between">
                  <Status tone="orange">
                    {s.status === "uncertain"
                      ? "Ausgang unklar"
                      : "Aufmerksamkeit nötig"}
                  </Status>
                  <span className="text-[10px] muted">
                    {read.includes(s.id) ? "Gelesen" : "Neu"}
                  </span>
                </div>
                <h3 className="mb-2 text-sm">
                  {workspaceDrafts.find((d) => d.id === s.draftId)?.title}
                </h3>
                <p className="text-xs leading-relaxed muted">{s.error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRead((r) => (r.includes(s.id) ? r : [...r, s.id]));
                    nav("/calendar?view=agenda");
                    setNotifications(false);
                  }}
                >
                  Im Kalender prüfen
                </Button>
              </div>
            ))}
            {!issues.length && (
              <p className="text-sm muted">Alle Abläufe sind ruhig.</p>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRead(issues.map((s) => s.id))}
            >
              Alle als gelesen markieren
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/settings/notifications"
                onClick={() => setNotifications(false)}
              >
                Benachrichtigungen einstellen
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
function NotFound() {
  return (
    <EmptyState
      title="Diese Seite hat noch keinen Platz"
      description="Nutze die Navigation, um zu deinem Workspace zurückzukehren."
      action={
        <Button asChild>
          <Link to="/overview">Zur Übersicht</Link>
        </Button>
      }
    />
  );
}
function ComposerRoute() {
  const { id } = useParams();
  return <ComposerPage key={id} />;
}
function ResearchRoute() {
  const { state } = useStore();
  return <ResearchPage key={state.activeAccountId} />;
}
function ProtectedRoute({ children }: { children: ReactNode }) {
  if (demoMode) return <>{children}</>;
  if (!backendConfigured)
    return (
      <div className="p-12">
        <EmptyState
          title="Backend noch nicht konfiguriert"
          description="Die öffentlichen Seiten sind verfügbar. Für deinen Workspace fehlt die Convex-Verbindung."
          action={
            <Button asChild>
              <Link to="/welcome">Zur Startseite</Link>
            </Button>
          }
        />
      </div>
    );
  return <AuthenticatedRoute>{children}</AuthenticatedRoute>;
}
function AuthenticatedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const nav = useNavigate();
  const login = `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
  if (isLoading)
    return (
      <div className="p-12 muted" role="status">
        Sitzung wird geprüft …
      </div>
    );
  if (!isAuthenticated) return <Navigate to={login} replace />;
  return (
    <AuthBoundary
      authClient={authClient}
      getAuthUserFn={api.auth.session}
      isAuthError={(error) =>
        String(error).includes("Unauthenticated") ||
        String(error).includes("EMAIL_NOT_VERIFIED")
      }
      onUnauth={() => nav(login, { replace: true })}
      renderFallback={() => (
        <div className="p-12 muted" role="status">
          Bitte erneut anmelden.
        </div>
      )}
    >
      <WorkspaceStoreProvider>{children}</WorkspaceStoreProvider>
    </AuthBoundary>
  );
}

export function App() {
  useEffect(() => {
    try {
      document.documentElement.classList.toggle(
        "dark",
        JSON.parse(localStorage.getItem("dispatch-theme") ?? '"light"') ===
          "dark",
      );
    } catch {
      document.documentElement.classList.remove("dark");
    }
  }, []);
  return (
    <Suspense
      fallback={
        <div role="status" className="p-12 muted">
          Dispatch wird geladen …
        </div>
      }
    >
      <Routes>
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        <Route path="/verify" element={<AuthPage mode="verify" />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="drafts" element={<DraftsPage />} />
          <Route path="drafts/:id" element={<ComposerRoute />} />
          <Route path="ideas" element={<IdeasPage />} />
          <Route path="signals" element={<SignalsPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="research" element={<ResearchRoute />} />
          <Route path="agent" element={<AgentPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
          <Route path="repurpose" element={<RepurposePage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="settings/:tab?" element={<SettingsPage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
