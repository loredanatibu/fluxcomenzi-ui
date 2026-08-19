// Mirrors com.mep.fluxcomenzi.model.Lucrare (+ inherited VersionedEntity
// columns) as returned by / posted to /api/lucrari.
export interface Lucrare {
  id: number;
  idObiectiv: number;
  nume: string;
}
