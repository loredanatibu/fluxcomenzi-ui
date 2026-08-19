// Mirrors com.mep.fluxcomenzi.model.Obiectiv (+ inherited VersionedEntity
// columns) as returned by GET /api/obiective, used to populate the
// "Obiectiv" combobox on the new-task form.
export interface Obiectiv {
  id: number;
  nume: string;
}
