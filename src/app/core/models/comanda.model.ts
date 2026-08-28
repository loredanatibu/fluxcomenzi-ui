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
  comandaTrimisa: boolean;
  comandaReceptionata: boolean;
  observatii: string;
  createdBy: string;
  createdAt: string;
}
