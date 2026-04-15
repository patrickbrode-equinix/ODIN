import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../api/api";
import { useAuth } from "./AuthContext";

export type LanguageCode = "de" | "en" | "sq" | "bs" | "fr" | "es" | "pt-BR" | "fa-AF";

export type TranslationKey =
  | "header.crawlerUpdate"
  | "header.noCurrentCrawlerData"
  | "header.activeTickets"
  | "header.shiftplan"
  | "header.noUpdateAvailable"
  | "header.infos"
  | "header.teamsActive"
  | "header.teamsInactive"
  | "header.odinLogicActive"
  | "header.odinLogicInactive"
  | "header.systemMetrics"
  | "common.settings"
  | "common.logout"
  | "common.language"
  | "common.themeDark"
  | "common.themeLight"
  | "nav.dashboard"
  | "nav.shiftplan"
  | "nav.handover"
  | "nav.tickets"
  | "nav.tvDashboard"
  | "nav.protokoll"
  | "nav.commitCompliance"
  | "nav.odinLogic"
  | "nav.shiftplanControl"
  | "nav.teamsCenter"
  | "nav.adminSettings"
  | "nav.userManagement"
  | "nav.statistics"
  | "nav.ticketAudit"
  | "nav.weekPlanning"
  | "nav.teamsNotifications"
  | "nav.automatedAssignment"
  | "nav.operationsNode"
  | "settings.title"
  | "settings.personalAppSettings"
  | "settings.changePassword"
  | "settings.startPasswordChange"
  | "settings.securityRequirement"
  | "settings.securityRequirementBody"
  | "settings.profile"
  | "settings.name"
  | "settings.email"
  | "settings.location"
  | "settings.team"
  | "settings.activeSince"
  | "settings.lastLogin"
  | "settings.app"
  | "settings.language"
  | "settings.theme"
  | "settings.notifications"
  | "settings.emailNotifications"
  | "settings.browserNotifications"
  | "settings.shiftReminders"
  | "settings.shiftPreferences"
  | "settings.shiftPreferencesBody"
  | "settings.systemThresholds"
  | "settings.loading";

type LanguageOption = {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  shortLabel: string;
  dir?: "ltr" | "rtl";
};

type LanguageContextValue = {
  language: LanguageCode;
  languages: LanguageOption[];
  setLanguage: (nextLanguage: LanguageCode, options?: { persist?: boolean }) => Promise<void>;
  t: (key: TranslationKey) => string;
  direction: "ltr" | "rtl";
};

const DEFAULT_LANGUAGE: LanguageCode = "de";
const STORAGE_KEY = "odin.language";

export const LANGUAGE_TO_LOCALE: Record<LanguageCode, string> = {
  de: "de-DE",
  en: "en-US",
  sq: "sq-AL",
  bs: "bs-BA",
  fr: "fr-FR",
  es: "es-ES",
  "pt-BR": "pt-BR",
  "fa-AF": "fa-AF",
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "de", label: "Deutsch", nativeLabel: "Deutsch", shortLabel: "DE" },
  { code: "en", label: "English", nativeLabel: "English", shortLabel: "EN" },
  { code: "sq", label: "Albanisch", nativeLabel: "Shqip", shortLabel: "SQ" },
  { code: "bs", label: "Bosnisch", nativeLabel: "Bosanski", shortLabel: "BS" },
  { code: "fr", label: "Französisch", nativeLabel: "Français", shortLabel: "FR" },
  { code: "es", label: "Spanisch", nativeLabel: "Español", shortLabel: "ES" },
  { code: "pt-BR", label: "Portugiesisch (Brasilien)", nativeLabel: "Português (Brasil)", shortLabel: "PT" },
  { code: "fa-AF", label: "Dari (Afghanistan)", nativeLabel: "دری (افغانستان)", shortLabel: "دری", dir: "rtl" },
];

const TRANSLATIONS: Record<TranslationKey, Record<LanguageCode, string>> = {
  "header.crawlerUpdate": {
    de: "Crawler-Update",
    en: "Crawler update",
    sq: "Përditësimi i crawler-it",
    bs: "Ažuriranje crawlera",
    fr: "Mise à jour du crawler",
    es: "Actualización del crawler",
    "pt-BR": "Atualização do crawler",
    "fa-AF": "به‌روزرسانی خزنده",
  },
  "header.noCurrentCrawlerData": {
    de: "Keine aktuellen Crawler-Daten",
    en: "No current crawler data",
    sq: "Nuk ka të dhëna aktuale nga crawler-i",
    bs: "Nema aktuelnih crawler podataka",
    fr: "Aucune donnée crawler actuelle",
    es: "No hay datos actuales del crawler",
    "pt-BR": "Sem dados atuais do crawler",
    "fa-AF": "دادهٔ تازه از خزنده موجود نیست",
  },
  "header.activeTickets": {
    de: "Aktive Tickets",
    en: "Active tickets",
    sq: "Tiketat aktive",
    bs: "Aktivni tiketi",
    fr: "Tickets actifs",
    es: "Tickets activos",
    "pt-BR": "Tickets ativos",
    "fa-AF": "تیکت‌های فعال",
  },
  "header.shiftplan": {
    de: "Schichtplan",
    en: "Shift plan",
    sq: "Plani i ndërrimeve",
    bs: "Plan smjena",
    fr: "Planning des shifts",
    es: "Plan de turnos",
    "pt-BR": "Plano de turnos",
    "fa-AF": "برنامه شیفت",
  },
  "header.noUpdateAvailable": {
    de: "Kein Update verfügbar",
    en: "No update available",
    sq: "Asnjë përditësim i disponueshëm",
    bs: "Nema dostupnog ažuriranja",
    fr: "Aucune mise à jour disponible",
    es: "No hay actualización disponible",
    "pt-BR": "Nenhuma atualização disponível",
    "fa-AF": "به‌روزرسانی در دسترس نیست",
  },
  "header.infos": {
    de: "Infos",
    en: "Info",
    sq: "Informacione",
    bs: "Informacije",
    fr: "Infos",
    es: "Información",
    "pt-BR": "Informações",
    "fa-AF": "اطلاعات",
  },
  "header.teamsActive": {
    de: "Teams aktiv",
    en: "Teams active",
    sq: "Teams aktiv",
    bs: "Teams aktivan",
    fr: "Teams actif",
    es: "Teams activo",
    "pt-BR": "Teams ativo",
    "fa-AF": "Teams فعال",
  },
  "header.teamsInactive": {
    de: "Teams inaktiv",
    en: "Teams inactive",
    sq: "Teams joaktiv",
    bs: "Teams neaktivan",
    fr: "Teams inactif",
    es: "Teams inactivo",
    "pt-BR": "Teams inativo",
    "fa-AF": "Teams غیرفعال",
  },
  "header.odinLogicActive": {
    de: "ODIN-Logik aktiv",
    en: "ODIN logic active",
    sq: "Logjika ODIN aktive",
    bs: "ODIN logika aktivna",
    fr: "Logique ODIN active",
    es: "Lógica ODIN activa",
    "pt-BR": "Lógica ODIN ativa",
    "fa-AF": "منطق ODIN فعال",
  },
  "header.odinLogicInactive": {
    de: "ODIN-Logik inaktiv",
    en: "ODIN logic inactive",
    sq: "Logjika ODIN joaktive",
    bs: "ODIN logika neaktivna",
    fr: "Logique ODIN inactive",
    es: "Lógica ODIN inactiva",
    "pt-BR": "Lógica ODIN inativa",
    "fa-AF": "منطق ODIN غیرفعال",
  },
  "header.systemMetrics": {
    de: "Systemmetriken",
    en: "System metrics",
    sq: "Metrikat e sistemit",
    bs: "Sistemske metrike",
    fr: "Métriques système",
    es: "Métricas del sistema",
    "pt-BR": "Métricas do sistema",
    "fa-AF": "شاخص‌های سیستم",
  },
  "common.settings": {
    de: "Einstellungen",
    en: "Settings",
    sq: "Cilësimet",
    bs: "Postavke",
    fr: "Paramètres",
    es: "Ajustes",
    "pt-BR": "Configurações",
    "fa-AF": "تنظیمات",
  },
  "common.logout": {
    de: "Abmelden",
    en: "Log out",
    sq: "Dilni",
    bs: "Odjava",
    fr: "Se déconnecter",
    es: "Cerrar sesión",
    "pt-BR": "Sair",
    "fa-AF": "خروج",
  },
  "common.language": {
    de: "Sprache",
    en: "Language",
    sq: "Gjuha",
    bs: "Jezik",
    fr: "Langue",
    es: "Idioma",
    "pt-BR": "Idioma",
    "fa-AF": "زبان",
  },
  "common.themeDark": {
    de: "Dunkel",
    en: "Dark",
    sq: "Errët",
    bs: "Tamno",
    fr: "Sombre",
    es: "Oscuro",
    "pt-BR": "Escuro",
    "fa-AF": "تیره",
  },
  "common.themeLight": {
    de: "Hell",
    en: "Light",
    sq: "Ndriçuar",
    bs: "Svijetlo",
    fr: "Clair",
    es: "Claro",
    "pt-BR": "Claro",
    "fa-AF": "روشن",
  },
  "nav.dashboard": {
    de: "Dashboard",
    en: "Dashboard",
    sq: "Paneli",
    bs: "Nadzorna ploča",
    fr: "Tableau de bord",
    es: "Panel",
    "pt-BR": "Painel",
    "fa-AF": "داشبورد",
  },
  "nav.shiftplan": {
    de: "Schichtplan",
    en: "Shift plan",
    sq: "Plani i ndërrimeve",
    bs: "Plan smjena",
    fr: "Planning des shifts",
    es: "Plan de turnos",
    "pt-BR": "Plano de turnos",
    "fa-AF": "برنامه شیفت",
  },
  "nav.handover": {
    de: "Handover",
    en: "Handover",
    sq: "Dorëzim",
    bs: "Primopredaja",
    fr: "Relève",
    es: "Relevo",
    "pt-BR": "Passagem de turno",
    "fa-AF": "تحویل شیفت",
  },
  "nav.tickets": {
    de: "Tickets",
    en: "Tickets",
    sq: "Tiketat",
    bs: "Tiketi",
    fr: "Tickets",
    es: "Tickets",
    "pt-BR": "Tickets",
    "fa-AF": "تیکت‌ها",
  },
  "nav.tvDashboard": {
    de: "TV Dashboard",
    en: "TV dashboard",
    sq: "Paneli TV",
    bs: "TV nadzorna ploča",
    fr: "Tableau TV",
    es: "Panel TV",
    "pt-BR": "Painel TV",
    "fa-AF": "داشبورد تلویزیون",
  },
  "nav.protokoll": {
    de: "Protokoll",
    en: "Log",
    sq: "Protokolli",
    bs: "Protokol",
    fr: "Journal",
    es: "Protocolo",
    "pt-BR": "Protocolo",
    "fa-AF": "گزارش",
  },
  "nav.commitCompliance": {
    de: "Commit Compliance",
    en: "Commit compliance",
    sq: "Përputhshmëria e commit-eve",
    bs: "Usklađenost commit-a",
    fr: "Conformité des commits",
    es: "Cumplimiento de commits",
    "pt-BR": "Conformidade de commits",
    "fa-AF": "انطباق کامیت‌ها",
  },
  "nav.odinLogic": {
    de: "ODIN-Logik",
    en: "ODIN logic",
    sq: "Logjika ODIN",
    bs: "ODIN logika",
    fr: "Logique ODIN",
    es: "Lógica ODIN",
    "pt-BR": "Lógica ODIN",
    "fa-AF": "منطق ODIN",
  },
  "nav.shiftplanControl": {
    de: "Schichtplaner",
    en: "Shift planner",
    sq: "Planifikuesi i ndërrimeve",
    bs: "Planer smjena",
    fr: "Planificateur de shifts",
    es: "Planificador de turnos",
    "pt-BR": "Planejador de turnos",
    "fa-AF": "برنامه‌ریز شیفت",
  },
  "nav.teamsCenter": {
    de: "Teams Center",
    en: "Teams center",
    sq: "Qendra Teams",
    bs: "Teams centar",
    fr: "Centre Teams",
    es: "Centro de Teams",
    "pt-BR": "Central Teams",
    "fa-AF": "مرکز Teams",
  },
  "nav.adminSettings": {
    de: "Admin Settings",
    en: "Admin settings",
    sq: "Cilësimet e administratorit",
    bs: "Admin postavke",
    fr: "Paramètres admin",
    es: "Ajustes de administrador",
    "pt-BR": "Configurações de admin",
    "fa-AF": "تنظیمات مدیر",
  },
  "nav.userManagement": {
    de: "User Management",
    en: "User management",
    sq: "Menaxhimi i përdoruesve",
    bs: "Upravljanje korisnicima",
    fr: "Gestion des utilisateurs",
    es: "Gestión de usuarios",
    "pt-BR": "Gerenciamento de usuários",
    "fa-AF": "مدیریت کاربران",
  },
  "nav.statistics": {
    de: "Statistiken",
    en: "Statistics",
    sq: "Statistikat",
    bs: "Statistike",
    fr: "Statistiques",
    es: "Estadísticas",
    "pt-BR": "Estatísticas",
    "fa-AF": "آمار",
  },
  "nav.ticketAudit": {
    de: "Ticket-Audit",
    en: "Ticket audit",
    sq: "Auditimi i tiketave",
    bs: "Revizija tiketa",
    fr: "Audit des tickets",
    es: "Auditoría de tickets",
    "pt-BR": "Auditoria de tickets",
    "fa-AF": "بررسی تیکت‌ها",
  },
  "nav.weekPlanning": {
    de: "Wochenplanung",
    en: "Week planning",
    sq: "Planifikimi javor",
    bs: "Sedmično planiranje",
    fr: "Planification hebdomadaire",
    es: "Planificación semanal",
    "pt-BR": "Planejamento semanal",
    "fa-AF": "برنامه‌ریزی هفتگی",
  },
  "nav.teamsNotifications": {
    de: "Teams Benachrichtigungen",
    en: "Teams notifications",
    sq: "Njoftimet Teams",
    bs: "Teams obavijesti",
    fr: "Notifications Teams",
    es: "Notificaciones de Teams",
    "pt-BR": "Notificações do Teams",
    "fa-AF": "اعلان‌های Teams",
  },
  "nav.automatedAssignment": {
    de: "Automated Assignment",
    en: "Automated assignment",
    sq: "Caktim automatik",
    bs: "Automatska dodjela",
    fr: "Attribution automatique",
    es: "Asignación automática",
    "pt-BR": "Atribuição automática",
    "fa-AF": "واگذاری خودکار",
  },
  "nav.operationsNode": {
    de: "Operations Dispatching and Intelligence Node",
    en: "Operations Dispatching and Intelligence Node",
    sq: "Nyja e Operacioneve, Dispeçimit dhe Inteligjencës",
    bs: "Čvor za operacije, dispečing i inteligenciju",
    fr: "Nœud d'opérations, de dispatching et d'intelligence",
    es: "Nodo de operaciones, despacho e inteligencia",
    "pt-BR": "Nó de operações, despacho e inteligência",
    "fa-AF": "گره عملیات، دیسپچ و هوشمندی",
  },
  "settings.title": {
    de: "EINSTELLUNGEN",
    en: "SETTINGS",
    sq: "CILËSIMET",
    bs: "POSTAVKE",
    fr: "PARAMÈTRES",
    es: "AJUSTES",
    "pt-BR": "CONFIGURAÇÕES",
    "fa-AF": "تنظیمات",
  },
  "settings.personalAppSettings": {
    de: "Persönliche App-Einstellungen",
    en: "Personal app settings",
    sq: "Cilësimet personale të aplikacionit",
    bs: "Lične postavke aplikacije",
    fr: "Paramètres personnels de l'application",
    es: "Ajustes personales de la aplicación",
    "pt-BR": "Configurações pessoais do aplicativo",
    "fa-AF": "تنظیمات شخصی برنامه",
  },
  "settings.changePassword": {
    de: "Passwort ändern",
    en: "Change password",
    sq: "Ndrysho fjalëkalimin",
    bs: "Promijeni lozinku",
    fr: "Changer le mot de passe",
    es: "Cambiar contraseña",
    "pt-BR": "Alterar senha",
    "fa-AF": "تغییر رمز عبور",
  },
  "settings.startPasswordChange": {
    de: "Startpasswort ändern",
    en: "Change starter password",
    sq: "Ndrysho fjalëkalimin fillestar",
    bs: "Promijeni početnu lozinku",
    fr: "Changer le mot de passe initial",
    es: "Cambiar la contraseña inicial",
    "pt-BR": "Alterar senha inicial",
    "fa-AF": "تغییر رمز آغازین",
  },
  "settings.securityRequirement": {
    de: "Sicherheitsvorgabe",
    en: "Security requirement",
    sq: "Kërkesë sigurie",
    bs: "Sigurnosni zahtjev",
    fr: "Exigence de sécurité",
    es: "Requisito de seguridad",
    "pt-BR": "Exigência de segurança",
    "fa-AF": "الزام امنیتی",
  },
  "settings.securityRequirementBody": {
    de: "Dieses Konto verwendet noch das initiale Passwort. Bitte ändere es jetzt. Bis dahin bleibt ODIN auf diese Seite beschränkt.",
    en: "This account is still using the initial password. Please change it now. Until then, ODIN remains limited to this page.",
    sq: "Kjo llogari ende përdor fjalëkalimin fillestar. Ju lutem ndryshojeni tani. Deri atëherë, ODIN mbetet i kufizuar në këtë faqe.",
    bs: "Ovaj račun još koristi početnu lozinku. Molimo promijenite je sada. Do tada je ODIN ograničen na ovu stranicu.",
    fr: "Ce compte utilise encore le mot de passe initial. Veuillez le modifier maintenant. D'ici là, ODIN reste limité à cette page.",
    es: "Esta cuenta aún usa la contraseña inicial. Cámbiala ahora. Hasta entonces, ODIN queda limitado a esta página.",
    "pt-BR": "Esta conta ainda usa a senha inicial. Altere-a agora. Até lá, o ODIN fica limitado a esta página.",
    "fa-AF": "این حساب هنوز از رمز عبور اولیه استفاده می‌کند. لطفاً همین حالا آن را تغییر دهید. تا آن زمان، ODIN به همین صفحه محدود می‌ماند.",
  },
  "settings.profile": {
    de: "Profil",
    en: "Profile",
    sq: "Profili",
    bs: "Profil",
    fr: "Profil",
    es: "Perfil",
    "pt-BR": "Perfil",
    "fa-AF": "پروفایل",
  },
  "settings.name": {
    de: "Name",
    en: "Name",
    sq: "Emri",
    bs: "Ime",
    fr: "Nom",
    es: "Nombre",
    "pt-BR": "Nome",
    "fa-AF": "نام",
  },
  "settings.email": {
    de: "E-Mail",
    en: "Email",
    sq: "Email",
    bs: "E-mail",
    fr: "E-mail",
    es: "Correo electrónico",
    "pt-BR": "E-mail",
    "fa-AF": "ایمیل",
  },
  "settings.location": {
    de: "Standort",
    en: "Location",
    sq: "Lokacioni",
    bs: "Lokacija",
    fr: "Site",
    es: "Ubicación",
    "pt-BR": "Localização",
    "fa-AF": "موقعیت",
  },
  "settings.team": {
    de: "Team",
    en: "Team",
    sq: "Ekipi",
    bs: "Tim",
    fr: "Équipe",
    es: "Equipo",
    "pt-BR": "Equipe",
    "fa-AF": "تیم",
  },
  "settings.activeSince": {
    de: "Aktiv seit",
    en: "Active since",
    sq: "Aktiv që nga",
    bs: "Aktivan od",
    fr: "Actif depuis",
    es: "Activo desde",
    "pt-BR": "Ativo desde",
    "fa-AF": "فعال از",
  },
  "settings.lastLogin": {
    de: "Letzter Login",
    en: "Last login",
    sq: "Hyrja e fundit",
    bs: "Posljednja prijava",
    fr: "Dernière connexion",
    es: "Último inicio de sesión",
    "pt-BR": "Último login",
    "fa-AF": "آخرین ورود",
  },
  "settings.app": {
    de: "App",
    en: "App",
    sq: "Aplikacioni",
    bs: "Aplikacija",
    fr: "Application",
    es: "Aplicación",
    "pt-BR": "Aplicativo",
    "fa-AF": "برنامه",
  },
  "settings.language": {
    de: "Sprache",
    en: "Language",
    sq: "Gjuha",
    bs: "Jezik",
    fr: "Langue",
    es: "Idioma",
    "pt-BR": "Idioma",
    "fa-AF": "زبان",
  },
  "settings.theme": {
    de: "Theme",
    en: "Theme",
    sq: "Tema",
    bs: "Tema",
    fr: "Thème",
    es: "Tema",
    "pt-BR": "Tema",
    "fa-AF": "تم",
  },
  "settings.notifications": {
    de: "Benachrichtigungen",
    en: "Notifications",
    sq: "Njoftimet",
    bs: "Obavijesti",
    fr: "Notifications",
    es: "Notificaciones",
    "pt-BR": "Notificações",
    "fa-AF": "اعلان‌ها",
  },
  "settings.emailNotifications": {
    de: "E-Mail Benachrichtigungen",
    en: "Email notifications",
    sq: "Njoftimet me email",
    bs: "E-mail obavijesti",
    fr: "Notifications e-mail",
    es: "Notificaciones por correo",
    "pt-BR": "Notificações por e-mail",
    "fa-AF": "اعلان‌های ایمیلی",
  },
  "settings.browserNotifications": {
    de: "Browser Benachrichtigungen",
    en: "Browser notifications",
    sq: "Njoftimet e shfletuesit",
    bs: "Obavijesti preglednika",
    fr: "Notifications du navigateur",
    es: "Notificaciones del navegador",
    "pt-BR": "Notificações do navegador",
    "fa-AF": "اعلان‌های مرورگر",
  },
  "settings.shiftReminders": {
    de: "Schicht-Erinnerungen",
    en: "Shift reminders",
    sq: "Kujtesat e ndërrimit",
    bs: "Podsjetnici za smjenu",
    fr: "Rappels de shift",
    es: "Recordatorios de turno",
    "pt-BR": "Lembretes de turno",
    "fa-AF": "یادآوری‌های شیفت",
  },
  "settings.shiftPreferences": {
    de: "Schichtplan-Wünsche",
    en: "Shift preferences",
    sq: "Preferencat e ndërrimeve",
    bs: "Želje za smjene",
    fr: "Préférences de shift",
    es: "Preferencias de turno",
    "pt-BR": "Preferências de turno",
    "fa-AF": "ترجیحات شیفت",
  },
  "settings.shiftPreferencesBody": {
    de: "Lege deine bevorzugten und unerwünschten Schichten, verfügbare Tage und weitere Wünsche fest. Diese werden bei der automatischen Schichtplanung berücksichtigt.",
    en: "Define your preferred and unwanted shifts, available days, and further wishes. These are considered during automatic shift planning.",
    sq: "Përcakto ndërrimet e preferuara dhe të padëshiruara, ditët e disponueshme dhe dëshirat e tjera. Këto merren parasysh gjatë planifikimit automatik.",
    bs: "Postavite željene i nepoželjne smjene, dostupne dane i druge želje. To se uzima u obzir tokom automatskog planiranja smjena.",
    fr: "Définissez vos shifts préférés et indésirables, vos jours disponibles et d'autres souhaits. Ils sont pris en compte lors de la planification automatique.",
    es: "Define tus turnos preferidos y no deseados, los días disponibles y otras preferencias. Se tienen en cuenta en la planificación automática.",
    "pt-BR": "Defina seus turnos preferidos e indesejados, dias disponíveis e outras preferências. Isso é considerado no planejamento automático.",
    "fa-AF": "شیفت‌های دلخواه و نامطلوب، روزهای در دسترس و سایر خواسته‌های خود را تعیین کنید. این موارد در برنامه‌ریزی خودکار شیفت در نظر گرفته می‌شوند.",
  },
  "settings.systemThresholds": {
    de: "System-Schwellenwerte",
    en: "System thresholds",
    sq: "Pragjet e sistemit",
    bs: "Sistemski pragovi",
    fr: "Seuils système",
    es: "Umbrales del sistema",
    "pt-BR": "Limiares do sistema",
    "fa-AF": "آستانه‌های سیستم",
  },
  "settings.loading": {
    de: "Lade Einstellungen…",
    en: "Loading settings...",
    sq: "Po ngarkohen cilësimet...",
    bs: "Učitavanje postavki...",
    fr: "Chargement des paramètres...",
    es: "Cargando ajustes...",
    "pt-BR": "Carregando configurações...",
    "fa-AF": "در حال بارگیری تنظیمات...",
  },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGE_OPTIONS.some((option) => option.code === value);
}

function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
}

function getLanguageDirection(language: LanguageCode): "ltr" | "rtl" {
  return LANGUAGE_OPTIONS.find((option) => option.code === language)?.dir || "ltr";
}

export function getLanguageLocale(language: LanguageCode): string {
  return LANGUAGE_TO_LOCALE[language] || LANGUAGE_TO_LOCALE[DEFAULT_LANGUAGE];
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dir = getLanguageDirection(language);
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    async function loadUserLanguage() {
      if (!user) return;
      try {
        const { data } = await api.get("/user/settings");
        const nextLanguage = isLanguageCode(data?.language) ? data.language : DEFAULT_LANGUAGE;
        if (!cancelled) {
          setLanguageState(nextLanguage);
        }
      } catch {
        // Non-fatal: keep local language state.
      }
    }

    loadUserLanguage();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setLanguage = useCallback(async (nextLanguage: LanguageCode, options?: { persist?: boolean }) => {
    const persist = options?.persist !== false;
    setLanguageState(nextLanguage);
    if (persist && user) {
      await api.put("/user/settings", { language: nextLanguage });
    }
  }, [user]);

  const t = useCallback((key: TranslationKey) => {
    return TRANSLATIONS[key]?.[language] || TRANSLATIONS[key]?.[DEFAULT_LANGUAGE] || key;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    languages: LANGUAGE_OPTIONS,
    setLanguage,
    t,
    direction: getLanguageDirection(language),
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}