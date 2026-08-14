import {
  sqliteTable,
  integer,
  text,
  numeric,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ----------------------------------------------------------------------------
// Users — admin / team members
// ----------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("member"), // 'admin' | 'manager' | 'member'
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

// ----------------------------------------------------------------------------
// Projects — a construction job / build (Turso SQLite Schema)
// ----------------------------------------------------------------------------
export const projects = sqliteTable("projects", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  client: text("client"),
  location: text("location"),
  budget: numeric("budget"),
  startDate: text("start_date"),
  status: text("status").notNull().default("Active"),
  progress: integer("progress").notNull().default(0),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

// ----------------------------------------------------------------------------
// Project Members — junction table for team assignments
// ----------------------------------------------------------------------------
export const projectMembers = sqliteTable("project_members", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'lead' | 'member' | 'viewer'
  assignedAt: text("assigned_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

// ----------------------------------------------------------------------------
// Sheets — each project has two predefined (but fully editable) sheets
// ----------------------------------------------------------------------------
export const sheets = sqliteTable("sheets", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
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
export const columns = sqliteTable("columns", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sheetId: integer("sheet_id")
    .notNull()
    .references(() => sheets.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: text("type").notNull().default("text"),
  options: text("options", { mode: "json" }).$type<string[] | null>(),
  reconcileRole: text("reconcile_role"),
  width: integer("width").notNull().default(180),
  position: integer("position").notNull().default(0),
});

// ----------------------------------------------------------------------------
// Rows + Cells — Excel-like grid data
// ----------------------------------------------------------------------------
export const rows = sqliteTable("rows", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sheetId: integer("sheet_id")
    .notNull()
    .references(() => sheets.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const cells = sqliteTable(
  "cells",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    rowId: integer("row_id")
      .notNull()
      .references(() => rows.id, { onDelete: "cascade" }),
    columnId: integer("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "cascade" }),
    value: text("value"),
  },
  (t) => ({
    rowColUnq: uniqueIndex("cells_row_column_unique").on(t.rowId, t.columnId),
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

// ----------------------------------------------------------------------------
// Messages — 1-on-1 direct messages between users
// ----------------------------------------------------------------------------
export const messages = sqliteTable("messages", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: integer("is_read", { mode: "number" }).notNull().default(0),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id], relationName: "sentMessages" }),
  receiver: one(users, { fields: [messages.receiverId], references: [users.id], relationName: "receivedMessages" }),
}));
