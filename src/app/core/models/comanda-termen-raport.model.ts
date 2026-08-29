import { Comanda } from './comanda.model';

// Mirrors the payload of GET /api/comenzi/termen-3-zile-lucratoare -- each row is
// a comanda joined with its parent lucrare/obiectiv, so the report can display
// full context without extra lookups.
export interface ComandaTermenRaport {
  comanda: Comanda;
  lucrare: { idLucrare: number; nume: string };
  obiectiv: { idObiectiv: number; nume: string };
}
