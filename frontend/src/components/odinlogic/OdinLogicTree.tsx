/* ------------------------------------------------ */
/* ODIN LOGIC TREE – Assignment decision tree       */
/* Visual tree of the current assignment pipeline   */
/* ------------------------------------------------ */

import { useState } from "react";
import { ChevronRight, ChevronDown, Shield, Users, Filter, ArrowDownUp, Zap, AlertTriangle, Ban, GitBranch, HelpCircle } from "lucide-react";
import { InfoTooltip } from "../ui/InfoTooltip";

/* ---- Tree Node Types ---- */

interface TreeNode {
  id: string;
  label: string;
  description: string;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  type: "gate" | "filter" | "rule" | "action" | "info";
  children?: TreeNode[];
}

/* ---- Static tree representing the current assignment logic ---- */

const LOGIC_TREE: TreeNode[] = [
  {
    id: "crawler-guard",
    label: "Crawler-Daten Prüfung",
    description: "Prüft die Aktualität der Ticketdaten aus dem Jarvis-Crawler. Veraltete Daten führen zum sofortigen Abbruch des gesamten Laufs.",
    detail: (
      <>
        <p><strong>Was wird geprüft:</strong> Zeitstempel des letzten erfolgreichen Crawler-Imports. Die Differenz zur aktuellen Uhrzeit wird mit dem konfigurierten Schwellenwert verglichen.</p>
        <p><strong>Warum:</strong> Die ODIN-Engine trifft Zuweisungsentscheidungen auf Basis der Ticketdaten im System. Wenn diese Daten nicht aktuell sind, könnten bereits abgeschlossene, manuell zugewiesene oder stornierte Tickets fälschlich erneut zugewiesen werden.</p>
        <p><strong>Bei Überschreitung:</strong> Der <em>gesamte</em> Lauf wird sofort abgebrochen — kein einzelnes Ticket wird verarbeitet. Der Lauf wird als „crawler_stale“ protokolliert. Dies ist die einzige globale Schutzregel, die den kompletten Lauf blockiert.</p>
        <p><strong>Konfiguration:</strong> Der Schwellenwert ist unter Einstellungen → „Crawler Max-Alter“ konfigurierbar.</p>
      </>
    ),
    type: "gate",
    icon: <Shield className="w-4 h-4 text-red-400" />,
    children: [
      {
        id: "crawler-stale",
        label: "Daten veraltet → Engine stoppt",
        description: "Wenn die Crawler-Daten älter als der konfigurierte Schwellenwert sind, wird der gesamte Zuweisungslauf abgebrochen. Kein Ticket wird verarbeitet.",
        detail: (
          <>
            <p>Diese harte Schutzregel verhindert Fehlzuweisungen auf veralteter Datenbasis. Der Lauf wird als „failed“ mit dem Grund „crawler_stale“ gespeichert.</p>
            <p>Mögliche Ursachen: Crawler ausgefallen, Netzwerkproblem, Jarvis-System nicht erreichbar, Ingest-Endpunkt blockiert.</p>
          </>
        ),
        type: "action",
      },
      {
        id: "crawler-fresh",
        label: "Daten aktuell → weiter zur Ticket-Verarbeitung",
        description: "Die Crawler-Daten liegen innerhalb des erlaubten Alters. Die Engine fährt mit dem Laden und Normalisieren der Tickets fort.",
        type: "info",
      },
    ],
  },
  {
    id: "ticket-load",
    label: "Tickets laden & normalisieren",
    description: "Aktive Tickets werden aus der queue_items-Tabelle geladen und über umfangreiche Alias-Tabellen in ein einheitliches internes Format normalisiert.",
    detail: (
      <>
        <p><strong>Normalisierung:</strong> Jedes Feld wird einzeln gemappt — Tickettyp (20+ Varianten), Status (13+ Varianten), Priorität (15+ Varianten), Site, Handover-Typ, System-Name. Unbekannte Werte werden als „Unknown“ klassifiziert, nie still ignoriert.</p>
        <p><strong>Datenbasis:</strong> Tabelle <code>queue_items</code>, gefüllt durch den Jarvis-Crawler. Enthält SmartHands, TroubleTickets, CrossConnect-Installationen und weitere Ticketarten.</p>
        <p><strong>Limitierung:</strong> Maximal die unter „Max. Tickets pro Run“ konfigurierte Anzahl wird geladen.</p>
      </>
    ),
    type: "filter",
    icon: <Filter className="w-4 h-4 text-blue-400" />,
    children: [
      {
        id: "handover-routing",
        label: "Handover-Routing",
        description: "Tickets mit einem Handover-Kennzeichen werden speziell geroutet: Workload-Handovers laufen normal weiter, Terminierte werden zu Scheduled, Other-Teams gehen nur an Dispatcher.",
        detail: (
          <>
            <p><strong>Workload Handover:</strong> Das Ticket bleibt als normales offenes Ticket im System und wird in der nächsten Schicht wie ein neues Ticket behandelt. Kein Typwechsel.</p>
            <p><strong>Terminiert Handover:</strong> Das Ticket wird intern als „Scheduled“ (Prio-Tier 4) behandelt. Der Handover-Typ signalisiert, dass eine terminierte Übergabe erwartet wird.</p>
            <p><strong>Other Teams Handover:</strong> Dieses Ticket darf <em>ausschließlich</em> dem aktiven Dispatcher zugewiesen werden. Alle normalen Techniker werden sofort als Kandidaten ausgeschlossen. Diese Regel ist hart kodiert und nicht deaktivierbar.</p>
          </>
        ),
        type: "rule",
        children: [
          { id: "ho-workload", label: "Workload Handover → normales Ticket", description: "Wird als reguläres Ticket behandelt und durchläuft die gesamte Pipeline. Die nächste Schicht übernimmt die Bearbeitung.", type: "info" },
          { id: "ho-terminiert", label: "Terminiert Handover → Scheduled (Tier 4)", description: "Wird in den Typ „Scheduled“ konvertiert und erhält damit Prioritätsstufe 4. Wird zeitlich termingerecht eingeplant.", type: "info" },
          { id: "ho-other-teams", label: "Other Teams Handover → nur Dispatcher", description: "Wird ausschließlich dem Dispatcher der aktiven Schicht zugeordnet. Kein normaler Techniker kann dieses Ticket erhalten. Dies stellt sicher, dass teamübergreifende Kommunikation zentral koordiniert wird.", type: "action" },
        ],
      },
      {
        id: "relevance-check",
        label: "Relevanzprüfung",
        description: "Tickets werden auf grundsätzliche Zuweisungsfähigkeit geprüft. Geschlossene, nicht unterstützte oder manuell blockierte Tickets werden frühzeitig als „nicht relevant“ markiert.",
        detail: (
          <>
            <p><strong>Ausschlusskriterien:</strong></p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Status ist „closed“ oder „cancelled“</li>
              <li>Status ist nicht in der Liste aktiver Status</li>
              <li>Ticket hat einen manuellen Hold (manualHold = true)</li>
              <li>autoAssignable-Flag ist false</li>
              <li>Tickettyp nicht in der Liste unterstützter Typen</li>
              <li>Commit-Time liegt außerhalb des Planungsfensters</li>
              <li>Pflichtfelder fehlen (z. B. keine Ticket-ID)</li>
            </ul>
            <p><strong>Ergebnis:</strong> Nicht-relevante Tickets werden als „not_relevant“ protokolliert und übersprungen.</p>
          </>
        ),
        type: "filter",
      },
    ],
  },
  {
    id: "priority-sort",
    label: "Priorisierung (6 Stufen)",
    description: "Alle relevanten Tickets werden deterministisch nach einem festen Stufensystem sortiert. Die Reihenfolge bestimmt, welches Ticket zuerst Kandidaten zugeteilt bekommt.",
    detail: (
      <>
        <p><strong>Wichtig:</strong> Die Sortierung erfolgt <em>vor</em> der eigentlichen Zuweisung. Ein Ticket in Tier 1 wird also vor einem Ticket in Tier 3 verarbeitet und kann den besten Kandidaten beanspruchen.</p>
        <p><strong>Innerhalb eines Tiers:</strong> Sortierung nach Restzeit (geringste zuerst), dann nach Erstellungszeitpunkt (älteste zuerst), dann nach Ticket-ID (lexikographisch).</p>
        <p><strong>Fehlende Restzeit:</strong> Tickets ohne Commit-Time werden ans Ende ihres Tiers sortiert (Restzeit = ∞).</p>
      </>
    ),
    type: "rule",
    icon: <ArrowDownUp className="w-4 h-4 text-amber-400" />,
    children: [
      { id: "tier-1", label: "Tier 1: Trouble Ticket High / Critical", description: "Höchste Priorität. Kritische Störungen, die sofortige Bearbeitung erfordern. Critical wird vor High eingestuft.", detail: <p>TT-High wird vom Crawler mit einer hohen Dringlichkeit importiert. Diese Tickets werden immer zuerst zugeteilt, da sie meistens mit SLA-Verletzungen oder Kundenausfällen verbunden sind.</p>, type: "info" },
      { id: "tier-2", label: "Tier 2: Trouble Ticket Medium", description: "Zweithöchste Priorität. Störungen mit mittlerer Dringlichkeit, die zeitnah, aber nicht sofort bearbeitet werden müssen.", type: "info" },
      { id: "tier-3", label: "Tier 3: KPI-Queues (Smart Hands, Cross Connect)", description: "Die Hauptmasse der operativen Tickets. Sortiert nach geringster Restlaufzeit — wer am nächsten am Commit ist, wird zuerst zugewiesen.", detail: <p>Diese Tickets haben eine konkrete Commit-Time und werden nach verbleibender Restzeit priorisiert. Ein SmartHands-Ticket mit 2h Restzeit wird vor einem mit 12h Restzeit bearbeitet.</p>, type: "info" },
      { id: "tier-4", label: "Tier 4: Scheduled Tickets", description: "Terminierte Tickets, einschließlich terminierter Handovers. Werden nach geplantem Startzeitpunkt sortiert.", type: "info" },
      { id: "tier-5", label: "Tier 5: Trouble Ticket Low", description: "Trouble Tickets mit niedriger Priorität. Werden erst zugewiesen, wenn höherpriorisierte Tickets versorgt sind.", type: "info" },
      { id: "tier-6", label: "Tier 6: Alle übrigen Tickets", description: "Restliche Tickets, die keinem oberen Tier zugeordnet werden konnten. Werden nach Restzeit und Alter sortiert.", type: "info" },
    ],
  },
  {
    id: "per-ticket",
    label: "Pro-Ticket-Verarbeitung",
    description: "Jedes Ticket wird einzeln und sequenziell in Prioritätsreihenfolge durch die vollständige Zuweisungs-Pipeline verarbeitet. Frühere Zuweisungen beeinflussen die Kandidatenlage späterer Tickets.",
    detail: (
      <>
        <p><strong>Sequenziell:</strong> Ticket für Ticket, in der oben festgelegten Prioritätsreihenfolge. Ein zugewiesener Mitarbeiter steht dem nächsten Ticket eventuell nicht mehr zur Verfügung (erhöhte Auslastung).</p>
        <p><strong>Ergebnisse pro Ticket:</strong> assigned (zugewiesen), manual_review (an Dispatcher weitergeleitet), no_candidate (kein geeigneter Kandidat), not_relevant (Vorprüfung), blocked (manuell blockiert), error (Verarbeitungsfehler).</p>
      </>
    ),
    type: "gate",
    icon: <Zap className="w-4 h-4 text-indigo-400" />,
    children: [
      {
        id: "override-check",
        label: "Override-Prüfung",
        description: "Prüft, ob manuelle Eingriffe für dieses Ticket existieren. Overrides haben absoluten Vorrang vor der automatischen Logik.",
        detail: (
          <>
            <p><strong>force_assign:</strong> Ticket wird direkt der angegebenen Person zugewiesen, ohne weitere Prüfungen.</p>
            <p><strong>force_block:</strong> Ticket wird blockiert und nicht zugewiesen. Erscheint als „blocked“ im Log.</p>
            <p><strong>force_manual:</strong> Ticket wird sofort als „manual_review“ eingestuft und geht an den Dispatcher.</p>
            <p>Overrides können über den Bereich „Manuelle Zuweisung“ konfiguriert werden.</p>
          </>
        ),
        type: "filter",
      },
      {
        id: "exclusion-check",
        label: "Ausnahmeliste (System Name)",
        description: "Prüft, ob der System-Name des Tickets auf der manuellen Ausschlussliste steht. Ausgeschlossene Systeme werden immer an den Dispatcher weitergeleitet.",
        detail: (
          <>
            <p><strong>Zweck:</strong> Bestimmte Systeme (z. B. besonders sensible Kundenanlagen) sollen nie automatisch zugewiesen werden. Die Ausschlussliste wird im Reiter „Manuelle Zuweisung“ gepflegt.</p>
            <p><strong>Ergebnis:</strong> Treffer → „manual_review“. Kein Treffer → weiter zum nächsten Schritt.</p>
          </>
        ),
        type: "filter",
        icon: <Ban className="w-4 h-4 text-orange-400" />,
      },
      {
        id: "subtype-exclusion",
        label: "Ausnahmeliste (Subtype / Trouble Type)",
        description: "Prüft, ob der Customer-Trouble-Type des Tickets auf der Subtype-Ausschlussliste steht. Bestimmte Störungsarten sollen nur manuell bearbeitet werden.",
        detail: (
          <>
            <p><strong>Beispiel:</strong> EIS-Tickets (Erdungs-/Isolationsstörungen) können auf die Subtype-Ausschlussliste gesetzt werden, wenn sie spezielle Qualifikationen erfordern.</p>
            <p><strong>Pflege:</strong> Über den Reiter „Manuelle Zuweisung“ → Subtypes.</p>
          </>
        ),
        type: "filter",
        icon: <Ban className="w-4 h-4 text-orange-400" />,
      },
      {
        id: "eligibility",
        label: "Kandidaten-Filterung (9 Regeln)",
        description: "Alle verfügbaren Mitarbeiter der aktuellen Schicht werden gegen 9 Berechtigungsregeln geprüft. Nur wer alle 9 Regeln besteht, bleibt als Kandidat übrig.",
        detail: (
          <>
            <p><strong>Prinzip:</strong> Jede Regel ist ein Ja/Nein-Gate. Sobald eine Regel fehlschlägt, wird der Mitarbeiter für dieses Ticket <em>komplett</em> ausgeschlossen.</p>
            <p><strong>Reihenfolge:</strong> Die Regeln werden in fester Reihenfolge abgearbeitet. Die erste fehlgeschlagene Regel wird im Decision-Log als Ausschlussgrund vermerkt.</p>
          </>
        ),
        type: "filter",
        icon: <Users className="w-4 h-4 text-green-400" />,
        children: [
          { id: "elig-auto", label: "1. Automatisch zuweisbar?", description: "Der Mitarbeiter muss als autoAssignable markiert sein. Dies ist ein individuelles Flag pro Person, das über die Dispatcher-Ansicht gesteuert wird.", detail: <p>Wenn ein Mitarbeiter z. B. gerade eingearbeitet wird oder nur bestimmte Aufgaben übernimmt, kann dieses Flag deaktiviert werden.</p>, type: "rule" },
          { id: "elig-available", label: "2. Verfügbar (nicht blockiert)?", description: "Der Mitarbeiter darf nicht als „blocked“ markiert sein. Blockierung erfolgt typischerweise über den Dispatcher bei besonderen Situationen.", type: "rule" },
          { id: "elig-break", label: "3. Nicht in Pause?", description: "Mitarbeiter in einer aktiven Pause (onBreak = true) erhalten keine neuen Tickets. Die Pause wird über die Schichtansicht gesteuert.", type: "rule" },
          { id: "elig-absent", label: "4. Nicht abwesend?", description: "Abwesende Mitarbeiter (absent = true) werden ausgeschlossen. Abwesenheiten werden aus dem Schichtplan importiert.", type: "rule" },
          { id: "elig-shift", label: "5. Schicht aktiv?", description: "Der Mitarbeiter muss einer aktuell aktiven Schicht zugeordnet sein (shiftActive = true). Mitarbeiter außerhalb ihrer Schichtzeit erhalten keine Tickets.", type: "rule" },
          {
            id: "elig-role",
            label: "6. Rollenfilter",
            description: "Basierend auf der aktuellen Tagesrolle des Mitarbeiters wird geprüft, ob dieser Tickettyp für die Rolle zulässig ist.",
            detail: (
              <>
                <p><strong>Datenbasis:</strong> Die Tagesrolle kommt aus dem Wochenplan (weekplan_roles). Ist keine Rolle im Wochenplan hinterlegt, gilt die statische Standardrolle aus der Benutzerverwaltung.</p>
                <p><strong>Wochenplan hat Vorrang:</strong> Ermöglicht schichtspezifische Rollenzuweisungen, die sich täglich ändern können.</p>
              </>
            ),
            type: "rule",
            icon: <Shield className="w-4 h-4 text-purple-400" />,
            children: [
              { id: "role-dispatcher", label: "Dispatcher", description: "Erhält ausschließlich Other-Teams-Handovers. Keine normalen Tickets. Der Dispatcher koordiniert die Schicht und soll nicht durch eigene Tickets belastet werden.", type: "info" },
              { id: "role-large-order", label: "Large Order", description: "Mitarbeiter auf Large-Order-Projekten erhalten keine automatischen Zuweisungen. Sie sind bereits für Großaufträge reserviert.", type: "info" },
              { id: "role-projekt", label: "Projekt", description: "Projektmitarbeiter erhalten keine regulären Tickets. Sie arbeiten an geplanten Projekten, nicht an operativen Queues.", type: "info" },
              { id: "role-leads", label: "Leads", description: "Teamleiter erhalten keine automatischen Ticketzuweisungen. Ihre Rolle ist Koordination und Eskalation.", type: "info" },
              { id: "role-db", label: "Deutsche Börse", description: "Spezialrolle: Erhält nur Trouble Tickets und Cross Connects — letztere nur, wenn die Restlaufzeit mehr als 24 Stunden beträgt. Dies schützt zeitkritische deutsche-Börse-Aufträge.", type: "info" },
              { id: "role-cc", label: "Cross Connect", description: "Reine CC-Spezialisten: Erhalten ausschließlich Cross-Connect-Installationstickets. Keine SmartHands, keine TroubleTickets.", type: "info" },
              { id: "role-support", label: "Support", description: "Sekundäre Rolle — diese Mitarbeiter werden nicht als Ticket-Owner zugewiesen. Sie unterstützen bei Bedarf, erhalten aber keine eigenen Zuweisungen.", type: "info" },
              { id: "role-buddy", label: "Buddy / Neustarter", description: "Informelle Rollen für Einarbeitungssituationen. Werden aktuell wie normale Mitarbeiter behandelt — eine spätere Einschränkung ist vorgesehen.", type: "info" },
            ],
          },
          { id: "elig-site", label: "7. Site stimmt überein?", description: "Wenn die Site-Strenge aktiv ist, muss der Mitarbeiter der gleichen Site zugeordnet sein wie das Ticket. Bei inaktiver Site-Strenge wird diese Prüfung übersprungen.", detail: <p>Konfiguration unter Einstellungen → „Site-Strenge“. Deaktivierung ermöglicht site-übergreifende Zuweisung bei Unterbesetzung.</p>, type: "rule" },
          {
            id: "elig-purity",
            label: "8. Sortenreinheit (Queue Purity)",
            description: "Prüft, ob die aktuelle Ticketqueue des Mitarbeiters „rein“ ist — also ob das neue Ticket zum Typ der bestehenden Tickets passt.",
            detail: (
              <>
                <p><strong>Regel:</strong> SmartHands-Worker dürfen nur SmartHands erhalten. Cross-Connect-Worker nur Cross Connects. Trouble Tickets und Scheduled können gemischt werden.</p>
                <p><strong>Ausnahme:</strong> Bei aktiviertem Ressourcenmangel-Flag dürfen CC-Worker zusätzlich TroubleTickets erhalten — aber nur, wenn alle aktuellen CC-Tickets eine Restlaufzeit von mehr als 24 Stunden haben.</p>
              </>
            ),
            type: "rule",
            children: [
              { id: "purity-exception", label: "Ausnahme: Ressourcenmangel + CC > 24h", description: "Nur bei gesetztem Ressourcenmangel-Flag: CC-Worker darf Trouble Tickets erhalten, wenn alle seine aktiven CC-Tickets mehr als 24 Stunden Restlaufzeit haben.", detail: <p><strong>⚠ Offener Punkt:</strong> Die genaue fachliche Definition von „Ressourcenmangel“ ist nicht final spezifiziert. Die Aktivierung erfolgt manuell über die Einstellungen.</p>, type: "info" },
            ],
          },
          { id: "elig-resp", label: "9. Verantwortungsbereich?", description: "Wenn die Verantwortungsbereich-Strenge aktiv ist, muss der Worker dem gleichen Verantwortungsbereich zugeordnet sein wie das Ticket.", detail: <p>Konfiguration unter Einstellungen → „Verantwortungsbereich-Strenge“.</p>, type: "rule" },
        ],
      },
      {
        id: "worker-selection",
        label: "Worker-Auswahl (Tie-Breaking)",
        description: "Aus allen Kandidaten, die sämtliche Berechtigungsregeln bestanden haben, wird der finale Mitarbeiter über ein vierstufiges Tie-Breaking ermittelt.",
        detail: (
          <>
            <p><strong>Determinismus:</strong> Bei identischen Eingabedaten führt der Algorithmus immer zum selben Ergebnis. Die Auswahl ist vollständig reproduzierbar und auditierbar.</p>
            <p><strong>Kaskade:</strong> Jede Stufe wird nur herangezogen, wenn die vorherige zu einem Gleichstand führt.</p>
          </>
        ),
        type: "action",
        icon: <GitBranch className="w-4 h-4 text-cyan-400" />,
        children: [
          {
            id: "tb-grouping",
            label: "1. System-Gruppierung",
            description: "Bevorzugt Mitarbeiter, die bereits Tickets des gleichen Systems bearbeiten. Ziel: Effizienz durch gebündelte Vor-Ort-Arbeit.",
            detail: (
              <>
                <p><strong>SmartHands:</strong> Max. 3 SH-Tickets pro Person und System (konfigurierbar). Bei 3+ wird der Mitarbeiter für dieses System blockiert.</p>
                <p><strong>CrossConnect:</strong> Gruppierung nur, wenn die Restlaufzeiten ähnlich sind (Schwelle: 6 Stunden Differenz, konfigurierbar).</p>
                <p><strong>Score:</strong> 10 + Anzahl bestehender Tickets am gleichen System. Höherer Score = stärkere Präferenz.</p>
              </>
            ),
            type: "rule",
          },
          { id: "tb-purity", label: "2. Queue-Reinheit", description: "Mitarbeiter mit einer „reinen“ Queue (nur ein Tickettyp) werden gegenüber Mitarbeitern mit gemischter Queue bevorzugt. Fördert spezialisierte Bearbeitung.", type: "rule" },
          { id: "tb-workload", label: "3. Geringste Auslastung", description: "Bei weiterem Gleichstand wird der Mitarbeiter mit den wenigsten aktiven Tickets bevorzugt. Ziel: möglichst gleichmäßige Lastverteilung über die Schicht.", type: "rule" },
          { id: "tb-id", label: "4. Fallback Tie-Breaker", description: "Letzte Entscheidungsstufe: Entweder die niedrigste Worker-ID (stable-id, deterministisch) oder eine zufällige Auswahl, je nach Konfiguration.", detail: <p>Konfiguration unter Einstellungen → „Fallback Tie-Breaker“. Für maximale Nachvollziehbarkeit wird „stable-id“ empfohlen.</p>, type: "rule" },
        ],
      },
      {
        id: "decision-log",
        label: "Entscheidung protokollieren",
        description: "Das Ergebnis jeder Ticketentscheidung wird vollständig in der Datenbank gespeichert — inklusive aller geprüften Kandidaten, Ausschlussgründe und Bewertungen.",
        detail: (
          <>
            <p><strong>Protokollierte Informationen:</strong> Ticket-ID, gewählter Mitarbeiter, alle Kandidaten mit Scores, Ausschlussgründe pro Kandidat, angewandte Regeln, Tie-Breaker-Details, Zeitstempel.</p>
            <p><strong>Mögliche Ergebnisse:</strong></p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li><strong>assigned</strong> — Ticket erfolgreich einem Mitarbeiter zugewiesen</li>
              <li><strong>manual_review</strong> — Kein automatisch geeigneter Kandidat, Dispatcher muss entscheiden</li>
              <li><strong>no_candidate</strong> — Keine berechtigten Mitarbeiter verfügbar</li>
              <li><strong>not_relevant</strong> — Ticket hat die Relevanzprüfung nicht bestanden</li>
              <li><strong>blocked</strong> — Manuell blockiert durch Override</li>
              <li><strong>error</strong> — Verarbeitungsfehler bei diesem Ticket</li>
            </ul>
          </>
        ),
        type: "action",
      },
    ],
  },
];

/* ---- Tree Node Component ---- */

const TYPE_STYLES: Record<TreeNode["type"], string> = {
  gate: "border-red-500/30 bg-red-500/5",
  filter: "border-blue-500/30 bg-blue-500/5",
  rule: "border-amber-500/30 bg-amber-500/5",
  action: "border-green-500/30 bg-green-500/5",
  info: "border-slate-500/20 bg-slate-500/5",
};

const TYPE_BADGE: Record<TreeNode["type"], { label: string; color: string }> = {
  gate: { label: "Gate", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  filter: { label: "Filter", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  rule: { label: "Regel", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  action: { label: "Aktion", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  info: { label: "Info", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
};

function TreeNodeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const style = TYPE_STYLES[node.type];
  const badge = TYPE_BADGE[node.type];

  return (
    <div className={`${depth > 0 ? "ml-4 border-l border-white/10 pl-3" : ""}`}>
      <div
        className={`rounded-lg border p-3 my-1.5 transition-colors ${style} ${hasChildren ? "cursor-pointer hover:bg-white/5" : ""}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2">
          {hasChildren && (
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          )}
          {!hasChildren && <span className="w-4 shrink-0" />}
          {node.icon && <span className="mt-0.5 shrink-0">{node.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{node.label}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badge.color}`}>
                {badge.label}
              </span>
              {node.detail && (
                <span onClick={(e) => e.stopPropagation()}>
                  <InfoTooltip title={node.label} side="right" align="start" width="w-96">
                    {node.detail}
                  </InfoTooltip>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{node.description}</p>
          </div>
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="mt-0.5">
          {node.children!.map((child) => (
            <TreeNodeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Main Export ---- */

export default function OdinLogicTree() {
  return (
    <div className="space-y-2 p-1">
      <div className="mb-4">
        <h3 className="font-semibold text-sm">Zuweisungslogik — Entscheidungsbaum</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Visualisiert die aktuelle Pipeline der Assignment Engine. Klicken Sie auf Knoten mit Unterebenen, um diese ein-/auszuklappen.
        </p>
      </div>

      <div className="space-y-1">
        {LOGIC_TREE.map((node) => (
          <TreeNodeView key={node.id} node={node} depth={0} />
        ))}
      </div>

      {/* Open Points */}
      <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h4 className="font-semibold text-sm text-amber-300">Offene Punkte</h4>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
          <li><strong>Ressourcenmangel-Definition</strong> — fachlich nicht final definiert. Flag existiert, Regel noch offen.</li>
          <li><strong>6-Stunden-Restzeit-Schwelle</strong> (CC-Gruppierung) — Arbeitsdefinition, bestätigungsbedürftig.</li>
          <li><strong>Buddy / Neustarter Sonderlogik</strong> — aktuell informell, spätere Erweiterung möglich.</li>
          <li><strong>Teams-Reminder für Other-Teams-Handover</strong> — geplant, noch nicht umgesetzt.</li>
        </ul>
      </div>
    </div>
  );
}
