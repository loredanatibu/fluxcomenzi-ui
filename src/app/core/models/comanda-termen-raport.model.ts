import { Comanda } from './comanda.model';
import { Furnizor } from './furnizor.model';
import { Solicitant } from './solicitant.model';

// Mirrors the payload of GET /api/comenzi/termen-3-zile-lucratoare -- each row is
// a comanda joined with its parent lucrare/obiectiv and its solicitant/furnizor,
// so the report can display full context without extra lookups.
export interface ComandaTermenRaport {
  comanda: Comanda;
  lucrare: { idLucrare: number; nume: string };
  obiectiv: { idObiectiv: number; nume: string };
  solicitant: Solicitant | null;
  furnizor: Furnizor | null;
}
