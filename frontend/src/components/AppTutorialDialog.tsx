import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Languages, Rocket, Layout, BarChart2, Settings2, Brain, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useLanguage, type LanguageCode } from "../context/LanguageContext";

/* ─────────────────────────────────────────────────────────────────────── */
/*  TYPES                                                                  */
/* ─────────────────────────────────────────────────────────────────────── */

type TutorialStep = {
  title: string;
  body: string;
  icon?: React.ReactNode;
};

type TutorialCopy = {
  languageTitle: string;
  languageHint: string;
  start: string;
  title: string;
  close: string;
  back: string;
  next: string;
  finish: string;
  skip: string;
  restart: string;
  progress: string;
  steps: TutorialStep[];
};

/* ─────────────────────────────────────────────────────────────────────── */
/*  TUTORIAL CONTENT – DE / EN                                             */
/* ─────────────────────────────────────────────────────────────────────── */

const TUTORIAL: Record<LanguageCode, TutorialCopy> = {
  de: {
    languageTitle: "Tutorial-Sprache wählen",
    languageHint: "Dieses Tutorial führt dich durch alle Bereiche von ODIN – vom Dashboard über Schichtplanung und Ticketlogik bis hin zu Automation und Administration.",
    start: "Tutorial starten",
    title: "ODIN Produkt-Tour",
    close: "Schließen",
    back: "Zurück",
    next: "Weiter",
    finish: "Fertig",
    skip: "Überspringen",
    restart: "Erneut starten",
    progress: "Schritt",
    steps: [
      {
        title: "Was ist ODIN?",
        body: "ODIN steht für **Operations Dispatching and Intelligence Node**. Es ist die zentrale Plattform, über die dein Team den gesamten operativen Alltag steuert – von Schichtplanung über Ticketverteilung bis hin zur automatisierten Zuweisung.\n\nODIN wurde entwickelt, um Transparenz, Nachvollziehbarkeit und Automatisierung in den Betrieb zu bringen. Statt verstreuter Tabellen, E-Mails und Einzelsysteme bietet ODIN eine einzige, teamweite Oberfläche, in der alle relevanten Informationen zusammenlaufen.\n\n**Was ODIN heute kann:**\n• Echtzeit-Dashboard mit Ticket- und Schichtüberblick\n• Automatische und manuelle Ticketzuweisung\n• Schichtplanung mit Abwesenheiten, Feiertagen und Warnungen\n• Teams-Benachrichtigungen für operative Events\n• Shadow Run und Dry Run für sichere Automation\n• TV-Dashboard für Teammonitore\n• Rollenbasierte Zugriffskontrolle\n\n**Die Vision:** ODIN soll die Brücke zwischen operativer Exzellenz und datengetriebener Entscheidungsfindung bilden – ein System, das nicht nur reagiert, sondern vorausschauend unterstützt.",
      },
      {
        title: "Navigation und Aufbau",
        body: "Die App ist in drei Hauptbereiche gegliedert:\n\n**Header (oben):** Zeigt den Echtzeit-Status deines Systems – Crawler-Updates, aktive Tickets, Schichtplan-Upload, Teams-Status und ODIN-Logik-Status. Hier findest du auch Schnellzugriffe, Spracheinstellungen und dein Nutzerprofil.\n\n**Sidebar (links):** Die Hauptnavigation mit allen Reitern. Gruppen wie Dashboard, Schichtplan und Protokoll lassen sich auf- und zuklappen. Icons zeigen den Bereich auch im kompakten Modus.\n\n**Hauptbereich (Mitte):** Der Inhalt des aktuell gewählten Reiters. Jede Seite ist eigenständig und bietet kontextbezogene Filter, Aktionen und Informationen.",
      },
      {
        title: "Dashboard",
        body: "Das Dashboard ist deine Startseite. Es zeigt eine Zusammenfassung der wichtigsten Betriebswerte:\n\n• **Aktive Tickets** nach Typ (Smart Hand, Trouble Ticket, Cross Connect)\n• **Letzte Aktivitäten** im Team\n• **Schichtplan-Status** und Besetzung\n• **Systemgesundheit** über die Metriken im Header\n\nÜber das Untermenü erreichst du die **Statistiken** mit detaillierten Diagrammen – Dispatch vs. Closed, Ticket-Typen-Verteilung, Commit-Gesundheit und Tagestrends. Außerdem den **Ticket-Audit** für lückenlose Nachverfolgbarkeit.",
      },
      {
        title: "Schichtplan und Wochenplanung",
        body: "**Schichtplan:** Hier siehst du die gesamte Monatsbesetzung. Jede Zelle zeigt den geplanten Mitarbeiter, Feiertage werden farblich markiert, Abwesenheiten sind sofort sichtbar. Neue Schichtpläne werden per Excel-Upload importiert.\n\n**Wochenplanung:** Ermöglicht die Feinsteuerung pro Tag und Person. Du legst Rollen fest, verschiebst Zuweisungen und siehst offene Lücken. Ideal für die kurzfristige Personalsteuerung.\n\n**Tipp:** Beide Bereiche reagieren auf Feiertage deines Bundeslandes und berücksichtigen hinterlegte Abwesenheiten automatisch.",
      },
      {
        title: "Tickets und Handover",
        body: "**Tickets:** Die zentrale Queue-Ansicht zeigt alle aktiven Tickets mit Status, Typ, Commit-Datum und zugewiesenem Bearbeiter. Filter nach Typ, Status oder Zeitraum helfen bei der Priorisierung.\n\n**Handover:** Dokumentiert die Schichtübergabe zwischen Teams. Offene Punkte, kritische Anmerkungen und Statusänderungen werden strukturiert erfasst – für eine lückenlose Schichtdokumentation.\n\n**Commit Compliance:** Zeigt, wie termintreu Tickets geschlossen werden. Überfällige Tickets werden sofort sichtbar gemacht.",
      },
      {
        title: "ODIN-Logik und Auto Assignment",
        body: "Dies ist das Herzstück der Automatisierung.\n\n**Dry Run:** Simuliert eine Zuweisung ohne tatsächliche Änderungen. Ideal zum Testen neuer Regeln.\n\n**Shadow Run:** Führt Zuweisungen im Hintergrund aus und protokolliert die Ergebnisse – ohne dass Tickets tatsächlich zugewiesen werden.\n\n**Live-Modus:** Aktiviert die vollautomatische Ticketzuweisung anhand definierter Regeln, Rotationslogik und Verfügbarkeit.\n\n**Runs & Logs** zeigen die Historie, **Entscheidungen** erklären jede einzelne Zuweisung, **Logikbaum** und **Zuweisungsfluss** visualisieren die Engine.\n\n**Wichtig:** Beginne immer mit Dry Run → Shadow Run → erst dann Live aktivieren.",
      },
      {
        title: "Teams Center",
        body: "Hier konfigurierst du die Microsoft Teams-Integration.\n\n**Kanalversand:** Nachrichten an Teams-Kanäle (z.B. bei Schichtänderungen oder neuen Tickets).\n\n**Persönliche Nachrichten:** Direkte Benachrichtigungen an einzelne Teammitglieder über den Graph-Bot.\n\n**Diagnostik:** Das Fehlercenter zeigt nicht nur ob, sondern warum die Teams-Integration nicht funktioniert – inklusive Webhook-Status, Graph-Rechte und Token-Prüfung.\n\n**Event-Konfiguration:** Jedes ODIN-Event (z.B. Ticketzuweisung, Schichtplanänderung) kann einzeln aktiviert, deaktiviert und konfiguriert werden.",
      },
      {
        title: "TV Dashboard und Protokoll",
        body: "**TV Dashboard:** Eine für Monitore optimierte Vollbildansicht mit den wichtigsten Kennzahlen. Ideal für Teamräume oder Leitstellen. Es übernimmt automatisch die aktuelle Sprache.\n\n**Protokoll:** Zeigt die chronologische Historie aller Systemaktionen – wer hat wann was gemacht. Teams-Benachrichtigungen und automatisierte Zuweisungen werden ebenfalls hier protokolliert.\n\n**Automated Assignment Log:** Spezielle Ansicht für alle Aktionen der Zuweisungsengine.",
      },
      {
        title: "Schichtplaner (Kontrollzentrum)",
        body: "Das Schichtplan-Kontrollzentrum ist die Admin-Oberfläche für die strategische Schichtplanung.\n\n• **Draft-Generierung:** Erstellt automatisch Schichtplan-Entwürfe basierend auf Verfügbarkeit, Präferenzen und Regeln.\n• **Aktivierung:** Macht einen Entwurf zum aktiven Schichtplan.\n• **Regelkonfiguration:** Definiert Schichtfolgen, Mindestbesetzung und Sperrzeiten.\n\nDiese Funktion ist besonders für Planungsverantwortliche relevant.",
      },
      {
        title: "Administration und Einstellungen",
        body: "**User Management:** Verwaltet Benutzer, Rollen und Zugriffsrechte. Jede Seite kann individuell pro Rolle oder Abteilung freigeschaltet werden.\n\n**Admin Settings:** Zentrale Konfiguration für Schwellenwerte, Feature Toggles, Crawler-Einstellungen und Systemparameter.\n\n**Persönliche Einstellungen:** Sprache, Theme (Hell/Dunkel), Benachrichtigungspräferenzen und Schichtplan-Wünsche.\n\n**Tipp:** Deine Spracheinstellung wird serverseitig gespeichert und überall in ODIN übernommen – auch im TV Dashboard und im Tutorial.",
      },
      {
        title: "Statistiken und Metriken",
        body: "**Team-Statistiken:** Zeigt Dispatch- und Closed-Trends, Ticket-Typen-Verteilung, Status-Distribution und Commit-Gesundheit als interaktive Diagramme.\n\n**Systemmetriken:** Im Header-Popup findest du CPU, RAM, DB-Speicher, aktive Verbindungen, Online-User und Ticketlast.\n\n**Hinweis:** Wenn Statistiken nicht laden, wird jetzt eine klare Fehlermeldung mit Retry-Funktion angezeigt – statt eines stillen Fehlers.",
      },
      {
        title: "Zukunft und Vision",
        body: "ODIN wird kontinuierlich weiterentwickelt. Die Roadmap umfasst:\n\n• **Prädiktive Planung:** KI-gestützte Vorhersage von Ticketaufkommen und Personalengpässen\n• **Erweiterte Automation:** Mehrstufige Zuweisungslogik mit Eskalationsregeln\n• **Cross-Site-Koordination:** Standortübergreifende Schichtplanung und Ressourcenteilung\n• **Reporting Engine:** Automatische Berichte für Management und Compliance\n• **Mobile Ansicht:** Optimierte Oberfläche für unterwegs\n\nDas Ziel: **ODIN als Single Point of Truth** für den gesamten operativen Betrieb – transparent, automatisiert und nachvollziehbar.\n\nVielen Dank, dass du ODIN nutzt. Bei Fragen oder Feedback nutze den Feedback-Button in der App.",
      },
    ],
  },
  en: {
    languageTitle: "Choose tutorial language",
    languageHint: "This tutorial walks you through every area of ODIN – from the dashboard through shift planning and ticket logic to automation and administration.",
    start: "Start tutorial",
    title: "ODIN Product Tour",
    close: "Close",
    back: "Back",
    next: "Next",
    finish: "Finish",
    skip: "Skip",
    restart: "Restart",
    progress: "Step",
    steps: [
      {
        title: "What is ODIN?",
        body: "ODIN stands for **Operations Dispatching and Intelligence Node**. It is the central platform through which your team manages the entire operational day – from shift planning through ticket distribution to automated assignment.\n\nODIN was developed to bring transparency, traceability, and automation to operations. Instead of scattered spreadsheets, emails, and siloed systems, ODIN offers a single, team-wide interface where all relevant information converges.\n\n**What ODIN can do today:**\n• Real-time dashboard with ticket and shift overview\n• Automatic and manual ticket assignment\n• Shift planning with absences, public holidays, and warnings\n• Teams notifications for operational events\n• Shadow run and dry run for safe automation\n• TV dashboard for team monitors\n• Role-based access control\n\n**The vision:** ODIN aims to bridge operational excellence with data-driven decision-making – a system that not only reacts but proactively supports.",
      },
      {
        title: "Navigation and structure",
        body: "The application is organised into three main areas:\n\n**Header (top):** Shows the real-time status of your system – crawler updates, active tickets, shift plan upload, Teams status, and ODIN logic status. You will also find quick links, language settings, and your user profile here.\n\n**Sidebar (left):** The main navigation with all tabs. Groups such as Dashboard, Shift Plan, and Log can be collapsed and expanded. Icons indicate the area even in compact mode.\n\n**Main area (centre):** The content of the currently selected tab. Each page is self-contained and provides contextual filters, actions, and information.",
      },
      {
        title: "Dashboard",
        body: "The dashboard is your home page. It shows a summary of the most important operational metrics:\n\n• **Active tickets** by type (smart hand, trouble ticket, cross connect)\n• **Recent activity** across the team\n• **Shift plan status** and staffing\n• **System health** via the metrics in the header\n\nVia the sub-menu you can access **Statistics** with detailed charts – dispatch vs. closed, ticket type distribution, commit health, and daily trends. You will also find the **Ticket Audit** for complete traceability.",
      },
      {
        title: "Shift plan and week planning",
        body: "**Shift plan:** Here you see the entire monthly staffing. Each cell shows the planned employee; public holidays are colour-coded and absences are immediately visible. New shift plans are imported via Excel upload.\n\n**Week planning:** Allows fine-grained control per day and person. You assign roles, move allocations, and see open gaps. Ideal for short-term staffing adjustments.\n\n**Tip:** Both areas respond to the public holidays of your federal state and automatically take stored absences into account.",
      },
      {
        title: "Tickets and handover",
        body: "**Tickets:** The central queue view shows all active tickets with status, type, commit date, and assigned engineer. Filters by type, status, or time period help with prioritisation.\n\n**Handover:** Documents the shift handover between teams. Open items, critical notes, and status changes are captured in a structured way – for complete shift documentation.\n\n**Commit compliance:** Shows how punctually tickets are closed. Overdue tickets are immediately highlighted.",
      },
      {
        title: "ODIN logic and auto assignment",
        body: "This is the heart of automation.\n\n**Dry run:** Simulates an assignment without making actual changes. Ideal for testing new rules.\n\n**Shadow run:** Executes assignments in the background and logs the results – without actually assigning tickets.\n\n**Live mode:** Activates fully automatic ticket assignment based on defined rules, rotation logic, and availability.\n\n**Runs & logs** show the history, **Decisions** explain every individual assignment, **Logic tree** and **Assignment flow** visualise the engine.\n\n**Important:** Always start with dry run → shadow run → only then activate live mode.",
      },
      {
        title: "Teams centre",
        body: "Here you configure the Microsoft Teams integration.\n\n**Channel delivery:** Messages to Teams channels (e.g. on shift changes or new tickets).\n\n**Personal messages:** Direct notifications to individual team members via the Graph bot.\n\n**Diagnostics:** The error centre shows not only whether but why the Teams integration is failing – including webhook status, Graph permissions, and token checks.\n\n**Event configuration:** Every ODIN event (e.g. ticket assignment, shift plan change) can be individually enabled, disabled, and configured.",
      },
      {
        title: "TV dashboard and log",
        body: "**TV dashboard:** A fullscreen view optimised for monitors with the most important KPIs. Ideal for team rooms or operations centres. It automatically adopts the current language.\n\n**Log:** Shows the chronological history of all system actions – who did what and when. Teams notifications and automated assignments are also logged here.\n\n**Automated assignment log:** A dedicated view for all actions of the assignment engine.",
      },
      {
        title: "Shift planner (control centre)",
        body: "The shift plan control centre is the admin interface for strategic shift planning.\n\n• **Draft generation:** Automatically creates shift plan drafts based on availability, preferences, and rules.\n• **Activation:** Promotes a draft to the active shift plan.\n• **Rule configuration:** Defines shift sequences, minimum staffing, and blocked periods.\n\nThis feature is particularly relevant for planners and team leads.",
      },
      {
        title: "Administration and settings",
        body: "**User management:** Manages users, roles, and access rights. Each page can be individually enabled per role or department.\n\n**Admin settings:** Central configuration for thresholds, feature toggles, crawler settings, and system parameters.\n\n**Personal settings:** Language, theme (light/dark), notification preferences, and shift plan wishes.\n\n**Tip:** Your language setting is stored server-side and applied throughout ODIN – including the TV dashboard and this tutorial.",
      },
      {
        title: "Statistics and metrics",
        body: "**Team statistics:** Shows dispatch and closed trends, ticket type distribution, status distribution, and commit health as interactive charts.\n\n**System metrics:** In the header popup you will find CPU, RAM, DB storage, active connections, online users, and ticket load.\n\n**Note:** When statistics fail to load, a clear error message with a retry button is now shown – instead of a silent failure.",
      },
      {
        title: "Future and vision",
        body: "ODIN is continuously evolving. The roadmap includes:\n\n• **Predictive planning:** AI-powered forecasting of ticket volumes and staffing shortages\n• **Extended automation:** Multi-stage assignment logic with escalation rules\n• **Cross-site coordination:** Cross-location shift planning and resource sharing\n• **Reporting engine:** Automated reports for management and compliance\n• **Mobile view:** Optimised interface for on-the-go access\n\nThe goal: **ODIN as the single point of truth** for the entire operational business – transparent, automated, and traceable.\n\nThank you for using ODIN. For questions or feedback, use the feedback button in the app.",
      },
    ],
  },
};

/* ─────────────────────────────────────────────────────────────────────── */
/*  MARKDOWN-LIGHT RENDERER                                                */
/* ─────────────────────────────────────────────────────────────────────── */

function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.trim() === "") return <div key={i} className="h-1" />;
        // bullet
        if (/^[•\-]\s/.test(line)) {
          const content = line.replace(/^[•\-]\s*/, "");
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-sky-400 mt-0.5 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
            </div>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />;
      })}
    </div>
  );
}

function boldify(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>');
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  STEP ICONS                                                             */
/* ─────────────────────────────────────────────────────────────────────── */

const STEP_ICONS = [
  <Rocket className="h-5 w-5 text-amber-400" />,
  <Layout className="h-5 w-5 text-sky-400" />,
  <BarChart2 className="h-5 w-5 text-indigo-400" />,
  <BookOpen className="h-5 w-5 text-emerald-400" />,
  <BookOpen className="h-5 w-5 text-rose-400" />,
  <Brain className="h-5 w-5 text-violet-400" />,
  <BookOpen className="h-5 w-5 text-cyan-400" />,
  <Eye className="h-5 w-5 text-amber-400" />,
  <Settings2 className="h-5 w-5 text-slate-400" />,
  <Settings2 className="h-5 w-5 text-sky-400" />,
  <BarChart2 className="h-5 w-5 text-emerald-400" />,
  <Rocket className="h-5 w-5 text-amber-400" />,
];

/* ─────────────────────────────────────────────────────────────────────── */
/*  COMPONENT                                                              */
/* ─────────────────────────────────────────────────────────────────────── */

export function AppTutorialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { language, languages } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setSelectedLanguage(null);
      setStepIndex(0);
    }
  }, [open]);

  const effectiveLanguage = selectedLanguage || language;
  const copy = TUTORIAL[effectiveLanguage];
  const languageOption = useMemo(
    () => languages.find((entry) => entry.code === effectiveLanguage),
    [effectiveLanguage, languages]
  );

  const currentStep = copy.steps[stepIndex];
  const isLast = stepIndex === copy.steps.length - 1;
  const totalSteps = copy.steps.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-400" />
            {copy.title}
          </DialogTitle>
        </DialogHeader>

        {selectedLanguage === null ? (
          /* ── LANGUAGE SELECTION ── */
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Languages className="h-4 w-4 text-sky-300" />
                {copy.languageTitle}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {copy.languageHint}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {languages.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className="rounded-2xl border border-white/10 bg-white/3 px-5 py-4 text-left transition hover:border-sky-300/30 hover:bg-sky-500/10 group"
                  onClick={() => {
                    setSelectedLanguage(option.code);
                    setStepIndex(0);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{option.flag}</span>
                    <div>
                      <div className="text-sm font-semibold text-slate-100 group-hover:text-sky-200 transition-colors">
                        {option.nativeLabel}
                      </div>
                      <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {option.shortLabel}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── STEP CONTENT ── */
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1" dir="ltr">
            {/* Step header */}
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              {STEP_ICONS[stepIndex % STEP_ICONS.length]}
              <span>{copy.progress} {stepIndex + 1} / {totalSteps}</span>
            </div>

            {/* Step title */}
            <div className="text-xl font-semibold text-slate-100">
              {currentStep.title}
            </div>

            {/* Step content */}
            <div className="text-sm leading-7 text-slate-300">
              <RichText text={currentStep.body} />
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-1.5 pt-2">
              {copy.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIndex(i)}
                  className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer hover:opacity-80 ${
                    i <= stepIndex ? "bg-sky-400" : "bg-white/10"
                  } ${i === stepIndex ? "shadow-[0_0_6px_rgba(56,189,248,0.5)]" : ""}`}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-3 sm:justify-between flex-shrink-0">
          {selectedLanguage === null ? (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {copy.close}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (stepIndex === 0) {
                      setSelectedLanguage(null);
                      return;
                    }
                    setStepIndex((c) => Math.max(0, c - 1));
                  }}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {copy.back}
                </Button>
                {stepIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-200"
                    onClick={() => onOpenChange(false)}
                  >
                    {copy.skip}
                  </Button>
                )}
              </div>
              <Button
                onClick={() => {
                  if (isLast) {
                    onOpenChange(false);
                    return;
                  }
                  setStepIndex((c) => Math.min(totalSteps - 1, c + 1));
                }}
              >
                {isLast ? copy.finish : copy.next}
                {!isLast ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
