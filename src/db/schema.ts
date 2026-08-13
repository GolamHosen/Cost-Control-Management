import * as pgSchema from "./pg-schema";
import * as tursoSchema from "./turso-schema";

export const isTurso = Boolean(process.env.TURSO_DATABASE_URL);

export const users = isTurso ? tursoSchema.users : pgSchema.users;
export const projects = isTurso ? tursoSchema.projects : pgSchema.projects;
export const projectMembers = isTurso ? tursoSchema.projectMembers : pgSchema.projectMembers;
export const sheets = isTurso ? tursoSchema.sheets : pgSchema.sheets;
export const columns = isTurso ? tursoSchema.columns : pgSchema.columns;
export const rows = isTurso ? tursoSchema.rows : pgSchema.rows;
export const cells = isTurso ? tursoSchema.cells : pgSchema.cells;

export const usersRelations = isTurso
  ? tursoSchema.usersRelations
  : pgSchema.usersRelations;
export const projectsRelations = isTurso
  ? tursoSchema.projectsRelations
  : pgSchema.projectsRelations;
export const projectMembersRelations = isTurso
  ? tursoSchema.projectMembersRelations
  : pgSchema.projectMembersRelations;
export const sheetsRelations = isTurso
  ? tursoSchema.sheetsRelations
  : pgSchema.sheetsRelations;
export const columnsRelations = isTurso
  ? tursoSchema.columnsRelations
  : pgSchema.columnsRelations;
export const rowsRelations = isTurso
  ? tursoSchema.rowsRelations
  : pgSchema.rowsRelations;
export const cellsRelations = isTurso
  ? tursoSchema.cellsRelations
  : pgSchema.cellsRelations;

export const messages = isTurso ? tursoSchema.messages : (tursoSchema.messages as any);
export const messagesRelations = isTurso
  ? tursoSchema.messagesRelations
  : (tursoSchema.messagesRelations as any);

export { pgSchema, tursoSchema };
