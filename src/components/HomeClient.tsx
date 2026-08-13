"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";
import { computeReconciliation, formatCurrency } from "@/lib/finance";
import { readExcelFile } from "@/lib/excel-import";
import {
  Alert,
  Building,
  Calendar,
  Check,
  Plus,
  Trash,
  Wallet,
  X,
} from "./Icons";

export default function HomeClient({ projects: initial }: { projects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initial);
  const [showModal, setShowModal] = useState(false);
  const [importingProject, setImportingProject] = useState(false);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const totalBudget = projects.reduce((a, p) => a + parseFloat(p.budget ?? "0"), 0);
  const totalSpend = projects.reduce((a, p) => a + computeReconciliation(p).actualTotal, 0);
  const balancedCount = projects.filter((p) => computeReconciliation(p).balanced).length;

  function removeProject(id: number) {
    if (!confirm("Delete this project and all its data? This cannot be undone.")) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    fetch(`/api/projects/${id}`, { method: "DELETE" }).catch(() => {});
  }

  // --- Import Entire Project from Excel (.xlsx / .xls / .csv) ---
  const handleImportProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingProject(true);
    try {
      const parsedSheets = await readExcelFile(file);
      if (parsedSheets.length === 0 || parsedSheets[0].rows.length === 0) {
        alert("No valid data rows found in the selected Excel file.");
        return;
      }

      // Infer project name from file name
      const projectName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .trim();

      // Create new project in database
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName || "Imported Excel Project",
          status: "Active",
          withSample: false, // create clean default sheets
        }),
      });

      const newProj = await createRes.json();
      if (!createRes.ok || !newProj.id) {
        throw new Error(newProj.error || "Failed to create project from file");
      }

      // Populate imported rows into project's active sheet
      const firstParsedSheet = parsedSheets[0];
      const targetSheet = newProj.sheets?.[0];

      if (targetSheet && firstParsedSheet.rows.length > 0) {
        const targetCols = targetSheet.columns || [];

        for (const rowObj of firstParsedSheet.rows) {
          const rowRes = await fetch(`/api/projects/${newProj.id}/rows`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheetId: targetSheet.id }),
          });

          if (rowRes.ok) {
            const rowData = await rowRes.json();

            // Match headers and save cell values
            for (const col of targetCols) {
              const matchedKey = Object.keys(rowObj).find(
                (k) => k.toLowerCase().trim() === col.label.toLowerCase().trim()
              );

              const val = matchedKey ? rowObj[matchedKey] : "";
              if (val) {
                await fetch(`/api/projects/${newProj.id}/cells`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    rowId: rowData.id,
                    columnId: col.id,
                    value: val,
                  }),
                });
              }
            }
          }
        }
      }

      // Navigate to newly imported project
      router.push(`/projects/${newProj.id}`);
      router.refresh();
    } catch (err: any) {
      alert(`Failed to import project: ${err.message || err}`);
    } finally {
      setImportingProject(false);
      if (projectFileInputRef.current) projectFileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Hidden File Input for Excel Project Import */}
      <input
        type="file"
        ref={projectFileInputRef}
        onChange={handleImportProjectFile}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Hero Header */}
      <header className="border-b border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="mx-auto max-w-[1400px] px-5 py-10">
          <div className="flex items-center gap-2 text-amber-400">
            <Building width={22} />
            <span className="text-sm font-semibold uppercase tracking-widest">
              BuildLedger
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Construction cost control &amp; payment tracker
          </h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            Excel-style sheets for your expenses and your cost-control/payment
            ledger — with a live cross-check that keeps both sheets perfectly in
            balance. Add or remove any column, anytime.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-4">
            <HeroStat label="Projects" value={String(projects.length)} />
            <HeroStat label="Contract value" value={formatCurrency(totalBudget)} />
            <HeroStat label="Actual spend" value={formatCurrency(totalSpend)} />
            <HeroStat
              label="In balance"
              value={`${balancedCount}/${projects.length}`}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
            >
              <Plus width={18} /> New Project
            </button>

            <button
              onClick={() => projectFileInputRef.current?.click()}
              disabled={importingProject}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
              title="Create a project automatically by importing an Excel (.xlsx / .csv) file"
            >
              📥 {importingProject ? "Importing Project…" : "Import Project (Excel)"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-8">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Your projects</h2>

        {projects.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <Building width={32} className="mx-auto text-slate-300" />
            <p className="mt-3 text-slate-500">
              No projects yet. Create your first build or import an Excel file to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const r = computeReconciliation(p);
              return (
                <div
                  key={p.id}
                  className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-slate-900">
                        {p.name}
                      </h3>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {[p.client, p.location].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProject(p.id);
                      }}
                      className="rounded-md p-1 text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                      title="Delete project"
                    >
                      <Trash width={15} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {p.status}
                    </span>
                    {p.startDate && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar width={11} /> {p.startDate}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <MiniStat
                      icon={<Wallet width={14} />}
                      label="Expenses"
                      value={formatCurrency(r.expenseTotal)}
                      tone="text-sky-700"
                    />
                    <MiniStat
                      icon={<Building width={14} />}
                      label="Actual cost"
                      value={formatCurrency(r.actualTotal)}
                      tone="text-violet-700"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        r.balanced
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {r.balanced ? <Check width={12} /> : <Alert width={12} />}
                      {r.balanced ? "Sheets balanced" : `Variance ${formatCurrency(Math.abs(r.variance))}`}
                    </span>
                    <span className="text-xs text-slate-400">Open →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => router.push(`/projects/${id}`)}
        />
      )}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <div className={`text-sm font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    client: "",
    location: "",
    budget: "",
    startDate: "",
    status: "Active",
    withSample: true,
  });
  const [saving, setSaving] = useState(false);
  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-400";

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.id) onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">New project</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X width={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-500">Project name *</label>
            <input
              autoFocus
              className={field}
              placeholder="e.g. Smith Residence — Renovation"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Client</label>
            <input className={field} value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Location</label>
            <input className={field} placeholder="Suburb, State" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Contract budget (AUD)</label>
            <input className={field} inputMode="decimal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Start date</label>
            <input type="date" className={field} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {["Active", "On Hold", "Completed", "Tendering"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.withSample}
            onChange={(e) => setForm({ ...form, withSample: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            Pre-fill with example line items to show how the two sheets
            cross-check each other (you can delete them anytime).
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.name.trim()}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}
