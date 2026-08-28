// Mirrors com.mep.fluxcomenzi.model.Obiectiv -- a plain mutable row (see
// obiective in schema.sql) as returned by / posted to /api/obiective.
export interface Obiectiv {
  id: number;
  nume: string;
  alias?: string | null;
  termenExecutie?: string | null;
  dataIncepere?: string | null;
  createdBy: string;
  createdAt: string;
}
