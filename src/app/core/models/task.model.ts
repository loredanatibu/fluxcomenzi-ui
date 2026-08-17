// Mirrors com.mep.fluxcomenzi.model.Task (+ inherited VersionedEntity
// columns) as returned by GET /api/tasks. `name` is the task's own name;
// there is no denormalized objective name on this entity yet, only the
// `idObjective` foreign key, so the grid currently maps it into the
// "Nume Obiectiv" column as a stand-in (see TaskListComponent columns).
export interface Task {
  id: number;
  idObjective: number;
  name: string;
  nameAlias?: string;
  deadline?: string;
  createdAt?: string;
  createdBy?: string;
}
