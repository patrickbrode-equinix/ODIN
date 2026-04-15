/* ------------------------------------------------ */
/* TEAMS COMMUNICATION CENTER                      */
/* Full-featured Teams management page             */
/* ------------------------------------------------ */

import React, { useCallback, useEffect, useState } from "react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import {
  fetchTeamsStatus, fetchTeamsDiagnostics, fetchTeamsEvents, updateTeamsEvent,
  fetchTeamsRouting, createTeamsRoutingRule, updateTeamsRoutingRule, deleteTeamsRoutingRule,
  fetchTeamsTemplates, updateTeamsTemplate, previewTemplate,
  fetchTeamsSettings, updateTeamsSettings,
  fetchTeamsLog, fetchTeamsErrors, retryTeamsMessage,
  sendTeamsTestMessage, testTeamsTemplate, fetchTeamsEmployees,
  type TeamsStatus, type TeamsDiagnostics, type TeamsDiagnosticCheck, type TeamsEventConfig, type TeamsRoutingRule,
  type TeamsTemplate, type TeamsMessageLog, type TeamsEmployee,
} from "../../api/teamsConfig";
import {
  CheckCircle2, XCircle, AlertTriangle, Send, RefreshCw, Settings,
  Users, FileText, TestTube, Clock, Zap, Eye, ToggleLeft, ToggleRight,
  Loader2, Play, RotateCcw, ShieldAlert, Activity, Mail, Network
} from "lucide-react";
import { InfoTooltip } from "../ui/InfoTooltip";
import { useLanguage, type LanguageCode, getLanguageLocale } from "../../context/LanguageContext";

/* ---- Tab type ---- */
type TabId = "overview" | "diagnostics" | "employees" | "events" | "routing" | "templates" | "test" | "log" | "errors" | "settings";

interface RecipientGroup {
  id: string;
  name: string;
  description: string;
  recipients: string[];
}

const TABS: { id: TabId; icon: React.ElementType }[] = [
  { id: "overview", icon: Eye },
  { id: "diagnostics", icon: ShieldAlert },
  { id: "employees", icon: Network },
  { id: "events", icon: Zap },
  { id: "routing", icon: Users },
  { id: "templates", icon: FileText },
  { id: "test", icon: TestTube },
  { id: "log", icon: Clock },
  { id: "errors", icon: AlertTriangle },
  { id: "settings", icon: Settings },
];

const TAB_SUMMARIES: Record<TabId, { title: string; description: string }> = {
  overview: {
    title: "Schnellüberblick",
    description: "Status, Versandlage und die wichtigsten Blocker in einer kompakten Leitwarte.",
  },
  diagnostics: {
    title: "Fehlercenter",
    description: "Technische Checks mit Klartext-Erklärung: was geprüft wurde, warum es wichtig ist und welcher nächste Schritt nötig ist.",
  },
  employees: {
    title: "Gemappte Mitarbeiter",
    description: "Alle vorhandenen Teams-Mappings aus der Datenbank inklusive Mailquelle, Override-Status und verknüpftem ODIN-User.",
  },
  events: {
    title: "Events",
    description: "Steuert, welche ODIN-Ereignisse überhaupt Teams-Nachrichten auslösen und wie aggressiv diese ausgeliefert werden.",
  },
  routing: {
    title: "Routing",
    description: "Ordnet Ereignisse Personen, Rollen, Schichten oder gespeicherten Empfängergruppen zu.",
  },
  templates: {
    title: "Templates",
    description: "Formulierung und Informationsdichte der Teams-Nachrichten inklusive Testvorschau.",
  },
  test: {
    title: "Test Center",
    description: "Validiert Webhooks, Bot-Pfade und Templates ohne ein echtes produktives Event auszulösen.",
  },
  log: {
    title: "Verlauf",
    description: "Chronologischer Überblick über bereits gesendete oder fehlgeschlagene Teams-Nachrichten.",
  },
  errors: {
    title: "Fehler & Retry",
    description: "Gezielte Nachbearbeitung fehlgeschlagener Zustellungen mit klarer technischer Fehlerursache.",
  },
  settings: {
    title: "Einstellungen",
    description: "Globale Versandregeln wie Quiet Hours, Deduplizierung, Fallbacks und Eskalationszeiten.",
  },
};

const TEAMS_COPY: Record<LanguageCode, any> = {
  de: {
    pageTitle: "Teams Communication Center",
    pageSubtitle: "Microsoft Teams Nachrichtensteuerung",
    strapline: "Teams Center · transparent, aber operativ nutzbar",
    tabs: { overview: "Übersicht", diagnostics: "Fehlercenter", employees: "Mappings", events: "Events", routing: "Routing", templates: "Templates", test: "Test Center", log: "Verlauf", errors: "Fehler & Retry", settings: "Einstellungen" },
    summaries: TAB_SUMMARIES,
    statusError: "Status konnte nicht geladen werden",
    diagnosticsError: "Fehlercenter konnte nicht geladen werden",
    refresh: "Aktualisieren",
    recheck: "Neu prüfen",
    ready: "Bereit",
    blocked: "Blockiert",
    teamsReady: "Teams bereit",
    teamsBlocked: "Teams blockiert",
    sentToday: "Gesendet heute",
    failedToday: "Fehlgeschlagen heute",
    openRetries: "Offene Retries (24h)",
    mappedEmployees: "Gemappte Mitarbeiter",
    lastSuccess: "Letzter erfolgreicher Versand",
    lastError: "Letzter Fehler",
    time: "Zeit",
    type: "Typ",
    recipient: "Empfänger",
    noSend: "Noch keine Sendung",
    noErrors: "Keine Fehler",
    quickStatus: "Fehlercenter-Schnellstatus",
    whatChecks: "Was das Fehlercenter prüft",
    commonFailures: "Typische Fehlerbilder",
    operationsUsage: "Operative Nutzung",
    latestDiagnosis: "Letzte Diagnose",
    asOf: "Stand",
    blockingPoints: "Blockierende Punkte",
    noBlockingPoints: "Aktuell wurden keine blockierenden Teams-Probleme erkannt.",
    activeMappings: "Aktive Teams-Mappings",
    linkedUsers: "Mit ODIN-User verknüpft",
    manualOverrides: "Manuelle Overrides",
    employeeMappings: "Mitarbeiter-Mappings",
    filterHint: "Filterbar nach Mitarbeitername, E-Mail oder Mailquelle.",
    searchNameOrMail: "Suche nach Name oder E-Mail",
    employee: "Mitarbeiter",
    teamsMail: "Teams-Mail",
    mailSource: "Mailquelle",
    override: "Override",
    odinUser: "ODIN-User",
    lastUpdated: "Zuletzt aktualisiert",
    manual: "Manuell",
    automatic: "Automatisch",
    notLinked: "Nicht verknüpft",
    noEmployees: "Keine Mitarbeiter-Mappings passend zum aktuellen Filter.",
    active: "Aktiv",
    inactive: "Inaktiv",
    statusFilterAll: "Alle Status",
    sent: "Gesendet",
    failed: "Fehlgeschlagen",
    entriesTotal: "Einträge gesamt",
    content: "Inhalt",
    error: "Fehler",
    failedMessages: "Fehlgeschlagene Nachrichten – manuelles Retry möglich",
    noFailedMessages: "Keine fehlgeschlagenen Nachrichten",
    retry: "Retry",
    save: "Speichern",
  },
  en: { pageTitle: "Teams Communication Center", pageSubtitle: "Microsoft Teams message control", strapline: "Teams Center · transparent and operational", tabs: { overview: "Overview", diagnostics: "Diagnostics", employees: "Mappings", events: "Events", routing: "Routing", templates: "Templates", test: "Test center", log: "History", errors: "Errors & retry", settings: "Settings" }, summaries: { overview: { title: "Quick overview", description: "Status, delivery load and the main blockers in one compact control room." }, diagnostics: { title: "Diagnostics", description: "Technical checks with plain-language explanations, importance and next steps." }, employees: { title: "Mapped employees", description: "All Teams mappings from the database including mail source, override state and linked ODIN user." }, events: { title: "Events", description: "Controls which ODIN events trigger Teams messages and how aggressively they are delivered." }, routing: { title: "Routing", description: "Assigns events to people, roles, shifts or saved recipient groups." }, templates: { title: "Templates", description: "Wording and information density of Teams messages including test preview." }, test: { title: "Test center", description: "Validates webhooks, bot paths and templates without firing a real production event." }, log: { title: "History", description: "Chronological overview of sent or failed Teams messages." }, errors: { title: "Errors & retry", description: "Targeted reprocessing of failed deliveries with clear technical root cause." }, settings: { title: "Settings", description: "Global delivery rules such as quiet hours, deduplication, fallbacks and escalation times." } }, statusError: "Status could not be loaded", diagnosticsError: "Diagnostics could not be loaded", refresh: "Refresh", recheck: "Run again", ready: "Ready", blocked: "Blocked", teamsReady: "Teams ready", teamsBlocked: "Teams blocked", sentToday: "Sent today", failedToday: "Failed today", openRetries: "Open retries (24h)", mappedEmployees: "Mapped employees", lastSuccess: "Last successful delivery", lastError: "Last error", time: "Time", type: "Type", recipient: "Recipient", noSend: "No delivery yet", noErrors: "No errors", quickStatus: "Diagnostics quick status", whatChecks: "What diagnostics checks", commonFailures: "Typical failure patterns", operationsUsage: "Operational usage", latestDiagnosis: "Latest diagnosis", asOf: "As of", blockingPoints: "Blocking issues", noBlockingPoints: "No blocking Teams issues were detected.", activeMappings: "Active Teams mappings", linkedUsers: "Linked to ODIN user", manualOverrides: "Manual overrides", employeeMappings: "Employee mappings", filterHint: "Filter by employee name, email or email source.", searchNameOrMail: "Search by name or email", employee: "Employee", teamsMail: "Teams email", mailSource: "Mail source", override: "Override", odinUser: "ODIN user", lastUpdated: "Last updated", manual: "Manual", automatic: "Automatic", notLinked: "Not linked", noEmployees: "No employee mappings match the current filter.", active: "Active", inactive: "Inactive", statusFilterAll: "All statuses", sent: "Sent", failed: "Failed", entriesTotal: "entries total", content: "Content", error: "Error", failedMessages: "Failed messages – manual retry available", noFailedMessages: "No failed messages", retry: "Retry", save: "Save" },
  sq: { pageTitle: "Qendra e komunikimit Teams", pageSubtitle: "Kontrolli i mesazheve Microsoft Teams", strapline: "Qendra Teams · transparente dhe operative", tabs: { overview: "Përmbledhje", diagnostics: "Diagnostikë", employees: "Mappings", events: "Ngjarje", routing: "Rrjedhë", templates: "Template", test: "Qendra e testit", log: "Historik", errors: "Gabime dhe retry", settings: "Cilësimet" }, summaries: TAB_SUMMARIES, statusError: "Statusi nuk u ngarkua", diagnosticsError: "Diagnostika nuk u ngarkua", refresh: "Rifresko", recheck: "Kontrollo sërish", ready: "Gati", blocked: "Bllokuar", teamsReady: "Teams gati", teamsBlocked: "Teams i bllokuar", sentToday: "Dërguar sot", failedToday: "Dështuar sot", openRetries: "Retry të hapura (24h)", mappedEmployees: "Punonjës të mapuar", lastSuccess: "Dërgimi i fundit me sukses", lastError: "Gabimi i fundit", time: "Koha", type: "Lloji", recipient: "Marrësi", noSend: "Ende pa dërgim", noErrors: "Pa gabime", quickStatus: "Status i shpejtë", whatChecks: "Çfarë kontrollon diagnostika", commonFailures: "Gabime tipike", operationsUsage: "Përdorim operativ", latestDiagnosis: "Diagnoza e fundit", asOf: "Gjendja", blockingPoints: "Pika bllokuese", noBlockingPoints: "Nuk u gjetën probleme bllokuese.", activeMappings: "Mappings aktivë", linkedUsers: "Të lidhur me ODIN", manualOverrides: "Overrides manuale", employeeMappings: "Mappings të punonjësve", filterHint: "Filtro sipas emrit, email-it ose burimit të email-it.", searchNameOrMail: "Kërko sipas emrit ose email-it", employee: "Punonjësi", teamsMail: "Email Teams", mailSource: "Burimi i email-it", override: "Override", odinUser: "Përdoruesi ODIN", lastUpdated: "Përditësuar së fundi", manual: "Manual", automatic: "Automatik", notLinked: "I palidhur", noEmployees: "Asnjë mapping nuk përputhet me filtrin.", active: "Aktiv", inactive: "Joaktiv", statusFilterAll: "Të gjithë statuset", sent: "Dërguar", failed: "Dështuar", entriesTotal: "hyrje gjithsej", content: "Përmbajtja", error: "Gabim", failedMessages: "Mesazhe të dështuara – retry manual", noFailedMessages: "Nuk ka mesazhe të dështuara", retry: "Retry", save: "Ruaj" },
  bs: { pageTitle: "Teams komunikacijski centar", pageSubtitle: "Upravljanje Microsoft Teams porukama", strapline: "Teams centar · transparentan i operativan", tabs: { overview: "Pregled", diagnostics: "Dijagnostika", employees: "Mapiranja", events: "Događaji", routing: "Rutiranje", templates: "Predlošci", test: "Test centar", log: "Historija", errors: "Greške i retry", settings: "Postavke" }, summaries: TAB_SUMMARIES, statusError: "Status se nije mogao učitati", diagnosticsError: "Dijagnostika se nije mogla učitati", refresh: "Osvježi", recheck: "Provjeri ponovo", ready: "Spremno", blocked: "Blokirano", teamsReady: "Teams spreman", teamsBlocked: "Teams blokiran", sentToday: "Poslano danas", failedToday: "Neuspjelo danas", openRetries: "Otvoreni retry (24h)", mappedEmployees: "Mapirani zaposlenici", lastSuccess: "Posljednja uspješna isporuka", lastError: "Posljednja greška", time: "Vrijeme", type: "Tip", recipient: "Primalac", noSend: "Još nema slanja", noErrors: "Nema grešaka", quickStatus: "Brzi status", whatChecks: "Šta provjerava dijagnostika", commonFailures: "Tipični problemi", operationsUsage: "Operativna upotreba", latestDiagnosis: "Posljednja dijagnoza", asOf: "Stanje", blockingPoints: "Blokirajuće tačke", noBlockingPoints: "Nema blokirajućih Teams problema.", activeMappings: "Aktivna mapiranja", linkedUsers: "Povezano s ODIN korisnikom", manualOverrides: "Ručni override", employeeMappings: "Mapiranja zaposlenika", filterHint: "Filter po imenu, e-mailu ili izvoru pošte.", searchNameOrMail: "Traži po imenu ili e-mailu", employee: "Zaposlenik", teamsMail: "Teams e-mail", mailSource: "Izvor pošte", override: "Override", odinUser: "ODIN korisnik", lastUpdated: "Zadnje ažuriranje", manual: "Ručno", automatic: "Automatski", notLinked: "Nije povezano", noEmployees: "Nema mapiranja za trenutni filter.", active: "Aktivno", inactive: "Neaktivno", statusFilterAll: "Svi statusi", sent: "Poslano", failed: "Neuspjelo", entriesTotal: "unosa ukupno", content: "Sadržaj", error: "Greška", failedMessages: "Neuspjele poruke – moguć ručni retry", noFailedMessages: "Nema neuspjelih poruka", retry: "Retry", save: "Spremi" },
  fr: { pageTitle: "Centre de communication Teams", pageSubtitle: "Pilotage des messages Microsoft Teams", strapline: "Centre Teams · transparent et exploitable", tabs: { overview: "Vue d’ensemble", diagnostics: "Diagnostic", employees: "Mappings", events: "Événements", routing: "Routage", templates: "Templates", test: "Centre de test", log: "Historique", errors: "Erreurs et retry", settings: "Paramètres" }, summaries: TAB_SUMMARIES, statusError: "Le statut n’a pas pu être chargé", diagnosticsError: "Le diagnostic n’a pas pu être chargé", refresh: "Actualiser", recheck: "Relancer", ready: "Prêt", blocked: "Bloqué", teamsReady: "Teams prêt", teamsBlocked: "Teams bloqué", sentToday: "Envoyés aujourd’hui", failedToday: "Échecs aujourd’hui", openRetries: "Retries ouverts (24h)", mappedEmployees: "Employés mappés", lastSuccess: "Dernier envoi réussi", lastError: "Dernière erreur", time: "Heure", type: "Type", recipient: "Destinataire", noSend: "Aucun envoi pour le moment", noErrors: "Aucune erreur", quickStatus: "Statut rapide", whatChecks: "Ce que vérifie le diagnostic", commonFailures: "Pannes typiques", operationsUsage: "Usage opérationnel", latestDiagnosis: "Dernier diagnostic", asOf: "État", blockingPoints: "Points bloquants", noBlockingPoints: "Aucun problème bloquant détecté.", activeMappings: "Mappings actifs", linkedUsers: "Lié à un utilisateur ODIN", manualOverrides: "Overrides manuels", employeeMappings: "Mappings employés", filterHint: "Filtrable par nom, e-mail ou source e-mail.", searchNameOrMail: "Rechercher par nom ou e-mail", employee: "Employé", teamsMail: "E-mail Teams", mailSource: "Source e-mail", override: "Override", odinUser: "Utilisateur ODIN", lastUpdated: "Dernière mise à jour", manual: "Manuel", automatic: "Automatique", notLinked: "Non lié", noEmployees: "Aucun mapping ne correspond au filtre actuel.", active: "Actif", inactive: "Inactif", statusFilterAll: "Tous les statuts", sent: "Envoyé", failed: "Échec", entriesTotal: "entrées au total", content: "Contenu", error: "Erreur", failedMessages: "Messages en échec – retry manuel possible", noFailedMessages: "Aucun message en échec", retry: "Retry", save: "Enregistrer" },
  es: { pageTitle: "Centro de comunicación Teams", pageSubtitle: "Control de mensajes de Microsoft Teams", strapline: "Centro Teams · transparente y operativo", tabs: { overview: "Resumen", diagnostics: "Diagnóstico", employees: "Mappings", events: "Eventos", routing: "Routing", templates: "Templates", test: "Centro de pruebas", log: "Historial", errors: "Errores y retry", settings: "Ajustes" }, summaries: TAB_SUMMARIES, statusError: "No se pudo cargar el estado", diagnosticsError: "No se pudo cargar el diagnóstico", refresh: "Actualizar", recheck: "Volver a comprobar", ready: "Listo", blocked: "Bloqueado", teamsReady: "Teams listo", teamsBlocked: "Teams bloqueado", sentToday: "Enviados hoy", failedToday: "Fallidos hoy", openRetries: "Retries abiertos (24h)", mappedEmployees: "Empleados mapeados", lastSuccess: "Último envío correcto", lastError: "Último error", time: "Hora", type: "Tipo", recipient: "Destinatario", noSend: "Aún no hay envíos", noErrors: "Sin errores", quickStatus: "Estado rápido", whatChecks: "Qué comprueba el diagnóstico", commonFailures: "Fallos típicos", operationsUsage: "Uso operativo", latestDiagnosis: "Último diagnóstico", asOf: "Estado", blockingPoints: "Puntos bloqueantes", noBlockingPoints: "No se detectaron problemas bloqueantes.", activeMappings: "Mappings activos", linkedUsers: "Vinculado con usuario ODIN", manualOverrides: "Overrides manuales", employeeMappings: "Mappings de empleados", filterHint: "Filtrable por nombre, correo o fuente de correo.", searchNameOrMail: "Buscar por nombre o correo", employee: "Empleado", teamsMail: "Correo Teams", mailSource: "Fuente del correo", override: "Override", odinUser: "Usuario ODIN", lastUpdated: "Última actualización", manual: "Manual", automatic: "Automático", notLinked: "No vinculado", noEmployees: "No hay mappings para el filtro actual.", active: "Activo", inactive: "Inactivo", statusFilterAll: "Todos los estados", sent: "Enviado", failed: "Fallido", entriesTotal: "entradas totales", content: "Contenido", error: "Error", failedMessages: "Mensajes fallidos: retry manual disponible", noFailedMessages: "No hay mensajes fallidos", retry: "Retry", save: "Guardar" },
  "pt-BR": { pageTitle: "Central de comunicação Teams", pageSubtitle: "Controle de mensagens do Microsoft Teams", strapline: "Central Teams · transparente e operacional", tabs: { overview: "Visão geral", diagnostics: "Diagnóstico", employees: "Mappings", events: "Eventos", routing: "Roteamento", templates: "Templates", test: "Centro de testes", log: "Histórico", errors: "Erros e retry", settings: "Configurações" }, summaries: TAB_SUMMARIES, statusError: "Não foi possível carregar o status", diagnosticsError: "Não foi possível carregar o diagnóstico", refresh: "Atualizar", recheck: "Verificar novamente", ready: "Pronto", blocked: "Bloqueado", teamsReady: "Teams pronto", teamsBlocked: "Teams bloqueado", sentToday: "Enviados hoje", failedToday: "Falhas hoje", openRetries: "Retries abertos (24h)", mappedEmployees: "Funcionários mapeados", lastSuccess: "Último envio com sucesso", lastError: "Último erro", time: "Hora", type: "Tipo", recipient: "Destinatário", noSend: "Ainda sem envios", noErrors: "Sem erros", quickStatus: "Status rápido", whatChecks: "O que o diagnóstico verifica", commonFailures: "Falhas típicas", operationsUsage: "Uso operacional", latestDiagnosis: "Último diagnóstico", asOf: "Estado", blockingPoints: "Pontos bloqueadores", noBlockingPoints: "Nenhum problema bloqueador foi detectado.", activeMappings: "Mappings ativos", linkedUsers: "Vinculado ao usuário ODIN", manualOverrides: "Overrides manuais", employeeMappings: "Mappings de funcionários", filterHint: "Filtrável por nome, e-mail ou origem do e-mail.", searchNameOrMail: "Buscar por nome ou e-mail", employee: "Funcionário", teamsMail: "E-mail Teams", mailSource: "Origem do e-mail", override: "Override", odinUser: "Usuário ODIN", lastUpdated: "Última atualização", manual: "Manual", automatic: "Automático", notLinked: "Não vinculado", noEmployees: "Nenhum mapping corresponde ao filtro atual.", active: "Ativo", inactive: "Inativo", statusFilterAll: "Todos os status", sent: "Enviado", failed: "Falhou", entriesTotal: "entradas no total", content: "Conteúdo", error: "Erro", failedMessages: "Mensagens com falha – retry manual disponível", noFailedMessages: "Nenhuma mensagem com falha", retry: "Retry", save: "Salvar" },
  "fa-AF": { pageTitle: "مرکز ارتباط Teams", pageSubtitle: "کنترل پیام‌های Microsoft Teams", strapline: "مرکز Teams · شفاف و قابل استفاده عملیاتی", tabs: { overview: "نمای کلی", diagnostics: "تشخیص", employees: "نگاشت‌ها", events: "رویدادها", routing: "مسیردهی", templates: "قالب‌ها", test: "مرکز تست", log: "تاریخچه", errors: "خطا و retry", settings: "تنظیمات" }, summaries: TAB_SUMMARIES, statusError: "وضعیت بارگیری نشد", diagnosticsError: "تشخیص بارگیری نشد", refresh: "تازه‌سازی", recheck: "بررسی دوباره", ready: "آماده", blocked: "مسدود", teamsReady: "Teams آماده است", teamsBlocked: "Teams مسدود است", sentToday: "ارسال‌شده امروز", failedToday: "ناموفق امروز", openRetries: "retry باز (24h)", mappedEmployees: "کارکنان نگاشت‌شده", lastSuccess: "آخرین ارسال موفق", lastError: "آخرین خطا", time: "زمان", type: "نوع", recipient: "گیرنده", noSend: "هنوز ارسالی نیست", noErrors: "بدون خطا", quickStatus: "وضعیت سریع", whatChecks: "تشخیص چه چیزی را بررسی می‌کند", commonFailures: "خطاهای رایج", operationsUsage: "استفاده عملیاتی", latestDiagnosis: "آخرین تشخیص", asOf: "وضعیت", blockingPoints: "موارد مسدودکننده", noBlockingPoints: "هیچ مشکل مسدودکننده‌ای شناسایی نشد.", activeMappings: "نگاشت‌های فعال", linkedUsers: "متصل به کاربر ODIN", manualOverrides: "override دستی", employeeMappings: "نگاشت کارکنان", filterHint: "فیلتر بر اساس نام، ایمیل یا منبع ایمیل.", searchNameOrMail: "جستجو بر اساس نام یا ایمیل", employee: "کارمند", teamsMail: "ایمیل Teams", mailSource: "منبع ایمیل", override: "override", odinUser: "کاربر ODIN", lastUpdated: "آخرین به‌روزرسانی", manual: "دستی", automatic: "خودکار", notLinked: "متصل نیست", noEmployees: "هیچ نگاشتی با فیلتر فعلی سازگار نیست.", active: "فعال", inactive: "غیرفعال", statusFilterAll: "همه وضعیت‌ها", sent: "ارسال شد", failed: "ناموفق", entriesTotal: "ورودی در مجموع", content: "محتوا", error: "خطا", failedMessages: "پیام‌های ناموفق - retry دستی ممکن است", noFailedMessages: "پیام ناموفقی وجود ندارد", retry: "retry", save: "ذخیره" },
};

function useTeamsUi() {
  const { language } = useLanguage();
  return {
    language,
    locale: getLanguageLocale(language),
    copy: TEAMS_COPY[language],
  };
}

const DIAGNOSTIC_HELP: Record<string, { title: string; summary: string; detail: string }> = {
  channel_webhook: {
    title: "Webhook-Prüfung",
    summary: "Prüft, ob überhaupt ein Teams-Ziel für Kanalnachrichten konfiguriert ist.",
    detail: "Ohne Webhook kann ODIN keine Kanalnachrichten an Teams übergeben. Der Check prüft nur die Konfiguration, nicht den tatsächlichen Versand einer Nachricht.",
  },
  bot_api: {
    title: "Bot-Pfad",
    summary: "Bewertet, ob persönliche 1:1-Nachrichten über die interne Bot-Anbindung vorbereitet sind.",
    detail: "Der Bot-Pfad ist für private Nachrichten relevant. Fehlt er, kann Kanalversand trotzdem funktionieren, persönliche Zustellung aber unvollständig bleiben.",
  },
  graph_credentials: {
    title: "Graph-Credentials",
    summary: "Prüft, ob Tenant, Client und Secret für Entra ID vollständig vorhanden sind.",
    detail: "Fehlende oder vertauschte Werte blockieren die Authentifizierung, bevor überhaupt ein Graph-Aufruf stattfinden kann.",
  },
  graph_token: {
    title: "Graph-Authentifizierung",
    summary: "Versucht aktiv, über Client Credentials ein Access Token von Entra ID zu holen.",
    detail: "Damit sieht man sofort, ob das Problem an falschen Secrets, ungültiger App-Registrierung oder an Netzwerk/Proxy liegt.",
  },
  graph_permissions: {
    title: "Graph-Berechtigungen",
    summary: "Liest Rollen und Scopes direkt aus dem ausgestellten Token.",
    detail: "Ein technisch gültiges Token ohne Rollen ist in der Praxis trotzdem wertlos. Genau das zeigt dieser Check.",
  },
  graph_users_probe: {
    title: "Graph-/users-Probe",
    summary: "Macht einen echten Lesezugriff gegen Microsoft Graph /users.",
    detail: "So wird sichtbar, ob die Berechtigungen in Azure zwar hinterlegt, aber noch nicht per Admin Consent freigegeben wurden.",
  },
  recipient_mapping: {
    title: "Empfänger-Auflösung",
    summary: "Prüft, ob ODIN überhaupt reale Zieladressen oder einen Fallback hat.",
    detail: "Auch wenn Graph technisch funktioniert, können persönliche Nachrichten ohne Mitarbeiter-Mapping oder Fallback nicht zielgerichtet zugestellt werden.",
  },
  delivery_health: {
    title: "Aktuelle Versandlage",
    summary: "Wertet das Nachrichtenlog auf aktuelle Fehler und offene Retries aus.",
    detail: "Das ist der operative Check: selbst bei korrekter Konfiguration kann der Versand an Rate Limits, ungültigen URLs oder temporären Teams-Fehlern scheitern.",
  },
};

const CAPABILITY_HELP: Record<string, string> = {
  "Kanalversand": "Kanalversand ist aktiv, wenn ein Webhook vorhanden ist. Damit kann ODIN Nachrichten in einen Teams-Kanal posten.",
  "Graph Lookup": "Graph Lookup ist aktiv, wenn ODIN erfolgreich Benutzerdaten aus Microsoft Graph lesen kann. Das ist die Grundlage für User-Auflösung.",
  "Persoenliche Nachrichten": "Persönliche Nachrichten benötigen sowohl Graph-Zugriff als auch den Bot-Pfad. Fehlt eines davon, bleibt nur Kanal- oder Fallback-Versand.",
};

function parseRecipientGroups(rawValue: string | undefined): RecipientGroup[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const name = String(entry?.name || "").trim();
        if (!name) return null;
        return {
          id: String(entry?.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim(),
          name,
          description: String(entry?.description || "").trim(),
          recipients: Array.isArray(entry?.recipients)
            ? entry.recipients.map((recipient: unknown) => String(recipient || "").trim()).filter(Boolean)
            : [],
        };
      })
      .filter(Boolean) as RecipientGroup[];
  } catch {
    return [];
  }
}

export default function TeamsCommunicationCenter() {
  return <TeamsCommunicationCenterPanel />;
}

export function TeamsCommunicationCenterPanel({ embedded = false, initialTab = "overview" }: { embedded?: boolean; initialTab?: TabId }) {
  const { copy } = useTeamsUi();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const tabSummary = copy.summaries[activeTab];

  const content = (
    <>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {copy.tabs[t.id]}
          </button>
        ))}
      </div>

      <EnterpriseCard className="mb-6">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{tabSummary.title}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{tabSummary.description}</div>
          </div>
          <div className="text-xs text-gray-400">{copy.strapline}</div>
        </div>
      </EnterpriseCard>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "diagnostics" && <DiagnosticsTab />}
      {activeTab === "employees" && <EmployeesTab />}
      {activeTab === "events" && <EventsTab />}
      {activeTab === "routing" && <RoutingTab />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "test" && <TestCenterTab />}
      {activeTab === "log" && <LogTab />}
      {activeTab === "errors" && <ErrorsTab />}
      {activeTab === "settings" && <SettingsTab />}
    </>
  );

  if (embedded) return <div className="space-y-0">{content}</div>;

  return (
    <EnterprisePageShell>
      <EnterpriseHeader title={copy.pageTitle} subtitle={copy.pageSubtitle} />
      {content}
    </EnterprisePageShell>
  );
}

/* ================================================ */
/* OVERVIEW TAB                                     */
/* ================================================ */

function OverviewTab() {
  const { copy, locale } = useTeamsUi();
  const [status, setStatus] = useState<TeamsStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<TeamsDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStatus, nextDiagnostics] = await Promise.all([
        fetchTeamsStatus(),
        fetchTeamsDiagnostics(),
      ]);
      setStatus(nextStatus);
      setDiagnostics(nextDiagnostics);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!status) return <ErrorBox message={copy.statusError} />;

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${ok ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {label}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Status Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.webhook_configured} label="Webhook" />
          <InfoTooltip title="Webhook-Status">
            <p><strong>Bedeutung:</strong> Zeigt an, ob der Microsoft Teams Webhook-Endpunkt konfiguriert ist. Der Webhook wird benötigt, um Nachrichten in Teams-Kanäle zu senden.</p>
            <p><strong>Nicht konfiguriert:</strong> Es fehlt die Webhook-URL in den Umgebungsvariablen. Ohne diesen Endpunkt können keine Kanalnachrichten gesendet werden.</p>
          </InfoTooltip>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.bot_configured} label="Bot API" />
          <InfoTooltip title="Bot API Status">
            <p><strong>Bedeutung:</strong> Zeigt an, ob der Microsoft Bot Framework Endpunkt konfiguriert ist. Der Bot wird für persönliche 1:1-Nachrichten an Mitarbeiter benötigt.</p>
            <p><strong>Voraussetzung:</strong> Azure Bot Registration, gültige App-ID und Secret. Ohne Bot-Konfiguration können keine persönlichen Benachrichtigungen versendet werden.</p>
          </InfoTooltip>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.graph_configured} label="Graph API" />
          <InfoTooltip title="Microsoft Graph API">
            <p><strong>Bedeutung:</strong> Zeigt an, ob die Microsoft Graph API Credentials (Tenant-ID, Client-ID, Client-Secret) hinterlegt sind.</p>
            <p><strong>Wofür:</strong> Graph API wird benötigt, um Teams-Benutzer aufzulösen (User Resolve), Chat-Installationen zu erstellen und Conversation References zu verwalten.</p>
            <p><strong>Nicht konfiguriert:</strong> User-Mapping und persönliche Nachrichten funktionieren nicht.</p>
          </InfoTooltip>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.mapped_employees > 0} label={`${status.mapped_employees} Mappings`} />
          <InfoTooltip title="Employee Mappings">
            <p><strong>Bedeutung:</strong> Anzahl der Mitarbeiter, deren ODIN-Account mit einem Teams-Benutzer verknüpft ist.</p>
            <p><strong>Wichtig:</strong> Nur gemappte Mitarbeiter können persönliche Teams-Nachrichten erhalten. Mitarbeiter ohne Mapping werden bei persönlichen Benachrichtigungen übersprungen.</p>
          </InfoTooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{status.sent_today}</div>
            <div className="text-sm text-gray-500">{copy.sentToday}</div>
          </div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{status.failed_today}</div>
            <div className="text-sm text-gray-500">{copy.failedToday}</div>
          </div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">{status.pending_retries}</div>
            <div className="text-sm text-gray-500">{copy.openRetries}</div>
          </div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{status.mapped_employees}</div>
            <div className="text-sm text-gray-500">{copy.mappedEmployees}</div>
          </div>
        </EnterpriseCard>
      </div>

      {/* Last Success / Error */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnterpriseCard>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{copy.lastSuccess}</h3>
          {status.last_success ? (
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">{copy.time}:</span> {new Date(status.last_success.sent_at).toLocaleString(locale)}</div>
              <div><span className="text-gray-500">{copy.type}:</span> {status.last_success.message_type}</div>
              <div><span className="text-gray-500">{copy.recipient}:</span> {status.last_success.recipient || "–"}</div>
            </div>
          ) : <div className="text-gray-400 text-sm">{copy.noSend}</div>}
        </EnterpriseCard>
        <EnterpriseCard>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{copy.lastError}</h3>
          {status.last_error ? (
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">{copy.time}:</span> {new Date(status.last_error.sent_at).toLocaleString(locale)}</div>
              <div><span className="text-gray-500">{copy.type}:</span> {status.last_error.message_type}</div>
              <div className="text-red-600 text-xs font-mono break-all">{status.last_error.error_msg}</div>
            </div>
          ) : <div className="text-green-500 text-sm">{copy.noErrors}</div>}
        </EnterpriseCard>
      </div>

      {diagnostics && (
        <EnterpriseCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{copy.quickStatus}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{diagnostics.summary}</p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${diagnostics.ready ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
              {diagnostics.ready ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              {diagnostics.ready ? copy.ready : copy.blocked}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <CapabilityCard label="Kanalversand" active={diagnostics.capabilities.channel_notifications} />
            <CapabilityCard label="Graph Lookup" active={diagnostics.capabilities.graph_lookup} />
            <CapabilityCard label="Persoenliche Nachrichten" active={diagnostics.capabilities.personal_notifications} />
          </div>
          {diagnostics.blocking_issues.length > 0 && (
            <div className="mt-4 space-y-2">
              {diagnostics.blocking_issues.slice(0, 3).map((issue) => (
                <div key={issue} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  {issue}
                </div>
              ))}
            </div>
          )}
        </EnterpriseCard>
      )}

      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
          <RefreshCw className="w-4 h-4" /> {copy.refresh}
        </button>
      </div>
    </div>
  );
}

function DiagnosticsTab() {
  const { copy, locale } = useTeamsUi();
  const [diagnostics, setDiagnostics] = useState<TeamsDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDiagnostics(await fetchTeamsDiagnostics());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!diagnostics) return <ErrorBox message={copy.diagnosticsError} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EnterpriseCard>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <ShieldAlert className="w-4 h-4" />
            {copy.whatChecks}
            <InfoTooltip title="Prüfumfang" side="right">
              <p>Das Fehlercenter kombiniert Konfiguration, echte Authentifizierung, Graph-Lesetest und aktuelle Versandlage.</p>
              <p>Dadurch sieht man nicht nur <strong>dass</strong> Teams nicht funktioniert, sondern <strong>woran</strong> es konkret scheitert.</p>
            </InfoTooltip>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Jeder Check dokumentiert Prüfschritt, Ergebnis, technische Details und den nächsten sinnvollen Arbeitsschritt.</p>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Mail className="w-4 h-4" />
            {copy.commonFailures}
            <InfoTooltip title="Häufige Ursachen" side="right">
              <p>In der Praxis blockieren am häufigsten drei Dinge: fehlender Webhook, fehlende Graph-Rechte oder ein gültiges Token ohne Admin Consent.</p>
            </InfoTooltip>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Wenn Kanalversand läuft, persönliche Nachrichten aber nicht, liegt die Ursache fast immer im Graph- oder Bot-Pfad.</p>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Activity className="w-4 h-4" />
            {copy.operationsUsage}
            <InfoTooltip title="Wie man es nutzt" side="right">
              <p>Erst die roten Blocker beheben, dann die Hinweise prüfen, danach im Test Center mit Kanal- und Personaltest verifizieren.</p>
            </InfoTooltip>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">So bleibt die Fehleranalyse nachvollziehbar und endet nicht bei einem reinen Konfigurations-Check.</p>
        </EnterpriseCard>
      </div>

      <EnterpriseCard>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <Activity className="w-4 h-4" />
              {copy.latestDiagnosis}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{diagnostics.summary}</div>
            <div className="text-xs text-gray-400">{copy.asOf}: {new Date(diagnostics.generated_at).toLocaleString(locale)}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${diagnostics.ready ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
              {diagnostics.ready ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              {diagnostics.ready ? copy.teamsReady : copy.teamsBlocked}
            </div>
            <button onClick={load} className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">
              <RefreshCw className="w-4 h-4" /> {copy.recheck}
            </button>
          </div>
        </div>
      </EnterpriseCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CapabilityCard label="Kanalversand" active={diagnostics.capabilities.channel_notifications} tooltip={CAPABILITY_HELP["Kanalversand"]} />
        <CapabilityCard label="Graph Lookup" active={diagnostics.capabilities.graph_lookup} tooltip={CAPABILITY_HELP["Graph Lookup"]} />
        <CapabilityCard label="Persoenliche Nachrichten" active={diagnostics.capabilities.personal_notifications} tooltip={CAPABILITY_HELP["Persoenliche Nachrichten"]} />
      </div>

      <EnterpriseCard>
        <h3 className="text-sm font-semibold mb-3">{copy.blockingPoints}</h3>
        {diagnostics.blocking_issues.length === 0 ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
            {copy.noBlockingPoints}
          </div>
        ) : (
          <div className="space-y-2">
            {diagnostics.blocking_issues.map((issue) => (
              <div key={issue} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                {issue}
              </div>
            ))}
          </div>
        )}
      </EnterpriseCard>

      <div className="space-y-3">
        {diagnostics.checks.map((check) => (
          <DiagnosticCheckCard key={check.key} check={check} />
        ))}
      </div>
    </div>
  );
}

function EmployeesTab() {
  const { copy, locale } = useTeamsUi();
  const [employees, setEmployees] = useState<TeamsEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEmployees(await fetchTeamsEmployees());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  const filteredEmployees = employees.filter((employee) => {
    const haystack = [employee.employee_name, employee.email, employee.email_source]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(search.toLowerCase());
  });

  const activeMappings = employees.filter((employee) => employee.is_active !== false).length;
  const linkedUsers = employees.filter((employee) => employee.user_id).length;
  const manualOverrides = employees.filter((employee) => employee.manual_override).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EnterpriseCard>
          <div className="text-3xl font-bold text-blue-600">{activeMappings}</div>
          <div className="text-sm text-gray-500">{copy.activeMappings}</div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-3xl font-bold text-green-600">{linkedUsers}</div>
          <div className="text-sm text-gray-500">{copy.linkedUsers}</div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-3xl font-bold text-amber-600">{manualOverrides}</div>
          <div className="text-sm text-gray-500">{copy.manualOverrides}</div>
        </EnterpriseCard>
      </div>

      <EnterpriseCard>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">{copy.employeeMappings}
              <InfoTooltip title="Was hier sichtbar ist" side="right" width="w-96">
                <p>Hier sehen Sie die Datenbasis für persönliche Teams-Nachrichten. Ohne Mapping kann ODIN einen Mitarbeiter zwar fachlich auswählen, aber nicht persönlich in Teams adressieren.</p>
                <p><strong>Mailquelle:</strong> Zeigt, aus welchem Prozess die Adresse stammt. <strong>Override:</strong> Markiert manuell gepflegte Werte.</p>
              </InfoTooltip>
            </h3>
            <p className="text-sm text-gray-500">{copy.filterHint}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchNameOrMail}
              className="w-72 border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
            />
            <button onClick={load} className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">
              <RefreshCw className="w-4 h-4" /> {copy.refresh}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="py-2 px-3">{copy.employee}</th>
                <th className="py-2 px-3">{copy.teamsMail}</th>
                <th className="py-2 px-3">{copy.mailSource}</th>
                <th className="py-2 px-3">{copy.override}</th>
                <th className="py-2 px-3">{copy.odinUser}</th>
                <th className="py-2 px-3">{copy.lastUpdated}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={`${employee.employee_name}-${employee.email || 'nomail'}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 px-3 font-medium">{employee.employee_name}</td>
                  <td className="py-2 px-3">{employee.email || "–"}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{employee.email_source || "–"}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${employee.manual_override ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                      {employee.manual_override ? copy.manual : copy.automatic}
                    </span>
                  </td>
                  <td className="py-2 px-3">{employee.user_id ? `User #${employee.user_id}` : copy.notLinked}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{new Date(employee.updated_at).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">{copy.noEmployees}</div>
        )}
      </EnterpriseCard>
    </div>
  );
}

/* ================================================ */
/* EVENTS TAB                                       */
/* ================================================ */

function EventsTab() {
  const [events, setEvents] = useState<TeamsEventConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEvents(await fetchTeamsEvents()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEvent = async (e: TeamsEventConfig) => {
    try {
      const updated = await updateTeamsEvent(e.event_key, { enabled: !e.enabled });
      setEvents(prev => prev.map(ev => ev.event_key === e.event_key ? updated : ev));
    } catch (err) { console.error(err); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-4">Welche ODIN-Events lösen Teams-Nachrichten aus? Jedes Event kann einzeln aktiviert/deaktiviert und konfiguriert werden.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Aktiv
                  <InfoTooltip title="Event aktiv/inaktiv">
                    <p>Schaltet das Event ein oder aus. Inaktive Events lösen <em>keine</em> Teams-Nachrichten aus, auch wenn die Bedingung im System eintritt.</p>
                    <p><strong>Wichtig:</strong> Deaktivierung betrifft nur den Nachrichtenversand. Das Event selbst wird weiterhin im System erkannt und geloggt.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">Event</th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Priorität
                  <InfoTooltip title="Event-Priorität">
                    <p>Bestimmt die Dringlichkeit der Nachricht. P1 = höchste Priorität (z. B. kritische Störungen), P5 = niedrigste.</p>
                    <p><strong>Auswirkung:</strong> Höhere Prioritäten umgehen ggf. Quiet Hours und Digest-Bündelung. P1-Nachrichten werden auch nachts gesendet, wenn „Nur kritische nachts" aktiv ist.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Modus
                  <InfoTooltip title="Sendemodus">
                    <p><strong>Sofort:</strong> Nachricht wird unmittelbar bei Event-Eintritt versendet.</p>
                    <p><strong>Digest:</strong> Nachricht wird gesammelt und im nächsten Digest-Intervall gebündelt versendet. Reduziert die Anzahl einzelner Benachrichtigungen.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Quiet Hours
                  <InfoTooltip title="Quiet Hours beachten">
                    <p>Wenn „Ja": Außerhalb der konfigurierten Betriebszeiten wird die Nachricht zurückgehalten und erst nach Ende der Quiet Hours gesendet.</p>
                    <p>Wenn „Nein": Nachricht wird unabhängig von der Uhrzeit sofort gesendet.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Cooldown
                  <InfoTooltip title="Cooldown-Dauer">
                    <p>Mindestzeit zwischen zwei aufeinanderfolgenden Nachrichten desselben Event-Typs. Verhindert Nachrichtenflut bei häufig auftretenden Events.</p>
                    <p><strong>Beispiel:</strong> 30 min Cooldown = nach einer „Crawler stale"-Nachricht wird frühestens 30 Minuten später eine weitere gesendet.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Duplikatschutz
                  <InfoTooltip title="Duplikatschutz">
                    <p>Verhindert, dass identische Nachrichten innerhalb des Duplikat-Fensters mehrfach gesendet werden.</p>
                    <p><strong>Beispiel:</strong> Wenn dasselbe Ticket in zwei aufeinanderfolgenden Runs identisch zugewiesen wird, wird die Nachricht nur einmal gesendet.</p>
                  </InfoTooltip>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map(e => (
              <tr key={e.event_key} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3">
                  <button onClick={() => toggleEvent(e)} className="focus:outline-none">
                    {e.enabled
                      ? <ToggleRight className="w-6 h-6 text-green-500" />
                      : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                  </button>
                </td>
                <td className="py-2 px-3 font-medium">{e.label}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.priority <= 1 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : e.priority <= 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                    P{e.priority}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500">{e.send_mode === "immediate" ? "Sofort" : "Digest"}</td>
                <td className="py-2 px-3">{e.respect_quiet_hours ? "Ja" : "Nein"}</td>
                <td className="py-2 px-3">{e.cooldown_minutes > 0 ? `${e.cooldown_minutes} min` : "–"}</td>
                <td className="py-2 px-3">{e.deduplicate ? "Ja" : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================ */
/* ROUTING TAB                                      */
/* ================================================ */

function RoutingTab() {
  const [rules, setRules] = useState<TeamsRoutingRule[]>([]);
  const [events, setEvents] = useState<TeamsEventConfig[]>([]);
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState<{ event_key: string; target_type: TeamsRoutingRule["target_type"]; target_value: string }>({ event_key: "", target_type: "person", target_value: "" });
  const [groupDraft, setGroupDraft] = useState({ name: "", description: "", recipients: "" });
  const [savingGroups, setSavingGroups] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, e, settings] = await Promise.all([fetchTeamsRouting(), fetchTeamsEvents(), fetchTeamsSettings()]);
      setRules(r);
      setEvents(e);
      setGroups(parseRecipientGroups(settings.recipient_groups));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRule = async () => {
    if (!newRule.event_key || !newRule.target_value) return;
    try {
      const created = await createTeamsRoutingRule(newRule);
      setRules(prev => [...prev, created]);
      setNewRule({ event_key: "", target_type: "person", target_value: "" });
      setShowAdd(false);
    } catch (err) { console.error(err); }
  };

  const removeRule = async (id: number) => {
    try {
      await deleteTeamsRoutingRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
  };

  const saveGroups = async (nextGroups: RecipientGroup[]) => {
    setSavingGroups(true);
    try {
      await updateTeamsSettings({ recipient_groups: JSON.stringify(nextGroups) });
      setGroups(nextGroups);
    } catch (err) {
      console.error(err);
    }
    setSavingGroups(false);
  };

  const addGroup = async () => {
    const name = groupDraft.name.trim();
    if (!name) return;

    const nextGroup: RecipientGroup = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `group-${Date.now()}`,
      name,
      description: groupDraft.description.trim(),
      recipients: groupDraft.recipients.split(",").map((entry) => entry.trim()).filter(Boolean),
    };

    const nextGroups = [...groups.filter((group) => group.name.toLowerCase() !== name.toLowerCase()), nextGroup]
      .sort((left, right) => left.name.localeCompare(right.name, "de-DE"));
    await saveGroups(nextGroups);
    setGroupDraft({ name: "", description: "", recipients: "" });
  };

  const removeGroup = async (groupId: string) => {
    await saveGroups(groups.filter((group) => group.id !== groupId));
  };

  if (loading) return <LoadingSpinner />;

  // Group by event_key
  const grouped = rules.reduce<Record<string, TeamsRoutingRule[]>>((acc, r) => {
    (acc[r.event_key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              Empfängergruppen
              <InfoTooltip title="Empfängergruppen" side="right" width="w-96">
                <p>Hier definieren Sie wiederverwendbare Gruppenbezeichnungen für das Routing, z. B. „Dispatcher", „Shift Leads" oder „Management".</p>
                <p>Die Gruppe wird danach im Routing als Zieltyp <strong>Gruppe</strong> verwendet und muss nicht jedes Mal neu getippt werden.</p>
              </InfoTooltip>
            </div>
            <p className="mt-1 text-sm text-gray-500">Speichert saubere, nachvollziehbare Routing-Ziele statt freier Einzelfelder.</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {groups.length === 0 && <div className="text-sm text-gray-400">Noch keine Empfängergruppen gespeichert.</div>}
              {groups.map((group) => (
                <div key={group.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{group.name}</span>
                    <span className="text-[10px] text-gray-400">{group.recipients.length} Empfänger</span>
                    <button onClick={() => removeGroup(group.id)} disabled={savingGroups} className="text-xs text-red-500 hover:text-red-700">Entfernen</button>
                  </div>
                  {group.description && <div className="mt-1 text-xs text-gray-500">{group.description}</div>}
                  {group.recipients.length > 0 && <div className="mt-1 text-xs text-gray-400">{group.recipients.join(", ")}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm font-semibold">Neue Gruppe anlegen</div>
            <input value={groupDraft.name} onChange={(event) => setGroupDraft((state) => ({ ...state, name: event.target.value }))} placeholder="Gruppenname" className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />
            <input value={groupDraft.description} onChange={(event) => setGroupDraft((state) => ({ ...state, description: event.target.value }))} placeholder="Beschreibung" className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />
            <textarea value={groupDraft.recipients} onChange={(event) => setGroupDraft((state) => ({ ...state, recipients: event.target.value }))} rows={3} placeholder="Empfänger kommasepariert, z. B. dispatcher@firma.de, lead@firma.de" className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />
            <button onClick={addGroup} disabled={savingGroups} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">{savingGroups ? "Speichert..." : "Gruppe speichern"}</button>
          </div>
        </div>
      </EnterpriseCard>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 flex items-center gap-1.5">
          Routing-Regeln: Welche Events gehen an wen?
          <InfoTooltip title="Routing-Regeln" side="right" width="w-96">
            <p>Routing-Regeln bestimmen, welche Personen oder Gruppen bei welchen Events eine Teams-Nachricht erhalten.</p>
            <p><strong>Zieltypen:</strong></p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li><strong>Person:</strong> Einzelne Person (Name oder E-Mail)</li>
              <li><strong>Gruppe:</strong> Z. B. „Dispatcher", „Management", „Leads"</li>
              <li><strong>Rolle:</strong> Schichtrolle (z. B. „dispatcher", „smarthands")</li>
              <li><strong>Schicht:</strong> Aktive Schichtgruppe (z. B. „E1", „L2")</li>
            </ul>
            <p><strong>Beispiel:</strong> Event „Trouble Ticket High" → Routing an Person „Schichtleiter" + Gruppe „Dispatcher".</p>
          </InfoTooltip>
        </p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + Regel hinzufügen
        </button>
      </div>

      {showAdd && (
        <EnterpriseCard>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Event</label>
              <select value={newRule.event_key} onChange={e => setNewRule(p => ({ ...p, event_key: e.target.value }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
                <option value="">Wählen...</option>
                {events.map(e => <option key={e.event_key} value={e.event_key}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Zieltyp</label>
              <select value={newRule.target_type} onChange={e => setNewRule(p => ({ ...p, target_type: e.target.value as any }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
                <option value="person">Person</option>
                <option value="group">Gruppe</option>
                <option value="role">Rolle</option>
                <option value="shift">Schicht</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Zielwert</label>
              <input value={newRule.target_value} onChange={e => setNewRule(p => ({ ...p, target_value: e.target.value }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800" placeholder="Name / Gruppe / Rolle" />
              {newRule.target_type === "group" && groups.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 max-w-md">
                  {groups.map((group) => (
                    <button key={group.id} type="button" onClick={() => setNewRule((state) => ({ ...state, target_value: group.name }))} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30">
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={addRule} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">Speichern</button>
          </div>
        </EnterpriseCard>
      )}

      {Object.entries(grouped).map(([eventKey, eventRules]) => (
        <EnterpriseCard key={eventKey}>
          <h3 className="text-sm font-semibold mb-2">{eventRules[0]?.event_label || eventKey}</h3>
          <div className="space-y-1">
            {eventRules.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1 px-2 rounded bg-gray-50 dark:bg-gray-800/50 text-sm">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{r.target_type}</span>
                  <div>
                    <div>{r.target_value}</div>
                    {r.target_type === "group" && groups.find((group) => group.name === r.target_value)?.description && (
                      <div className="text-xs text-gray-400">{groups.find((group) => group.name === r.target_value)?.description}</div>
                    )}
                  </div>
                  {!r.enabled && <span className="text-xs text-gray-400">(deaktiviert)</span>}
                </div>
                <button onClick={() => removeRule(r.id)} className="text-red-500 hover:text-red-700 text-xs">Entfernen</button>
              </div>
            ))}
          </div>
        </EnterpriseCard>
      ))}
      {Object.keys(grouped).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">Noch keine Routing-Regeln definiert.</div>
      )}
    </div>
  );
}

/* ================================================ */
/* TEMPLATES TAB                                    */
/* ================================================ */

function TemplatesTab() {
  const [templates, setTemplates] = useState<TeamsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await fetchTeamsTemplates()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (t: TeamsTemplate) => {
    setEditing(t.template_key);
    setEditBody(t.body_text);
    setPreview(null);
  };

  const saveEdit = async (key: string) => {
    try {
      const updated = await updateTeamsTemplate(key, { body_text: editBody });
      setTemplates(prev => prev.map(t => t.template_key === key ? updated : t));
      setEditing(null);
    } catch (err) { console.error(err); }
  };

  const showPreview = async () => {
    try {
      const result = await previewTemplate(editBody);
      setPreview(result.rendered);
    } catch (err) { console.error(err); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
        Nachrichtenvorlagen mit Platzhaltern.
        <InfoTooltip title="Template-System" side="right" width="w-96">
          <p>Templates definieren den Text, der bei einem Event als Teams-Nachricht versendet wird. Platzhalter werden beim Versand automatisch mit den tatsächlichen Werten ersetzt.</p>
          <p><strong>Verfügbare Platzhalter:</strong></p>
          <ul className="list-disc ml-4 space-y-0.5 font-mono text-[10px]">
            <li>{"{{employeeName}}"} — Name des Mitarbeiters</li>
            <li>{"{{ticketId}}"} — Ticket-Nummer</li>
            <li>{"{{systemName}}"} — Betroffenes System</li>
            <li>{"{{restTime}}"} — Verbleibende Zeit bis Commit</li>
            <li>{"{{priority}}"} — Ticket-Priorität</li>
            <li>{"{{shift}}"} — Aktuelle Schicht</li>
            <li>{"{{reason}}"} — Ereignisgrund</li>
          </ul>
          <p><strong>Tipp:</strong> Verwenden Sie die Vorschau-Funktion, um das gerenderte Template mit Beispieldaten zu prüfen.</p>
        </InfoTooltip>
      </p>
      {templates.map(t => (
        <EnterpriseCard key={t.template_key}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-sm font-semibold">{t.title}</h3>
              <span className="text-xs text-gray-400">{t.template_key}</span>
            </div>
            {editing !== t.template_key && (
              <button onClick={() => startEdit(t)} className="text-xs text-blue-600 hover:text-blue-800">Bearbeiten</button>
            )}
          </div>

          {editing === t.template_key ? (
            <div className="space-y-2">
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                className="w-full border dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-800 min-h-20"
                rows={4}
              />
              <div className="flex gap-2">
                <button onClick={showPreview} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Vorschau</button>
                <button onClick={() => saveEdit(t.template_key)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Speichern</button>
                <button onClick={() => setEditing(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
              </div>
              {preview && (
                <div className="mt-2 p-3 rounded bg-blue-50 dark:bg-blue-900/20 text-sm border border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-blue-600 font-semibold mb-1">Vorschau:</div>
                  <div>{preview}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800/50 rounded p-2">{t.body_text}</div>
          )}

          <div className="flex gap-3 mt-2 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-0.5">Deep-Link: {t.include_deep_link ? "Ja" : "Nein"}
              <InfoTooltip title="Deep-Link">
                <p>Fügt der Nachricht einen direkten Link zum Ticket im OES-System hinzu. Der Empfänger kann mit einem Klick zum Ticket springen.</p>
                <p><strong>Empfehlung:</strong> Immer aktiviert lassen, um die Reaktionszeit zu verkürzen.</p>
              </InfoTooltip>
            </span>
            <span className="flex items-center gap-0.5">Ticketdetails: {t.include_ticket_details ? "Ja" : "Nein"}
              <InfoTooltip title="Ticketdetails">
                <p>Blendet eine Zusammenfassung der Ticketdaten direkt in der Nachricht ein (System, Kategorie, Erstelldatum).</p>
                <p><strong>Vorteil:</strong> Empfänger sieht sofort den Kontext, ohne das Ticket öffnen zu müssen.</p>
              </InfoTooltip>
            </span>
            <span className="flex items-center gap-0.5">Restzeit: {t.include_remaining_time ? "Ja" : "Nein"}
              <InfoTooltip title="Restzeit">
                <p>Zeigt die verbleibende SLA-Zeit bis zum nächsten Commit-Termin an. Hilft dem Empfänger, die Dringlichkeit einzuschätzen.</p>
                <p><strong>Hinweis:</strong> Nur sinnvoll bei Tickets mit SLA-Bindung.</p>
              </InfoTooltip>
            </span>
            <span className="flex items-center gap-0.5">Prioritätsbadge: {t.include_priority_badge ? "Ja" : "Nein"}
              <InfoTooltip title="Prioritätsbadge">
                <p>Fügt ein farbiges Badge (P1–P4) in die Nachricht ein, das die Priorität visuell hervorhebt.</p>
                <p><strong>Effekt:</strong> Empfänger erkennt auf einen Blick, ob sofortiges Handeln nötig ist.</p>
              </InfoTooltip>
            </span>
          </div>
        </EnterpriseCard>
      ))}
    </div>
  );
}

/* ================================================ */
/* TEST CENTER TAB                                  */
/* ================================================ */

function TestCenterTab() {
  const { copy } = useTeamsUi();
  const [channel, setChannel] = useState<"channel" | "personal">("channel");
  const [title, setTitle] = useState("ODIN Test Message");
  const [body, setBody] = useState("Dies ist eine Testnachricht von ODIN.");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  const [templates, setTemplates] = useState<TeamsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    fetchTeamsTemplates().then(setTemplates).catch(console.error);
  }, []);

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    try {
      await sendTeamsTestMessage({ channel, title, body });
      setResult({ success: true, message: "Testnachricht erfolgreich gesendet!" });
    } catch (err: any) {
      setResult({ success: false, message: err?.response?.data?.error || "Senden fehlgeschlagen" });
    }
    setSending(false);
  };

  const sendTemplateTest = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    setResult(null);
    try {
      const res = await testTeamsTemplate(selectedTemplate, channel);
      setResult({ success: true, message: `Template "${selectedTemplate}" gesendet!` });
    } catch (err: any) {
      setResult({ success: false, message: err?.response?.data?.error || "Template-Test fehlgeschlagen" });
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Manual Test */}
      <EnterpriseCard>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">Manuelle Testnachricht
          <InfoTooltip title="Manuelle Testnachricht">
            <p>Sendet eine frei formulierte Nachricht über den konfigurierten Teams-Kanal oder als persönliche Nachricht an den Fallback-Empfänger.</p>
            <p><strong>Zweck:</strong> Prüfen, ob die Webhook-/Bot-Verbindung funktioniert, ohne ein echtes Event auszulösen.</p>
            <p><strong>Hinweis:</strong> Diese Nachricht erscheint im Log, wird aber nicht als Event-Benachrichtigung gezählt.</p>
          </InfoTooltip>
        </h3>
        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={channel === "channel"} onChange={() => setChannel("channel")} /> Channel
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={channel === "personal"} onChange={() => setChannel("personal")} /> Personal
            </label>
            <InfoTooltip title="Kanal vs. Persönlich">
              <p><strong>Channel:</strong> Nachricht wird in den konfigurierten Teams-Kanal gepostet (sichtbar für alle Kanalmitglieder).</p>
              <p><strong>Personal:</strong> Nachricht wird als 1:1-Chat an den Fallback-Empfänger gesendet (privat).</p>
              <p><strong>Tipp:</strong> Nutzen Sie „Personal" für vertrauliche Tests und „Channel" um die Kanalanbindung zu verifizieren.</p>
            </InfoTooltip>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel" className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Nachricht" rows={3} className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />
          <button onClick={sendTest} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Testnachricht senden
          </button>
        </div>
      </EnterpriseCard>

      {/* Template Test */}
      <EnterpriseCard>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">Template testen
          <InfoTooltip title="Template-Test">
            <p>Sendet ein konkretes Template mit Beispieldaten über den gewählten Kanal. Die Platzhalter werden mit Testdaten befüllt.</p>
            <p><strong>Nutzen:</strong> Prüft, ob das Template korrekt gerendert wird und alle Platzhalter aufgelöst werden.</p>
            <p><strong>Wichtig:</strong> Die Testnachricht wird im Log unter „test" vermerkt.</p>
          </InfoTooltip>
        </h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800">
              <option value="">Template auswählen...</option>
              {templates.map(t => <option key={t.template_key} value={t.template_key}>{t.title}</option>)}
            </select>
          </div>
          <button onClick={sendTemplateTest} disabled={!selectedTemplate || sending} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
            <Play className="w-4 h-4" /> Testen
          </button>
        </div>
      </EnterpriseCard>

      {/* Result */}
      {result && (
        <div className={`p-3 rounded text-sm ${result.success ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {result.success ? <CheckCircle2 className="w-4 h-4 inline mr-2" /> : <XCircle className="w-4 h-4 inline mr-2" />}
          {result.message}
        </div>
      )}
    </div>
  );
}

/* ================================================ */
/* LOG TAB                                          */
/* ================================================ */

function LogTab() {
  const { copy, locale } = useTeamsUi();
  const [data, setData] = useState<{ rows: TeamsMessageLog[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchTeamsLog({ ...filter, limit: 100 })); } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <select value={filter.status || ""} onChange={e => setFilter(f => ({ ...f, status: e.target.value || undefined }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
          <option value="">{copy.statusFilterAll}</option>
          <option value="sent">{copy.sent}</option>
          <option value="failed">{copy.failed}</option>
        </select>
        <InfoTooltip title="Status-Filter">
          <p><strong>Gesendet:</strong> Nachricht wurde erfolgreich an Teams übermittelt (HTTP 200/202).</p>
          <p><strong>Fehlgeschlagen:</strong> Nachricht konnte nicht zugestellt werden – siehe Fehlerspalte für Details.</p>
          <p>Der Filter zeigt nur die letzten 100 Einträge an.</p>
        </InfoTooltip>
        <button onClick={load} className="text-sm text-blue-600 hover:underline">{copy.refresh}</button>
        <span className="text-xs text-gray-400">{data.total} {copy.entriesTotal}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="py-2 px-3"><span className="flex items-center gap-1">{copy.status} <InfoTooltip title="Status"><p>Grüner Haken = zugestellt. Rotes X = fehlgeschlagen. Fehlgeschlagene Nachrichten können im Errors-Tab erneut versendet werden.</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">{copy.time} <InfoTooltip title="Zeitpunkt"><p>Zeitpunkt der Übergabe an die Teams-API (nicht Zustellzeitpunkt beim Empfänger).</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">{copy.type} <InfoTooltip title="Nachrichtentyp"><p>Der Event-Typ, der die Nachricht ausgelöst hat (z.B. assignment, escalation, handover, test).</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">{copy.recipient} <InfoTooltip title="Empfänger"><p>Teams-Kanal oder Person. „–" bedeutet Broadcast an den Standardkanal.</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">{copy.content} <InfoTooltip title="Inhalt"><p>Gekürzte Vorschau des Nachrichteninhalts.</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">{copy.error} <InfoTooltip title="Fehlermeldung"><p>Technische Fehlermeldung bei fehlgeschlagener Zustellung. Häufige Ursachen: ungültiger Webhook, Netzwerkfehler, Bot-Token abgelaufen.</p></InfoTooltip></span></th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(msg => (
              <tr key={msg.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3">
                  {msg.status === "sent"
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />}
                </td>
                <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{new Date(msg.sent_at).toLocaleString(locale)}</td>
                <td className="py-2 px-3">{msg.message_type}</td>
                <td className="py-2 px-3">{msg.recipient || "–"}</td>
                <td className="py-2 px-3 max-w-xs truncate">{msg.content}</td>
                <td className="py-2 px-3 text-xs text-red-500 max-w-xs truncate">{msg.error_msg || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================ */
/* ERRORS TAB                                       */
/* ================================================ */

function ErrorsTab() {
  const { copy, locale } = useTeamsUi();
  const [errors, setErrors] = useState<TeamsMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setErrors(await fetchTeamsErrors()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const retry = async (id: number) => {
    setRetrying(id);
    try {
      await retryTeamsMessage(id);
      setErrors(prev => prev.filter(e => e.id !== id));
    } catch (err) { console.error(err); }
    setRetrying(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">{copy.failedMessages}
        <InfoTooltip title="Fehler & Retry" width="w-96">
          <p>Hier werden alle Nachrichten aufgelistet, deren Zustellung fehlgeschlagen ist. Mögliche Ursachen:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li><strong>Webhook ungültig:</strong> Die URL ist abgelaufen oder wurde in Teams gelöscht.</li>
            <li><strong>Netzwerkfehler:</strong> Der Backend-Server konnte die Teams-API nicht erreichen.</li>
            <li><strong>Bot-Token abgelaufen:</strong> Das OAuth-Token muss erneuert werden.</li>
            <li><strong>Rate Limit:</strong> Zu viele Nachrichten in kurzer Zeit – Teams drosselt die API.</li>
          </ul>
          <p><strong>Retry:</strong> Klicken Sie auf „Retry", um die Nachricht erneut zu senden. Bei Erfolg wird sie aus der Liste entfernt und im Log als „sent" vermerkt.</p>
        </InfoTooltip>
      </p>
      {errors.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
          {copy.noFailedMessages}
        </div>
      ) : errors.map(e => (
        <EnterpriseCard key={e.id}>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {e.message_type} – {new Date(e.sent_at).toLocaleString(locale)}
              </div>
              <div className="text-xs text-gray-500">{e.content}</div>
              <div className="text-xs text-red-500 font-mono">{e.error_msg}</div>
            </div>
            <button
              onClick={() => retry(e.id)}
              disabled={retrying === e.id}
              className="flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded hover:bg-orange-200 disabled:opacity-50"
            >
              {retrying === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              {copy.retry}
            </button>
          </div>
        </EnterpriseCard>
      ))}
    </div>
  );
}

/* ================================================ */
/* SETTINGS TAB                                     */
/* ================================================ */

function SettingsTab() {
  const { copy } = useTeamsUi();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSettings(await fetchTeamsSettings()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateTeamsSettings(settings);
      setSettings(updated);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const coreFields: SettingField[] = [
    { key: "quiet_hours_start", label: "Quiet Hours Start", type: "text", tooltip: <><p>Beginn der Ruhezeit im Format HH:MM (z.B. „22:00"). Während der Quiet Hours werden nur kritische Nachrichten zugestellt.</p><p><strong>Tipp:</strong> Setzen Sie den Wert auf die Uhrzeit, ab der Ihr Team nicht mehr im Dienst ist.</p></> },
    { key: "quiet_hours_end", label: "Quiet Hours Ende", type: "text", tooltip: <><p>Ende der Ruhezeit im Format HH:MM (z.B. „06:00"). Ab diesem Zeitpunkt werden alle Nachrichten wieder normal versendet.</p><p><strong>Aufgeschobene Nachrichten:</strong> Nicht-kritische Nachrichten aus der Nacht werden als Digest zusammengefasst.</p></> },
    { key: "quiet_hours_critical_only", label: "Nur kritische nachts", type: "toggle", tooltip: <><p>Wenn aktiv, werden während der Quiet Hours nur Nachrichten mit kritischer Priorität (P1) sofort zugestellt. Alle anderen werden bis zum Ende der Ruhezeit zurückgehalten.</p><p><strong>Deaktiviert:</strong> Alle Nachrichten werden auch nachts sofort gesendet.</p></> },
    { key: "daily_max_messages", label: "Max. Nachrichten/Tag", type: "number", tooltip: <><p>Maximale Anzahl an Teams-Nachrichten pro Tag. Bei Überschreitung werden weitere Nachrichten in eine Warteschlange gestellt.</p><p><strong>Zweck:</strong> Schützt vor Nachrichtenflut bei Massenevents. Empfehlung: 200–500 je nach Teamgröße.</p></> },
    { key: "digest_interval_minutes", label: "Digest-Intervall (Min)", type: "number", tooltip: <><p>Zeitraum in Minuten, in dem ähnliche Nachrichten zu einem Digest zusammengefasst werden, statt einzeln gesendet zu werden.</p><p><strong>Beispiel:</strong> Bei 15 Min werden alle Assignment-Benachrichtigungen innerhalb von 15 Min zu einer einzelnen Zusammenfassung gebündelt.</p></> },
    { key: "cooldown_default_minutes", label: "Cooldown Standard (Min)", type: "number", tooltip: <><p>Mindestabstand in Minuten zwischen zwei Nachrichten desselben Typs an denselben Empfänger. Verhindert Spam bei schnell aufeinanderfolgenden Events.</p><p><strong>Empfehlung:</strong> 5–15 Minuten, je nach Benachrichtigungstyp.</p></> },
    { key: "escalation_delay_minutes", label: "Eskalationsverzögerung (Min)", type: "number", tooltip: <><p>Wartezeit in Minuten, bevor eine Eskalationsnachricht gesendet wird. Gibt dem primären Empfänger Zeit zu reagieren, bevor die Eskalation greift.</p><p><strong>Beispiel:</strong> Bei 30 Min wird die Eskalation erst 30 Min nach der ersten Benachrichtigung ausgelöst, falls keine Reaktion erfolgt.</p></> },
    { key: "fallback_recipient", label: "Fallback-Empfänger", type: "text", tooltip: <><p>Teams-Benutzer-ID oder E-Mail-Adresse, die als Empfänger verwendet wird, wenn kein spezifischer Empfänger ermittelt werden kann.</p><p><strong>Typisch:</strong> Teamleiter oder Dispatcher-Mailbox. Wird auch für persönliche Testnachrichten verwendet.</p></> },
    { key: "deduplicate_window_minutes", label: "Duplikat-Fenster (Min)", type: "number", tooltip: <><p>Zeitfenster in Minuten, innerhalb dessen identische Nachrichten (gleicher Typ, gleicher Empfänger, gleicher Inhalt) als Duplikat erkannt und unterdrückt werden.</p><p><strong>Empfehlung:</strong> 10–30 Minuten. Zu kurz = Spam, zu lang = verzögerte Updates.</p></> },
  ];

  const dispatcherFields: SettingField[] = [
    { key: "dispatcher_manual_review_notify_systems", label: "System-Ausschlüsse melden", type: "toggle", tooltip: <><p>Wenn aktiv, erhalten Dispatcher eine Teams-Nachricht, sobald ein Ticket wegen Systemname aus ODIN ausgeschlossen und in den manuellen Review geschoben wird.</p><p>Diese Einstellung ist bereits mit der Backend-Logik verdrahtet.</p></> },
    { key: "dispatcher_manual_review_notify_subtypes", label: "Subtype-Ausschlüsse melden", type: "toggle", tooltip: <><p>Wenn aktiv, werden manuelle Reviews aufgrund eines ausgeschlossenen Subtypes sofort an Dispatcher gemeldet.</p><p>Dadurch sieht das Team früh, welche Tickets bewusst nicht automatisch verteilt wurden.</p></> },
    { key: "dispatcher_manual_review_live_only", label: "Nur im Live-Modus senden", type: "toggle", tooltip: <><p>Begrenzt die Dispatcher-Benachrichtigung auf echte Live-Läufe.</p><p>Dry-Run- und Shadow-Run-Szenarien bleiben damit ruhig.</p></> },
    { key: "dispatcher_manual_review_recipients", label: "Direkte Empfänger", type: "text", tooltip: <><p>Kommaseparierte Liste aus E-Mail-Adressen oder Mitarbeiterkennungen für die direkte Zustellung.</p><p>ODIN versucht zuerst die persönliche Zustellung über den Bot-Pfad, falls dieser vorhanden ist.</p></>, placeholder: "dispatcher@firma.de, schichtleitung@firma.de" },
    { key: "dispatcher_manual_review_shift_filter", label: "Nur für bestimmte Schichten", type: "text", tooltip: <><p>Optionaler Schichtfilter, z. B. 1,2 oder D,N. Nur aktive Mitarbeiter aus diesen Schichten werden als Empfänger berücksichtigt.</p><p>So lassen sich Nachtdispatcher und Tagesdispatch getrennt steuern.</p></>, placeholder: "1,2,N" },
    { key: "dispatcher_manual_review_group_targets", label: "Gruppen-Ziele", type: "text", tooltip: <><p>Kommaseparierte Gruppennamen für den späteren Gruppenversand oder Fallback-Zusammenfassungen.</p><p>Die Gruppennamen sollten mit den Routing-Gruppen abgestimmt sein.</p></>, placeholder: "Dispatcher, Shift Leads" },
    { key: "dispatcher_manual_review_channel_fallback", label: "Kanal-Fallback erlauben", type: "toggle", tooltip: <><p>Wenn persönliche Zustellung nicht möglich ist, darf ODIN stattdessen eine Kanal- oder Sammelnachricht erzeugen.</p><p>Empfohlen, solange nicht alle Mitarbeiter sauber im Bot gemappt sind.</p></> },
    { key: "dispatcher_manual_review_title", label: "Titel-Vorlage", type: "text", tooltip: <><p>Optionaler eigener Nachrichtentitel für manuelle Reviews.</p><p>Freilassen bedeutet: der Standardtitel aus dem Backend wird verwendet.</p></>, placeholder: "Manual Review für Dispatcher" },
    { key: "dispatcher_manual_review_body", label: "Text-Vorlage", type: "textarea", tooltip: <><p>Optionaler Nachrichtentext für Dispatcher-Benachrichtigungen. Unterstützt Platzhalter wie <code>{"{{ticketId}}"}</code>, <code>{"{{systemName}}"}</code>, <code>{"{{reason}}"}</code> und <code>{"{{category}}"}</code>.</p><p>Wenn leer, verwendet das Backend den Standardtext.</p></>, placeholder: "Ticket {{ticketId}} wurde wegen {{reason}} in den manuellen Review verschoben." },
    { key: "bot_internal_base_url", label: "Bot-Base-URL", type: "text", tooltip: <><p>Interne Basis-URL des Teams-Bots für persönliche Zustellung.</p><p>Nur notwendig, wenn persönliche Bot-Benachrichtigungen aus dem Backend genutzt werden sollen.</p></>, placeholder: "http://teams-bot:3978" },
  ];

  const orchestrationFields: SettingField[] = [
    { key: "notification_timing_matrix", label: "Wann soll wer eine Nachricht bekommen", type: "textarea", tooltip: <><p>Freie Regelmatrix für künftige erweiterte Benachrichtigungslogik.</p><p>Empfohlenes Format pro Zeile: <code>trigger|zieltyp|ziel|bedingung</code>.</p></>, placeholder: "manual_review|group|Dispatcher|live-only\nassignment|shift|N|priority=P1" },
    { key: "standard_person_shift_messages", label: "Standardnachrichten für Personen/Schichten", type: "textarea", tooltip: <><p>Speichert Standardtexte für bestimmte Personen in bestimmten Schichten.</p><p>Empfohlenes Format pro Zeile: <code>schicht|person|nachricht</code>.</p></>, placeholder: "N|dispatcher@firma.de|Bitte Ticket sofort prüfen." },
    { key: "standard_group_messages", label: "Standardnachrichten für Gruppen", type: "textarea", tooltip: <><p>Speichert Gruppen- oder Rollenansprachen für spätere automatische Verwendung.</p><p>Empfohlenes Format pro Zeile: <code>gruppe|trigger|nachricht</code>.</p></>, placeholder: "Dispatcher|manual_review|Bitte manuell priorisieren." },
  ];

  const updateValue = (key: string, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="grid gap-4 md:grid-cols-3">
          <SettingsSummaryTile title="Dispatcher-Review" value={`${asEnabledLabel(settings.dispatcher_manual_review_notify_systems)} / ${asEnabledLabel(settings.dispatcher_manual_review_notify_subtypes)}`} hint="System- und Subtype-Ausschlüsse" />
          <SettingsSummaryTile title="Zustellpfad" value={settings.bot_internal_base_url ? "Bot + Fallback" : "Webhook / Fallback"} hint="Personen und Kanalsteuerung" />
          <SettingsSummaryTile title="Routing-Vorbereitung" value={settings.notification_timing_matrix ? "Erweitert konfiguriert" : "Basis"} hint="Wer bekommt wann welche Nachricht" />
        </div>
      </EnterpriseCard>

      <SettingsSectionCard title="Globale Versandregeln" description="Basisverhalten für Ruhezeiten, Deduplizierung und Eskalation.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coreFields.map((field) => (
            <SettingInput key={field.key} field={field} value={settings[field.key] || ""} onChange={updateValue} />
          ))}
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Dispatcher bei ausgeschlossenen Tickets" description="Diese Einstellungen steuern die neue Backend-Benachrichtigung für Tickets, die wegen Systemname oder Subtype in den manuellen Review laufen.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dispatcherFields.map((field) => (
            <SettingInput key={field.key} field={field} value={settings[field.key] || ""} onChange={updateValue} />
          ))}
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Nachrichten-Orchestrierung" description="Vorbereitung für feinere Regeln wie personenspezifische Standardsätze, Gruppenansprache und zeitabhängige Zustellung.">
        <div className="grid grid-cols-1 gap-4">
          {orchestrationFields.map((field) => (
            <SettingInput key={field.key} field={field} value={settings[field.key] || ""} onChange={updateValue} />
          ))}
        </div>
      </SettingsSectionCard>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
          {copy.save}
        </button>
      </div>
    </div>
  );
}

type SettingField = {
  key: string;
  label: string;
  type: "text" | "number" | "toggle" | "textarea";
  tooltip: React.ReactNode;
  placeholder?: string;
};

function SettingsSectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <EnterpriseCard>
      <div className="mb-4">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</div>
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      {children}
    </EnterpriseCard>
  );
}

function SettingsSummaryTile({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
      <div className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</div>
    </div>
  );
}

function SettingInput({ field, value, onChange }: { field: SettingField; value: string; onChange: (key: string, value: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
        {field.label}
        <InfoTooltip title={field.label}>{field.tooltip}</InfoTooltip>
      </label>
      {field.type === "toggle" ? (
        <button
          onClick={() => onChange(field.key, value === "true" ? "false" : "true")}
          className="focus:outline-none"
          type="button"
        >
          {value === "true"
            ? <ToggleRight className="w-6 h-6 text-green-500" />
            : <ToggleLeft className="w-6 h-6 text-gray-400" />}
        </button>
      ) : field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(event) => onChange(field.key, event.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
        />
      ) : (
        <input
          type={field.type}
          value={value}
          onChange={(event) => onChange(field.key, event.target.value)}
          placeholder={field.placeholder}
          className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
        />
      )}
    </div>
  );
}

function asEnabledLabel(value: string | undefined) {
  return value === "true" ? "An" : "Aus";
}

function CapabilityCard({ label, active, tooltip }: { label: string; active: boolean; tooltip?: string }) {
  const { copy } = useTeamsUi();
  return (
    <EnterpriseCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
          {label}
          {tooltip && (
            <InfoTooltip title={label} side="right">
              <p>{tooltip}</p>
            </InfoTooltip>
          )}
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
          {active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {active ? copy.active : copy.inactive}
        </div>
      </div>
    </EnterpriseCard>
  );
}

function DiagnosticCheckCard({ check }: { check: TeamsDiagnosticCheck }) {
  const badgeClass = check.status === "ok"
    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
    : check.status === "warning"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
      : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400";
  const explanation = DIAGNOSTIC_HELP[check.key];

  return (
    <EnterpriseCard>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">{check.title}</h3>
              {explanation && (
                <InfoTooltip title={explanation.title} side="right" width="w-96">
                  <p><strong>Kurz:</strong> {explanation.summary}</p>
                  <p>{explanation.detail}</p>
                </InfoTooltip>
              )}
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
              {check.status === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : check.status === "warning" ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {check.status === "ok" ? "OK" : check.status === "warning" ? "Hinweis" : "Fehler"}
            </span>
          </div>

          {explanation && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
              <strong>Warum dieser Check wichtig ist:</strong> {explanation.summary}
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Pruefschritt</div>
              <div className="text-gray-700 dark:text-gray-300">{check.action}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Ergebnis</div>
              <div className="text-gray-700 dark:text-gray-300">{check.detail}</div>
            </div>
            {check.next_step && (
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Naechster Schritt</div>
                <div className="text-gray-700 dark:text-gray-300">{check.next_step}</div>
              </div>
            )}
          </div>
        </div>

        {check.data && Object.keys(check.data).length > 0 && (
          <div className="w-full md:w-80 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/60">
            <div className="mb-2 font-semibold text-gray-600 dark:text-gray-300">Technische Details</div>
            <div className="space-y-1.5">
              {Object.entries(check.data).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <span className="text-gray-500 dark:text-gray-400">{key}</span>
                  <span className="break-all text-right text-gray-700 dark:text-gray-200">{formatDiagnosticValue(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </EnterpriseCard>
  );
}

function formatDiagnosticValue(value: unknown) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

/* ================================================ */
/* SHARED COMPONENTS                                 */
/* ================================================ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
      <XCircle className="w-4 h-4 inline mr-2" />
      {message}
    </div>
  );
}
