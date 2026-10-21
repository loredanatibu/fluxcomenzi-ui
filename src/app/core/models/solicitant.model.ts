// Mirrors com.mep.fluxcomenzi.model.Solicitant -- read-only lookup list (see
// solicitanti in schema.sql). A comanda references the chosen one by id (idSolicitant).
export interface Solicitant {
  id: number;
  numePrenume: string;
  telefon: string | null;
  email: string | null;
}
