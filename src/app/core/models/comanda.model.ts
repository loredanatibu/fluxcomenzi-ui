// Mirrors com.mep.fluxcomenzi.model.Comanda -- a plain mutable row (see
// comenzi in schema.sql) as returned by / posted to /api/comenzi.
export interface Comanda {
  id: number;
  idLucrare: number;
  idSolicitant: number;
  idFurnizor: number;
  // Only set when the comanda is supplied through an agent.
  idAgent: number | null;
  numeMaterial: string;
  cantitate: number;
  unitateMasura: string;
  termenLivrare: string;
  // Read-only: what was received so far. Not stored in comenzi -- the API sums
  // comanda_receptionata over the UPDATE rows in comenzi_istoric.
  totalReceptionat: number;
  observatii: string;
  createdBy: string;
  createdAt: string;
}
