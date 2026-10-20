import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, merge, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ComandaService, ComandaPayload } from '../../core/services/comanda.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
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

  // Create mode: one FormGroup per new comanda, all saved under the selected lucrare.
  // Disabled until a Lucrare is picked; "Adaugă linie" appends another empty row.
  readonly createRows = new FormArray<FormGroup>([this.newCreateRow()]);

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
  ) {
    // Creează Comandă starts with nothing selected: Obiectiv must be chosen first,
    // which unlocks Lucrare, which in turn unlocks the rows.
    this.form.get('idLucrare')?.disable();
    this.createRows.disable();

    if (this.authService.isAuthenticated()) {
      this.loadObiectiveCuLucrari();
    }

    merge(this.form.statusChanges, this.createRows.statusChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.formValid.set(this.form.get('idLucrare')!.valid && this.createRows.valid);
      });

    this.form.get('idLucrare')!.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.selectedLucrareId.set(value);
      if (this.mode() === 'create') {
        if (value != null) {
          this.createRows.enable();
        } else {
          this.createRows.disable();
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

  addCreateRow(): void {
    this.createRows.push(this.newCreateRow());
  }

  removeCreateRow(index: number): void {
    if (this.createRows.length > 1) {
      this.createRows.removeAt(index);
    }
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

  private resetCreateRows(): void {
    this.createRows.clear();
    this.createRows.push(this.newCreateRow());
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
    this.resetCreateRows();
    this.createRows.disable();

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

    const invalidIndex = this.createRows.controls.findIndex((group) => group.invalid);
    if (invalidIndex !== -1) {
      this.createRows.markAllAsTouched();
      const message = getRequiredFieldsMessage(this.createRows.at(invalidIndex), REQUIRED_ROW_LABELS);
      this.errorMessage.set(`Linia ${invalidIndex + 1}: ${message}`);
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const groups = [...this.createRows.controls];
    const requests = groups.map((group) => {
      const v = group.getRawValue();
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
      };
      return this.comandaService.create(payload).pipe(
        map(() => true),
        catchError(() => of(false)),
      );
    });

    forkJoin(requests).subscribe((results) => {
      this.isSubmitting.set(false);
      const failed = groups.filter((_, i) => !results[i]);

      if (failed.length === 0) {
        this.successMessage.set(groups.length === 1 ? 'Comanda a fost salvată.' : 'Comenzile au fost salvate.');
        this.resetCreateRows();
        return;
      }

      // Keep only the rows that failed, so retrying doesn't duplicate the ones already saved.
      this.createRows.clear();
      failed.forEach((group) => this.createRows.push(group));
      this.errorMessage.set(`${failed.length} din ${groups.length} comenzi nu au putut fi salvate.`);
    });
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
