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
  // Read-only: what was consumed on avize -- the API sums comanda_receptionata over the
  // AVIZ rows in comenzi_istoric. It doesn't change totalReceptionat.
  consum: number;
  observatii: string;
  createdBy: string;
  createdAt: string;
}

// The total shown for Recepționat: what was received minus what avizele consumed.
// Rounded to 3 places to drop float noise like 9.899999999999999.
export function totalDupaConsum(c: Comanda): number {
  return Number(((c.totalReceptionat ?? 0) - (c.consum ?? 0)).toFixed(3));
}
