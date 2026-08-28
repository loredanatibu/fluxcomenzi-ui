import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { LucrareService } from '../../core/services/lucrare.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { Lucrare } from '../../core/models/lucrare.model';
import { Obiectiv } from '../../core/models/obiectiv.model';
import { ObiectivCuLucrari } from '../../core/models/obiectiv-cu-lucrari.model';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { getRequiredFieldsMessage } from '../../shared/forms/required-fields.util';

type LucrareMode = 'create' | 'update' | 'delete';

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

  readonly mode = signal<LucrareMode>('create');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly obiective = signal<Obiectiv[]>([]);
  readonly isLoadingObiective = signal(false);

  readonly lucrari = signal<Lucrare[]>([]);
  readonly isLoadingLucrari = signal(false);
  readonly selectedLucrareId = signal<number | null>(null);

  // Update mode: Obiectiv is picked first (from /obiective/cu-lucrari), which then
  // scopes which lucrari are selectable in the Nume field.
  readonly obiectiveCuLucrari = signal<ObiectivCuLucrari[]>([]);
  readonly isLoadingObiectiveCuLucrari = signal(false);
  readonly selectedIdObiectiv = signal<number | null>(null);

  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) return 'Se salvează...';
    return this.mode() === 'delete' ? 'Șterge' : 'Salvează';
  });

  readonly lucrareOptions = computed<ComboOption[]>(() => {
    if (this.mode() === 'update') {
      const idObiectiv = this.selectedIdObiectiv();
      if (idObiectiv == null) return [];
      const entry = this.obiectiveCuLucrari().find((o) => o.obiectiv.idObiectiv === idObiectiv);
      return (entry?.lucrari ?? []).map((l) => ({ value: l.idLucrare, label: l.nume }));
    }
    return this.lucrari().map((l) => ({ value: l.id, label: l.nume }));
  });

  readonly obiectivOptions = computed<ComboOption[]>(() => {
    if (this.mode() === 'update') {
      return this.obiectiveCuLucrari().map((o) => ({ value: o.obiectiv.idObiectiv, label: o.obiectiv.nume }));
    }
    return this.obiective().map((o) => ({ value: o.id, label: o.nume }));
  });

  readonly form = this.fb.group({
    nume: ['', Validators.required],
    idObiectiv: [null as number | null, Validators.required],
  });

  constructor(
    readonly authService: AuthService,
    private readonly lucrareService: LucrareService,
    private readonly objectiveService: ObjectiveService,
  ) {
    if (this.authService.isAuthenticated()) {
      this.loadObiective();
    }

    this.form.get('idObiectiv')!.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (this.mode() !== 'update') return;

      // Picking a different Obiectiv invalidates the previously chosen Lucrare.
      this.selectedIdObiectiv.set(value ?? null);
      this.selectedLucrareId.set(null);
      this.form.patchValue({ nume: '' }, { emitEvent: false });
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

    if (mode === 'create') {
      this.form.get('nume')?.enable();
      this.form.get('idObiectiv')?.enable();
      return;
    }

    // Nume is only ever chosen/displayed, never typed, in update & delete mode.
    this.form.get('nume')?.disable();

    if (mode === 'delete') {
      this.form.get('idObiectiv')?.disable();
      this.loadLucrari();
    } else {
      // Update: Obiectiv must be picked first; it drives which lucrari are selectable.
      this.form.get('idObiectiv')?.enable();
      this.loadObiectiveCuLucrari();
    }
  }

  onLucrareSelected(rawId: number | string | null): void {
    const id = rawId == null ? null : Number(rawId);
    this.selectedLucrareId.set(id);

    if (this.mode() === 'update') {
      const idObiectiv = this.selectedIdObiectiv();
      const entry =
        idObiectiv != null ? this.obiectiveCuLucrari().find((o) => o.obiectiv.idObiectiv === idObiectiv) : undefined;
      const lucrare = id ? entry?.lucrari.find((l) => l.idLucrare === id) : undefined;
      this.form.patchValue({ nume: lucrare?.nume ?? '' }, { emitEvent: false });
      return;
    }

    const lucrare = id ? this.lucrari().find((l) => l.id === id) : undefined;
    this.form.patchValue(
      {
        nume: lucrare?.nume ?? '',
        idObiectiv: lucrare?.idObiectiv ?? null,
      },
      { emitEvent: false },
    );
  }

  submit(): void {
    const mode = this.mode();

    if (mode === 'delete') {
      this.deleteLucrare();
      return;
    }

    if (mode === 'update' && !this.selectedLucrareId()) {
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

    const request =
      mode === 'update'
        ? this.lucrareService.update(this.selectedLucrareId()!, payload)
        : this.lucrareService.create(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set(mode === 'update' ? 'Lucrarea a fost actualizată.' : 'Lucrarea a fost salvată.');
        if (mode === 'create') {
          this.form.reset();
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          mode === 'update' ? 'Lucrarea nu a putut fi actualizată.' : 'Lucrarea nu a putut fi salvată.',
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

  private loadObiectiveCuLucrari(): void {
    this.isLoadingObiectiveCuLucrari.set(true);
    this.objectiveService.getAllCuLucrari().subscribe({
      next: (list) => {
        this.obiectiveCuLucrari.set(list);
        this.isLoadingObiectiveCuLucrari.set(false);
        this.errorMessage.set(null);
      },
      error: () => {
        this.isLoadingObiectiveCuLucrari.set(false);
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

  private deleteLucrare(): void {
    const id = this.selectedLucrareId();
    if (!id) {
      this.errorMessage.set('Selectează o lucrare.');
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    this.lucrareService.delete(id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Lucrarea a fost ștearsă.');
        this.lucrari.set(this.lucrari().filter((l) => l.id !== id));
        this.selectedLucrareId.set(null);
        this.form.reset();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Lucrarea nu a putut fi ștearsă.');
      },
    });
  }
}
