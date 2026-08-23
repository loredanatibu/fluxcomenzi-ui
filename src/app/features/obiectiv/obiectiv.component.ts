import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { merge } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { DateRangeService } from '../../core/services/date-range.service';
import { Obiectiv } from '../../core/models/obiectiv.model';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { getRequiredFieldsMessage } from '../../shared/forms/required-fields.util';

type ObiectivMode = 'create' | 'update' | 'delete';

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

  readonly mode = signal<ObiectivMode>('create');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly dateRangeError = signal<string | null>(null);

  readonly obiective = signal<Obiectiv[]>([]);
  readonly isLoadingObiective = signal(false);
  readonly selectedObiectivId = signal<number | null>(null);

  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) return 'Se salvează...';
    return this.mode() === 'delete' ? 'Șterge' : 'Salvează';
  });

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
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dateRangeError.set(null);
    this.selectedObiectivId.set(null);
    this.form.reset();

    if (mode === 'create') {
      this.form.get('nume')?.enable();
      this.form.get('alias')?.enable();
      this.form.get('termenExecutie')?.enable();
      this.form.get('dataIncepere')?.enable();
      return;
    }

    // Nume/alias are only ever chosen/displayed, never typed, in update & delete mode.
    this.form.get('nume')?.disable();
    this.form.get('alias')?.disable();

    if (mode === 'delete') {
      this.form.get('termenExecutie')?.disable();
      this.form.get('dataIncepere')?.disable();
    } else {
      this.form.get('termenExecutie')?.enable();
      this.form.get('dataIncepere')?.enable();
    }

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

  submit(): void {
    const mode = this.mode();

    if (mode === 'delete') {
      this.deleteObiectiv();
      return;
    }

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
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set(mode === 'update' ? 'Obiectivul a fost actualizat.' : 'Obiectivul a fost salvat.');
        if (mode === 'create') {
          this.form.reset();
        }
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

  private deleteObiectiv(): void {
    const id = this.selectedObiectivId();
    if (!id) {
      this.errorMessage.set('Selectează un obiectiv.');
      return;
    }

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
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Obiectivul nu a putut fi șters.');
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
