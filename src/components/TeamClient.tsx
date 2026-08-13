"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import { getAvatarColor, getInitials } from "@/components/Sidebar";

interface AssignmentInfo {
  projectId: number;
  projectName: string;
  projectStatus: string;
  memberRole: string;
}

interface Props {
  teamMembers: User[];
  assignmentMap: Record<number, AssignmentInfo[]>;
  allProjects: { id: number; name: string; status: string }[];
}

export default function TeamClient({ teamMembers, assignmentMap, allProjects }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(teamMembers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<User | null>(null);
  const [localAssignments, setLocalAssignments] =
    useState<Record<number, AssignmentInfo[]>>(assignmentMap);

  async function addMember(data: { name: string; email: string; role: string; phone: string; password: string }) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const newUser = await res.json();
      setMembers((prev) => [...prev, { ...newUser, createdAt: newUser.createdAt || "" }]);
      setShowAddModal(false);
      router.refresh();
    }
  }

  async function deleteMember(id: number) {
    if (
      !confirm(
        "Remove this team member from the system? Their account will be permanently deleted from the database."
      )
    )
      return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete team member");
    }
  }

  async function assignToProject(userId: number, projectId: number, role: string) {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) {
      const proj = allProjects.find((p) => p.id === projectId);
      setLocalAssignments((prev) => ({
        ...prev,
        [userId]: [
          ...(prev[userId] || []),
          {
            projectId,
            projectName: proj?.name ?? "",
            projectStatus: proj?.status ?? "",
            memberRole: role,
          },
        ],
      }));
      router.refresh();
    }
  }

  async function unassignFromProject(userId: number, projectId: number) {
    await fetch(`/api/projects/${projectId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    setLocalAssignments((prev) => ({
      ...prev,
      [userId]: (prev[userId] || []).filter((a) => a.projectId !== projectId),
    }));
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-6 py-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Team Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your construction team and their project assignments.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Member
          </button>
        </div>
      </header>

      <div className="px-6 py-6 lg:px-8">
        {members.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-3 text-slate-500">No team members yet. Click &quot;Add Member&quot; to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {members.map((user) => {
              const assignments = localAssignments[user.id] || [];
              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  {/* User Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColor(user.name)}`}
                      >
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowAssignModal(user)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        title="Assign to project"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                      {user.role === "admin" ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/60"
                          title="Admin accounts are protected from deletion"
                        >
                          <svg className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Protected
                        </span>
                      ) : (
                        <button
                          onClick={() => deleteMember(user.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove member"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        user.role === "admin"
                          ? "bg-amber-100 text-amber-700"
                          : user.role === "manager"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {user.role}
                    </span>
                    {user.phone && (
                      <span className="text-[11px] text-slate-400">{user.phone}</span>
                    )}
                  </div>

                  {/* Assigned Projects */}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Assigned Projects ({assignments.length})
                    </div>
                    {assignments.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-300">No project assignments</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {assignments.map((a) => (
                          <div
                            key={a.projectId}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium text-slate-700">
                                {a.projectName}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                    a.projectStatus === "Active"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : a.projectStatus === "Completed"
                                      ? "bg-sky-100 text-sky-700"
                                      : "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {a.projectStatus}
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  {a.memberRole}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => unassignFromProject(user.id, a.projectId)}
                              className="ml-2 flex-shrink-0 rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                              title="Remove from project"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onAdd={addMember}
        />
      )}

      {/* Assign to Project Modal */}
      {showAssignModal && (
        <AssignModal
          user={showAssignModal}
          allProjects={allProjects}
          currentAssignments={localAssignments[showAssignModal.id] || []}
          onClose={() => setShowAssignModal(null)}
          onAssign={(projectId, role) => assignToProject(showAssignModal.id, projectId, role)}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: { name: string; email: string; role: string; phone: string; password: string }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "member",
    phone: "",
    password: "team123",
  });
  const [saving, setSaving] = useState(false);
  const field =
    "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400";

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    await onAdd(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add Team Member</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-500">Full Name *</label>
            <input
              autoFocus
              className={field}
              placeholder="e.g. David Chen"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Email *</label>
            <input
              type="email"
              className={field}
              placeholder="david@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Role</label>
            <select
              className={field}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Phone</label>
            <input
              className={field}
              placeholder="+61 400 123 456"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Password</label>
            <input
              className={field}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim() || !form.email.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignModal({
  user,
  allProjects,
  currentAssignments,
  onClose,
  onAssign,
}: {
  user: User;
  allProjects: { id: number; name: string; status: string }[];
  currentAssignments: AssignmentInfo[];
  onClose: () => void;
  onAssign: (projectId: number, role: string) => void;
}) {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [role, setRole] = useState("member");

  const assignedIds = new Set(currentAssignments.map((a) => a.projectId));
  const availableProjects = allProjects.filter((p) => !assignedIds.has(p.id));

  const field =
    "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assign to Project</h2>
            <p className="text-xs text-slate-500">
              Assign <strong>{user.name}</strong> to a project
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {availableProjects.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            This member is already assigned to all projects.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Project</label>
              <select
                className={field}
                value={selectedProject ?? ""}
                onChange={(e) => setSelectedProject(Number(e.target.value))}
              >
                <option value="">Select a project…</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Role on Project</label>
              <select
                className={field}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="lead">Lead</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedProject) {
                onAssign(selectedProject, role);
                onClose();
              }
            }}
            disabled={!selectedProject}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
