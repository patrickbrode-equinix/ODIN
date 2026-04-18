/* ------------------------------------------------ */
/* USERS – USER MANAGEMENT PAGE                     */
/* ------------------------------------------------ */

import { useEffect, useMemo, useState } from "react";
import { Plus, CheckCircle, Shield, Trash2, Users as UsersIcon } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";

import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/api";
import { fetchSkills, type EmployeeSkills } from "../../api/coverage";
import { useLanguage, getLanguageLocale } from "../../context/LanguageContext";
import { formatAbsoluteDateTime, formatRelativeTime } from "../../utils/loginStatus";

import { AddUserModal } from "../users/AddUserModal";
import { UserAccessModal } from "../users/UserAccessModal";

/* ------------------------------------------------ */
/* TYPES                                           */
/* ------------------------------------------------ */

interface User {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  group: string;
  department?: string | null;
  approved: boolean;
  isAdmin: boolean;
  isRoot?: boolean;
  provisionedFromShiftplan?: boolean;
  provisionedEmployeeName?: string | null;
  createdAt: string;
  lastLogin: string | null;
}

/* ------------------------------------------------ */
/* HELPERS                                         */
/* ------------------------------------------------ */

function renderApproval(approved: boolean, copy: (typeof USERS_COPY)[keyof typeof USERS_COPY]) {
  return approved ? (
    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
      {copy.active}
    </Badge>
  ) : (
    <Badge className="border-orange-500/30 bg-orange-500/15 text-orange-400">
      {copy.pending}
    </Badge>
  );
}

function getDisplayName(user: User) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

function getCompetenceTarget(user: User) {
  return user.provisionedEmployeeName?.trim() || getDisplayName(user);
}

function getTopRatedSkills(skillProfile?: EmployeeSkills, limit = 2) {
  return Object.entries(skillProfile?.rated_skills || {})
    .map(([skill, rating]) => ({ skill, rating: Number.parseInt(String(rating ?? "0"), 10) }))
    .filter((entry) => Number.isInteger(entry.rating) && entry.rating > 0)
    .sort((left, right) => right.rating - left.rating || left.skill.localeCompare(right.skill, "de"))
    .slice(0, limit);
}

const USERS_COPY = {
  de: {
    title: "USER MANAGEMENT",
    subtitle: "Benutzer, Rechte und Login-Status verwalten",
    addUser: "User anlegen",
    introExternal: "Hier koennen auch Nutzer angelegt werden, die nicht im Schichtplan stehen. Das ist fuer andere Teams oder reine Ticketverteilung gedacht.",
    introCompetence: "Kompetenzprofile werden in den Schichtplan-Einstellungen gepflegt und hier nur zur Einordnung angezeigt.",
    user: "User",
    department: "Abteilung",
    source: "Quelle",
    competence: "Kompetenz",
    login: "Login",
    role: "Rolle",
    status: "Status",
    actions: "Aktionen",
    loading: "User werden geladen…",
    empty: "Keine User gefunden",
    shiftplan: "Shiftplan",
    external: "Extern / anderes Team",
    noProfile: "Noch kein Profil",
    profile: "Profil",
    neverLoggedIn: "Noch nie eingeloggt",
    lastLogin: "Letzter Login",
    ago: "vor",
    active: "Aktiv",
    pending: "Ausstehend",
    root: "Root",
    admin: "Admin",
    userRole: "User",
    rights: "Rechte",
    approve: "Freigeben",
    delete: "Loeschen",
    deleteConfirm: "User wirklich loeschen?",
    deleteFinal: "Dieser Vorgang ist endgueltig.",
    adminToggle: "Admin",
  },
  en: {
    title: "USER MANAGEMENT",
    subtitle: "Manage users, access rights, and login status",
    addUser: "Add user",
    introExternal: "You can also create users that are not part of the shift plan, for example for other teams or ticket distribution only.",
    introCompetence: "Competence profiles stay in shift admin settings and are shown here as read-only context.",
    user: "User",
    department: "Department",
    source: "Source",
    competence: "Competence",
    login: "Login",
    role: "Role",
    status: "Status",
    actions: "Actions",
    loading: "Loading users…",
    empty: "No users found",
    shiftplan: "Shiftplan",
    external: "External / other team",
    noProfile: "No profile yet",
    profile: "Profile",
    neverLoggedIn: "Never logged in",
    lastLogin: "Last login",
    ago: "ago",
    active: "Active",
    pending: "Pending",
    root: "Root",
    admin: "Admin",
    userRole: "User",
    rights: "Rights",
    approve: "Approve",
    delete: "Delete",
    deleteConfirm: "Delete user now?",
    deleteFinal: "This action is permanent.",
    adminToggle: "Admin",
  },
  ro: {
    title: "USER MANAGEMENT",
    subtitle: "Administrare utilizatori, drepturi si stare de login",
    addUser: "Adauga utilizator",
    introExternal: "Aici pot fi creati si utilizatori care nu exista in planul de ture, de exemplu pentru alte echipe sau doar pentru distributia tichetelor.",
    introCompetence: "Profilurile de competenta raman in setarile de administrare a turelor si sunt afisate aici doar informativ.",
    user: "Utilizator",
    department: "Departament",
    source: "Sursa",
    competence: "Competenta",
    login: "Login",
    role: "Rol",
    status: "Stare",
    actions: "Actiuni",
    loading: "Se incarca utilizatorii…",
    empty: "Nu au fost gasiti utilizatori",
    shiftplan: "Shiftplan",
    external: "Extern / alta echipa",
    noProfile: "Inca fara profil",
    profile: "Profil",
    neverLoggedIn: "Nu s-a autentificat niciodata",
    lastLogin: "Ultima autentificare",
    ago: "in urma",
    active: "Activ",
    pending: "In asteptare",
    root: "Root",
    admin: "Admin",
    userRole: "Utilizator",
    rights: "Drepturi",
    approve: "Aproba",
    delete: "Sterge",
    deleteConfirm: "Stergi acest utilizator?",
    deleteFinal: "Aceasta actiune este definitiva.",
    adminToggle: "Admin",
  },
  ar: {
    title: "إدارة المستخدمين",
    subtitle: "إدارة المستخدمين والصلاحيات وحالة تسجيل الدخول",
    addUser: "إضافة مستخدم",
    introExternal: "يمكن أيضاً إنشاء مستخدمين غير موجودين في خطة الشفت، مثلاً لفرق أخرى أو لتوزيع التذاكر فقط.",
    introCompetence: "تبقى ملفات الكفاءة في إعدادات إدارة الشفت وتُعرض هنا للقراءة فقط.",
    user: "المستخدم",
    department: "القسم",
    source: "المصدر",
    competence: "الكفاءة",
    login: "تسجيل الدخول",
    role: "الدور",
    status: "الحالة",
    actions: "الإجراءات",
    loading: "جارٍ تحميل المستخدمين…",
    empty: "لم يتم العثور على مستخدمين",
    shiftplan: "Shiftplan",
    external: "خارجي / فريق آخر",
    noProfile: "لا يوجد ملف بعد",
    profile: "الملف",
    neverLoggedIn: "لم يسجل الدخول من قبل",
    lastLogin: "آخر تسجيل دخول",
    ago: "منذ",
    active: "نشط",
    pending: "قيد الانتظار",
    root: "Root",
    admin: "Admin",
    userRole: "مستخدم",
    rights: "الصلاحيات",
    approve: "اعتماد",
    delete: "حذف",
    deleteConfirm: "هل تريد حذف هذا المستخدم؟",
    deleteFinal: "هذا الإجراء نهائي.",
    adminToggle: "Admin",
  },
} as const;

function getLoginDotClass(hasLoggedIn: boolean) {
  return hasLoggedIn ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" : "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.45)]";
}

/* ------------------------------------------------ */
/* COMPONENT                                       */
/* ------------------------------------------------ */

export default function Users() {
  const { user: currentUser, canAccess } = useAuth();
  const { language } = useLanguage();
  const locale = getLanguageLocale(language);
  const copy = USERS_COPY[language as keyof typeof USERS_COPY] || USERS_COPY.en;

  /* 🔑 WRITE = darf verwalten */
  const canManageUsers = canAccess("user_management", "write");

  /* ------------------------------------------------ */
  /* STATE                                           */
  /* ------------------------------------------------ */

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillProfiles, setSkillProfiles] = useState<Record<string, EmployeeSkills>>({});

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<User | null>(null);

  /* ------------------------------------------------ */
  /* LOAD USERS                                      */
  /* ------------------------------------------------ */

  async function loadUsers() {
    try {
      const res = await api.get<User[]>("/admin/users");
      const list = Array.isArray(res.data) ? res.data : [];
      setUsers(list);
    } catch (err) {
      console.error("LOAD USERS ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompetenceContext() {
    try {
      const skills = await fetchSkills();

      setSkillProfiles(
        Object.fromEntries(skills.map((entry) => [entry.employee_name, entry]))
      );
    } catch (err) {
      console.error("LOAD COMPETENCE ERROR:", err);
    }
  }

  useEffect(() => {
    loadUsers();
    loadCompetenceContext();
  }, []);

  /* ------------------------------------------------ */
  /* UPDATE USER (APPROVAL ONLY)                      */
  /* ------------------------------------------------ */

  async function updateUser(userId: number, patch: Partial<User>) {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...patch } : u))
    );

    try {
      await api.patch(`/admin/users/${userId}`, patch);
    } catch (err) {
      console.error("USER UPDATE ERROR:", err);
      loadUsers();
    }
  }

  /* ------------------------------------------------ */
  /* DELETE USER                                     */
  /* ------------------------------------------------ */

  async function deleteUser(userId: number, email: string) {
    const ok = window.confirm(
      `${copy.deleteConfirm}\n\n${email}\n\n${copy.deleteFinal}`
    );
    if (!ok) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      loadUsers();
    } catch (err) {
      console.error("DELETE USER ERROR:", err);
      loadUsers();
    }
  }

  const userRows = useMemo(
    () => users.map((user) => ({
      user,
      displayName: getDisplayName(user),
      competenceTarget: getCompetenceTarget(user),
    })),
    [users]
  );

  /* ------------------------------------------------ */
  /* RENDER                                          */
  /* ------------------------------------------------ */

  return (
    <EnterprisePageShell>
      {/* HEADER */}
      <EnterpriseHeader
        title={copy.title}
        subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{copy.subtitle}</span>}
        icon={<UsersIcon className="w-5 h-5 text-indigo-400" />}
        rightContent={
          canManageUsers && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-indigo-600/90 hover:bg-indigo-600 text-white shadow-sm border-transparent"
                onClick={() => setAddUserOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                {copy.addUser}
              </Button>
            </div>
          )
        }
      />

      <EnterpriseCard className="mb-4">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>{copy.introExternal}</p>
          <p>{copy.introCompetence}</p>
        </div>
      </EnterpriseCard>

      {/* TABLE */}
      <EnterpriseCard noPadding className="flex-1 overflow-hidden flex flex-col min-h-0 bg-transparent shadow-none border-0">
        <div className="overflow-auto border rounded-xl bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.user}</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>{copy.department}</TableHead>
                <TableHead>{copy.source}</TableHead>
                <TableHead>{copy.competence}</TableHead>
                <TableHead>{copy.login}</TableHead>
                <TableHead>{copy.role}</TableHead>
                <TableHead>{copy.status}</TableHead>
                <TableHead className="text-right">{copy.actions}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-[13px] text-[#4b5563]">
                    {copy.loading}
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-[13px] text-[#4b5563]">
                    {copy.empty}
                  </TableCell>
                </TableRow>
              ) : (
                userRows.map(({ user, displayName, competenceTarget }) => {
                  const isSelf = user.id === currentUser?.id;
                  const isRoot = user.isRoot === true;
                  const hasLoggedIn = Boolean(user.lastLogin);
                  const competenceProfile = skillProfiles[competenceTarget];
                  const topSkills = getTopRatedSkills(competenceProfile);
                  const absoluteLastLogin = formatAbsoluteDateTime(user.lastLogin, locale);
                  const relativeLastLogin = formatRelativeTime(user.lastLogin, locale);

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${getLoginDotClass(hasLoggedIn)}`} />
                          <span>{displayName}</span>
                        </div>
                      </TableCell>

                      <TableCell>{user.email}</TableCell>

                      <TableCell>
                        {(user.department ?? user.group) || "-"}
                      </TableCell>

                      <TableCell>
                        {user.provisionedFromShiftplan ? (
                          <Badge className="border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
                            {copy.shiftplan}
                          </Badge>
                        ) : (
                          <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">
                            {copy.external}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex min-w-55 flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {competenceProfile?.can_sh ? <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-300">SH</Badge> : null}
                            {competenceProfile?.can_tt ? <Badge className="border-violet-500/30 bg-violet-500/15 text-violet-300">TT</Badge> : null}
                            {competenceProfile?.can_cc ? <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">CC</Badge> : null}
                            {!competenceProfile ? (
                              <span className="text-xs text-muted-foreground">{copy.noProfile}</span>
                            ) : null}
                          </div>

                          {topSkills.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {topSkills.map((entry) => (
                                <Badge key={`${competenceTarget}-${entry.skill}`} className="border-slate-500/30 bg-slate-500/10 text-slate-300">
                                  {entry.skill} {entry.rating}/5
                                </Badge>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{copy.profile}: {competenceTarget}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="min-w-55 space-y-1">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${getLoginDotClass(hasLoggedIn)}`} />
                            <span>{hasLoggedIn ? copy.lastLogin : copy.neverLoggedIn}</span>
                          </div>
                          {hasLoggedIn ? (
                            <div className="text-xs text-muted-foreground">
                              <div>{absoluteLastLogin || user.lastLogin}</div>
                              <div>{relativeLastLogin || "-"}</div>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        {isRoot ? (
                          <Badge className="border-red-500/30 bg-red-500/15 text-red-300">
                            {copy.root}
                          </Badge>
                        ) : user.isAdmin ? (
                          <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-300">
                            {copy.admin}
                          </Badge>
                        ) : (
                          <Badge className="border-slate-500/30 bg-slate-500/15 text-slate-300">
                            {copy.userRole}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>{renderApproval(user.approved, copy)}</TableCell>

                      <TableCell className="text-right space-x-1">
                        {canManageUsers && !isRoot && !isSelf && (
                          <div className="inline-flex items-center gap-2 mr-2 align-middle">
                            <span className="text-xs text-muted-foreground">{copy.adminToggle}</span>
                            <Switch
                              checked={user.isAdmin}
                              onCheckedChange={(checked) =>
                                updateUser(user.id, { isAdmin: checked })
                              }
                              aria-label={`Toggle admin for ${user.email}`}
                            />
                          </div>
                        )}

                        {canManageUsers && !isRoot && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title={copy.rights}
                            onClick={() => setSelectedUserForAccess(user)}
                          >
                            <Shield className="w-4 h-4 mr-1 text-indigo-500" />
                            {copy.rights}
                          </Button>
                        )}

                        {!user.approved && canManageUsers && !isRoot && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={copy.approve}
                            onClick={() =>
                              updateUser(user.id, { approved: true })
                            }
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}

                        {!isSelf && canManageUsers && !isRoot && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={copy.delete}
                            onClick={() =>
                              deleteUser(user.id, user.email)
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </EnterpriseCard>

      <AddUserModal
        open={addUserOpen}
        onClose={() => {
          setAddUserOpen(false);
        }}
        onCreated={loadUsers}
      />

      <UserAccessModal
        open={selectedUserForAccess !== null}
        onClose={() => setSelectedUserForAccess(null)}
        user={selectedUserForAccess}
      />
    </EnterprisePageShell>
  );
}
