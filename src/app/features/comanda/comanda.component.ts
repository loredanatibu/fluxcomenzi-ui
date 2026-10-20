import { Component, ElementRef, Injector, computed, effect, inject, afterNextRender, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, merge, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ComandaService, ComandaPayload } from '../../core/services/comanda.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { SolicitantService } from '../../core/services/solicitant.service';
import { Comanda } from '../../core/models/comanda.model';
import { ObiectivCuLucrari } from '../../core/models/obiectiv-cu-lucrari.model';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { getRequiredFieldsMessage } from '../../shared/forms/required-fields.util';

type ComandaMode = 'create' | 'receptie' | 'update';

const REQUIRED_ROW_LABELS: Record<string, string> = {
  numeMaterial: 'Nume material',
  cantitate: 'Cantitate',
  unitateMasura: 'Unitate măsură',
  numeFurnizor: 'Nume furnizor',
  emailFurnizor: 'Email furnizor',
  termenLivrare: 'Termen livrare',
};

@Component({
  selector: 'app-comenzi',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DateInputComponent, ComboSelectComponent],
  templateUrl: './comanda.component.html',
  styleUrl: './comanda.component.scss',
})
export class ComandaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly mode = signal<ComandaMode>('create');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly comenzi = signal<Comanda[]>([]);
  readonly isLoadingComenzi = signal(false);

  // Update mode lists comenzi for the chosen lucrare, editable directly in the grid.
  readonly selectedLucrareId = signal<number | null>(null);
  readonly filteredComenzi = computed(() => {
    const idLucrare = this.selectedLucrareId();
    if (idLucrare == null) return [];
    return this.comenzi().filter((c) => c.idLucrare === idLucrare);
  });

  // One FormGroup per row in the comenzi grid, rebuilt whenever filteredComenzi changes.
  // gridRows mirrors it 1:1 so save can recover each row's id/idLucrare (not editable
  // fields, so not part of the group). The Salvează button's enabled state reads
  // gridForm.dirty directly in the template -- Reactive Forms already tracks that
  // per control from user input, no extra bookkeeping needed.
  readonly gridForm = new FormArray<FormGroup>([]);
  // Update and Recepție share the grid: same row groups, different editable columns.
  // Fields a mode doesn't show stay in the group untouched, so saving sends them back as-is.
  readonly isGridMode = computed(() => this.mode() === 'update' || this.mode() === 'receptie');
  gridRows: Comanda[] = [];

  // Create mode: comenzi are grouped by solicitant -- each group is { requestedBy, rows },
  // with one FormGroup per new comanda in rows, all saved under the selected lucrare.
  // Disabled until a Lucrare is picked; "Adaugă linie" appends a row to its own group,
  // "Adaugă solicitant" appends another group.
  readonly solicitantGroups = new FormArray<FormGroup>([this.newSolicitantGroup()]);

  // Loaded once, up front: the Solicitant combobox options shared by every group.
  // requestedBy stores numePrenume (no FK -- see solicitanti in schema.sql), so that's the value.
  readonly solicitantOptions = signal<ComboOption[]>([]);
  readonly isLoadingSolicitanti = signal(false);

  // Every mode: Obiectiv is picked first (from /obiective/cu-lucrari), which then scopes
  // which lucrari are selectable (in create, before the rows become editable; in update
  // and recepție, before the comenzi grid for the chosen lucrare is shown).
  readonly obiectiveCuLucrari = signal<ObiectivCuLucrari[]>([]);
  readonly isLoadingObiective = signal(false);
  readonly selectedIdObiectiv = signal<number | null>(null);

  readonly obiectivOptions = computed<ComboOption[]>(() =>
    this.obiectiveCuLucrari().map((o) => ({ value: o.obiectiv.idObiectiv, label: o.obiectiv.nume })),
  );
  readonly lucrareOptions = computed<ComboOption[]>(() => {
    const idObiectiv = this.selectedIdObiectiv();
    if (idObiectiv == null) return [];
    const entry = this.obiectiveCuLucrari().find((o) => o.obiectiv.idObiectiv === idObiectiv);
    return (entry?.lucrari ?? []).map((l) => ({ value: l.idLucrare, label: l.nume }));
  });

  readonly form = this.fb.group({
    idLucrare: [null as number | null, Validators.required],
  });

  // Drives the Salvează button in create mode: disabled until a Lucrare is picked and all
  // required fields of every row are filled. Uses `.valid` rather than `.invalid` because
  // the rows start disabled (locked behind Obiectiv/Lucrare) -- an all-disabled array's
  // status is 'DISABLED', which is neither valid nor invalid, so `.invalid` would miss it.
  readonly formValid = signal(false);

  constructor(
    readonly authService: AuthService,
    private readonly comandaService: ComandaService,
    private readonly objectiveService: ObjectiveService,
    private readonly solicitantService: SolicitantService,
  ) {
    // Creează Comandă starts with nothing selected: Obiectiv must be chosen first,
    // which unlocks Lucrare, which in turn unlocks the solicitant groups.
    this.form.get('idLucrare')?.disable();
    this.solicitantGroups.disable();

    if (this.authService.isAuthenticated()) {
      this.loadObiectiveCuLucrari();
      this.loadSolicitanti();
    }

    merge(this.form.statusChanges, this.solicitantGroups.statusChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.formValid.set(this.form.get('idLucrare')!.valid && this.solicitantGroups.valid);
      });

    this.form.get('idLucrare')!.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.selectedLucrareId.set(value);
      if (this.mode() === 'create') {
        if (value != null) {
          this.solicitantGroups.enable();
        } else {
          this.solicitantGroups.disable();
        }
      }
    });

    effect(() => this.buildGridForm(this.filteredComenzi()));
  }

  private buildGridForm(rows: Comanda[]): void {
    // Unsaved edits survive a rebuild (e.g. after deleting another row) as long as their
    // comanda is still listed; everything else is rebuilt from the server data.
    const dirtyById = new Map<number, FormGroup>();
    this.gridForm.controls.forEach((group, i) => {
      if (group.dirty && this.gridRows[i]) dirtyById.set(this.gridRows[i].id, group);
    });

    this.gridRows = rows;
    this.gridForm.clear();
    for (const c of rows) {
      this.gridForm.push(
        dirtyById.get(c.id) ??
          this.fb.group({
            requestedBy: [c.requestedBy],
            numeMaterial: [c.numeMaterial],
            cantitate: [c.cantitate],
            unitateMasura: [c.unitateMasura],
            numeFurnizor: [c.numeFurnizor],
            emailFurnizor: [c.emailFurnizor],
            termenLivrare: [toDateTimeInputValue(c.termenLivrare)],
            comandaReceptionata: [c.comandaReceptionata, [Validators.required, Validators.min(0)]],
            observatii: [c.observatii],
          }),
      );
    }

    // clear() doesn't reset the array's own dirty flag, so recompute it from the rows.
    if (!this.gridForm.controls.some((group) => group.dirty)) {
      this.gridForm.markAsPristine();
    }
  }

  rowsOf(group: FormGroup): FormArray<FormGroup> {
    return group.get('rows') as FormArray<FormGroup>;
  }

  addSolicitantGroup(): void {
    this.solicitantGroups.push(this.newSolicitantGroup());
    const index = this.solicitantGroups.length - 1;
    this.focusAfterRender(`[data-solicitant="${index}"] app-combo-select input`);
  }

  removeSolicitantGroup(index: number): void {
    if (this.solicitantGroups.length > 1) {
      this.solicitantGroups.removeAt(index);
    }
  }

  addCreateRow(groupIndex: number): void {
    this.rowsOf(this.solicitantGroups.at(groupIndex)).push(this.newCreateRow());
    this.focusAfterRender(`[data-solicitant="${groupIndex}"] tbody tr:last-child input`);
  }

  removeCreateRow(groupIndex: number, rowIndex: number): void {
    const rows = this.rowsOf(this.solicitantGroups.at(groupIndex));
    if (rows.length > 1) {
      rows.removeAt(rowIndex);
    }
  }

  // Moves focus into the field just added, so the user can type straight away.
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  private newSolicitantGroup(): FormGroup {
    return this.fb.group({
      requestedBy: [null as string | null, Validators.required],
      rows: this.fb.array<FormGroup>([this.newCreateRow()]),
    });
  }

  private newCreateRow(): FormGroup {
    return this.fb.group({
      numeMaterial: ['', Validators.required],
      cantitate: [null as number | null, [Validators.required, Validators.min(0)]],
      unitateMasura: ['', Validators.required],
      numeFurnizor: ['', Validators.required],
      emailFurnizor: ['', [Validators.required, Validators.email]],
      termenLivrare: ['', Validators.required],
    });
  }

  private resetSolicitantGroups(): void {
    this.solicitantGroups.clear();
    this.solicitantGroups.push(this.newSolicitantGroup());
  }

  saveGridChanges(): void {
    if (!this.gridForm.dirty) return;

    const updates = this.gridForm.controls
      .map((group, i) => ({ group, row: this.gridRows[i] }))
      .filter(({ group }) => group.dirty)
      .map(({ group, row }) => {
        const v = group.getRawValue();
        const payload: ComandaPayload = {
          idLucrare: row.idLucrare,
          numeMaterial: v.numeMaterial,
          cantitate: Number(v.cantitate),
          unitateMasura: v.unitateMasura,
          numeFurnizor: v.numeFurnizor,
          emailFurnizor: v.emailFurnizor,
          termenLivrare: v.termenLivrare,
          comandaReceptionata: Number(v.comandaReceptionata),
          observatii: v.observatii ?? '',
          requestedBy: v.requestedBy ?? '',
        };
        return this.comandaService.update(row.id, payload);
      });

    if (updates.length === 0) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    forkJoin(updates).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Comenzile au fost actualizate.');
        // Saved: the reload below should replace these rows, not keep them as unsaved edits.
        this.gridForm.markAsPristine();
        this.loadComenzi();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Comenzile nu au putut fi actualizate.');
      },
    });
  }

  deleteGridRow(index: number): void {
    const comanda = this.gridRows[index];
    if (!comanda || !window.confirm(`Ștergi comanda „${comanda.numeMaterial}”?`)) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    this.comandaService.delete(comanda.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Comanda a fost ștearsă.');
        this.comenzi.set(this.comenzi().filter((c) => c.id !== comanda.id));
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Comanda nu a putut fi ștearsă.');
      },
    });
  }

  onObiectivSelected(rawId: number | string | null): void {
    const id = rawId == null ? null : Number(rawId);
    this.selectedIdObiectiv.set(id);

    const idLucrare = this.form.get('idLucrare')!;
    idLucrare.reset(null);
    if (id != null) {
      idLucrare.enable();
    } else {
      idLucrare.disable();
    }
  }

  selectMode(mode: ComandaMode): void {
    if (this.mode() === mode) return;

    this.mode.set(mode);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.selectedLucrareId.set(null);
    this.selectedIdObiectiv.set(null);
    this.form.reset();
    this.form.get('idLucrare')?.disable();
    this.resetSolicitantGroups();
    this.solicitantGroups.disable();

    this.loadObiectiveCuLucrari();
    if (mode !== 'create') {
      this.loadComenzi();
    }
  }

  submit(): void {
    const idLucrare = this.form.get('idLucrare')!.value;
    if (idLucrare == null) {
      this.errorMessage.set(getRequiredFieldsMessage(this.form, { idLucrare: 'Lucrare' }));
      return;
    }

    const invalidMessage = this.findInvalidCreateMessage();
    if (invalidMessage) {
      this.solicitantGroups.markAllAsTouched();
      this.errorMessage.set(invalidMessage);
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    // Flattened (solicitant group, row) pairs, so results map back to where each row lives.
    const entries = this.solicitantGroups.controls.flatMap((solicitantGroup) =>
      this.rowsOf(solicitantGroup).controls.map((row) => ({ solicitantGroup, row })),
    );
    const requests = entries.map(({ solicitantGroup, row }) => {
      const v = row.getRawValue();
      const payload: ComandaPayload = {
        idLucrare,
        numeMaterial: v.numeMaterial,
        cantitate: Number(v.cantitate),
        unitateMasura: v.unitateMasura,
        numeFurnizor: v.numeFurnizor,
        emailFurnizor: v.emailFurnizor,
        termenLivrare: v.termenLivrare,
        comandaReceptionata: 0,
        observatii: '',
        requestedBy: solicitantGroup.get('requestedBy')!.value,
      };
      return this.comandaService.create(payload).pipe(
        map(() => true),
        catchError(() => of(false)),
      );
    });

    forkJoin(requests).subscribe((results) => {
      this.isSubmitting.set(false);
      const failed = new Set(entries.filter((_, i) => !results[i]).map(({ row }) => row));

      if (failed.size === 0) {
        this.successMessage.set(entries.length === 1 ? 'Comanda a fost salvată.' : 'Comenzile au fost salvate.');
        this.resetSolicitantGroups();
        return;
      }

      // Keep only the rows that failed (and the solicitanti they belong to), so retrying
      // doesn't duplicate the ones already saved.
      for (let g = this.solicitantGroups.length - 1; g >= 0; g--) {
        const rows = this.rowsOf(this.solicitantGroups.at(g));
        for (let r = rows.length - 1; r >= 0; r--) {
          if (!failed.has(rows.at(r))) rows.removeAt(r);
        }
        if (rows.length === 0) this.solicitantGroups.removeAt(g);
      }
      this.errorMessage.set(`${failed.size} din ${entries.length} comenzi nu au putut fi salvate.`);
    });
  }

  // First problem in the create form, as a message naming the solicitant and line, or null.
  private findInvalidCreateMessage(): string | null {
    for (const [g, solicitantGroup] of this.solicitantGroups.controls.entries()) {
      const nume: string | null = solicitantGroup.get('requestedBy')!.value;
      const label = nume || `Solicitantul ${g + 1}`;
      if (solicitantGroup.get('requestedBy')!.invalid) {
        return `${label}: Alege solicitantul.`;
      }
      const rows = this.rowsOf(solicitantGroup);
      const r = rows.controls.findIndex((row) => row.invalid);
      if (r !== -1) {
        return `${label}, linia ${r + 1}: ${getRequiredFieldsMessage(rows.at(r), REQUIRED_ROW_LABELS)}`;
      }
    }
    return null;
  }

  private loadObiectiveCuLucrari(): void {
    this.isLoadingObiective.set(true);
    this.objectiveService.getAllCuLucrari().subscribe({
      next: (list) => {
        this.obiectiveCuLucrari.set(list);
        this.isLoadingObiective.set(false);
        this.errorMessage.set(null);
      },
      error: () => {
        this.isLoadingObiective.set(false);
        this.errorMessage.set('Obiectivele nu au putut fi încărcate.');
      },
    });
  }

  private loadSolicitanti(): void {
    this.isLoadingSolicitanti.set(true);
    this.solicitantService.getAll().subscribe({
      next: (list) => {
        this.solicitantOptions.set(list.map((s) => ({ value: s.numePrenume, label: s.numePrenume })));
        this.isLoadingSolicitanti.set(false);
      },
      error: () => {
        this.isLoadingSolicitanti.set(false);
        this.errorMessage.set('Solicitanții nu au putut fi încărcați.');
      },
    });
  }

  private loadComenzi(): void {
    this.isLoadingComenzi.set(true);
    this.comandaService.getAll().subscribe({
      next: (list) => {
        this.comenzi.set(list);
        this.isLoadingComenzi.set(false);
      },
      error: () => {
        this.isLoadingComenzi.set(false);
        this.errorMessage.set('Comenzile nu au putut fi încărcate.');
      },
    });
  }
}

function toDateTimeInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : '';
}
