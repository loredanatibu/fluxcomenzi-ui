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
  comandaReceptionata: number;
  observatii: string;
  createdBy: string;
  createdAt: string;
}
