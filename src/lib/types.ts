// Shared client/server domain types

export type ColumnType = "text" | "number" | "currency" | "date" | "select";

export type ReconcileRole =
  | "expense_amount"
  | "cost_budget"
  | "cost_actual"
  | "cost_paid"
  | "reconcile_key";

export type SheetType = "expense" | "cost_control";

export interface Column {
  id: number;
  sheetId: number;
  label: string;
  type: ColumnType;
  options?: string[] | null;
  reconcileRole?: ReconcileRole | null;
  width: number;
  position: number;
}

export interface SheetRow {
  id: number;
  position: number;
  cells: Record<number, string>; // columnId -> value
}

export interface Sheet {
  id: number;
  projectId: number;
  name: string;
  type: SheetType;
  position: number;
  columns: Column[];
  rows: SheetRow[];
}

export type UserRole = "admin" | "manager" | "member";
export type MemberRole = "lead" | "member" | "viewer";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  role: MemberRole;
  assignedAt: string;
  user?: User;
}

export interface Project {
  id: number;
  name: string;
  client: string | null;
  location: string | null;
  budget: string | null;
  startDate: string | null;
  status: string;
  progress: number;
  createdAt: string;
  sheets: Sheet[];
  members?: ProjectMember[];
}

export const COLUMN_TYPES: { value: ColumnType; label: string; icon: string }[] = [
  { value: "text", label: "Text", icon: "T" },
  { value: "number", label: "Number", icon: "#" },
  { value: "currency", label: "Currency (AUD)", icon: "$" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "select", label: "Dropdown", icon: "▾" },
];

export const RECONCILE_ROLES: Record<SheetType, { value: ReconcileRole; label: string }[]> = {
  expense: [
    { value: "expense_amount", label: "Expense total (cross-checks Actual Cost)" },
    { value: "reconcile_key", label: "Match key (e.g. Cost Code)" },
  ],
  cost_control: [
    { value: "cost_actual", label: "Actual cost (cross-checks Expenses)" },
    { value: "cost_budget", label: "Budget" },
    { value: "cost_paid", label: "Amount paid" },
    { value: "reconcile_key", label: "Match key (e.g. Cost Code)" },
  ],
};
