import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AgentService } from '../../core/services/agent.service';
import { FurnizorService } from '../../core/services/furnizor.service';
import { SolicitantService } from '../../core/services/solicitant.service';
import { Agent, AgentInput } from '../../core/models/agent.model';
import { Solicitant, SolicitantInput } from '../../core/models/solicitant.model';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

type NomenclatorType = 'agenti' | 'furnizori' | 'solicitanti';

// Agent and Solicitant name their person `numePrenume`, Furnizor its company `nume`; the
// page works on this common shape and each config maps to/from its own model.
interface NomenclatorItem {
  id: number;
  nume: string;
  telefon: string | null;
  email: string | null;
}

type NomenclatorInput = Omit<NomenclatorItem, 'id'>;

interface NomenclatorConfig {
  label: string;
  // "agentul" / "furnizorul" / "solicitantul" -- in messages.
  articulat: string;
  numeLabel: string;
  // Column lengths from the backend entities (Agent/Furnizor/Solicitant *_MAX).
  numeMax: number;
  emailMax: number;
  getAll(): Observable<NomenclatorItem[]>;
  create(input: NomenclatorInput): Observable<NomenclatorItem>;
  delete(id: number): Observable<void>;
}

const TELEFON_MAX = 30;

@Component({
  selector: 'app-nomenclatoare',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nomenclator.component.html',
  styleUrl: './nomenclator.component.scss',
})
export class NomenclatorComponent {
  private readonly agentService = inject(AgentService);
  private readonly furnizorService = inject(FurnizorService);
  private readonly solicitantService = inject(SolicitantService);
  private readonly dialog = inject(ConfirmDialogService);

  readonly telefonMax = TELEFON_MAX;

  readonly configs: Record<NomenclatorType, NomenclatorConfig> = {
    agenti: {
      label: 'Agenți',
      articulat: 'agentul',
      numeLabel: 'Nume și prenume',
      numeMax: 255,
      emailMax: 255,
      getAll: () => this.agentService.getAll().pipe(map((list) => list.map(fromPersoana))),
      create: (input) => this.agentService.create(toPersoana(input)).pipe(map(fromPersoana)),
      delete: (id) => this.agentService.delete(id),
    },
    furnizori: {
      label: 'Furnizori',
      articulat: 'furnizorul',
      numeLabel: 'Nume',
      numeMax: 50,
      emailMax: 50,
      getAll: () => this.furnizorService.getAll(),
      create: (input) => this.furnizorService.create(input),
      delete: (id) => this.furnizorService.delete(id),
    },
    solicitanti: {
      label: 'Solicitanți',
      articulat: 'solicitantul',
      numeLabel: 'Nume și prenume',
      numeMax: 255,
      emailMax: 255,
      getAll: () => this.solicitantService.getAll().pipe(map((list) => list.map(fromPersoana))),
      create: (input) => this.solicitantService.create(toPersoana(input)).pipe(map(fromPersoana)),
      delete: (id) => this.solicitantService.delete(id),
    },
  };
  readonly menu: NomenclatorType[] = ['agenti', 'furnizori', 'solicitanti'];

  readonly activeType = signal<NomenclatorType | null>(null);
  readonly activeConfig = computed(() => {
    const type = this.activeType();
    return type ? this.configs[type] : null;
  });

  // The backend only returns activ=true rows, so a deleted one simply drops out of the list.
  readonly items = signal<NomenclatorItem[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Adaugă form, shown above the list once the button is pressed.
  readonly isAdding = signal(false);
  readonly nume = signal('');
  readonly telefon = signal('');
  readonly email = signal('');
  readonly isSubmitting = signal(false);
  readonly deletingId = signal<number | null>(null);

  constructor(readonly authService: AuthService) {}

  select(type: NomenclatorType): void {
    if (this.activeType() === type) return;

    this.activeType.set(type);
    this.items.set([]);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.cancelAdd();
    this.load(type);
  }

  startAdd(): void {
    this.isAdding.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  cancelAdd(): void {
    this.isAdding.set(false);
    this.nume.set('');
    this.telefon.set('');
    this.email.set('');
  }

  save(): void {
    const type = this.activeType();
    const config = this.activeConfig();
    if (!type || !config || this.isSubmitting()) return;

    const nume = this.nume().trim();
    if (!nume) {
      this.errorMessage.set(`Completează câmpurile obligatorii: ${config.numeLabel}.`);
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);
    config
      .create({ nume, telefon: this.telefon().trim() || null, email: this.email().trim() || null })
      .subscribe({
        next: (created) => {
          this.isSubmitting.set(false);
          if (this.activeType() !== type) return;
          this.items.update((list) => [...list, created].sort((a, b) => compareText(a.nume, b.nume)));
          this.cancelAdd();
          this.dialog.notifySaved();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (this.activeType() !== type) return;
          // 400/409 carry the reason as plain text (missing field, duplicate name).
          this.errorMessage.set(
            (err.status === 400 || err.status === 409) && typeof err.error === 'string'
              ? err.error
              : `Nu s-a putut adăuga ${config.articulat}.`,
          );
        },
      });
  }

  async remove(item: NomenclatorItem): Promise<void> {
    const type = this.activeType();
    const config = this.activeConfig();
    if (!type || !config || this.deletingId() != null) return;

    const confirmed = await this.dialog.ask({
      title: `Ștergi ${config.articulat}?`,
      message: 'Nu va mai apărea în liste. Comenzile existente nu sunt afectate.',
      subject: item.nume,
      confirmText: 'Șterge',
      variant: 'danger',
    });
    if (!confirmed) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.deletingId.set(item.id);
    config.delete(item.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        if (this.activeType() !== type) return;
        this.items.update((list) => list.filter((i) => i.id !== item.id));
        this.successMessage.set(`${capitalize(config.articulat)} ${item.nume} a fost șters.`);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        if (this.activeType() !== type) return;
        // 409 carries the reason as plain text (it still has comenzi).
        this.errorMessage.set(
          err.status === 409 && typeof err.error === 'string' ? err.error : `Nu s-a putut șterge ${config.articulat}.`,
        );
      },
    });
  }

  private load(type: NomenclatorType): void {
    this.isLoading.set(true);
    this.configs[type].getAll().subscribe({
      next: (list) => {
        // A slower response for a list the user already switched away from is dropped.
        if (this.activeType() !== type) return;
        this.items.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        if (this.activeType() !== type) return;
        this.isLoading.set(false);
        this.errorMessage.set('Lista nu a putut fi încărcată.');
      },
    });
  }
}

// Agent / Solicitant (numePrenume) <-> the page's common shape (nume).
function fromPersoana({ numePrenume, ...rest }: Agent | Solicitant): NomenclatorItem {
  return { ...rest, nume: numePrenume };
}

function toPersoana({ nume, ...rest }: NomenclatorInput): AgentInput & SolicitantInput {
  return { ...rest, numePrenume: nume };
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'ro', { sensitivity: 'base' });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
