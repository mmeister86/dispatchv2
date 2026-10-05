import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Compass,
  GitBranch,
  Layers,
  Mail,
  Search,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  authClient,
  demoMode,
  backendConfigured,
  returnPath,
  authPath,
} from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { DemoNote, PageHeader, Section, Status } from "@/components/shared";
import { useLocalState, useStore, useWorkspaceLocalState } from "@/lib/store";
import { now, uid } from "@/lib/model";
import { Field } from "./Settings";

function Brand() {
  return (
    <Link
      to="/welcome"
      aria-label="Dispatch Startseite"
      className="inline-flex items-center gap-2.5 font-semibold text-lg tracking-tight"
    >
      <span className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground rounded-md">
        <Layers size={16} />
      </span>
      dispatch<span className="text-primary">.</span>
    </Link>
  );
}
function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-5 sm:px-9 py-6 flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <nav
          aria-label="Öffentliche Navigation"
          className="flex flex-wrap gap-4 sm:gap-6 items-center text-sm"
        >
          <Link to="/help" className="muted hover:text-foreground">
            Hilfe
          </Link>
          <Link to="/login">Anmelden</Link>
          <Button asChild size="sm">
            <Link to="/signup">
              {demoMode ? "Demo starten" : "Workspace starten"}{" "}
              <ArrowRight size={14} />
            </Link>
          </Button>
        </nav>
      </header>
      {children}
      <footer className="max-w-6xl mx-auto px-5 sm:px-9 py-9 border-t flex flex-wrap justify-between gap-4 text-xs muted">
        <span>Dispatch · Mehr Substanz. Weniger Content-Stress.</span>
        <div className="flex gap-5">
          <Link to="/help">Hilfe</Link>
          <Link to="/legal">Rechtliche Hinweise</Link>
          <span>{demoMode ? "Lokale Produktdemo" : "Dispatch Vorschau"}</span>
        </div>
      </footer>
    </div>
  );
}
export function LandingPage() {
  return (
    <PublicLayout>
      <main className="max-w-6xl mx-auto px-5 sm:px-9">
        <section className="grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-20 items-center py-16 sm:py-24">
          <div>
            <span className="eyebrow">Ein ruhiger Ort für gute Inhalte</span>
            <h1 className="text-[clamp(40px,5.4vw,66px)] leading-[1.08] tracking-[-2.5px] mt-5 mb-6">
              Du baust etwas.
              <br />
              Erzähl davon.
            </h1>
            <p className="muted text-lg leading-relaxed max-w-lg mb-8">
              Aus deiner täglichen Arbeit werden Geschichten, die nach dir
              klingen. Sammeln, schreiben, abstimmen und planen — mit Dispatch.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link to="/signup">
                  Deinen Workflow entdecken <ArrowRight size={16} />
                </Link>
              </Button>
              <Link
                to="/login"
                className="text-sm font-semibold inline-flex gap-2 items-center"
              >
                Demo öffnen
                <ArrowRight size={15} />
              </Link>
            </div>
            <p className="muted text-xs mt-5 mb-0">
              Lokale Demo · kein Social-Login · keine Zahlung
            </p>
          </div>
          <div className="relative pt-5 pb-8">
            <div
              className="absolute inset-3 bg-[#e6e9dc] rounded-[45%_55%_40%_60%] -rotate-6"
              aria-hidden="true"
            />
            <div className="relative surface p-6 sm:p-8 rotate-[-2deg]">
              <div className="flex items-center justify-between mb-8">
                <span className="eyebrow">Aus deiner Werkstatt</span>
                <Status tone="green">Entwurf</Status>
              </div>
              <div className="flex gap-3 items-center mb-5">
                <span className="w-9 h-9 rounded-full bg-[#dcd6bb] dark:bg-secondary flex items-center justify-center font-semibold text-xs">
                  MS
                </span>
                <div>
                  <p className="font-semibold text-sm mb-0">
                    Deine eigene Stimme
                  </p>
                  <span className="muted text-xs">Building in public</span>
                </div>
              </div>
              <p className="text-lg leading-relaxed">
                Heute drei Features gestrichen.
                <br />
                Und das Produkt ist besser geworden.
              </p>
              <p className="muted text-sm leading-relaxed mb-7">
                Manchmal ist Fortschritt kein neues Feature. Sondern ein
                klarerer nächster Schritt.
              </p>
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-xs muted">Von der Notiz zum Beitrag</span>
                <span className="text-primary flex items-center gap-1 text-xs font-semibold">
                  <Check size={14} />
                  Bereit für dein Feedback
                </span>
              </div>
            </div>
            <div className="relative mt-4 ml-8 surface px-5 py-4 rotate-[2deg] flex gap-3 items-center">
              <GitBranch size={18} />
              <div>
                <span className="text-xs font-semibold">
                  Ein Release. Eine gute Geschichte.
                </span>
                <p className="muted text-xs mt-1 mb-0">
                  Verknüpfe deine Arbeit mit deinem Content.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="border-y py-12 grid md:grid-cols-[0.7fr_1fr] gap-10">
          <div>
            <span className="eyebrow">Mit Absicht veröffentlichen</span>
            <h2 className="text-3xl leading-tight mt-3 mb-0">
              Weniger Tabs.
              <br />
              Mehr roter Faden.
            </h2>
          </div>
          <div className="space-y-7">
            {[
              [
                "01",
                "Finde die Geschichte",
                "Ideen aus Notizen, öffentlichen Quellen und ausgewählten Repository-Ereignissen sammeln.",
              ],
              [
                "02",
                "Bleib bei deiner Stimme",
                "Eigene Textbeispiele, inhaltliche Säulen und klare Freigaben statt austauschbarer Posts.",
              ],
              [
                "03",
                "Behalte den Überblick",
                "Kanäle, Kalender und Teamfeedback an einem Ort. Du entscheidest, was veröffentlicht wird.",
              ],
            ].map(([n, title, description]) => (
              <div className="flex gap-5" key={n}>
                <span className="text-primary text-xs pt-1 font-semibold">
                  {n}
                </span>
                <div>
                  <h3 className="mb-2">{title}</h3>
                  <p className="muted leading-relaxed mb-0 text-sm">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="py-16 sm:py-20">
          <div className="mb-9 flex flex-wrap gap-4 justify-between items-end">
            <div>
              <span className="eyebrow">Raum für deinen Workflow</span>
              <h2 className="text-3xl mt-3 mb-0">
                Ein Plan für jede Werkstatt.
              </h2>
            </div>
            <span className="text-xs muted">
              Beispielpreise der Demo · kein Kauf möglich
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                name: "Starter",
                price: "12",
                description: "Für deine erste konsistente Content-Routine.",
                perks: [
                  "2 Social Accounts",
                  "10 geplante Beiträge",
                  "Eigene Textvorlagen",
                ],
              },
              {
                name: "Studio",
                price: "29",
                description: "Für Marken, die gemeinsam etwas aufbauen.",
                perks: [
                  "8 Social Accounts",
                  "5 Teammitglieder",
                  "Freigaben & Quellen-Monitoring",
                ],
              },
            ].map((plan) => (
              <div className="surface p-7" key={plan.name}>
                <div className="flex justify-between items-baseline">
                  <h3 className="text-xl mb-0">{plan.name}</h3>
                  <p className="mb-0">
                    <span className="text-3xl font-semibold">
                      {plan.price} €
                    </span>
                    <span className="muted text-xs"> / Monat</span>
                  </p>
                </div>
                <p className="muted text-sm mt-3 mb-6">{plan.description}</p>
                <ul className="space-y-3 text-sm mb-7">
                  {plan.perks.map((p) => (
                    <li className="flex gap-2" key={p}>
                      <Check size={16} className="text-primary" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.name === "Studio" ? "default" : "outline"}
                  asChild
                >
                  <Link to="/signup">
                    Plan in der Demo ansehen
                    <ArrowRight size={15} />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
        <div className="mb-16">
          <DemoNote>
            {demoMode
              ? "Diese Vorschau läuft im Browser mit Beispieldaten. Scores zeigen lokale Orientierungshilfen, keine garantierte Reichweite. KI, Live-Publishing, Zahlungen und E-Mail-Versand sind nicht angebunden."
              : "Konto, E-Mail-Bestätigung und Workspace-Profil sind angebunden. Inhalte, Social-Verbindungen, KI, Publishing und Zahlungen werden noch eingerichtet."}
          </DemoNote>
        </div>
      </main>
    </PublicLayout>
  );
}
type AuthMode = "login" | "signup" | "reset" | "verify";
const authTitles: Record<AuthMode, string> = {
  login: "Schön, dass du da bist.",
  signup: "Hier beginnt dein roter Faden.",
  reset: "Wieder Zugang finden.",
  verify: "Ein kleiner letzter Schritt.",
};
export function AuthPage({ mode = "login" }: { mode?: AuthMode }) {
  const [params] = useSearchParams();
  const token = params.get("token");
  const newPassword = mode === "reset" && !!token;
  const destination = returnPath(params.get("returnTo"));
  // Build-time mode never changes during a React session.
  const capabilities =
    !demoMode && backendConfigured
      ? useQuery(api.auth.capabilities, {})
      : undefined;

  const navigate = useNavigate();
  const { state, setState } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState("normal");
  const [github, setGithub] = useWorkspaceLocalState("github", {
    login: false,
    installed: false,
    repos: ["dispatch/calendar"],
    monitors: ["dispatch/calendar"],
    privateConsent: false,
    events: ["Releases", "Pull Requests"],
  });
  const submitReal = async () => {
    if (busy) return;
    setError("");
    if (!backendConfigured) {
      setError("Die Authentifizierung ist noch nicht konfiguriert.");
      return;
    }
    if (mode === "signup" && !consent) {
      setError("Bestätige bitte die Datenschutzhinweise.");
      return;
    }
    setBusy(true);
    const callbackURL = `${import.meta.env.VITE_SITE_URL}${authPath("/onboarding", destination)}`;
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email,
              password,
              name: email.split("@")[0],
              callbackURL,
            })
          : mode === "login"
            ? await authClient.signIn.email({ email, password, callbackURL })
            : newPassword
              ? await authClient.resetPassword({
                  newPassword: password,
                  token: token!,
                })
              : mode === "reset"
                ? await authClient.requestPasswordReset({
                    email,
                    redirectTo: `${import.meta.env.VITE_SITE_URL}${authPath("/reset-password", destination)}`,
                  })
                : await authClient.sendVerificationEmail({
                    email,
                    callbackURL,
                  });
      if (result.error) {
        setError(
          result.error.message ??
            "Anfrage fehlgeschlagen. Bitte erneut versuchen.",
        );
        return;
      }
      if (mode === "login") navigate(destination);
      else if (mode === "signup") navigate(authPath("/verify", destination));
      else setSuccess(true);
    } catch {
      setError("Der Server ist nicht erreichbar. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (!demoMode) {
      void submitReal();
      return;
    }

    if (busy) return;
    setError("");
    if (scenario === "expired") {
      setError(
        "Deine Demo-Sitzung ist abgelaufen. Setze den Demo-Zustand zurück auf „Normal“ und melde dich erneut an.",
      );
      return;
    }
    if (scenario === "error") {
      setError(
        "Anmeldung konnte im Demo-Szenario nicht abgeschlossen werden. Prüfe deine Eingaben oder teste den normalen Ablauf.",
      );
      return;
    }
    if (mode !== "verify" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    if ((mode === "login" || mode === "signup") && password.length < 8) {
      setError(
        "Verwende für diese Demo mindestens 8 Zeichen. Das Passwort wird weder gespeichert noch versendet.",
      );
      return;
    }
    if (mode === "signup" && !consent) {
      setError("Bestätige bitte die Hinweise zur lokalen Demo.");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (mode === "reset" || mode === "verify") {
        setSuccess(true);
        return;
      }
      if (mode === "signup") {
        setState((s) => ({
          ...s,
          preferences: { ...s.preferences, onboardingDone: false },
        }));
        navigate(authPath("/verify", destination));
      } else
        navigate(
          state.preferences.onboardingDone ? "/overview" : "/onboarding",
        );
    }, 400);
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="bg-[#e9ecdf] dark:bg-secondary p-8 sm:p-12 lg:p-16 flex flex-col justify-between gap-10">
        <Brand />
        <div className="max-w-md py-6 lg:py-14">
          <span className="eyebrow">Platz für deine Gedanken</span>
          <h1 className="text-[clamp(35px,4vw,52px)] leading-[1.13] mt-5 mb-6">
            Gute Geschichten
            <br />
            fangen bei deiner
            <br />
            Arbeit an.
          </h1>
          <p className="muted text-base leading-relaxed">
            Dispatch hilft dir, den roten Faden zu finden. Von der ersten Notiz
            bis zum letzten Feinschliff.
          </p>
          <div className="flex gap-3 mt-8">
            <span className="h-10 w-10 rounded-full border flex items-center justify-center">
              <Compass size={17} />
            </span>
            <p className="text-sm leading-relaxed mb-0">
              Deine Stimme. Dein Rhythmus.
              <br />
              <span className="muted">Dein nächster guter Beitrag.</span>
            </p>
          </div>
        </div>
        <p className="muted text-xs mb-0">
          {demoMode
            ? "Alles bleibt lokal in diesem Browser. Keine echte Authentifizierung."
            : "Dein Konto und dein Workspace werden sicher gespeichert."}
        </p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link
            to="/welcome"
            className="muted inline-flex gap-1 items-center text-xs mb-10"
          >
            <ChevronLeft size={14} />
            Zur Startseite
          </Link>
          <span className="eyebrow">
            {mode === "signup"
              ? "Deine Werkstatt wartet"
              : mode === "reset"
                ? "Passwort zurücksetzen"
                : mode === "verify"
                  ? demoMode
                    ? "Demo-Bestätigung"
                    : "E-Mail bestätigen"
                  : "Willkommen zurück"}
          </span>
          <h2 className="text-3xl mt-3 mb-4">{authTitles[mode]}</h2>
          <p className="muted text-sm leading-relaxed mb-7">
            {demoMode
              ? mode === "login"
                ? "Öffne deinen lokalen Workspace. Verwende eine Beispieladresse und ein beliebiges Demo-Passwort mit 8 Zeichen."
                : mode === "signup"
                  ? "Richte dein Profil in der Produktdemo ein. Es wird kein echtes Konto erstellt."
                  : mode === "reset"
                    ? "Teste den Ablauf zur Wiederherstellung. Eine E-Mail wird nicht versendet."
                    : "In der echten Anwendung würde hier deine E-Mail bestätigt. Du kannst den Schritt lokal simulieren."
              : mode === "login"
                ? "Melde dich mit deiner bestätigten E-Mail-Adresse an."
                : mode === "signup"
                  ? "Erstelle dein Konto. Wir senden dir einen Link zur E-Mail-Bestätigung."
                  : newPassword
                    ? "Wähle ein neues Passwort. Der Link ist nur einmal gültig."
                    : mode === "reset"
                      ? "Wir senden dir einen Link, mit dem du dein Passwort zurücksetzen kannst."
                      : "Öffne den Bestätigungslink in deiner E-Mail. Du kannst hier einen neuen Link anfordern."}
          </p>
          {success ? (
            <div role="status" className="stack">
              <CheckCircle2 size={28} className="text-[#527548]" />
              <h3>
                {!demoMode
                  ? newPassword
                    ? "Passwort gespeichert"
                    : mode === "reset"
                      ? "Anfrage angenommen"
                      : "Bestätigungslink angefordert"
                  : mode === "reset"
                    ? "Demo-Anfrage vorbereitet"
                    : "Demo-Bestätigung erfolgreich"}
              </h3>
              <p className="muted text-sm">
                {!demoMode
                  ? newPassword
                    ? "Du kannst dich jetzt mit deinem neuen Passwort anmelden."
                    : "Wenn ein passendes Konto existiert, erhältst du eine E-Mail. Öffne den Link, um fortzufahren."
                  : mode === "reset"
                    ? "Es wurde kein Reset-Link versendet. Für die Demo kannst du mit einem beliebigen Passwort ab 8 Zeichen fortfahren."
                    : "Dein nächster Schritt: ein Profil, das zu dir passt."}
              </p>
              <Button asChild>
                <Link
                  to={authPath(
                    !demoMode || mode === "reset" ? "/login" : "/onboarding",
                    destination,
                  )}
                >
                  {!demoMode || mode === "reset"
                    ? "Zur Anmeldung"
                    : "Profil einrichten"}
                  <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {(!demoMode || mode !== "verify") && !newPassword && (
                <Field label="E-Mail-Adresse">
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    disabled={busy}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="du@beispiel.de"
                  />
                </Field>
              )}
              {(mode === "login" || mode === "signup" || newPassword) && (
                <Field
                  label={
                    demoMode
                      ? "Demo-Passwort"
                      : newPassword
                        ? "Neues Passwort"
                        : "Passwort"
                  }
                >
                  <Input
                    type="password"
                    autoComplete={
                      mode === "signup" || newPassword
                        ? "new-password"
                        : "current-password"
                    }
                    required
                    minLength={8}
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
                  />
                </Field>
              )}
              {mode === "login" && (
                <Link
                  to={authPath("/reset-password", destination)}
                  className="text-xs font-semibold text-right -mt-2"
                >
                  Passwort vergessen?
                </Link>
              )}
              {mode === "signup" && (
                <label className="text-xs leading-relaxed flex items-start gap-2">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Ich habe die{" "}
                    <Link className="underline" to="/legal">
                      {demoMode
                        ? "Demo- und Datenschutzhinweise"
                        : "Datenschutzhinweise"}
                    </Link>{" "}
                    gelesen.{" "}
                    {demoMode
                      ? "Angaben werden ausschließlich lokal verwendet."
                      : "Angaben werden für mein Konto und meinen Workspace verarbeitet."}
                  </span>
                </label>
              )}
              {error && (
                <p role="alert" className="text-destructive text-sm mb-0">
                  {error}
                </p>
              )}
              <Button disabled={busy}>
                {busy
                  ? "Einen Moment…"
                  : !demoMode
                    ? mode === "signup"
                      ? "Konto anlegen"
                      : mode === "login"
                        ? "Anmelden"
                        : newPassword
                          ? "Passwort speichern"
                          : mode === "reset"
                            ? "Reset-Link anfordern"
                            : "Bestätigungslink erneut senden"
                    : mode === "signup"
                      ? "Demo-Profil anlegen"
                      : mode === "reset"
                        ? "Reset-Ablauf simulieren"
                        : mode === "verify"
                          ? "Bestätigung simulieren"
                          : "Demo anmelden"}
                <ArrowRight size={15} />
              </Button>
              {(mode === "login" || mode === "signup") && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || (!demoMode && !capabilities?.githubLogin)}
                    onClick={() => {
                      if (!demoMode) {
                        if (mode === "signup" && !consent) {
                          setError("Bestätige zuerst die Datenschutzhinweise.");
                          return;
                        }
                        setBusy(true);
                        void authClient.signIn
                          .social({
                            provider: "github",
                            callbackURL: `${import.meta.env.VITE_SITE_URL}${destination}`,
                          })
                          .then((result) => {
                            if (result.error)
                              setError(
                                result.error.message ??
                                  "GitHub-Anmeldung fehlgeschlagen.",
                              );
                          })
                          .catch(() =>
                            setError("GitHub-Anmeldung fehlgeschlagen."),
                          )
                          .finally(() => setBusy(false));
                        return;
                      }
                      if (mode === "signup" && !consent) {
                        setError(
                          "Bestätige zuerst die Hinweise zur lokalen Demo.",
                        );
                        return;
                      }
                      setGithub({ ...github, login: true });
                      navigate(
                        state.preferences.onboardingDone
                          ? "/overview"
                          : "/onboarding",
                      );
                    }}
                  >
                    <GitBranch size={15} />
                    {demoMode
                      ? "GitHub-Anmeldung simulieren"
                      : "Mit GitHub anmelden"}
                  </Button>
                  <p className="text-xs muted mb-0">
                    {demoMode
                      ? "Nur Demo-Anmeldung."
                      : capabilities?.githubLogin
                        ? "GitHub-Anmeldung ist verfügbar."
                        : "GitHub-Anmeldung ist noch nicht konfiguriert."}{" "}
                    Repository-Zugriff benötigt anschließend eine eigene
                    Zustimmung.
                  </p>
                </>
              )}
              {demoMode && mode === "login" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      state.preferences.onboardingDone
                        ? "/overview"
                        : "/onboarding",
                    )
                  }
                >
                  Ohne Eingaben direkt zur Demo
                </Button>
              )}
              {demoMode && (
                <details className="text-xs muted">
                  <summary className="cursor-pointer">
                    Demo-Fehlerzustände testen
                  </summary>
                  <select
                    aria-label="Auth Demo Szenario"
                    className="native-select mt-3"
                    value={scenario}
                    onChange={(e) => {
                      setScenario(e.target.value);
                      setError("");
                    }}
                  >
                    <option value="normal">Normaler Ablauf</option>
                    <option value="error">Anmeldefehler</option>
                    <option value="expired">Sitzung abgelaufen</option>
                  </select>
                </details>
              )}
            </form>
          )}
          <p className="text-xs muted mt-7 leading-relaxed">
            {mode === "login" ? (
              <>
                Noch kein Profil?{" "}
                <Link
                  className="font-semibold text-foreground"
                  to={authPath("/signup", destination)}
                >
                  {demoMode ? "Demo starten" : "Konto anlegen"}
                </Link>
              </>
            ) : (
              <Link
                className="font-semibold text-foreground"
                to={authPath("/login", destination)}
              >
                Zur Anmeldung
              </Link>
            )}
          </p>
          <div className="mt-8">
            <DemoNote>
              {demoMode
                ? "Keine Live-Anmeldung, OAuth-Anfragen oder E-Mails. Passwörter werden nicht gespeichert."
                : !backendConfigured
                  ? "Die Verbindung zur Authentifizierung fehlt."
                  : capabilities?.restrictedSender
                    ? "E-Mails verwenden vorerst den eingeschränkten Resend-Testabsender. Die Zustellung an andere Empfänger benötigt einen verifizierten Absender."
                    : "E-Mail und Passwort sind unabhängig von GitHub nutzbar."}
            </DemoNote>
          </div>
        </div>
      </main>
    </div>
  );
}
export function OnboardingPage() {
  const { state, setState, saveProfile, onboardingStep } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = demoMode
    ? useLocalState("onboarding-step", 0)
    : useState(onboardingStep);
  const initialProject = {
    name:
      state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.name ??
      "",
    description:
      state.workspaces.find((w) => w.id === state.activeWorkspaceId)
        ?.description ?? "",
  };
  const [project, setProject] = demoMode
    ? useLocalState("onboarding-project", initialProject)
    : useState(initialProject);
  const [github, setGitBranch] = useWorkspaceLocalState("github", {
    login: false,
    installed: false,
    repos: ["dispatch/calendar"],
    monitors: ["dispatch/calendar"],
    privateConsent: false,
    events: ["Releases", "Pull Requests"],
  });
  const [profile, setProfile] = useState(state.preferences);
  const admin = state.role === "Owner" || state.role === "Admin";
  const editable = state.role !== "Viewer";
  const change = (patch: Partial<typeof profile>) => {
    if (editable) {
      setProfile((p) => ({ ...p, ...patch }));
      if (demoMode)
        setState((s) => ({
          ...s,
          preferences: { ...s.preferences, ...patch },
        }));
    }
  };
  const persist = async (nextStep: number, complete = false) => {
    if (!editable || busy) return false;
    setBusy(true);
    const ok = await saveProfile(
      { ...profile, onboardingDone: complete },
      admin ? project : undefined,
      nextStep,
    );
    setBusy(false);
    if (ok) setStep(nextStep);
    return ok;
  };
  const finish = async () => {
    if (await persist(0, true)) navigate(returnPath(params.get("returnTo")));
  };
  const defer = async () => {
    if (await persist(step, false))
      navigate(returnPath(params.get("returnTo")));
  };
  const steps = [
    "Dein Projekt",
    "Deine Stimme",
    demoMode ? "Deine Quellen" : "Deine Quellen (optional)",
    demoMode ? "Dein erster Kanal" : "Dein erster Kanal (optional)",
  ];
  return (
    <div className="min-h-screen max-w-4xl mx-auto px-5 sm:px-10 py-8">
      <header className="flex gap-4 justify-between items-center mb-12">
        <Brand />
        <Button
          variant="ghost"
          size="sm"
          onClick={defer}
          disabled={busy || !editable}
        >
          {busy ? "Wird gespeichert…" : "Später einrichten"}
          <ArrowRight size={14} />
        </Button>
      </header>
      <div className="grid gap-10 md:grid-cols-[210px_minmax(0,1fr)]">
        <aside>
          <span className="eyebrow">Dein Setup</span>
          <ol className="space-y-5 mt-6">
            {steps.map((name, i) => (
              <li key={name} className="flex gap-3 items-center">
                <span
                  className={`h-7 w-7 flex items-center justify-center rounded-full text-xs ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-[#e8f0e5] text-[#30613e]" : "bg-secondary muted"}`}
                >
                  {i < step && (demoMode || i < 2) ? (
                    <Check size={13} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`text-sm ${i === step ? "font-semibold" : "muted"}`}
                >
                  {name}
                </span>
              </li>
            ))}
          </ol>
          <p className="muted text-xs leading-relaxed mt-8">
            {demoMode
              ? "Jeder Schritt wird lokal gespeichert."
              : "Mit Weiter speicherst du jeden Schritt in deinem Workspace."}{" "}
            Du kannst jederzeit zurückkommen.
          </p>
        </aside>
        <main>
          <Progress
            aria-label={`Einrichtung: Schritt ${Math.min(step, 3) + 1} von 4`}
            value={((Math.min(step, 3) + 1) / 4) * 100}
            className="mb-7 h-1"
          />
          <span className="eyebrow">Schritt {Math.min(step, 3) + 1} von 4</span>
          <h1 className="mt-3 mb-4">
            {step === 0
              ? "Was baust du gerade?"
              : step === 1
                ? "Wie klingt deine Stimme?"
                : step === 2
                  ? "Wo entstehen deine Ideen?"
                  : "Wo möchtest du erzählen?"}
          </h1>
          <p className="muted leading-relaxed mb-7">
            {step === 0
              ? "Ein paar Grundlagen, damit sich dein Workspace nach dir anfühlt."
              : step === 1
                ? "Gute Inhalte verbinden das, was dich beschäftigt, mit den Menschen, die du erreichen möchtest."
                : step === 2
                  ? "Verknüpfe deine Arbeit optional mit Dispatch. Zugriff auf private Inhalte erfordert deine ausdrückliche Zustimmung."
                  : demoMode
                    ? "Verbinde einen Kanal als lokale Simulation. Du kannst alle Kanäle später in den Einstellungen ergänzen."
                    : "Du kannst jetzt ohne Social-Account starten und später einen Kanal verbinden."}
          </p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 3) void finish();
              else void persist(Math.min(3, step + 1));
            }}
          >
            {step === 0 && (
              <>
                <Field label="Dein Name">
                  <Input
                    required
                    value={profile.name}
                    disabled={!editable}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </Field>
                <Field label="Projekt / Marke">
                  <Input
                    required
                    value={project.name}
                    disabled={!admin}
                    onChange={(e) =>
                      setProject({ ...project, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Was macht dein Projekt?">
                  <Textarea
                    value={project.description}
                    disabled={!admin}
                    onChange={(e) =>
                      setProject({ ...project, description: e.target.value })
                    }
                  />
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <Field label="Für wen schreibst du?">
                  <Textarea
                    value={profile.audience}
                    disabled={!editable}
                    onChange={(e) => change({ audience: e.target.value })}
                  />
                </Field>
                <Field label="Tonalität">
                  <Input
                    value={profile.tone}
                    disabled={!editable}
                    onChange={(e) => change({ tone: e.target.value })}
                  />
                </Field>
                <Field label="Themen">
                  <Input
                    value={profile.topics}
                    disabled={!editable}
                    onChange={(e) => change({ topics: e.target.value })}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Sprache">
                    <select
                      className="native-select"
                      value={profile.language}
                      disabled={!editable}
                      onChange={(e) => change({ language: e.target.value })}
                    >
                      <option>Deutsch</option>
                      <option>English</option>
                    </select>
                  </Field>
                  <Field label="Zeitzone">
                    <select
                      className="native-select"
                      value={profile.timezone}
                      disabled={!editable}
                      onChange={(e) => change({ timezone: e.target.value })}
                    >
                      {[
                        "Europe/Berlin",
                        "Europe/London",
                        "America/New_York",
                        "UTC",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}
            {step === 2 &&
              (demoMode ? (
                <>
                  <div className="surface p-5">
                    <div className="flex gap-3 items-center mb-4">
                      <GitBranch size={24} />
                      <div>
                        <h3 className="mb-1">GitHub, wenn du möchtest</h3>
                        <p className="muted text-xs mb-0">
                          Anmeldung und Repository-Zugriff bleiben getrennt.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!admin}
                        onClick={() =>
                          setGitBranch((g) => ({ ...g, login: !g.login }))
                        }
                      >
                        {github.login
                          ? "Demo-Anmeldung trennen"
                          : "GitHub-Login simulieren"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!admin || !github.login}
                        onClick={() =>
                          setGitBranch((g) => ({
                            ...g,
                            installed: !g.installed,
                          }))
                        }
                      >
                        {github.installed
                          ? "Repository-App entfernen"
                          : "Repository-Zugriff simulieren"}
                      </Button>
                    </div>
                    {github.installed && (
                      <>
                        <p className="text-xs font-medium mt-5">
                          Beispiel-Repository: dispatch/calendar · Releases und
                          Pull Requests
                        </p>
                        <label className="flex gap-2 items-start text-xs leading-relaxed">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={!admin}
                            checked={github.privateConsent}
                            onChange={(e) =>
                              setGitBranch({
                                ...github,
                                privateConsent: e.target.checked,
                              })
                            }
                          />
                          Privaten Kontext ausdrücklich erlauben. Er darf nicht
                          automatisch veröffentlicht werden.
                        </label>
                      </>
                    )}
                  </div>
                  <DemoNote>
                    GitHub ist optional. Keine externe Anmeldung oder
                    Datenabfrage.
                  </DemoNote>
                </>
              ) : (
                <Section
                  title="GitHub, wenn du möchtest"
                  description="Repository-Zugriff wird separat angebunden. Dein Workspace funktioniert ohne GitHub."
                >
                  <p className="muted text-sm">
                    Du kannst diesen Schritt überspringen.
                  </p>
                </Section>
              ))}
            {step === 3 &&
              (demoMode ? (
                <>
                  <div className="surface p-5">
                    <div className="flex gap-3 items-center mb-5">
                      <span className="bg-foreground text-background w-8 h-8 rounded-md flex items-center justify-center font-semibold">
                        𝕏
                      </span>
                      <div>
                        <h3 className="mb-1">Dein X-Account</h3>
                        <p className="muted text-xs mb-0">
                          Eine lokale Verbindung zum Ausprobieren.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!admin}
                      onClick={() => {
                        if (!admin) return;
                        const account = state.accounts.find(
                          (a) =>
                            a.workspaceId === state.activeWorkspaceId &&
                            a.channel === "X",
                        );
                        if (account)
                          setState((s) => ({
                            ...s,
                            accounts: s.accounts.map((a) =>
                              a.id === account.id
                                ? { ...a, connected: !a.connected }
                                : a,
                            ),
                            activeAccountId: account.id,
                          }));
                        else {
                          const id = uid("acc");
                          setState((s) => ({
                            ...s,
                            accounts: [
                              ...s.accounts,
                              {
                                id,
                                workspaceId: s.activeWorkspaceId,
                                name: s.preferences.name,
                                handle: "@dein-demo-profil",
                                channel: "X",
                                connected: true,
                                color: "#2d332e",
                              },
                            ],
                            activeAccountId: id,
                          }));
                        }
                      }}
                    >
                      {state.accounts.some(
                        (a) =>
                          a.workspaceId === state.activeWorkspaceId &&
                          a.channel === "X" &&
                          a.connected,
                      )
                        ? "Demo-X-Verbindung trennen"
                        : "X-Verbindung simulieren"}
                    </Button>
                  </div>
                  <DemoNote>
                    Du entscheidest vor jeder Veröffentlichung. Diese Demo
                    sendet keine Beiträge.
                  </DemoNote>
                </>
              ) : (
                <Section
                  title="Dein erster Kanal"
                  description="Es ist noch kein Social-Account verbunden. Du kannst deinen Workspace bereits einrichten."
                >
                  <p className="muted text-sm">
                    Verbindungen werden später separat freigegeben. Es werden
                    keine Beiträge automatisch veröffentlicht.
                  </p>
                </Section>
              ))}
            <div className="flex flex-wrap justify-between gap-3 border-t pt-6 mt-3">
              <Button
                variant="ghost"
                type="button"
                disabled={busy || step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft size={15} />
                Zurück
              </Button>
              <div className="flex gap-2">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      step === 3 ? void defer() : void persist(3)
                    }
                  >
                    Überspringen
                  </Button>
                )}
                <Button disabled={busy || !editable}>
                  {busy
                    ? "Wird gespeichert…"
                    : step === 3
                      ? "Workspace öffnen"
                      : "Weiter"}
                  <ArrowRight size={15} />
                </Button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
const faqs = [
  {
    question: "Warum verbindet sich mein Social-Account nicht wirklich?",
    answer:
      "Dispatch läuft hier als lokale Produktdemo. Verbinden, Erneuern und Trennen simulieren den Verbindungsstatus. OAuth und Live-Publishing sind nicht angebunden.",
  },
  {
    question: "Warum kann ich einen Entwurf nicht planen?",
    answer:
      "Die aktuelle Version muss für den ausgewählten Account von einem Owner oder Admin freigegeben sein. Prüfe Textlänge, Verbindung, Alttexte, künftigen Zeitpunkt und belegte Kalenderslots.",
  },
  {
    question: "Was bedeutet „Abgleich erforderlich“?",
    answer:
      "Der Ausgang einer Veröffentlichung ist unklar, etwa nach einem Timeout. Gleiche zuerst den Remote-Status ab. Eine blinde Wiederholung kann doppelte Beiträge erzeugen. Die Demo simuliert diesen Ablauf.",
  },
  {
    question: "Warum ist eine Freigabe nach einer Bearbeitung ungültig?",
    answer:
      "Freigaben gelten immer für eine konkrete Version und einen Account. Eine Änderung am Text, an Medien oder am Account benötigt eine neue Freigabe.",
  },
  {
    question: "Wer kann Verbindungen, Regeln und Teammitglieder verwalten?",
    answer:
      "Owner und Admin können administrative Einstellungen ändern. Editor bearbeiten Inhalte, Viewer lesen sie. Owner-Übergabe und Löschung bleiben Ownern vorbehalten.",
  },
  {
    question: "Sind private GitHub-Inhalte automatisch öffentlich?",
    answer:
      "Nein. Repository-Zugriff ist von der GitHub-Anmeldung getrennt. Privater Kontext benötigt gesonderte Zustimmung und darf nicht automatisch in öffentlichen Posts erscheinen. In der Demo werden keine Repositories abgerufen.",
  },
  {
    question: "Wie exportiere oder lösche ich meine Daten?",
    answer:
      "Unter Einstellungen → Daten & Sicherheit lässt sich der aktive Workspace als JSON herunterladen. Löschung benötigt eine getippte Bestätigung und Owner-Rechte. Öffentliche Social-Beiträge bleiben erhalten.",
  },
  {
    question: "Wieso sind meine Daten nach einem Browserwechsel weg?",
    answer:
      "Diese Demo speichert Daten im lokalen Speicher dieses Browsers. Es gibt keine Cloud-Synchronisierung. Sichere wichtige Demo-Inhalte über den JSON-Export.",
  },
  {
    question: "Wie stoppe ich Automatisierung?",
    answer:
      "Unter Einstellungen → Automatisierung widerrufst du eine Richtlinie oder setzt den globalen Stopp für diesen Workspace. Er betrifft zukünftige automatische Aktionen. Manuelle Kalendertermine und abgeschlossene Beiträge bleiben bestehen.",
  },
];
export function HelpPage() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [requests, setRequests] = useWorkspaceLocalState<
    { id: string; message: string; created: string; consent: boolean }[]
  >("help-requests", []);
  const [sent, setSent] = useState(false);
  const { state } = useStore();
  const found = faqs.filter((f) =>
    `${f.question} ${f.answer}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <PublicLayout>
      <main className="max-w-4xl mx-auto px-5 sm:px-9 py-12">
        <PageHeader
          eyebrow="Wir helfen dir weiter"
          title="Ein klarer nächster Schritt."
          description="Antworten auf die kleinen Fragen, die den Workflow aufhalten."
        />
        <div className="relative mb-8">
          <Search size={17} className="absolute left-3 top-3 muted" />
          <Input
            aria-label="Hilfe durchsuchen"
            className="pl-10"
            placeholder="Suche nach Freigaben, Accounts, Datenschutz…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="divide-y">
          {found.map((f) => (
            <details key={f.question} className="py-5">
              <summary className="cursor-pointer font-semibold leading-relaxed">
                {f.question}
              </summary>
              <p className="muted text-sm leading-relaxed mt-4 mb-1 max-w-2xl">
                {f.answer}
              </p>
            </details>
          ))}
          {!found.length && (
            <p className="muted py-8">
              Keine passende Antwort. Formuliere deine Suche anders oder bereite
              unten eine Support-Anfrage vor.
            </p>
          )}
        </div>
        <div className="mt-10">
          <Section
            title="Deine Frage braucht mehr Kontext?"
            description="Bereite eine lokale Support-Anfrage vor. Sie wird nicht versendet."
          >
            {sent ? (
              <div role="status">
                <Status tone="green">Anfrage lokal gespeichert</Status>
                <p className="muted mt-4 text-sm">
                  {requests[requests.length - 1]?.id}. Kein Support-Team wurde
                  benachrichtigt. Du kannst den Text kopieren oder weitere
                  Details ergänzen.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSent(false);
                    setMessage("");
                    setConsent(false);
                  }}
                >
                  Weitere Anfrage vorbereiten
                </Button>
              </div>
            ) : (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!consent || !message.trim() || state.role === "Viewer")
                    return;
                  setRequests((rs) => [
                    ...rs,
                    {
                      id: uid("support"),
                      message: message.trim(),
                      created: now(),
                      consent: true,
                    },
                  ]);
                  setSent(true);
                }}
              >
                <Field label="Was ist passiert?">
                  <Textarea
                    required
                    minLength={10}
                    value={message}
                    disabled={state.role === "Viewer"}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Beschreibe den Ablauf. Keine Passwörter, Tokens oder privaten Inhalte einfügen."
                  />
                </Field>
                <label className="flex items-start gap-2 text-xs leading-relaxed">
                  <input
                    className="mt-0.5"
                    type="checkbox"
                    required
                    disabled={state.role === "Viewer"}
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  Ich stimme zu, diese Anfrage lokal zu speichern. Sie enthält
                  keine Zugangsdaten oder vertraulichen Inhalte.
                </label>
                <Button
                  className="self-start"
                  disabled={!consent || state.role === "Viewer"}
                >
                  <Mail size={15} />
                  Anfrage lokal vorbereiten
                </Button>
              </form>
            )}
          </Section>
        </div>
        <div className="mt-6">
          <DemoNote>
            Für eine echte Support-Anfrage brauchst du einen eingerichteten
            Support-Kanal. Diese Demo bietet ausschließlich eine lokale Vorschau
            mit ausdrücklicher Zustimmung.
          </DemoNote>
        </div>
      </main>
    </PublicLayout>
  );
}
export function LegalPage() {
  return (
    <PublicLayout>
      <main className="max-w-3xl mx-auto px-5 sm:px-9 py-12">
        <PageHeader
          eyebrow="Transparent von Anfang an"
          title="Rechtliche Hinweise"
          description="Entwurf für die Produktdemo. Keine freigegebenen Rechtstexte für einen öffentlichen Produktbetrieb."
        />
        <div className="stack">
          <DemoNote>
            Diese Inhalte sind weder rechtlich geprüft noch als Impressum,
            Datenschutzerklärung oder Vertragsbedingungen zertifiziert. Vor
            einem öffentlichen Launch müssen Verantwortliche und verbindliche
            Rechtstexte ergänzt und geprüft werden.
          </DemoNote>
          <Section
            title={
              demoMode ? "Was diese Demo macht" : "Was diese Vorschau macht"
            }
          >
            <p className="muted text-sm leading-relaxed mb-0">
              {demoMode
                ? "Dispatch zeigt einen Content-Workflow mit lokal gespeicherten Beispieldaten. Es gibt keine Live-Authentifizierung, KI-Anbindung, Zahlungen, E-Mails oder Veröffentlichungen an Social-Plattformen. Eine Demo-Registrierung begründet kein Kundenkonto oder Vertragsverhältnis."
                : "Dispatch verarbeitet Konto, Sitzungen, Workspace-Zugehörigkeit und Profil in Convex mit Better Auth. Verifikations- und Reset-E-Mails werden über Resend versendet. Social-Publishing, KI und Zahlungen sind noch nicht verfügbar."}
            </p>
          </Section>
          <Section
            title={
              demoMode ? "Lokale Daten & Speicherung" : "Daten & Speicherung"
            }
          >
            <p className="muted text-sm leading-relaxed">
              {demoMode
                ? "Profileinstellungen, Entwürfe, Medien-Metadaten, Team-Demo und Nutzungspräferenzen werden im lokalen Speicher deines Browsers abgelegt. Es werden keine Passwörter oder OAuth-Tokens gespeichert. Eingegebene Texte bleiben in dieser lokalen Anwendung. Browserdaten löschen entfernt diese Speicherung."
                : "Kontodaten und Workspace-Profile werden serverseitig gespeichert. Better Auth verwaltet Passwort-Hashes und Sitzungen. Der Browser speichert für die Cross-Domain-Anmeldung ein Sitzungscookie im lokalen Speicher; Browserdaten löschen meldet dich lokal ab und löscht keine Cloud-Daten."}
            </p>
            <p className="muted text-sm leading-relaxed mb-0">
              {demoMode
                ? "Ein JSON-Export ist unter Einstellungen → Daten & Sicherheit möglich. Lokale Workspace-Löschung und Kontodaten-Löschung benötigen eine ausdrückliche Bestätigung. Veröffentlichtes auf externen Plattformen wird nicht gelöscht."
                : "Export, Kontolöschung und weitere Datenverwaltung werden noch angebunden. Es wurden keine Social-Beiträge veröffentlicht."}
            </p>
          </Section>
          <Section title="Quellen & Rechte">
            <p className="muted text-sm leading-relaxed mb-0">
              Verwende ausschließlich Inhalte, die du verwenden darfst. Keine
              privaten Zugangslinks, Geheimnisse oder personenbezogenen Daten
              einfügen. Privater Repository-Kontext benötigt gesonderte
              Zustimmung. Er darf nicht automatisch zu öffentlichem Inhalt
              werden. Quellen und Zugriffe lassen sich im jeweiligen Workspace
              widerrufen.
            </p>
          </Section>
          <Section title="Inhalte, Scores & Verantwortung">
            <p className="muted text-sm leading-relaxed mb-0">
              Demo-Scores und Beispiele sind Orientierungshilfen. Sie
              garantieren weder Reichweite noch Umsatz oder rechtliche
              Zulässigkeit eines Beitrags. Prüfe Quellen, Rechte, Aussagen und
              Freigaben selbst vor einer Veröffentlichung. Automatisierung ist
              standardmäßig ausgeschaltet.
            </p>
          </Section>
          <Section title="Vor einem öffentlichen Launch erforderlich">
            <ul className="space-y-3 text-sm muted leading-relaxed">
              <li>
                Verantwortliche Anbieterangaben und echte Kontaktmöglichkeiten.
              </li>
              <li>
                Geprüfte Datenschutzhinweise mit tatsächlichen Verarbeitungen,
                Anbietern, Aufbewahrungsfristen und Betroffenenrechten.
              </li>
              <li>
                Geprüfte Nutzungs- und Zahlungsbedingungen für die tatsächlichen
                Leistungen.
              </li>
              <li>
                Dokumentierte OAuth-Berechtigungen, Datenflüsse und
                Löschprozesse der angebundenen Plattformen.
              </li>
            </ul>
          </Section>
        </div>
        <Link
          to="/help"
          className="text-sm font-semibold inline-flex gap-2 items-center mt-8"
        >
          Weitere Fragen? Zur Hilfe
          <ArrowRight size={15} />
        </Link>
      </main>
    </PublicLayout>
  );
}
