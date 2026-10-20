// Mirrors com.mep.fluxcomenzi.model.Solicitant -- read-only lookup list (see
// solicitanti in schema.sql). A comanda stores the chosen numePrenume in requestedBy.
export interface Solicitant {
  id: number;
  numePrenume: string;
  telefon: string | null;
  email: string | null;
}
