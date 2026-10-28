// Mirrors com.mep.fluxcomenzi.model.Furnizor -- lookup list behind the Furnizor
// combobox. A comanda references the chosen one by id (idFurnizor).
export interface Furnizor {
  id: number;
  nume: string;
  telefon: string | null;
  email: string | null;
}

// What POST /api/furnizori accepts: id and activ are set by the backend.
export type FurnizorInput = Omit<Furnizor, 'id'>;
