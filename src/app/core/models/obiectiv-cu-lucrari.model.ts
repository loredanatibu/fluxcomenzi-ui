// Mirrors the response of GET /api/obiective/cu-lucrari: each objective paired
// with the lucrari recorded under it. Used to drive the cascading
// Obiectiv -> Lucrare selection when editing a lucrare.
export interface ObiectivCuLucrari {
  obiectiv: {
    idObiectiv: number;
    nume: string;
  };
  lucrari: {
    idLucrare: number;
    nume: string;
  }[];
}
