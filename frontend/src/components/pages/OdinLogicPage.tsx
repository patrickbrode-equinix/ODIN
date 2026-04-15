/* ================================================ */
/* ODIN-Logik — Main Page                           */
/* ================================================ */

import { useEffect, useState, lazy, Suspense } from 'react';
import { useAssignmentStore } from '../../store/assignmentStore';
import { AssignmentStatusCards } from '../assignment/AssignmentStatusCards';
import { AssignmentSettingsPanel } from '../assignment/AssignmentSettingsPanel';
import { AssignmentRunTable } from '../assignment/AssignmentRunTable';
import { AssignmentDecisionTable } from '../assignment/AssignmentDecisionTable';
import { AssignmentDecisionDrawer } from '../assignment/AssignmentDecisionDrawer';
import { AssignmentFilters } from '../assignment/AssignmentFilters';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Play, RotateCcw, ChevronDown, ChevronUp, AlertCircle, Power, PowerOff, Shield, StopCircle, Zap, Clock, Brain, FileText, SkipForward } from 'lucide-react';
import { EnterprisePageShell, EnterpriseHeader, EnterpriseCard } from '../layout/EnterpriseLayout';
import { useLanguage, type LanguageCode, getLanguageLocale } from '../../context/LanguageContext';

const OdinLogicTree = lazy(() => import('../odinlogic/OdinLogicTree'));
const AssignmentVisualizer = lazy(() => import('../odinlogic/AssignmentVisualizer'));

type TabKey = 'runs' | 'decisions' | 'report' | 'settings' | 'logicTree' | 'visualizer';

const PAGE_COPY: Record<LanguageCode, {
  cancel: string;
  title: string;
  subtitle: string;
  liveConfirmTitle: string;
  liveConfirmMessage: string;
  liveConfirmButton: string;
  shadowConfirmTitle: string;
  shadowConfirmMessage: string;
  shadowConfirmButton: string;
  stopConfirmTitle: string;
  stopConfirmMessage: string;
  stopConfirmButton: string;
  runs: string;
  decisions: string;
  report: string;
  logicTree: string;
  flow: string;
  settings: string;
  crawlerOverride: string;
  staleData: string;
  dryRun: string;
  shadowRun: string;
  runInProgress: string;
  automaticAssignment: string;
  disabled: string;
  liveActive: string;
  shadowActive: string;
  lastStarted: string;
  stopped: string;
  by: string;
  mode: string;
  startShadowAutomation: string;
  startLiveAutomation: string;
  stopAutomation: string;
  close: string;
  engineSettings: string;
  selectRunForReport: string;
  loadReport: string;
  loading: string;
  validationConsistent: string;
  validationInconsistent: string;
  processed: string;
  assigned: string;
  unassigned: string;
  notRelevant: string;
  crawlerOverrideActive: string;
  crawlerOverrideHint: string;
  assignedTickets: string;
  unassignedTickets: string;
  ticket: string;
  system: string;
  category: string;
  queue: string;
  assignedTo: string;
  reason: string;
  status: string;
  modeDryRun: string;
}> = {
  de: {
    cancel: 'Abbrechen',
    title: 'ODIN-Logik',
    subtitle: 'Assignment Engine – Automatische Ticketzuweisung',
    liveConfirmTitle: 'Produktive automatische Zuweisung aktivieren',
    liveConfirmMessage: 'Du bist dabei, die produktive automatische Zuweisung zu aktivieren. Tickets werden gemäß der aktuellen Konfiguration tatsächlich Mitarbeitern zugewiesen.',
    liveConfirmButton: 'Ja, Live-Automatik aktivieren',
    shadowConfirmTitle: 'Automatische Zuweisung starten (Shadow)',
    shadowConfirmMessage: 'Möchtest du die automatische Zuweisungslogik im Shadow-Modus starten? Die Engine simuliert Zuweisungen, nimmt aber keine echten Ticketänderungen vor.',
    shadowConfirmButton: 'Ja, Shadow-Automatik starten',
    stopConfirmTitle: 'Automatische Zuweisung stoppen',
    stopConfirmMessage: 'Möchtest du die automatische Zuweisungslogik stoppen? Neue automatische Läufe werden erst wieder nach einem erneuten Start ausgeführt.',
    stopConfirmButton: 'Ja, Automatik stoppen',
    runs: 'Runs & Logs',
    decisions: 'Entscheidungen',
    report: 'Run-Report',
    logicTree: 'Logikbaum',
    flow: 'Zuweisungsfluss',
    settings: 'Einstellungen',
    crawlerOverride: 'Crawler-Override',
    staleData: 'Veraltete Daten',
    dryRun: 'Dry-Run',
    shadowRun: 'Shadow-Run starten',
    runInProgress: 'Läuft...',
    automaticAssignment: 'Automatische Zuweisung',
    disabled: 'Deaktiviert',
    liveActive: 'Live aktiv',
    shadowActive: 'Shadow aktiv',
    lastStarted: 'Zuletzt gestartet',
    stopped: 'Gestoppt',
    by: 'von',
    mode: 'Modus',
    startShadowAutomation: 'Shadow-Automatik starten',
    startLiveAutomation: 'Live-Automatik starten',
    stopAutomation: 'Automatik stoppen',
    close: 'Schließen',
    engineSettings: 'Engine Einstellungen',
    selectRunForReport: 'Wähle zuerst einen Run im Tab „Runs & Logs" aus, um den detaillierten Report zu sehen.',
    loadReport: 'Report laden',
    loading: 'Lädt...',
    validationConsistent: '✓ Ticketzählung konsistent',
    validationInconsistent: '⚠ Ticketzählung inkonsistent',
    processed: 'Verarbeitet',
    assigned: 'Zugewiesen',
    unassigned: 'Nicht zugewiesen',
    notRelevant: 'Nicht relevant',
    crawlerOverrideActive: '⚠ Crawler-Override war aktiv',
    crawlerOverrideHint: 'Ergebnisse basieren möglicherweise auf veralteten Crawler-Daten.',
    assignedTickets: '✓ Zugewiesene Tickets',
    unassignedTickets: '✗ Nicht zugewiesene Tickets',
    ticket: 'Ticket',
    system: 'System',
    category: 'Kategorie',
    queue: 'Queue',
    assignedTo: 'Zugewiesen an',
    reason: 'Begründung',
    status: 'Status',
    modeDryRun: 'Dry-Run',
  },
  en: {
    cancel: 'Cancel',
    title: 'ODIN Logic',
    subtitle: 'Assignment engine – automatic ticket assignment',
    liveConfirmTitle: 'Enable productive auto-assignment',
    liveConfirmMessage: 'You are about to enable productive automatic assignment. Tickets will be assigned to employees based on the current configuration.',
    liveConfirmButton: 'Yes, enable live automation',
    shadowConfirmTitle: 'Start automatic assignment (shadow)',
    shadowConfirmMessage: 'Do you want to start the automatic assignment logic in shadow mode? The engine simulates assignments without changing real tickets.',
    shadowConfirmButton: 'Yes, start shadow automation',
    stopConfirmTitle: 'Stop automatic assignment',
    stopConfirmMessage: 'Do you want to stop the automatic assignment logic? New automatic runs will remain stopped until you start it again.',
    stopConfirmButton: 'Yes, stop automation',
    runs: 'Runs & logs',
    decisions: 'Decisions',
    report: 'Run report',
    logicTree: 'Logic tree',
    flow: 'Assignment flow',
    settings: 'Settings',
    crawlerOverride: 'Crawler override',
    staleData: 'Stale data',
    dryRun: 'Dry run',
    shadowRun: 'Start shadow run',
    runInProgress: 'Running...',
    automaticAssignment: 'Automatic assignment',
    disabled: 'Disabled',
    liveActive: 'Live active',
    shadowActive: 'Shadow active',
    lastStarted: 'Last started',
    stopped: 'Stopped',
    by: 'by',
    mode: 'Mode',
    startShadowAutomation: 'Start shadow automation',
    startLiveAutomation: 'Start live automation',
    stopAutomation: 'Stop automation',
    close: 'Close',
    engineSettings: 'Engine settings',
    selectRunForReport: 'Select a run in the “Runs & Logs” tab first to view the detailed report.',
    loadReport: 'Load report',
    loading: 'Loading...',
    validationConsistent: '✓ Ticket count consistent',
    validationInconsistent: '⚠ Ticket count inconsistent',
    processed: 'Processed',
    assigned: 'Assigned',
    unassigned: 'Unassigned',
    notRelevant: 'Not relevant',
    crawlerOverrideActive: '⚠ Crawler override was active',
    crawlerOverrideHint: 'Results may be based on stale crawler data.',
    assignedTickets: '✓ Assigned tickets',
    unassignedTickets: '✗ Unassigned tickets',
    ticket: 'Ticket',
    system: 'System',
    category: 'Category',
    queue: 'Queue',
    assignedTo: 'Assigned to',
    reason: 'Reason',
    status: 'Status',
    modeDryRun: 'Dry run',
  },
  sq: { cancel: 'Anulo', title: 'Logjika ODIN', subtitle: 'Motori i caktimit – caktim automatik i tiketave', liveConfirmTitle: 'Aktivizo caktimin produktiv automatik', liveConfirmMessage: 'Do të aktivizosh caktimin produktiv automatik. Tiketat do t’u caktohen punonjësve sipas konfigurimit aktual.', liveConfirmButton: 'Po, aktivizo automatizimin live', shadowConfirmTitle: 'Nis caktimin automatik (shadow)', shadowConfirmMessage: 'Dëshiron ta nisësh logjikën automatike në modalitetin shadow? Motori simulon caktimet pa ndryshuar tiketat reale.', shadowConfirmButton: 'Po, nis shadow automation', stopConfirmTitle: 'Ndalo caktimin automatik', stopConfirmMessage: 'Dëshiron ta ndalosh logjikën automatike? Nisjet e reja automatike mbeten të ndaluara derisa ta aktivizosh sërish.', stopConfirmButton: 'Po, ndalo automatizimin', runs: 'Ekzekutime & logje', decisions: 'Vendime', report: 'Raporti i ekzekutimit', logicTree: 'Pema logjike', flow: 'Rrjedha e caktimit', settings: 'Cilësimet', crawlerOverride: 'Override i crawler-it', staleData: 'Të dhëna të vjetruara', dryRun: 'Dry-run', shadowRun: 'Nis shadow-run', runInProgress: 'Po ekzekutohet...', automaticAssignment: 'Caktim automatik', disabled: 'I çaktivizuar', liveActive: 'Live aktiv', shadowActive: 'Shadow aktiv', lastStarted: 'Nisur së fundi', stopped: 'Ndaluar', by: 'nga', mode: 'Modaliteti', startShadowAutomation: 'Nis shadow automation', startLiveAutomation: 'Nis live automation', stopAutomation: 'Ndalo automatizimin', close: 'Mbyll', engineSettings: 'Cilësimet e motorit', selectRunForReport: 'Zgjidh fillimisht një run te skeda “Runs & Logs” për të parë raportin e detajuar.', loadReport: 'Ngarko raportin', loading: 'Po ngarkohet...', validationConsistent: '✓ Numërimi i tiketave është konsistent', validationInconsistent: '⚠ Numërimi i tiketave është jokonsistent', processed: 'Të përpunuara', assigned: 'Të caktuara', unassigned: 'Të pacaktuara', notRelevant: 'Jo relevante', crawlerOverrideActive: '⚠ Override i crawler-it ishte aktiv', crawlerOverrideHint: 'Rezultatet mund të bazohen në të dhëna të vjetruara.', assignedTickets: '✓ Tiketa të caktuara', unassignedTickets: '✗ Tiketa të pacaktuara', ticket: 'Tiketë', system: 'Sistemi', category: 'Kategoria', queue: 'Queue', assignedTo: 'Caktuar te', reason: 'Arsyeja', status: 'Statusi', modeDryRun: 'Dry-run' },
  bs: { cancel: 'Otkaži', title: 'ODIN logika', subtitle: 'Engine za dodjelu – automatska dodjela tiketa', liveConfirmTitle: 'Aktiviraj produktivnu automatsku dodjelu', liveConfirmMessage: 'Upravo aktiviraš produktivnu automatsku dodjelu. Tiketi će biti stvarno dodijeljeni zaposlenicima prema trenutnoj konfiguraciji.', liveConfirmButton: 'Da, aktiviraj live automatiku', shadowConfirmTitle: 'Pokreni automatsku dodjelu (shadow)', shadowConfirmMessage: 'Želiš li pokrenuti automatsku logiku u shadow modu? Engine simulira dodjele bez izmjene stvarnih tiketa.', shadowConfirmButton: 'Da, pokreni shadow automatiku', stopConfirmTitle: 'Zaustavi automatsku dodjelu', stopConfirmMessage: 'Želiš li zaustaviti automatsku logiku? Novi automatski runovi ostat će zaustavljeni dok je ponovo ne pokreneš.', stopConfirmButton: 'Da, zaustavi automatiku', runs: 'Runovi i logovi', decisions: 'Odluke', report: 'Izvještaj runa', logicTree: 'Logičko stablo', flow: 'Tok dodjele', settings: 'Postavke', crawlerOverride: 'Crawler override', staleData: 'Zastarjeli podaci', dryRun: 'Dry-run', shadowRun: 'Pokreni shadow-run', runInProgress: 'U toku...', automaticAssignment: 'Automatska dodjela', disabled: 'Deaktivirano', liveActive: 'Live aktivan', shadowActive: 'Shadow aktivan', lastStarted: 'Zadnje pokretanje', stopped: 'Zaustavljeno', by: 'od', mode: 'Mod', startShadowAutomation: 'Pokreni shadow automatiku', startLiveAutomation: 'Pokreni live automatiku', stopAutomation: 'Zaustavi automatiku', close: 'Zatvori', engineSettings: 'Postavke enginea', selectRunForReport: 'Prvo odaberi run u tabu “Runs & Logs” da vidiš detaljan izvještaj.', loadReport: 'Učitaj izvještaj', loading: 'Učitavanje...', validationConsistent: '✓ Brojanje tiketa je konzistentno', validationInconsistent: '⚠ Brojanje tiketa nije konzistentno', processed: 'Obrađeno', assigned: 'Dodijeljeno', unassigned: 'Nedodijeljeno', notRelevant: 'Nije relevantno', crawlerOverrideActive: '⚠ Crawler override je bio aktivan', crawlerOverrideHint: 'Rezultati se možda zasnivaju na zastarjelim crawler podacima.', assignedTickets: '✓ Dodijeljeni tiketi', unassignedTickets: '✗ Nedodijeljeni tiketi', ticket: 'Tiket', system: 'Sistem', category: 'Kategorija', queue: 'Queue', assignedTo: 'Dodijeljeno', reason: 'Razlog', status: 'Status', modeDryRun: 'Dry-run' },
  fr: { cancel: 'Annuler', title: 'Logique ODIN', subtitle: 'Moteur d’assignation – attribution automatique des tickets', liveConfirmTitle: 'Activer l’attribution automatique en production', liveConfirmMessage: 'Vous allez activer l’attribution automatique en production. Les tickets seront réellement attribués selon la configuration actuelle.', liveConfirmButton: 'Oui, activer le mode live', shadowConfirmTitle: 'Démarrer l’attribution automatique (shadow)', shadowConfirmMessage: 'Voulez-vous démarrer la logique automatique en mode shadow ? Le moteur simule les attributions sans modifier les tickets réels.', shadowConfirmButton: 'Oui, démarrer le shadow', stopConfirmTitle: 'Arrêter l’attribution automatique', stopConfirmMessage: 'Voulez-vous arrêter la logique automatique ? Les nouveaux lancements automatiques resteront arrêtés jusqu’à un nouveau démarrage.', stopConfirmButton: 'Oui, arrêter l’automatisation', runs: 'Exécutions et journaux', decisions: 'Décisions', report: 'Rapport d’exécution', logicTree: 'Arbre logique', flow: 'Flux d’attribution', settings: 'Paramètres', crawlerOverride: 'Override du crawler', staleData: 'Données obsolètes', dryRun: 'Dry-run', shadowRun: 'Démarrer le shadow-run', runInProgress: 'En cours...', automaticAssignment: 'Attribution automatique', disabled: 'Désactivé', liveActive: 'Live actif', shadowActive: 'Shadow actif', lastStarted: 'Dernier démarrage', stopped: 'Arrêté', by: 'par', mode: 'Mode', startShadowAutomation: 'Démarrer le shadow', startLiveAutomation: 'Démarrer le live', stopAutomation: 'Arrêter l’automatisation', close: 'Fermer', engineSettings: 'Paramètres du moteur', selectRunForReport: 'Sélectionnez d’abord une exécution dans l’onglet “Runs & Logs” pour voir le rapport détaillé.', loadReport: 'Charger le rapport', loading: 'Chargement...', validationConsistent: '✓ Nombre de tickets cohérent', validationInconsistent: '⚠ Nombre de tickets incohérent', processed: 'Traités', assigned: 'Attribués', unassigned: 'Non attribués', notRelevant: 'Non pertinents', crawlerOverrideActive: '⚠ L’override du crawler était actif', crawlerOverrideHint: 'Les résultats peuvent reposer sur des données crawler obsolètes.', assignedTickets: '✓ Tickets attribués', unassignedTickets: '✗ Tickets non attribués', ticket: 'Ticket', system: 'Système', category: 'Catégorie', queue: 'Queue', assignedTo: 'Attribué à', reason: 'Justification', status: 'Statut', modeDryRun: 'Dry-run' },
  es: { cancel: 'Cancelar', title: 'Lógica ODIN', subtitle: 'Motor de asignación: asignación automática de tickets', liveConfirmTitle: 'Activar asignación automática productiva', liveConfirmMessage: 'Estás a punto de activar la asignación automática productiva. Los tickets se asignarán realmente según la configuración actual.', liveConfirmButton: 'Sí, activar automatización live', shadowConfirmTitle: 'Iniciar asignación automática (shadow)', shadowConfirmMessage: '¿Quieres iniciar la lógica automática en modo shadow? El motor simula asignaciones sin cambiar tickets reales.', shadowConfirmButton: 'Sí, iniciar shadow', stopConfirmTitle: 'Detener asignación automática', stopConfirmMessage: '¿Quieres detener la lógica automática? Las nuevas ejecuciones automáticas seguirán detenidas hasta que la vuelvas a iniciar.', stopConfirmButton: 'Sí, detener automatización', runs: 'Ejecuciones y registros', decisions: 'Decisiones', report: 'Informe de ejecución', logicTree: 'Árbol lógico', flow: 'Flujo de asignación', settings: 'Ajustes', crawlerOverride: 'Override del crawler', staleData: 'Datos obsoletos', dryRun: 'Dry-run', shadowRun: 'Iniciar shadow-run', runInProgress: 'En ejecución...', automaticAssignment: 'Asignación automática', disabled: 'Desactivado', liveActive: 'Live activo', shadowActive: 'Shadow activo', lastStarted: 'Último inicio', stopped: 'Detenido', by: 'por', mode: 'Modo', startShadowAutomation: 'Iniciar shadow', startLiveAutomation: 'Iniciar live', stopAutomation: 'Detener automatización', close: 'Cerrar', engineSettings: 'Ajustes del motor', selectRunForReport: 'Selecciona primero una ejecución en la pestaña “Runs & Logs” para ver el informe detallado.', loadReport: 'Cargar informe', loading: 'Cargando...', validationConsistent: '✓ Recuento de tickets consistente', validationInconsistent: '⚠ Recuento de tickets inconsistente', processed: 'Procesados', assigned: 'Asignados', unassigned: 'Sin asignar', notRelevant: 'No relevantes', crawlerOverrideActive: '⚠ El override del crawler estaba activo', crawlerOverrideHint: 'Los resultados pueden basarse en datos obsoletos del crawler.', assignedTickets: '✓ Tickets asignados', unassignedTickets: '✗ Tickets sin asignar', ticket: 'Ticket', system: 'Sistema', category: 'Categoría', queue: 'Queue', assignedTo: 'Asignado a', reason: 'Motivo', status: 'Estado', modeDryRun: 'Dry-run' },
  "pt-BR": { cancel: 'Cancelar', title: 'Lógica ODIN', subtitle: 'Motor de atribuição – atribuição automática de tickets', liveConfirmTitle: 'Ativar atribuição automática produtiva', liveConfirmMessage: 'Você está prestes a ativar a atribuição automática produtiva. Os tickets serão atribuídos de fato conforme a configuração atual.', liveConfirmButton: 'Sim, ativar automação live', shadowConfirmTitle: 'Iniciar atribuição automática (shadow)', shadowConfirmMessage: 'Deseja iniciar a lógica automática em modo shadow? O motor simula atribuições sem alterar tickets reais.', shadowConfirmButton: 'Sim, iniciar shadow', stopConfirmTitle: 'Parar atribuição automática', stopConfirmMessage: 'Deseja parar a lógica automática? Novas execuções automáticas ficarão paradas até uma nova ativação.', stopConfirmButton: 'Sim, parar automação', runs: 'Execuções e logs', decisions: 'Decisões', report: 'Relatório da execução', logicTree: 'Árvore lógica', flow: 'Fluxo de atribuição', settings: 'Configurações', crawlerOverride: 'Override do crawler', staleData: 'Dados desatualizados', dryRun: 'Dry-run', shadowRun: 'Iniciar shadow-run', runInProgress: 'Executando...', automaticAssignment: 'Atribuição automática', disabled: 'Desativado', liveActive: 'Live ativo', shadowActive: 'Shadow ativo', lastStarted: 'Último início', stopped: 'Parado', by: 'por', mode: 'Modo', startShadowAutomation: 'Iniciar shadow', startLiveAutomation: 'Iniciar live', stopAutomation: 'Parar automação', close: 'Fechar', engineSettings: 'Configurações do motor', selectRunForReport: 'Selecione primeiro uma execução na aba “Runs & Logs” para ver o relatório detalhado.', loadReport: 'Carregar relatório', loading: 'Carregando...', validationConsistent: '✓ Contagem de tickets consistente', validationInconsistent: '⚠ Contagem de tickets inconsistente', processed: 'Processados', assigned: 'Atribuídos', unassigned: 'Não atribuídos', notRelevant: 'Não relevantes', crawlerOverrideActive: '⚠ O override do crawler estava ativo', crawlerOverrideHint: 'Os resultados podem se basear em dados desatualizados do crawler.', assignedTickets: '✓ Tickets atribuídos', unassignedTickets: '✗ Tickets não atribuídos', ticket: 'Ticket', system: 'Sistema', category: 'Categoria', queue: 'Queue', assignedTo: 'Atribuído a', reason: 'Motivo', status: 'Status', modeDryRun: 'Dry-run' },
  "fa-AF": { cancel: 'لغو', title: 'منطق ODIN', subtitle: 'موتور تخصیص - واگذاری خودکار تیکت‌ها', liveConfirmTitle: 'فعال‌سازی واگذاری خودکار در حالت عملیاتی', liveConfirmMessage: 'شما در حال فعال‌سازی واگذاری خودکار عملیاتی هستید. تیکت‌ها طبق پیکربندی فعلی واقعاً به کارکنان واگذار می‌شوند.', liveConfirmButton: 'بله، حالت live را فعال کن', shadowConfirmTitle: 'شروع واگذاری خودکار (shadow)', shadowConfirmMessage: 'آیا می‌خواهید منطق خودکار را در حالت shadow اجرا کنید؟ موتور فقط شبیه‌سازی می‌کند و تیکت واقعی را تغییر نمی‌دهد.', shadowConfirmButton: 'بله، shadow را شروع کن', stopConfirmTitle: 'توقف واگذاری خودکار', stopConfirmMessage: 'آیا می‌خواهید منطق خودکار را متوقف کنید؟ اجرای خودکار جدید تا شروع دوباره متوقف می‌ماند.', stopConfirmButton: 'بله، خودکارسازی را متوقف کن', runs: 'اجراها و لاگ‌ها', decisions: 'تصمیم‌ها', report: 'گزارش اجرا', logicTree: 'درخت منطق', flow: 'جریان تخصیص', settings: 'تنظیمات', crawlerOverride: 'نادیده‌گرفتن crawler', staleData: 'داده‌های قدیمی', dryRun: 'Dry-run', shadowRun: 'شروع shadow-run', runInProgress: 'در حال اجرا...', automaticAssignment: 'واگذاری خودکار', disabled: 'غیرفعال', liveActive: 'live فعال', shadowActive: 'shadow فعال', lastStarted: 'آخرین شروع', stopped: 'متوقف شده', by: 'توسط', mode: 'حالت', startShadowAutomation: 'شروع shadow', startLiveAutomation: 'شروع live', stopAutomation: 'توقف خودکارسازی', close: 'بستن', engineSettings: 'تنظیمات موتور', selectRunForReport: 'ابتدا یک run را در تب “Runs & Logs” انتخاب کنید تا گزارش دقیق را ببینید.', loadReport: 'بارگیری گزارش', loading: 'در حال بارگیری...', validationConsistent: '✓ شمارش تیکت‌ها سازگار است', validationInconsistent: '⚠ شمارش تیکت‌ها ناسازگار است', processed: 'پردازش‌شده', assigned: 'واگذار شده', unassigned: 'واگذار نشده', notRelevant: 'نامرتبط', crawlerOverrideActive: '⚠ نادیده‌گرفتن crawler فعال بود', crawlerOverrideHint: 'نتیجه‌ها ممکن است بر داده‌های قدیمی crawler متکی باشند.', assignedTickets: '✓ تیکت‌های واگذار شده', unassignedTickets: '✗ تیکت‌های واگذار نشده', ticket: 'تیکت', system: 'سیستم', category: 'دسته', queue: 'صف', assignedTo: 'واگذار شده به', reason: 'دلیل', status: 'وضعیت', modeDryRun: 'Dry-run' },
};

/* ---- Safety Confirmation Dialog ---- */
function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const variantColors = {
    danger: { bg: 'bg-red-500/10 border-red-500/30', btn: 'bg-red-600 hover:bg-red-500', icon: 'text-red-400' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/30', btn: 'bg-amber-600 hover:bg-amber-500', icon: 'text-amber-400' },
    info: { bg: 'bg-blue-500/10 border-blue-500/30', btn: 'bg-blue-600 hover:bg-blue-500', icon: 'text-blue-400' },
  };
  const v = variantColors[variant];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`max-w-md w-full mx-4 rounded-xl border ${v.bg} p-6 shadow-2xl`}>
        <div className="flex items-start gap-3 mb-4">
          <Shield className={`w-6 h-6 ${v.icon} shrink-0 mt-0.5`} />
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border border-border/40 bg-background/60 hover:bg-background/80 text-muted-foreground hover:text-foreground transition">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm rounded-md text-white transition ${v.btn}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OdinLogicPage() {
  const { language } = useLanguage();
  const locale = getLanguageLocale(language);
  const copy = PAGE_COPY[language];
  const {
    health,
    runs,
    decisions,
    selectedRun,
    filters,
    loading,
    error,
    executing,
    fetchHealth,
    fetchSettings,
    fetchRuns,
    fetchDecisions,
    executeRun,
    startEngine,
    stopEngine,
    clearError,
  } = useAssignmentStore();

  const [tab, setTab] = useState<TabKey>('runs');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skipCrawler, setSkipCrawler] = useState(false);
  const [runReport, setRunReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'info';
    action: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', variant: 'info', action: () => {} });

  // Initial data load
  useEffect(() => {
    fetchHealth();
    fetchSettings();
    fetchRuns();
  }, []);

  // Reload runs when filters change
  useEffect(() => {
    fetchRuns();
  }, [filters.runMode, filters.runStatus]);

  // Load decisions when a run is selected or filter changes
  useEffect(() => {
    if (selectedRun) {
      fetchDecisions({ runId: selectedRun.id });
    }
  }, [selectedRun, filters.decisionResult]);

  useEffect(() => {
    setRunReport(null);
  }, [selectedRun?.id]);

  const lastRun = runs.length > 0 ? runs[0] : null;
  const engineEnabled = health?.enabled === true;
  const engineMode = health?.mode || 'shadow';

  /* ---- Engine Control Handlers ---- */
  const handleStartEngine = (mode: 'shadow' | 'live') => {
    if (mode === 'live') {
      setConfirmDialog({
        open: true,
        title: copy.liveConfirmTitle,
        message: copy.liveConfirmMessage,
        confirmLabel: copy.liveConfirmButton,
        variant: 'danger',
        action: () => { startEngine('live'); setConfirmDialog(d => ({ ...d, open: false })); },
      });
    } else {
      setConfirmDialog({
        open: true,
        title: copy.shadowConfirmTitle,
        message: copy.shadowConfirmMessage,
        confirmLabel: copy.shadowConfirmButton,
        variant: 'warning',
        action: () => { startEngine('shadow'); setConfirmDialog(d => ({ ...d, open: false })); },
      });
    }
  };

  const handleStopEngine = () => {
    setConfirmDialog({
      open: true,
      title: copy.stopConfirmTitle,
      message: copy.stopConfirmMessage,
      confirmLabel: copy.stopConfirmButton,
      variant: 'info',
      action: () => { stopEngine(); setConfirmDialog(d => ({ ...d, open: false })); },
    });
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'runs', label: copy.runs },
    { key: 'decisions', label: selectedRun ? `${copy.decisions} (Run #${selectedRun.id})` : copy.decisions },
    { key: 'report', label: selectedRun ? `${copy.report} (#${selectedRun.id})` : copy.report },
    { key: 'logicTree', label: copy.logicTree },
    { key: 'visualizer', label: copy.flow },
    { key: 'settings', label: copy.settings },
  ];

  return (
    <EnterprisePageShell style={{ maxWidth: 'none' }}>
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={copy.cancel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />

      {/* Page Header */}
      <EnterpriseHeader
        icon={<Brain className="w-6 h-6 text-blue-400" />}
        title={copy.title}
        subtitle={copy.subtitle}
        rightContent={
          <div className="flex items-center gap-2">
            {/* Crawler Override Toggle */}
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer" title="Crawler-Aktualitätsprüfung für Dry/Shadow-Runs überspringen">
              <input type="checkbox" checked={skipCrawler} onChange={e => setSkipCrawler(e.target.checked)} className="rounded w-3 h-3" />
              <SkipForward className="w-3 h-3" />
              {copy.crawlerOverride}
            </label>
            {skipCrawler && (
              <span className="text-[10px] text-amber-400 font-medium">⚠ {copy.staleData}</span>
            )}
            <div className="w-px h-6 bg-border/30" />
            <InfoTooltip title="Dry-Run" side="bottom">
              <p><strong>Einmaliger Testlauf</strong> — die Engine verarbeitet alle aktuellen Tickets und protokolliert Entscheidungen, aber nimmt <em>keine</em> Änderungen vor.</p>
              <p>Ideal zum Testen nach Regeländerungen.</p>
              {skipCrawler && <p className="text-amber-400 mt-1"><strong>⚠ Crawler-Override aktiv:</strong> Die 10-Minuten-Regel wird übersprungen. Ergebnisse basieren möglicherweise auf veralteten Daten.</p>}
            </InfoTooltip>
            <button
              onClick={() => executeRun('dry-run', skipCrawler)}
              disabled={executing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border/40 bg-background/60 hover:bg-background/80 transition text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {copy.dryRun}
            </button>
            <InfoTooltip title="Shadow-Run" side="bottom">
              <p><strong>Einmaliger Simulationslauf</strong> — die Engine führt den kompletten Zuweisungsprozess durch, speichert alle Entscheidungen, aber ändert <em>keine</em> Ticketzuweisungen.</p>
            </InfoTooltip>
            <button
              onClick={() => executeRun('shadow', skipCrawler)}
              disabled={executing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {executing ? copy.runInProgress : copy.shadowRun}
            </button>
          </div>
        }
      />

      {/* ============================================================= */}
      {/* ENGINE CONTROL PANEL — Start/Stop + Status                     */}
      {/* ============================================================= */}
      <div className={`rounded-xl border p-4 backdrop-blur-sm ${
        engineEnabled
          ? engineMode === 'live'
            ? 'border-green-500/40 bg-green-500/5'
            : 'border-amber-500/40 bg-amber-500/5'
          : 'border-border/40 bg-card/60'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: Status */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
              engineEnabled
                ? engineMode === 'live'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-500/20 text-zinc-400'
            }`}>
              {engineEnabled ? <Zap className="w-6 h-6" /> : <PowerOff className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {copy.automaticAssignment}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  !engineEnabled ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' :
                  engineMode === 'live' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  engineMode === 'shadow' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {!engineEnabled ? copy.disabled : engineMode === 'live' ? copy.liveActive : engineMode === 'shadow' ? copy.shadowActive : copy.modeDryRun}
                </span>
                <InfoTooltip title="Automatische Zuweisung" side="right" width="w-96">
                  <p><strong>Bedeutung:</strong> Steuert, ob die ODIN-Engine automatisch und dauerhaft Tickets zuweist.</p>
                  <p><strong>Deaktiviert:</strong> Keine automatischen Zuweisungen. Manuelle Dry-Runs und Shadow-Runs sind weiterhin möglich.</p>
                  <p><strong>Shadow aktiv:</strong> Die Engine läuft automatisch, simuliert Zuweisungen und protokolliert alle Entscheidungen — aber ändert keine echten Tickets.</p>
                  <p><strong>Live aktiv:</strong> Die Engine weist Tickets produktiv zu. Änderungen wirken sich direkt auf die Mitarbeiter-Zuweisungen aus.</p>
                  <p><strong>Unterschied zu Testläufen:</strong> Die Buttons „Dry-Run" und „Shadow-Run starten" oben rechts führen jeweils einen <em>einzelnen manuellen</em> Lauf aus. Die Steuerung hier aktiviert die <em>dauerhafte automatische</em> Logik.</p>
                </InfoTooltip>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {health?.lastStartedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {copy.lastStarted}: {new Date(health.lastStartedAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {health.lastStartedBy && <span> {copy.by} {health.lastStartedBy}</span>}
                  </span>
                )}
                {!engineEnabled && health?.lastStoppedAt && (
                  <span className="flex items-center gap-1">
                    {copy.stopped}: {new Date(health.lastStoppedAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {health.lastStoppedBy && <span> {copy.by} {health.lastStoppedBy}</span>}
                  </span>
                )}
                <span>{copy.mode}: <strong>{engineMode}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {!engineEnabled ? (
              <>
                <InfoTooltip title="Shadow-Automatik" side="bottom">
                  <p>Startet die automatische Engine im <strong>Shadow-Modus</strong>. Zuweisungen werden simuliert und protokolliert, aber nicht produktiv umgesetzt.</p>
                  <p><strong>Empfehlung:</strong> Diesen Modus verwenden, um die Logik über einen längeren Zeitraum zu validieren, bevor Live geschaltet wird.</p>
                </InfoTooltip>
                <button
                  onClick={() => handleStartEngine('shadow')}
                  disabled={executing}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
                >
                  <Power className="w-3.5 h-3.5" />
                  {copy.startShadowAutomation}
                </button>
                <InfoTooltip title="Live-Automatik" side="bottom">
                  <p>Startet die produktive automatische Zuweisung. <strong>Tickets werden tatsächlich zugewiesen.</strong></p>
                  <p><strong>Voraussetzung:</strong> Die Einstellung „enableLiveMode" muss in den Engine-Einstellungen aktiviert sein.</p>
                  <p><strong>⚠ Warnung:</strong> Nur verwenden, wenn die Logik im Shadow-Modus ausreichend validiert wurde.</p>
                </InfoTooltip>
                <button
                  onClick={() => handleStartEngine('live')}
                  disabled={executing}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white transition disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {copy.startLiveAutomation}
                </button>
              </>
            ) : (
              <>
                <InfoTooltip title="Automatik stoppen" side="bottom">
                  <p>Stoppt die automatische Zuweisungslogik. Keine weiteren automatischen Runs werden ausgeführt.</p>
                  <p>Manuelle Dry-Runs und Shadow-Runs sind weiterhin jederzeit möglich.</p>
                  <p><strong>Auswirkung:</strong> Bereits laufende Zuweisungsprozesse werden zu Ende geführt. Neue Läufe werden nicht mehr gestartet.</p>
                </InfoTooltip>
                <button
                  onClick={handleStopEngine}
                  disabled={executing}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-50"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  {copy.stopAutomation}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs underline hover:text-red-300">{copy.close}</button>
        </div>
      )}

      {/* Status Cards */}
      <AssignmentStatusCards health={health} lastRun={lastRun} />

      {/* Collapsible Settings */}
      <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <button
          onClick={() => setSettingsOpen(v => !v)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/20 transition"
        >
          <span>{copy.engineSettings}</span>
          {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {settingsOpen && <AssignmentSettingsPanel />}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-blue-500/20 gap-0 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-blue-500/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <AssignmentFilters />

      {/* Tab Content */}
      <EnterpriseCard noPadding>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && tab === 'runs' && <AssignmentRunTable runs={runs} />}

        {!loading && tab === 'decisions' && <AssignmentDecisionTable decisions={decisions} />}

        {!loading && tab === 'logicTree' && (
          <div className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>}>
              <OdinLogicTree />
            </Suspense>
          </div>
        )}

        {!loading && tab === 'visualizer' && (
          <div className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>}>
              <AssignmentVisualizer runs={runs} />
            </Suspense>
          </div>
        )}

        {!loading && tab === 'settings' && <AssignmentSettingsPanel />}

        {/* Run Report Tab */}
        {!loading && tab === 'report' && (
          <div className="p-5 space-y-4">
            {!selectedRun ? (
              <p className="text-sm text-muted-foreground text-center py-8">{copy.selectRunForReport}</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Run-Report #{selectedRun.id}
                  </h3>
                  <button
                    onClick={async () => {
                      setReportLoading(true);
                      try {
                        const { AssignmentApi } = await import('../../api/assignment');
                        const data = await AssignmentApi.getRunReport(selectedRun.id);
                        setRunReport(data.report);
                      } catch (e: any) { /* ignore */ }
                      setReportLoading(false);
                    }}
                    disabled={reportLoading}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
                  >
                    {reportLoading ? copy.loading : copy.loadReport}
                  </button>
                </div>
                {runReport && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {Object.entries(runReport.summary || {}).map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-border/20 bg-background/40 p-3 text-center">
                          <div className="text-lg font-bold text-foreground">{String(val)}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{key}</div>
                        </div>
                      ))}
                    </div>

                    {/* Validation */}
                    {runReport.validation && (
                      <div className={`rounded-lg border p-3 ${runReport.validation.countConsistent ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                        <div className="text-xs font-bold mb-1">{runReport.validation.countConsistent ? copy.validationConsistent : copy.validationInconsistent}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {copy.processed}: {runReport.validation.totalProcessed} | {copy.assigned}: {runReport.validation.totalAssigned} | {copy.unassigned}: {runReport.validation.totalUnassigned} | {copy.notRelevant}: {runReport.validation.totalNotRelevant}
                        </div>
                        {runReport.validation.warning && <div className="text-[10px] text-red-400 mt-1">{runReport.validation.warning}</div>}
                      </div>
                    )}

                    {/* Crawler Override Warning */}
                    {runReport.crawlerOverride && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                        <div className="text-xs font-bold text-amber-400">{copy.crawlerOverrideActive}</div>
                        <div className="text-[10px] text-muted-foreground">{copy.crawlerOverrideHint}</div>
                      </div>
                    )}

                    {/* Assigned Tickets */}
                    {runReport.assigned?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-green-400 mb-2">{copy.assignedTickets} ({runReport.assigned.length})</h4>
                        <div className="max-h-64 overflow-auto rounded-lg border border-border/20">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-background/60 text-muted-foreground">
                              <th className="px-3 py-1.5 text-left">{copy.ticket}</th>
                              <th className="px-3 py-1.5 text-left">{copy.system}</th>
                              <th className="px-3 py-1.5 text-left">{copy.category}</th>
                              <th className="px-3 py-1.5 text-left">{copy.queue}</th>
                              <th className="px-3 py-1.5 text-left">{copy.assignedTo}</th>
                              <th className="px-3 py-1.5 text-left">{copy.reason}</th>
                            </tr></thead>
                            <tbody>
                              {runReport.assigned.map((d: any, i: number) => (
                                <tr key={i} className="border-t border-border/10 hover:bg-green-500/5">
                                  <td className="px-3 py-1.5 font-mono">{d.displayTicketNumber}</td>
                                  <td className="px-3 py-1.5">{d.systemName || '–'}</td>
                                  <td className="px-3 py-1.5">{d.ticketCategory || '–'}</td>
                                  <td className="px-3 py-1.5">{d.queueType}</td>
                                  <td className="px-3 py-1.5 font-medium text-green-400">{d.assignedTo}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{d.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Unassigned Tickets */}
                    {runReport.unassigned?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-red-400 mb-2">{copy.unassignedTickets} ({runReport.unassigned.length})</h4>
                        <div className="max-h-64 overflow-auto rounded-lg border border-border/20">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-background/60 text-muted-foreground">
                              <th className="px-3 py-1.5 text-left">{copy.ticket}</th>
                              <th className="px-3 py-1.5 text-left">{copy.system}</th>
                              <th className="px-3 py-1.5 text-left">{copy.category}</th>
                              <th className="px-3 py-1.5 text-left">{copy.queue}</th>
                              <th className="px-3 py-1.5 text-left">{copy.status}</th>
                              <th className="px-3 py-1.5 text-left">{copy.reason}</th>
                            </tr></thead>
                            <tbody>
                              {runReport.unassigned.map((d: any, i: number) => (
                                <tr key={i} className="border-t border-border/10 hover:bg-red-500/5">
                                  <td className="px-3 py-1.5 font-mono">{d.displayTicketNumber}</td>
                                  <td className="px-3 py-1.5">{d.systemName || '–'}</td>
                                  <td className="px-3 py-1.5">{d.ticketCategory || '–'}</td>
                                  <td className="px-3 py-1.5">{d.queueType}</td>
                                  <td className="px-3 py-1.5 text-amber-400">{d.result}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{d.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </EnterpriseCard>

      {/* Decision Drawer */}
      <AssignmentDecisionDrawer />
    </EnterprisePageShell>
  );
}
