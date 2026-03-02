/* ------------------------------------------------ */
/* USERS – USER MANAGEMENT PAGE (POLICY-ONLY)       */
/* ------------------------------------------------ */

import { useEffect, useState } from "react";
import { Plus, CheckCircle, Shield, Trash2, Users as UsersIcon } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";

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

import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/api";

import { AddUserModal } from "../users/AddUserModal";
import { AbteilungAccessModal } from "../users/AbteilungAccessModal";
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
  createdAt: string;
  lastLogin: string | null;
}

/* ------------------------------------------------ */
/* HELPERS                                         */
/* ------------------------------------------------ */

function renderApproval(approved: boolean) {
  return approved ? (
    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
      Active
    </Badge>
  ) : (
    <Badge className="border-orange-500/30 bg-orange-500/15 text-orange-400">
      Pending
    </Badge>
  );
}

/* ------------------------------------------------ */
/* COMPONENT                                       */
/* ------------------------------------------------ */

export default function Users() {
  const { user: currentUser, canAccess } = useAuth();

  /* 🔑 WRITE = darf verwalten */
  const canManageUsers = canAccess("user_management", "write");

  /* ------------------------------------------------ */
  /* STATE                                           */
  /* ------------------------------------------------ */

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [groupAccessOpen, setAbteilungAccessOpen] = useState(false);

  const [userAccessOpen, setUserAccessOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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

  useEffect(() => {
    loadUsers();
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
      `User wirklich löschen?\n\n${email}\n\nDieser Vorgang ist endgültig.`
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

  /* ------------------------------------------------ */
  /* USER ACCESS MODAL                                */
  /* ------------------------------------------------ */

  function openUserAccess(user: User) {
    setSelectedUser(user);
    setUserAccessOpen(true);
  }

  function closeUserAccess() {
    setUserAccessOpen(false);
    setSelectedUser(null);
  }

  /* ------------------------------------------------ */
  /* RENDER                                          */
  /* ------------------------------------------------ */

  return (
    <EnterprisePageShell>
      {/* HEADER */}
      <EnterpriseHeader
        title="USER MANAGEMENT"
        subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Manage users and access rights</span>}
        icon={<UsersIcon className="w-5 h-5 text-indigo-400" />}
        rightContent={
          canManageUsers && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm"
                onClick={() => setAbteilungAccessOpen(true)}
              >
                <Shield className="w-3.5 h-3.5 mr-2" />
                Abteilung Access
              </Button>

              <Button
                size="sm"
                className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-indigo-600/90 hover:bg-indigo-600 text-white shadow-sm border-transparent"
                onClick={() => setAddUserOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                Add User
              </Button>
            </div>
          )
        }
      />

      {/* TABLE */}
      <EnterpriseCard noPadding className="flex-1 overflow-hidden flex flex-col min-h-0 bg-transparent shadow-none border-0">
        <div className="overflow-auto border rounded-xl bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[13px] text-[#4b5563]">
                    Loading users…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[13px] text-[#4b5563]">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUser?.id;

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {`${user.firstName ?? ""} ${user.lastName ?? ""
                          }`.trim()}
                      </TableCell>

                      <TableCell>{user.email}</TableCell>

                      <TableCell>
                        {(user.department ?? user.group) || "-"}
                      </TableCell>

                      <TableCell>{renderApproval(user.approved)}</TableCell>

                      <TableCell className="text-right space-x-1">
                        {canManageUsers && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openUserAccess(user)}
                            title="Permissions"
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                        )}

                        {!user.approved && canManageUsers && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Approve"
                            onClick={() =>
                              updateUser(user.id, { approved: true })
                            }
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}

                        {!isSelf && canManageUsers && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete user"
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

      {/* MODALS */}
      <UserAccessModal
        open={userAccessOpen}
        onClose={closeUserAccess}
        user={
          selectedUser
            ? {
              id: selectedUser.id,
              email: selectedUser.email,
              group: selectedUser.group,
            }
            : null
        }
      />

      <AbteilungAccessModal
        open={groupAccessOpen}
        onClose={() => setAbteilungAccessOpen(false)}
      />

      <AddUserModal
        open={addUserOpen}
        onClose={() => {
          setAddUserOpen(false);
          loadUsers();
        }}
      />
    </EnterprisePageShell>
  );
}
