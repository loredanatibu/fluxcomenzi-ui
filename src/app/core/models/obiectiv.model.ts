// Mirrors com.mep.fluxcomenzi.model.Obiectiv (+ inherited VersionedEntity
// columns) as returned by / posted to /api/obiective.
export interface Obiectiv {
  id: number;
  nume: string;
  alias?: string | null;
  termenExecutie?: string | null;
  dataIncepere?: string | null;
}
