import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ----------------------------------------------------------------------------
// Users — admin / team members
// ----------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("member"), // 'admin' | 'manager' | 'member'
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ----------------------------------------------------------------------------
// Projects — a construction job / build
// ----------------------------------------------------------------------------
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  client: text("client"),
  location: text("location"),
  budget: numeric("budget", { precision: 16, scale: 2 }),
  startDate: text("start_date"),
  status: text("status").notNull().default("Active"),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ----------------------------------------------------------------------------
// Project Members — junction table for team assignments
// ----------------------------------------------------------------------------
export const projectMembers = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'lead' | 'member' | 'viewer'
  assignedAt: timestamp("assigned_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ----------------------------------------------------------------------------
// Sheets — each project has two predefined (but fully editable) sheets
// ----------------------------------------------------------------------------
export const sheets = pgTable("sheets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  position: integer("position").notNull().default(0),
});

// ----------------------------------------------------------------------------
// Columns — DYNAMIC headers. Add / delete / rename / retype at will.
// ----------------------------------------------------------------------------
export const columns = pgTable("columns", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id")
    .notNull()
    .references(() => sheets.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: text("type").notNull().default("text"),
  options: text("options").array(),
  reconcileRole: text("reconcile_role"),
  width: integer("width").notNull().default(180),
  position: integer("position").notNull().default(0),
});

// ----------------------------------------------------------------------------
// Rows + Cells — Excel-like grid data
// ----------------------------------------------------------------------------
export const rows = pgTable("rows", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id")
    .notNull()
    .references(() => sheets.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const cells = pgTable(
  "cells",
  {
    id: serial("id").primaryKey(),
    rowId: integer("row_id")
      .notNull()
      .references(() => rows.id, { onDelete: "cascade" }),
    columnId: integer("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "cascade" }),
    value: text("value"),
  },
  (t) => ({
    rowColUnq: unique("cells_row_column_unique").on(t.rowId, t.columnId),
  }),
);

// ----------------------------------------------------------------------------
// Relations — enable db.query.* relational API
// ----------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  projectMembers: many(projectMembers),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  sheets: many(sheets),
  members: many(projectMembers),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const sheetsRelations = relations(sheets, ({ one, many }) => ({
  project: one(projects, { fields: [sheets.projectId], references: [projects.id] }),
  columns: many(columns),
  rows: many(rows),
}));

export const columnsRelations = relations(columns, ({ one }) => ({
  sheet: one(sheets, { fields: [columns.sheetId], references: [sheets.id] }),
}));

export const rowsRelations = relations(rows, ({ one, many }) => ({
  sheet: one(sheets, { fields: [rows.sheetId], references: [sheets.id] }),
  cells: many(cells),
}));

export const cellsRelations = relations(cells, ({ one }) => ({
  row: one(rows, { fields: [cells.rowId], references: [rows.id] }),
  column: one(columns, { fields: [cells.columnId], references: [columns.id] }),
}));
