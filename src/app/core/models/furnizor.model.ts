// Mirrors com.mep.fluxcomenzi.model.Furnizor -- lookup list behind the Furnizor
// combobox. A comanda references the chosen one by id (idFurnizor).
export interface Furnizor {
  id: number;
  nume: string;
  telefon: string | null;
  email: string | null;
}
