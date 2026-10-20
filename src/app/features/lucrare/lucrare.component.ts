import { Component, ElementRef, Injector, computed, inject, afterNextRender, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, merge, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LucrareService } from '../../core/services/lucrare.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { Lucrare } from '../../core/models/lucrare.model';
import { Obiectiv } from '../../core/models/obiectiv.model';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { getRequiredFieldsMessage } from '../../shared/forms/required-fields.util';

type LucrareMode = 'create' | 'update';

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  nume: 'Nume',
  idObiectiv: 'Obiectiv',
};

@Component({
  selector: 'app-lucrari',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ComboSelectComponent],
  templateUrl: './lucrare.component.html',
  styleUrl: './lucrare.component.scss',
})
export class LucrareComponent {
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly mode = signal<LucrareMode>('create');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly obiective = signal<Obiectiv[]>([]);
  readonly isLoadingObiective = signal(false);

  readonly lucrari = signal<Lucrare[]>([]);
  readonly isLoadingLucrari = signal(false);
  readonly selectedLucrareId = signal<number | null>(null);

  // Update: Obiectiv is picked first (select-only, from the full list), which then
  // scopes which lucrari (by idObiectiv) are pickable in the Nume field.
  readonly selectedIdObiectiv = signal<number | null>(null);

  // Ids of the selected obiectiv's lucrari that have comenzi -- those can't be deleted,
  // so the × is only offered for a lucrare outside this set.
  private readonly lucrariCuComenziIds = signal<ReadonlySet<number>>(new Set());
  private readonly isLoadingLucrariCuComenzi = signal(false);
  private lucrariCuComenziRequestId = 0;
  readonly canDeleteSelected = computed(() => {
    const id = this.selectedLucrareId();
    return id != null && !this.isLoadingLucrariCuComenzi() && !this.lucrariCuComenziIds().has(id);
  });

  readonly lucrareOptions = computed<ComboOption[]>(() => {
    const idObiectiv = this.selectedIdObiectiv();
    if (idObiectiv == null) return [];
    return this.lucrari()
      .filter((l) => l.idObiectiv === idObiectiv)
      .map((l) => ({ value: l.id, label: l.nume }));
  });

  // Create lists obiective by alias (falling back to nume when an obiectiv has none), with
  // the full nume shown alongside once one is picked; update keeps listing them by nume.
  readonly obiectivOptions = computed<ComboOption[]>(() =>
    this.obiective().map((o) => ({
      value: o.id,
      label: this.mode() === 'create' ? o.alias || o.nume : o.nume,
    })),
  );
  readonly selectedObiectivNume = computed(() => {
    const id = this.selectedIdObiectiv();
    return id == null ? null : (this.obiective().find((o) => o.id === id)?.nume ?? null);
  });

  readonly form = this.fb.group({
    nume: ['', Validators.required],
    idObiectiv: [null as number | null, Validators.required],
  });

  // Create mode: an obiectiv can get several lucrari at once -- one FormGroup per new
  // lucrare, all saved under the selected obiectiv. Disabled until an Obiectiv is picked;
  // "Adaugă linie" appends another empty row. The form's own `nume` control is only
  // used by update, so it stays disabled in create mode.
  readonly createRows = new FormArray<FormGroup>([this.newCreateRow()]);

  // Drives the Salvează button in create mode: disabled until Obiectiv and every row's
  // Nume are filled. Uses `.valid` rather than `.invalid` because the rows start disabled
  // -- an all-disabled array's status is 'DISABLED', neither valid nor invalid.
  readonly createValid = signal(false);

  constructor(
    readonly authService: AuthService,
    private readonly lucrareService: LucrareService,
    private readonly objectiveService: ObjectiveService,
  ) {
    this.form.get('nume')!.disable();
    this.createRows.disable();

    if (this.authService.isAuthenticated()) {
      this.loadObiective();
    }

    merge(this.form.statusChanges, this.createRows.statusChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.createValid.set(this.form.get('idObiectiv')!.valid && this.createRows.valid);
      });

    this.form.get('idObiectiv')!.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.selectedIdObiectiv.set(value ?? null);
      if (this.mode() === 'create') {
        if (value != null) {
          this.createRows.enable();
        } else {
          this.createRows.disable();
        }
        return;
      }

      // Picking a different Obiectiv invalidates the previously chosen Lucrare.
      this.selectedIdObiectiv.set(value ?? null);
      this.selectedLucrareId.set(null);
      this.form.patchValue({ nume: '' }, { emitEvent: false });
      this.loadLucrariCuComenzi(value ?? null);
    });
  }

  selectMode(mode: LucrareMode): void {
    if (this.mode() === mode) return;

    this.mode.set(mode);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.selectedLucrareId.set(null);
    this.selectedIdObiectiv.set(null);
    this.form.reset();
    this.resetCreateRows();
    this.createRows.disable();

    this.form.get('idObiectiv')?.enable();

    if (mode === 'create') {
      this.form.get('nume')?.disable();
      return;
    }

    // Update: Obiectiv is picked first (select-only), which scopes the Nume
    // combo-select; Nume itself is editable in place (freeText) once picked.
    this.form.get('nume')?.enable();
    this.loadLucrari();
  }

  onLucrareSelected(rawId: number | string | null): void {
    const id = rawId == null ? null : Number(rawId);
    this.selectedLucrareId.set(id);

    // Obiectiv is already picked and drives the option list, so only Nume needs
    // to reflect the chosen lucrare.
    const lucrare = id ? this.lucrari().find((l) => l.id === id) : undefined;
    this.form.patchValue({ nume: lucrare?.nume ?? '' }, { emitEvent: false });
  }

  // Update mode: the Nume combo-select is editable in place (freeText) once a
  // lucrare is picked -- this carries the typed text into the form for submit.
  onLucrareNameEdited(text: string): void {
    this.form.get('nume')?.setValue(text, { emitEvent: false });
  }

  addCreateRow(): void {
    this.createRows.push(this.newCreateRow());
    // Move focus into the new row: the button shifts down a row, and some browsers leave
    // its focus ring painted where it used to be if focus stays on it.
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLInputElement>('.lucrare__table tbody tr:last-child input')
          ?.focus(),
      { injector: this.injector },
    );
  }

  removeCreateRow(index: number): void {
    if (this.createRows.length > 1) {
      this.createRows.removeAt(index);
    }
  }

  private newCreateRow(): FormGroup {
    return this.fb.group({
      nume: ['', Validators.required],
    });
  }

  private resetCreateRows(): void {
    this.createRows.clear();
    this.createRows.push(this.newCreateRow());
  }

  submit(): void {
    if (this.mode() === 'create') {
      this.createLucrari();
      return;
    }

    if (!this.selectedLucrareId()) {
      this.errorMessage.set('Selectează o lucrare.');
      return;
    }

    if (this.form.invalid) {
      this.errorMessage.set(getRequiredFieldsMessage(this.form, REQUIRED_FIELD_LABELS));
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { nume, idObiectiv } = this.form.getRawValue();
    const payload = { idObiectiv: idObiectiv!, nume: nume! };

    this.lucrareService.update(this.selectedLucrareId()!, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Lucrarea a fost actualizată.');
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Lucrarea nu a putut fi actualizată.');
      },
    });
  }

  private createLucrari(): void {
    const idObiectiv = this.form.get('idObiectiv')!.value;
    if (idObiectiv == null) {
      this.errorMessage.set(getRequiredFieldsMessage(this.form, { idObiectiv: 'Obiectiv' }));
      return;
    }

    const invalidIndex = this.createRows.controls.findIndex((group) => group.invalid);
    if (invalidIndex !== -1) {
      this.createRows.markAllAsTouched();
      const message = getRequiredFieldsMessage(this.createRows.at(invalidIndex), { nume: 'Nume' });
      this.errorMessage.set(`Linia ${invalidIndex + 1}: ${message}`);
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const groups = [...this.createRows.controls];
    const requests = groups.map((group) =>
      this.lucrareService.create({ idObiectiv, nume: group.getRawValue().nume }).pipe(
        map(() => true),
        catchError(() => of(false)),
      ),
    );

    forkJoin(requests).subscribe((results) => {
      this.isSubmitting.set(false);
      const failed = groups.filter((_, i) => !results[i]);

      if (failed.length === 0) {
        this.successMessage.set(groups.length === 1 ? 'Lucrarea a fost salvată.' : 'Lucrările au fost salvate.');
        this.resetCreateRows();
        return;
      }

      // Keep only the rows that failed, so retrying doesn't duplicate the ones already saved.
      this.createRows.clear();
      failed.forEach((group) => this.createRows.push(group));
      this.errorMessage.set(`${failed.length} din ${groups.length} lucrări nu au putut fi salvate.`);
    });
  }

  private loadObiective(): void {
    this.isLoadingObiective.set(true);
    this.objectiveService.getAll().subscribe({
      next: (list) => {
        this.obiective.set(list);
        this.isLoadingObiective.set(false);
      },
      error: () => {
        this.isLoadingObiective.set(false);
        this.errorMessage.set('Obiectivele nu au putut fi încărcate.');
      },
    });
  }

  private loadLucrari(): void {
    this.isLoadingLucrari.set(true);
    this.lucrareService.getAll().subscribe({
      next: (list) => {
        this.lucrari.set(list);
        this.isLoadingLucrari.set(false);
      },
      error: () => {
        this.isLoadingLucrari.set(false);
        this.errorMessage.set('Lucrările nu au putut fi încărcate.');
      },
    });
  }

  private loadLucrariCuComenzi(idObiectiv: number | null): void {
    const requestId = ++this.lucrariCuComenziRequestId;
    this.lucrariCuComenziIds.set(new Set());
    if (idObiectiv == null) {
      this.isLoadingLucrariCuComenzi.set(false);
      return;
    }

    this.isLoadingLucrariCuComenzi.set(true);
    this.lucrareService.getCuComenzi(idObiectiv).subscribe({
      next: (list) => {
        if (requestId !== this.lucrariCuComenziRequestId) return;
        this.lucrariCuComenziIds.set(new Set(list.map((l) => l.id)));
        this.isLoadingLucrariCuComenzi.set(false);
      },
      error: () => {
        // Leave isLoading set so the × stays hidden -- without the list we can't tell
        // which lucrari are safe to delete.
        if (requestId !== this.lucrariCuComenziRequestId) return;
        this.errorMessage.set('Lucrările cu comenzi nu au putut fi încărcate.');
      },
    });
  }

  deleteLucrare(): void {
    const id = this.selectedLucrareId();
    if (!id) {
      this.errorMessage.set('Selectează o lucrare.');
      return;
    }

    const nume = this.lucrari().find((l) => l.id === id)?.nume ?? '';
    if (!window.confirm(`Ștergi lucrarea „${nume}”?`)) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    this.lucrareService.delete(id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Lucrarea a fost ștearsă.');
        this.lucrari.set(this.lucrari().filter((l) => l.id !== id));
        this.selectedLucrareId.set(null);
        this.form.patchValue({ nume: '' }, { emitEvent: false });
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        // 409 carries the reason as plain text (e.g. a comanda was added meanwhile).
        this.errorMessage.set(
          err.status === 409 && typeof err.error === 'string' ? err.error : 'Lucrarea nu a putut fi ștearsă.',
        );
      },
    });
  }
}
