// Mirrors com.mep.fluxcomenzi.model.Agent -- lookup list (see agenti in
// schema.sql). A comanda supplied through an agent references it by id (idAgent).
export interface Agent {
  id: number;
  numePrenume: string;
  telefon: string | null;
  email: string | null;
}

// What POST /api/agenti accepts: id and activ are set by the backend.
export type AgentInput = Omit<Agent, 'id'>;
