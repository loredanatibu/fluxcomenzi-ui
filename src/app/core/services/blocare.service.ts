import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';

// Header-ul cu token-ul tab-ului -- vezi BlocareService din API.
export const HEADER_TOKEN_BLOCARE = 'X-Blocare-Token';

export type ModEditare = 'RECEPTIE' | 'MODIFICARE';

// Recepție/Modifică Comandă blocheaza o lucrare; avizul (Comenzi pe obiectiv) un obiectiv.
export interface ResursaBlocata {
  tip: 'lucrari' | 'obiective';
  id: number;
  mod?: ModEditare;
}

// fara: nimic ales. se-cere: asteapta raspunsul. detinuta: tab-ul tine resursa si poate edita.
// refuzata: o tine altcineva (sau a pierdut-o). expirata: predata dupa inactivitate.
export type StareBlocare = 'fara' | 'se-cere' | 'detinuta' | 'refuzata' | 'expirata';

// UI-ul reinnoieste la 30s; API-ul o lasa sa expire dupa 2 minute fara reinnoire.
const INTERVAL_REINNOIRE_MS = 30_000;
const INACTIVITATE_MAXIMA_MS = 15 * 60_000;
const EVENIMENTE_ACTIVITATE = ['keydown', 'pointerdown', 'wheel'] as const;

// Blocarea unei lucrari sau a unui obiectiv de catre acest tab, ca doar cine a deschis-o primul
// sa poata salva. Data in providers-ul componentei, nu global: fiecare pagina deschisa are
// propriul token, iar la inchiderea ei Angular apeleaza ngOnDestroy, care preda blocarea.
@Injectable()
export class BlocareService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private readonly authService = inject(AuthService);

  // Identifica tab-ul la API, pe cererile de blocare si pe salvari.
  readonly token = genereazaToken();
  readonly stare = signal<StareBlocare>('fara');
  // Textul aratat cand stare e refuzata sau expirata.
  readonly mesaj = signal<string | null>(null);

  private resursa: ResursaBlocata | null = null;
  private cerere: Subscription | null = null;
  private reinnoire: Subscription | null = null;
  private ultimaActivitate = Date.now();

  private readonly laActivitate = () => (this.ultimaActivitate = Date.now());
  // La inchiderea tab-ului; vezi predaLaInchidere.
  private readonly laInchidere = () => this.predaLaInchidere();

  constructor() {
    EVENIMENTE_ACTIVITATE.forEach((e) => document.addEventListener(e, this.laActivitate, { passive: true }));
    window.addEventListener('pagehide', this.laInchidere);
  }

  ngOnDestroy(): void {
    EVENIMENTE_ACTIVITATE.forEach((e) => document.removeEventListener(e, this.laActivitate));
    window.removeEventListener('pagehide', this.laInchidere);
    this.preda();
  }

  // Cere resursa; una tinuta pana acum, alta decat aceasta, e predata intai.
  cere(resursa: ResursaBlocata): void {
    if (this.resursa && !aceeasiResursa(this.resursa, resursa)) {
      this.preda();
    }
    this.resursa = resursa;
    this.ultimaActivitate = Date.now();
    this.stare.set('se-cere');
    this.mesaj.set(null);
    this.trimite(resursa, false);
  }

  // "Reîncearcă" / "Reia editarea": cere din nou aceeasi resursa.
  reincearca(): void {
    if (this.resursa) this.cere(this.resursa);
  }

  preda(): void {
    this.cerere?.unsubscribe();
    this.opresteReinnoirea();
    // Si cand raspunsul inca nu venise: API-ul poate sa o fi dat deja. Pentru o resursa a
    // altui tab, API-ul ignora predarea.
    if (this.resursa) this.elibereaza(this.resursa);
    this.resursa = null;
    this.stare.set('fara');
    this.mesaj.set(null);
  }

  // Pentru un 409 primit la salvare: blocarea s-a pierdut intre timp. Resursa ramane retinuta,
  // ca "Reîncearcă" sa o ceara din nou.
  pierde(mesaj: string): void {
    this.cerere?.unsubscribe();
    this.opresteReinnoirea();
    this.stare.set('refuzata');
    this.mesaj.set(mesaj);
  }

  // PUT obtine sau reinnoieste. O reinnoire esuata din alt motiv decat 409 (retea, server
  // repornit) nu schimba starea: urmatoarea reinnoire incearca din nou, iar API-ul tine
  // blocarea inca doua minute.
  private trimite(resursa: ResursaBlocata, esteReinnoire: boolean): void {
    this.cerere?.unsubscribe();
    this.cerere = this.http
      .put<void>(this.url(resursa), null, {
        headers: { [HEADER_TOKEN_BLOCARE]: this.token },
        params: resursa.mod ? { mod: resursa.mod } : {},
      })
      .subscribe({
        next: () => {
          if (this.resursa !== resursa) return;
          this.stare.set('detinuta');
          this.mesaj.set(null);
          this.pornesteReinnoirea();
        },
        error: (err: HttpErrorResponse) => {
          if (this.resursa !== resursa || (esteReinnoire && err.status !== 409)) return;
          this.opresteReinnoirea();
          this.stare.set('refuzata');
          this.mesaj.set(mesajConflict(err) ?? 'Nu s-a putut verifica dacă pagina e liberă pentru editare.');
        },
      });
  }

  // La fiecare 30s: reinnoieste, daca utilizatorul a fost activ in ultimele 15 minute; altfel
  // preda blocarea, ca o pagina uitata deschisa sa nu-i tina pe ceilalti pe loc.
  private pornesteReinnoirea(): void {
    if (this.reinnoire) return;
    this.reinnoire = interval(INTERVAL_REINNOIRE_MS).subscribe(() => {
      const resursa = this.resursa;
      if (!resursa || this.stare() !== 'detinuta') return;
      if (Date.now() - this.ultimaActivitate > INACTIVITATE_MAXIMA_MS) {
        this.opresteReinnoirea();
        this.elibereaza(resursa);
        this.stare.set('expirata');
        this.mesaj.set('Sesiunea de editare a expirat după 15 minute de inactivitate.');
        return;
      }
      this.trimite(resursa, true);
    });
  }

  private opresteReinnoirea(): void {
    this.reinnoire?.unsubscribe();
    this.reinnoire = null;
  }

  private elibereaza(resursa: ResursaBlocata): void {
    this.http
      .delete<void>(this.url(resursa), { headers: { [HEADER_TOKEN_BLOCARE]: this.token } })
      .subscribe({ error: () => {} });
  }

  // Un tab care se inchide nu mai asteapta raspunsuri: doar fetch cu keepalive mai pleaca
  // dupa pagehide (HttpClient nu are optiunea). Fara garantie -- unele browsere nu trimit
  // asa o cerere cross-origin cu Authorization; atunci blocarea expira singura in API.
  private predaLaInchidere(): void {
    const jwt = this.authService.getToken();
    if (!this.resursa || !jwt) return;
    fetch(this.url(this.resursa), {
      method: 'DELETE',
      keepalive: true,
      headers: { Authorization: `Bearer ${jwt}`, [HEADER_TOKEN_BLOCARE]: this.token },
    }).catch(() => {});
  }

  private url(resursa: ResursaBlocata): string {
    return `${this.config.apiUrl}/blocari/${resursa.tip}/${resursa.id}`;
  }
}

// 409 aduce motivul ca text simplu (cine tine resursa, sau ce s-a schimbat intre timp).
export function mesajConflict(err: HttpErrorResponse): string | null {
  return err.status === 409 && typeof err.error === 'string' ? err.error : null;
}

function aceeasiResursa(a: ResursaBlocata, b: ResursaBlocata): boolean {
  return a.tip === b.tip && a.id === b.id && a.mod === b.mod;
}

// crypto.randomUUID() exista doar pe HTTPS sau localhost; getRandomValues merge si pe http://,
// cum e accesata aplicatia din reteaua interna.
function genereazaToken(): string {
  const octeti = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(octeti, (o) => o.toString(16).padStart(2, '0')).join('');
}
