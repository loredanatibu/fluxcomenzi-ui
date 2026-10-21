// Mirrors com.mep.fluxcomenzi.model.Agent -- read-only lookup list (see agenti in
// schema.sql). A comanda supplied through an agent references it by id (idAgent).
export interface Agent {
  id: number;
  numePrenume: string;
  telefon: string | null;
  email: string | null;
}
