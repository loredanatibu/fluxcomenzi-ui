// Mirrors com.mep.fluxcomenzi.model.Comanda (+ inherited VersionedEntity
// columns) as returned by / posted to /api/comenzi.
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
}
