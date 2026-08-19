import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { LucrareService } from '../../core/services/lucrare.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { Lucrare } from '../../core/models/lucrare.model';
import { Obiectiv } from '../../core/models/obiectiv.model';

type LucrareMode = 'create' | 'update' | 'delete';

@Component({
  selector: 'app-lucrari',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) return 'Se salvează...';
    return this.mode() === 'delete' ? 'Șterge' : 'Salvează';
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
  }

  selectMode(mode: LucrareMode): void {
    if (this.mode() === mode) return;

    this.mode.set(mode);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.selectedLucrareId.set(null);
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
    } else {
      this.form.get('idObiectiv')?.enable();
    }

    this.loadLucrari();
  }

  onLucrareSelected(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value) || null;
    this.selectedLucrareId.set(id);

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
      this.form.markAllAsTouched();
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
