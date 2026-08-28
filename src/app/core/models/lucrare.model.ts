// Mirrors com.mep.fluxcomenzi.model.Lucrare -- a plain mutable row (see
// lucrari in schema.sql) as returned by / posted to /api/lucrari.
export interface Lucrare {
  id: number;
  idObiectiv: number;
  nume: string;
  createdBy: string;
  createdAt: string;
}
