import * as pgSchema from "./pg-schema";
import * as tursoSchema from "./turso-schema";

// Supabase: account, profile, and communication data.
export const { users, messages, usersRelations, messagesRelations } = pgSchema;

// Turso: all project-related records.
export const {
  projects,
  projectMembers,
  sheets,
  columns,
  rows,
  cells,
  projectsRelations,
  projectMembersRelations,
  sheetsRelations,
  columnsRelations,
  rowsRelations,
  cellsRelations,
} = tursoSchema;

export { pgSchema, tursoSchema };
