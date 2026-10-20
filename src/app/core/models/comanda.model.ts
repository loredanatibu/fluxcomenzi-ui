// Mirrors com.mep.fluxcomenzi.model.Comanda -- a plain mutable row (see
// comenzi in schema.sql) as returned by / posted to /api/comenzi.
export interface Comanda {
  id: number;
  idLucrare: number;
  numeMaterial: string;
  cantitate: number;
  unitateMasura: string;
  numeFurnizor: string;
  emailFurnizor: string;
  termenLivrare: string;
  comandaReceptionata: number;
  observatii: string;
  requestedBy: string;
  createdBy: string;
  createdAt: string;
}
