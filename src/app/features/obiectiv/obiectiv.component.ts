import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, merge } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { DateRangeService } from '../../core/services/date-range.service';
import { Obiectiv } from '../../core/models/obiectiv.model';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { getRequiredFieldsMessage } from '../../shared/forms/required-fields.util';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

type ObiectivMode = 'create' | 'update';

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  nume: 'Nume',
  alias: 'Alias',
  termenExecutie: 'Termen execuție',
  dataIncepere: 'Data începere',
};

@Component({
  selector: 'app-obiective',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DateInputComponent, ComboSelectComponent],
  templateUrl: './obiectiv.component.html',
  styleUrl: './obiectiv.component.scss',
})
export class ObiectivComponent {
  private readonly fb = inject(FormBuilder);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly mode = signal<ObiectivMode>('create');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly dateRangeError = signal<string | null>(null);

  readonly obiective = signal<Obiectiv[]>([]);
  readonly isLoadingObiective = signal(false);
  readonly selectedObiectivId = signal<number | null>(null);
  private obiectiveRequestId = 0;

  // Ids of obiective that still have lucrari -- those can't be deleted, so the × is
  // only offered for an obiectiv outside this set.
  private readonly obiectiveCuLucrariIds = signal<ReadonlySet<number>>(new Set());
  readonly canDeleteSelected = computed(() => {
    const id = this.selectedObiectivId();
    return id != null && !this.obiectiveCuLucrariIds().has(id);
  });

  // Update picks the obiectiv by nume; its alias then shows in the Alias field below.
  readonly obiectivOptions = computed<ComboOption[]>(() =>
    this.obiective().map((o) => ({ value: o.id, label: o.nume })),
  );

  readonly form = this.fb.group({
    nume: ['', Validators.required],
    alias: ['', Validators.required],
    termenExecutie: ['', Validators.required],
    dataIncepere: ['', Validators.required],
  });

  constructor(
    readonly authService: AuthService,
    private readonly objectiveService: ObjectiveService,
    private readonly dateRangeService: DateRangeService,
  ) {
    merge(this.form.get('dataIncepere')!.valueChanges, this.form.get('termenExecutie')!.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.validateDateRange());
  }

  private validateDateRange(): void {
    const { dataIncepere, termenExecutie } = this.form.getRawValue();
    const result = this.dateRangeService.validate(
      dataIncepere,
      termenExecutie,
      'Data de începere trebuie să fie mai mică decât data de execuție.',
    );

    this.dateRangeError.set(result.message);

    if (!result.valid) {
      this.form.patchValue({ dataIncepere: '', termenExecutie: '' }, { emitEvent: false });
    }
  }

  selectMode(mode: ObiectivMode): void {
    if (this.mode() === mode) return;

    this.mode.set(mode);
    this.resetForm();
  }

  // Back to the current mode's starting state: empty fields, nothing selected, fresh list
  // (update). Used when switching modes and after every successful save.
  private resetForm(): void {
    const mode = this.mode();
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dateRangeError.set(null);
    this.selectedObiectivId.set(null);
    this.form.reset();

    const nume = this.form.get('nume')!;
    const alias = this.form.get('alias')!;
    const termenExecutie = this.form.get('termenExecutie')!;
    const dataIncepere = this.form.get('dataIncepere')!;

    if (mode === 'create') {
      nume.enable();
      alias.enable();
      termenExecutie.enable();
      dataIncepere.enable();
      nume.setValidators(Validators.required);
      alias.setValidators(Validators.required);
      termenExecutie.setValidators(Validators.required);
      dataIncepere.setValidators(Validators.required);
      [nume, alias, termenExecutie, dataIncepere].forEach((c) => c.updateValueAndValidity({ emitEvent: false }));
      return;
    }

    // Update: every field is editable once an obiectiv is picked -- nume in place in the
    // Obiectiv combobox (freeText), the rest in their own fields. Nume is the only required
    // one; alias, data începere and termen execuție stay optional.
    nume.enable();
    alias.enable();
    termenExecutie.enable();
    dataIncepere.enable();
    nume.setValidators(Validators.required);
    alias.clearValidators();
    termenExecutie.clearValidators();
    dataIncepere.clearValidators();
    [nume, alias, termenExecutie, dataIncepere].forEach((c) => c.updateValueAndValidity({ emitEvent: false }));

    this.loadObiective();
  }

  onObiectivSelected(rawId: number | string | null): void {
    const id = rawId == null ? null : Number(rawId);
    this.selectedObiectivId.set(id);

    const obiectiv = id ? this.obiective().find((o) => o.id === id) : undefined;
    this.dateRangeError.set(null);
    this.form.patchValue(
      {
        nume: obiectiv?.nume ?? '',
        alias: obiectiv?.alias ?? '',
        termenExecutie: toDateInputValue(obiectiv?.termenExecutie),
        dataIncepere: toDateInputValue(obiectiv?.dataIncepere),
      },
      { emitEvent: false },
    );
  }

  // Update mode: the Obiectiv combobox is editable in place (freeText) once an obiectiv is
  // picked -- this carries the typed text into the form as the new nume.
  onObiectivNameEdited(text: string): void {
    this.form.get('nume')!.setValue(text);
  }

  submit(): void {
    const mode = this.mode();

    if (mode === 'update' && !this.selectedObiectivId()) {
      this.errorMessage.set('Selectează un obiectiv.');
      return;
    }

    if (this.form.invalid) {
      this.errorMessage.set(getRequiredFieldsMessage(this.form, REQUIRED_FIELD_LABELS));
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { nume, alias, termenExecutie, dataIncepere } = this.form.getRawValue();
    const payload = {
      nume: nume!,
      alias: alias || null,
      termenExecutie: toIsoOrNull(termenExecutie),
      dataIncepere: toIsoOrNull(dataIncepere),
    };

    const request =
      mode === 'update'
        ? this.objectiveService.update(this.selectedObiectivId()!, payload)
        : this.objectiveService.create(payload);

    request.subscribe({
      next: async () => {
        this.isSubmitting.set(false);
        await this.confirmDialog.notifySaved();
        // Update mode reloads the list here, so the combobox shows what was just saved.
        this.resetForm();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          mode === 'update' ? 'Obiectivul nu a putut fi actualizat.' : 'Obiectivul nu a putut fi salvat.',
        );
      },
    });
  }

  private loadObiective(): void {
    const requestId = ++this.obiectiveRequestId;
    this.isLoadingObiective.set(true);
    forkJoin([this.objectiveService.getAll(), this.objectiveService.getAllCuLucrari()]).subscribe({
      next: ([list, cuLucrari]) => {
        if (requestId !== this.obiectiveRequestId) return;
        this.obiective.set(list);
        this.obiectiveCuLucrariIds.set(new Set(cuLucrari.map((o) => o.obiectiv.idObiectiv)));
        this.isLoadingObiective.set(false);
        this.errorMessage.set(null);
      },
      error: () => {
        if (requestId !== this.obiectiveRequestId) return;
        this.isLoadingObiective.set(false);
        this.errorMessage.set('Obiectivele nu au putut fi încărcate.');
      },
    });
  }

  async deleteObiectiv(): Promise<void> {
    const id = this.selectedObiectivId();
    if (!id) {
      this.errorMessage.set('Selectează un obiectiv.');
      return;
    }

    const nume = this.obiective().find((o) => o.id === id)?.nume ?? '';
    const confirmed = await this.confirmDialog.ask({
      title: 'Ștergi obiectivul?',
      message: 'Obiectivul va fi șters definitiv. ',
      subject: nume,
      confirmText: 'Șterge',
      variant: 'danger',
    });
    if (!confirmed) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    this.objectiveService.delete(id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Obiectivul a fost șters.');
        this.obiective.set(this.obiective().filter((o) => o.id !== id));
        this.selectedObiectivId.set(null);
        this.form.reset();
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        // 409 carries the reason as plain text (e.g. the obiectiv still has lucrari).
        this.errorMessage.set(
          err.status === 409 && typeof err.error === 'string' ? err.error : 'Obiectivul nu a putut fi șters.',
        );
      },
    });
  }
}

function toIsoOrNull(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
