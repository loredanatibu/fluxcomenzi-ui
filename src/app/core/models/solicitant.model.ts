// Mirrors com.mep.fluxcomenzi.model.Solicitant -- lookup list (see
// solicitanti in schema.sql). A comanda references the chosen one by id (idSolicitant).
export interface Solicitant {
  id: number;
  numePrenume: string;
  telefon: string | null;
  email: string | null;
}

// What POST /api/solicitanti accepts: id and activ are set by the backend.
export type SolicitantInput = Omit<Solicitant, 'id'>;
