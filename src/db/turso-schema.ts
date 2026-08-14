import { relations, sql } from "drizzle-orm";
import { integer, numeric, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Turso contains only project-scoped data. userId is deliberately an opaque
// Supabase user ID; databases cannot enforce foreign keys across this boundary.
export const projects = sqliteTable("projects", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  client: text("client"),
  location: text("location"),
  budget: numeric("budget"),
  startDate: text("start_date"),
  status: text("status").notNull().default("Active"),
  progress: integer("progress").notNull().default(0),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const projectMembers = sqliteTable("project_members", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  assignedAt: text("assigned_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const sheets = sqliteTable("sheets", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  position: integer("position").notNull().default(0),
});

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

export const projectsRelations = relations(projects, ({ many }) => ({
  sheets: many(sheets),
  members: many(projectMembers),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
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
