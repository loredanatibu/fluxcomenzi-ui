// Mirrors com.mep.fluxcomenzi.model.Furnizor -- lookup list behind the Furnizor
// combobox. A comanda stores the chosen nume in numeFurnizor.
export interface Furnizor {
  id: number;
  nume: string;
  telefon: string | null;
  email: string | null;
}
