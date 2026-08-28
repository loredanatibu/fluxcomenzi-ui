import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ComandaService } from '../../core/services/comanda.service';
import { LucrareService } from '../../core/services/lucrare.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { Comanda } from '../../core/models/comanda.model';
import { Lucrare } from '../../core/models/lucrare.model';
import { ObiectivCuLucrari } from '../../core/models/obiectiv-cu-lucrari.model';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { getRequiredFieldsMessage } from '../../shared/forms/required-fields.util';

// Fields that stay disabled in "Creează Comandă" until a Lucrare is picked.
const CREATE_STAGE_FIELDS = [
  'numeMaterial',
  'cantitate',
  'unitateMasura',
  'numeFurnizor',
  'emailFurnizor',
  'termenLivrare',
  'comandaTrimisa',
  'comandaReceptionata',
  'observatii',
] as const;

type ComandaMode = 'create' | 'update' | 'delete';

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  numeMaterial: 'Nume material',
  idLucrare: 'Lucrare',
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

  readonly lucrari = signal<Lucrare[]>([]);
  readonly isLoadingLucrari = signal(false);

  readonly comenzi = signal<Comanda[]>([]);
  readonly isLoadingComenzi = signal(false);
  readonly selectedComandaId = signal<number | null>(null);

  // Update mode (for now) only lists comenzi for the chosen lucrare; per-comanda editing comes later.
  readonly selectedLucrareId = signal<number | null>(null);
  readonly filteredComenzi = computed(() => {
    const idLucrare = this.selectedLucrareId();
    if (idLucrare == null) return [];
    return this.comenzi().filter((c) => c.idLucrare === idLucrare);
  });

  // Create mode: Obiectiv is picked first (from /obiective/cu-lucrari), which then
  // scopes which lucrari are selectable, before anything else becomes editable.
  readonly obiectiveCuLucrari = signal<ObiectivCuLucrari[]>([]);
  readonly isLoadingObiective = signal(false);
  readonly selectedIdObiectiv = signal<number | null>(null);

  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) return 'Se salvează...';
    return this.mode() === 'delete' ? 'Șterge' : 'Salvează';
  });

  readonly comandaOptions = computed<ComboOption[]>(() =>
    this.comenzi().map((c) => ({ value: c.id, label: c.numeMaterial })),
  );
  readonly obiectivOptions = computed<ComboOption[]>(() =>
    this.obiectiveCuLucrari().map((o) => ({ value: o.obiectiv.idObiectiv, label: o.obiectiv.nume })),
  );
  readonly lucrareOptions = computed<ComboOption[]>(() => {
    if (this.mode() === 'create') {
      const idObiectiv = this.selectedIdObiectiv();
      if (idObiectiv == null) return [];
      const entry = this.obiectiveCuLucrari().find((o) => o.obiectiv.idObiectiv === idObiectiv);
      return (entry?.lucrari ?? []).map((l) => ({ value: l.idLucrare, label: l.nume }));
    }
    return this.lucrari().map((l) => ({ value: l.id, label: l.nume }));
  });

  readonly form = this.fb.group({
    numeMaterial: ['', Validators.required],
    idLucrare: [null as number | null, Validators.required],
    cantitate: [null as number | null, [Validators.required, Validators.min(0)]],
    unitateMasura: ['', Validators.required],
    numeFurnizor: ['', Validators.required],
    emailFurnizor: ['', [Validators.required, Validators.email]],
    termenLivrare: ['', Validators.required],
    comandaTrimisa: [false],
    comandaReceptionata: [false],
    observatii: [''],
  });

  constructor(
    readonly authService: AuthService,
    private readonly comandaService: ComandaService,
    private readonly lucrareService: LucrareService,
    private readonly objectiveService: ObjectiveService,
  ) {
    // Creează Comandă starts with nothing selected: Obiectiv must be chosen first,
    // which unlocks Lucrare, which in turn unlocks everything else.
    this.form.get('idLucrare')?.disable();
    this.setCreateStageFieldsEnabled(false);

    if (this.authService.isAuthenticated()) {
      this.loadLucrari();
      this.loadObiectiveCuLucrari();
    }

    this.form.get('idLucrare')!.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.selectedLucrareId.set(value);
      if (this.mode() === 'create') {
        this.setCreateStageFieldsEnabled(value != null);
      }
    });
  }

  onObiectivSelectedForCreate(rawId: number | string | null): void {
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
    this.selectedComandaId.set(null);
    this.selectedLucrareId.set(null);
    this.selectedIdObiectiv.set(null);
    this.form.reset();

    if (mode === 'create') {
      this.form.get('idLucrare')?.disable();
      this.setCreateStageFieldsEnabled(false);
      this.loadObiectiveCuLucrari();
      return;
    }

    // Nume material is only ever chosen/displayed, never typed, in update & delete mode.
    this.form.get('numeMaterial')?.disable();

    if (mode === 'update') {
      // Only Lucrare stays editable; the datagrid below lists comenzi for the chosen lucrare.
      this.form.get('idLucrare')?.enable();
      this.form.get('cantitate')?.disable();
      this.form.get('unitateMasura')?.disable();
      this.form.get('numeFurnizor')?.disable();
      this.form.get('emailFurnizor')?.disable();
      this.form.get('termenLivrare')?.disable();
      this.form.get('comandaTrimisa')?.disable();
      this.form.get('comandaReceptionata')?.disable();
      this.form.get('observatii')?.disable();
    } else {
      // delete
      this.form.get('idLucrare')?.disable();
      this.form.get('cantitate')?.disable();
      this.form.get('unitateMasura')?.disable();
      this.form.get('numeFurnizor')?.disable();
      this.form.get('emailFurnizor')?.disable();
      this.form.get('termenLivrare')?.disable();
      this.form.get('comandaTrimisa')?.disable();
      this.form.get('comandaReceptionata')?.disable();
      this.form.get('observatii')?.disable();
    }

    this.loadComenzi();
  }

  onComandaSelected(rawId: number | string | null): void {
    const id = rawId == null ? null : Number(rawId);
    this.selectedComandaId.set(id);

    const comanda = id ? this.comenzi().find((c) => c.id === id) : undefined;
    this.form.patchValue(
      {
        numeMaterial: comanda?.numeMaterial ?? '',
        idLucrare: comanda?.idLucrare ?? null,
        cantitate: comanda?.cantitate ?? null,
        unitateMasura: comanda?.unitateMasura ?? '',
        numeFurnizor: comanda?.numeFurnizor ?? '',
        emailFurnizor: comanda?.emailFurnizor ?? '',
        termenLivrare: toDateTimeInputValue(comanda?.termenLivrare),
        comandaTrimisa: comanda?.comandaTrimisa ?? false,
        comandaReceptionata: comanda?.comandaReceptionata ?? false,
        observatii: comanda?.observatii ?? '',
      },
      { emitEvent: false },
    );
  }

  submit(): void {
    const mode = this.mode();

    if (mode === 'delete') {
      this.deleteComanda();
      return;
    }

    if (mode === 'update' && !this.selectedComandaId()) {
      this.errorMessage.set('Selectează o comandă.');
      return;
    }

    if (this.form.invalid) {
      this.errorMessage.set(getRequiredFieldsMessage(this.form, REQUIRED_FIELD_LABELS));
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const {
      numeMaterial,
      idLucrare,
      cantitate,
      unitateMasura,
      numeFurnizor,
      emailFurnizor,
      termenLivrare,
      comandaTrimisa,
      comandaReceptionata,
      observatii,
    } = this.form.getRawValue();

    const payload = {
      idLucrare: idLucrare!,
      numeMaterial: numeMaterial!,
      cantitate: Number(cantitate),
      unitateMasura: unitateMasura!,
      numeFurnizor: numeFurnizor!,
      emailFurnizor: emailFurnizor!,
      termenLivrare: termenLivrare!,
      comandaTrimisa: comandaTrimisa!,
      comandaReceptionata: comandaReceptionata!,
      observatii: observatii ?? '',
    };

    const request =
      mode === 'update'
        ? this.comandaService.update(this.selectedComandaId()!, payload)
        : this.comandaService.create(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set(mode === 'update' ? 'Comanda a fost actualizată.' : 'Comanda a fost salvată.');
        if (mode === 'create') {
          this.form.reset();
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          mode === 'update' ? 'Comanda nu a putut fi actualizată.' : 'Comanda nu a putut fi salvată.',
        );
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

  private setCreateStageFieldsEnabled(enabled: boolean): void {
    for (const name of CREATE_STAGE_FIELDS) {
      const control = this.form.get(name);
      if (enabled) {
        control?.enable();
      } else {
        control?.disable();
      }
    }
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

  private deleteComanda(): void {
    const id = this.selectedComandaId();
    if (!id) {
      this.errorMessage.set('Selectează o comandă.');
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    this.comandaService.delete(id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Comanda a fost ștearsă.');
        this.comenzi.set(this.comenzi().filter((c) => c.id !== id));
        this.selectedComandaId.set(null);
        this.form.reset();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Comanda nu a putut fi ștearsă.');
      },
    });
  }
}

function toDateTimeInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : '';
}
