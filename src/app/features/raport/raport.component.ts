import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin, map, tap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { BlocareService } from '../../core/services/blocare.service';
import { FiltruRaportObiectiv, RaportService } from '../../core/services/raport.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { SolicitantService } from '../../core/services/solicitant.service';
import { ComandaTermenRaport } from '../../core/models/comanda-termen-raport.model';
import { totalDupaConsum } from '../../core/models/comanda.model';
import { ObiectivCuLucrari } from '../../core/models/obiectiv-cu-lucrari.model';
import { Agent } from '../../core/models/agent.model';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

type RaportType = 'nelivrate' | 'termen-3-zile' | 'pe-agenti' | 'pe-obiectiv';

// Comenzi pe agenti: one section per agent, its rows split by obiectiv + lucrare.
interface AgentSection {
  agent: Agent;
  lucrari: LucrareSection[];
}

interface LucrareSection {
  obiectiv: string;
  lucrare: string;
  rows: ComandaTermenRaport[];
}

// Comenzi pe obiectiv: one block per lucrare of the chosen obiectiv.
interface LucrareObiectivSection {
  lucrare: string;
  rows: ComandaTermenRaport[];
}

@Component({
  selector: 'app-rapoarte',
  standalone: true,
  imports: [CommonModule, ComboSelectComponent],
  templateUrl: './raport.component.html',
  styleUrl: './raport.component.scss',
  // One blocare per page instance: its own tab token, handed back when the page is destroyed.
  providers: [BlocareService],
})
export class RaportComponent {
  // Comenzi pe obiectiv locks the chosen obiectiv, whatever the other filters: whoever picks it
  // first generates avize on it, the others only see the report (see BlocareService).
  readonly blocare = inject(BlocareService);
  private readonly raportService = inject(RaportService);
  private readonly objectiveService = inject(ObjectiveService);
  private readonly solicitantService = inject(SolicitantService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly totalDupaConsum = totalDupaConsum;

  readonly activeReport = signal<RaportType | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly rows = signal<ComandaTermenRaport[]>([]);

  // Comenzi pe agenți: the agent whose PDF is being generated (its button shows progress).
  readonly pdfAgentId = signal<number | null>(null);
  readonly pdfError = signal<string | null>(null);

  // Agents by name; within each, obiectiv then lucrare by name, rows by delivery deadline
  // (the order the backend already returns them in).
  readonly agentSections = computed<AgentSection[]>(() => {
    const byAgent = new Map<number, AgentSection>();
    for (const row of this.rows()) {
      if (!row.agent) continue;
      let section = byAgent.get(row.agent.id);
      if (!section) {
        section = { agent: row.agent, lucrari: [] };
        byAgent.set(row.agent.id, section);
      }
      const obiectiv = row.obiectiv?.nume ?? '';
      const lucrare = row.lucrare?.nume ?? '';
      let lucrareSection = section.lucrari.find((l) => l.obiectiv === obiectiv && l.lucrare === lucrare);
      if (!lucrareSection) {
        lucrareSection = { obiectiv, lucrare, rows: [] };
        section.lucrari.push(lucrareSection);
      }
      lucrareSection.rows.push(row);
    }

    const sections = [...byAgent.values()].sort((a, b) => compareText(a.agent.numePrenume, b.agent.numePrenume));
    for (const section of sections) {
      section.lucrari.sort((a, b) => compareText(a.obiectiv, b.obiectiv) || compareText(a.lucrare, b.lucrare));
    }
    return sections;
  });

  // Comenzi pe obiectiv: the filters being picked, and the ones the shown report (and its
  // PDF) was generated with -- null until "Generează raport" is pressed.
  readonly obiectiveCuLucrari = signal<ObiectivCuLucrari[]>([]);
  readonly solicitantOptions = signal<ComboOption[]>([]);
  readonly isLoadingFiltre = signal(false);
  readonly selectedIdObiectiv = signal<number | null>(null);
  readonly selectedIdLucrare = signal<number | null>(null);
  readonly selectedIdSolicitant = signal<number | null>(null);
  readonly filtruObiectiv = signal<FiltruRaportObiectiv | null>(null);
  readonly isPdfObiectivLoading = signal(false);
  // The aviz only takes rows with T > 0; without any there is nothing to deliver.
  readonly areDeLivrat = computed(() => this.rows().some((r) => totalDupaConsum(r.comanda) > 0));
  // Version of the report shown (X-Versiune-Raport), sent back with the aviz.
  private readonly versiuneRaport = signal(0);
  // The shown report must be of the obiectiv this page holds: after picking another obiectiv,
  // the old report stays on screen until "Generează raport", but no aviz from it.
  readonly poateGeneraAviz = computed(
    () => this.blocare.stare() === 'detinuta' && this.filtruObiectiv()?.idObiectiv === this.selectedIdObiectiv(),
  );

  // Obiective are picked by alias (nume when an obiectiv has none), as on Comenzi.
  private readonly aliasByIdObiectiv = signal<ReadonlyMap<number, string | null | undefined>>(new Map());
  readonly obiectivOptions = computed<ComboOption[]>(() =>
    this.obiectiveCuLucrari().map((o) => ({
      value: o.obiectiv.idObiectiv,
      label: this.aliasByIdObiectiv().get(o.obiectiv.idObiectiv) || o.obiectiv.nume,
    })),
  );
  readonly lucrareOptions = computed<ComboOption[]>(() => {
    const entry = this.obiectiveCuLucrari().find((o) => o.obiectiv.idObiectiv === this.selectedIdObiectiv());
    return (entry?.lucrari ?? []).map((l) => ({ value: l.idLucrare, label: l.nume }));
  });
  readonly selectedObiectivNume = computed(() => this.numeObiectiv(this.selectedIdObiectiv()));
  readonly raportObiectivNume = computed(() => this.numeObiectiv(this.filtruObiectiv()?.idObiectiv ?? null));

  // Lucrari by name; rows by delivery deadline (the order the backend returns them in).
  readonly lucrareSections = computed<LucrareObiectivSection[]>(() => {
    const byLucrare = new Map<string, LucrareObiectivSection>();
    for (const row of this.rows()) {
      const lucrare = row.lucrare?.nume ?? '';
      let section = byLucrare.get(lucrare);
      if (!section) {
        section = { lucrare, rows: [] };
        byLucrare.set(lucrare, section);
      }
      section.rows.push(row);
    }
    return [...byLucrare.values()].sort((a, b) => compareText(a.lucrare, b.lucrare));
  });

  constructor(readonly authService: AuthService) {
    // Getting the obiectiv (also after "Reîncearcă") reloads the report shown for it, so the
    // aviz starts from what is saved at that moment and with its current version.
    effect(() => {
      const poateGeneraAviz = this.poateGeneraAviz();
      untracked(() => {
        if (poateGeneraAviz && this.activeReport() === 'pe-obiectiv') this.loadReport('pe-obiectiv');
      });
    });
  }

  selectReport(report: RaportType): void {
    if (this.activeReport() === report) return;

    this.activeReport.set(report);
    this.errorMessage.set(null);
    this.pdfError.set(null);
    this.rows.set([]);
    // Comenzi pe obiectiv waits for its filters; the other reports load right away.
    if (report === 'pe-obiectiv') {
      this.filtruObiectiv.set(null);
      this.loadFiltre();
    } else {
      this.loadReport(report);
    }
    this.syncBlocare();
  }

  onObiectivSelected(value: number | string | null): void {
    this.selectedIdObiectiv.set(value == null ? null : Number(value));
    // The lucrare list belongs to the obiectiv, so a lucrare of the previous one can't stay picked.
    this.selectedIdLucrare.set(null);
    this.syncBlocare();
  }

  // The chosen obiectiv is held only while Comenzi pe obiectiv is open; any other report, or no
  // obiectiv, hands it back.
  private syncBlocare(): void {
    const idObiectiv = this.selectedIdObiectiv();
    if (this.activeReport() === 'pe-obiectiv' && idObiectiv != null) {
      this.blocare.cere({ tip: 'obiective', id: idObiectiv });
    } else {
      this.blocare.preda();
    }
  }

  generateRaportObiectiv(): void {
    const idObiectiv = this.selectedIdObiectiv();
    if (idObiectiv == null) return;

    this.filtruObiectiv.set({
      idObiectiv,
      idLucrare: this.selectedIdLucrare(),
      idSolicitant: this.selectedIdSolicitant(),
    });
    this.errorMessage.set(null);
    this.pdfError.set(null);
    this.rows.set([]);
    this.loadReport('pe-obiectiv');
  }

  // Generates the aviz for the report shown (its filters, not ones changed since): every row with
  // T > 0 is delivered in full, so the backend records it as consum. The report is then reloaded,
  // so T drops by what went on the aviz.
  async genereazaAvizObiectiv(): Promise<void> {
    const filtru = this.filtruObiectiv();
    if (!filtru || this.isPdfObiectivLoading() || !this.areDeLivrat() || !this.poateGeneraAviz()) return;

    const confirmed = await this.confirmDialog.ask({
      title: 'Generează aviz',
      message: 'Toate pozițiile cu T > 0 se livrează integral și totalul lor devine 0. Continui?',
      subject: this.raportObiectivNume() ?? undefined,
      confirmText: 'Generează aviz',
    });
    if (!confirmed) return;

    this.isPdfObiectivLoading.set(true);
    this.pdfError.set(null);
    this.raportService.genereazaAvizObiectiv(filtru, this.versiuneRaport(), this.blocare.token).subscribe({
      next: (pdf) => {
        this.isPdfObiectivLoading.set(false);
        saveFile(pdf, `Aviz obiectiv - ${this.raportObiectivNume() ?? filtru.idObiectiv}.pdf`);
        this.loadReport('pe-obiectiv');
      },
      error: async (err: HttpErrorResponse) => {
        this.isPdfObiectivLoading.set(false);
        // The response was asked for as a PDF, so even the 409 reason arrives as a Blob.
        const conflict = err.status === 409 && err.error instanceof Blob ? await err.error.text() : null;
        this.pdfError.set(
          conflict ??
            (err.status === 400 ? 'Nu există poziții cu T > 0 de livrat pe aviz.' : 'Avizul nu a putut fi generat.'),
        );
        // A 409 is either a changed report (the obiectiv is still held) or a lost blocare: asking
        // for it again tells them apart -- held, it reloads the report; lost, the banner shows why.
        if (conflict) this.blocare.reincearca();
        // Someone else may have delivered in the meantime: show the current totals.
        this.loadReport('pe-obiectiv');
      },
    });
  }

  // Downloads the agent's section as a PDF generated by the backend.
  downloadPdf(agent: Agent): void {
    if (this.pdfAgentId() != null) return;

    this.pdfAgentId.set(agent.id);
    this.pdfError.set(null);
    this.raportService.getPdfAgent(agent.id).subscribe({
      next: (pdf) => {
        this.pdfAgentId.set(null);
        saveFile(pdf, `Comenzi agent - ${agent.numePrenume}.pdf`);
      },
      error: () => {
        this.pdfAgentId.set(null);
        this.pdfError.set(`PDF-ul pentru ${agent.numePrenume} nu a putut fi generat.`);
      },
    });
  }

  private loadReport(report: RaportType): void {
    const filtru = this.filtruObiectiv();
    if (report === 'pe-obiectiv' && !filtru) return;

    let versiune = 0;
    const requests: Record<RaportType, () => Observable<ComandaTermenRaport[]>> = {
      nelivrate: () => this.raportService.getComenziNelivrate(),
      'termen-3-zile': () => this.raportService.getComenziTermen3ZileLucratoare(),
      'pe-agenti': () => this.raportService.getComenziPeAgenti(),
      'pe-obiectiv': () =>
        this.raportService.getComenziPeObiectiv(filtru!).pipe(
          tap((raport) => (versiune = raport.versiune)),
          map((raport) => raport.comenzi),
        ),
    };
    const request = requests[report]();
    // A slower response for a report the user already switched away from (or regenerated
    // with other filters) is dropped.
    const isStale = () => this.activeReport() !== report || this.filtruObiectiv() !== filtru;

    this.isLoading.set(true);
    request.subscribe({
      next: (list) => {
        if (isStale()) return;
        this.rows.set(list);
        this.versiuneRaport.set(versiune);
        this.isLoading.set(false);
      },
      error: () => {
        if (isStale()) return;
        this.isLoading.set(false);
        this.errorMessage.set('Raportul nu a putut fi încărcat.');
      },
    });
  }

  // Obiective (with their lucrari) and solicitanți for the Comenzi pe obiectiv filters.
  private loadFiltre(): void {
    if (this.obiectiveCuLucrari().length > 0) return;

    this.isLoadingFiltre.set(true);
    forkJoin([
      this.objectiveService.getAllCuLucrari(),
      this.objectiveService.getAll(),
      this.solicitantService.getAll(),
    ]).subscribe({
      next: ([list, obiective, solicitanti]) => {
        this.aliasByIdObiectiv.set(new Map(obiective.map((o) => [o.id, o.alias])));
        this.obiectiveCuLucrari.set(list);
        this.solicitantOptions.set(solicitanti.map((s) => ({ value: s.id, label: s.numePrenume })));
        this.isLoadingFiltre.set(false);
      },
      error: () => {
        this.isLoadingFiltre.set(false);
        this.errorMessage.set('Obiectivele sau solicitanții nu au putut fi încărcați.');
      },
    });
  }

  private numeObiectiv(idObiectiv: number | null): string | null {
    return this.obiectiveCuLucrari().find((o) => o.obiectiv.idObiectiv === idObiectiv)?.obiectiv.nume ?? null;
  }
}

function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoked a tick later: some browsers (Safari) cancel the download if it's revoked right away.
  setTimeout(() => URL.revokeObjectURL(url));
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'ro', { sensitivity: 'base' });
}
