import { Component, ElementRef, Injector, computed, effect, inject, afterNextRender, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, merge, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ComandaService, ComandaPayload } from '../../core/services/comanda.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { SolicitantService } from '../../core/services/solicitant.service';
import { FurnizorService } from '../../core/services/furnizor.service';
import { AgentService } from '../../core/services/agent.service';
import { Comanda } from '../../core/models/comanda.model';
import { ObiectivCuLucrari } from '../../core/models/obiectiv-cu-lucrari.model';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { ComboOption, ComboSelectComponent } from '../../shared/combo-select/combo-select.component';
import { getRequiredFieldsMessage } from '../../shared/forms/required-fields.util';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';

type ComandaMode = 'create' | 'receptie' | 'update';

const REQUIRED_ROW_LABELS: Record<string, string> = {
  numeMaterial: 'Nume material',
  cantitate: 'Cantitate',
  unitateMasura: 'Unitate măsură',
  idFurnizor: 'Furnizor',
  idAgent: 'Agent',
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
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly mode = signal<ComandaMode>('create');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly receptionatError = signal<string | null>(null);

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

  // Create mode: comenzi are grouped by solicitant -- each group is { idSolicitant, rows },
  // with one FormGroup per new comanda in rows, all saved under the selected lucrare.
  // Disabled until a Lucrare is picked; "Adaugă linie" appends a row to its own group,
  // "Adaugă solicitant" appends another group.
  readonly solicitantGroups = new FormArray<FormGroup>([this.newSolicitantGroup()]);

  // Loaded once, up front: the Solicitant/Furnizor combobox options for every group/row.
  // A comanda references both by id (FKs -- see comenzi in schema.sql), so the option
  // value is the id and the label the name; the label maps also name them in Recepție.
  readonly solicitantOptions = signal<ComboOption[]>([]);
  readonly isLoadingSolicitanti = signal(false);
  readonly furnizorOptions = signal<ComboOption[]>([]);
  readonly isLoadingFurnizori = signal(false);

  // Agent is optional: only comenzi supplied through an agent have one, marked by the
  // "prin agent" checkbox next to the Agent combobox, which stays disabled until it's
  // ticked. Agenti are loaded lazily -- the first time a box is ticked, or a listed
  // comanda already has an agent to name -- and the service caches them from then on.
  readonly agentOptions = signal<ComboOption[]>([]);
  readonly isLoadingAgenti = signal(false);

  private readonly numeSolicitantById = computed(() => labelsById(this.solicitantOptions()));
  private readonly numeFurnizorById = computed(() => labelsById(this.furnizorOptions()));
  private readonly numeAgentById = computed(() => labelsById(this.agentOptions()));

  // Every mode: Obiectiv is picked first (from /obiective/cu-lucrari), which then scopes
  // which lucrari are selectable (in create, before the rows become editable; in update
  // and recepție, before the comenzi grid for the chosen lucrare is shown).
  readonly obiectiveCuLucrari = signal<ObiectivCuLucrari[]>([]);
  readonly isLoadingObiective = signal(false);
  readonly selectedIdObiectiv = signal<number | null>(null);

  // Obiective are picked by alias (nume when an obiectiv has none), with the full nume
  // shown under the combobox once picked. /obiective/obiectiv-cu-lucrari carries no alias,
  // so it comes from the plain /obiective list, loaded alongside.
  private readonly aliasByIdObiectiv = signal<ReadonlyMap<number, string | null | undefined>>(new Map());
  readonly obiectivOptions = computed<ComboOption[]>(() =>
    this.obiectiveCuLucrari().map((o) => ({
      value: o.obiectiv.idObiectiv,
      label: this.aliasByIdObiectiv().get(o.obiectiv.idObiectiv) || o.obiectiv.nume,
    })),
  );
  readonly selectedObiectivNume = computed(() => {
    const id = this.selectedIdObiectiv();
    return this.obiectiveCuLucrari().find((o) => o.obiectiv.idObiectiv === id)?.obiectiv.nume ?? null;
  });
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
    private readonly furnizorService: FurnizorService,
    private readonly agentService: AgentService,
  ) {
    // Creează Comandă starts with nothing selected: Obiectiv must be chosen first,
    // which unlocks Lucrare, which in turn unlocks the solicitant groups.
    this.form.get('idLucrare')?.disable();
    this.solicitantGroups.disable();

    if (this.authService.isAuthenticated()) {
      this.loadObiectiveCuLucrari();
      this.loadSolicitanti();
      this.loadFurnizori();
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
          // enable() reaches every control, including the Agent comboboxes of unticked rows.
          this.solicitantGroups.controls
            .flatMap((group) => this.rowsOf(group).controls)
            .forEach((row) => this.syncAgentControl(row));
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
          this.withAgentToggle(
            this.fb.group({
              idSolicitant: [c.idSolicitant, Validators.required],
              numeMaterial: [c.numeMaterial],
              cantitate: [c.cantitate],
              unitateMasura: [c.unitateMasura],
              idFurnizor: [c.idFurnizor, Validators.required],
              prinAgent: [c.idAgent != null],
              idAgent: [{ value: c.idAgent, disabled: c.idAgent == null }, Validators.required],
              termenLivrare: [toDateTimeInputValue(c.termenLivrare)],
              comandaReceptionata: [c.comandaReceptionata, [Validators.required, Validators.min(0)]],
              observatii: [c.observatii],
            }),
          ),
      );
    }

    // Listed comenzi that already have an agent need the agenti to show the name.
    if (rows.some((c) => c.idAgent != null)) {
      this.loadAgenti();
    }

    // clear() doesn't reset the array's own dirty flag, so recompute it from the rows.
    if (!this.gridForm.controls.some((group) => group.dirty)) {
      this.gridForm.markAsPristine();
    }
  }

  // Recepție: more can't be received than was ordered. Same treatment as the obiectiv date
  // range -- the offending value is cleared and the message stays until the next edit.
  validateReceptionat(index: number): void {
    const comanda = this.gridRows[index];
    const control = this.gridForm.at(index)?.get('comandaReceptionata');
    if (!comanda || !control) return;

    const receptionat = control.value;
    if (receptionat == null || receptionat === '' || Number(receptionat) <= comanda.cantitate) {
      this.receptionatError.set(null);
      return;
    }

    this.receptionatError.set(
      `${comanda.numeMaterial}: cantitatea recepționată nu poate fi mai mare decât cantitatea comandată (${comanda.cantitate} ${comanda.unitateMasura}).`,
    );
    control.setValue(null);
  }

  rowsOf(group: FormGroup): FormArray<FormGroup> {
    return group.get('rows') as FormArray<FormGroup>;
  }

  // A new solicitant only makes sense once every existing one is chosen and has at least
  // one fully filled-in material. Disabled groups (no lucrare yet) count as not ready.
  canAddSolicitant(): boolean {
    return this.solicitantGroups.controls.every(
      (group) => group.get('idSolicitant')!.valid && this.rowsOf(group).controls.some((row) => row.valid),
    );
  }

  addSolicitantGroup(): void {
    this.solicitantGroups.push(this.newSolicitantGroup());
    const index = this.solicitantGroups.length - 1;
    this.focusAfterRender(`[data-solicitant="${index}"] app-combo-select input`);
  }

  async removeSolicitantGroup(index: number): Promise<void> {
    if (this.solicitantGroups.length <= 1) return;

    // Asks first only when there's something to lose -- an empty group just goes.
    const group = this.solicitantGroups.at(index);
    if (hasFilledValue(group)) {
      const idSolicitant: number | null = group.get('idSolicitant')!.value;
      const lineCount = this.rowsOf(group).length;
      const confirmed = await this.confirmDialog.ask({
        title: 'Elimini solicitantul?',
        message: 'Solicitantul și toate liniile lui vor fi eliminate din comandă.',
        subject: `${(idSolicitant != null && this.numeSolicitant(idSolicitant)) || `Solicitantul ${index + 1}`} · ${lineCount} ${lineCount === 1 ? 'linie' : 'linii'}`,
        confirmText: 'Elimină',
        variant: 'danger',
      });
      // The group may have moved while the dialog was open; remove it by identity.
      if (!confirmed) return;
      index = this.solicitantGroups.controls.indexOf(group);
      if (index === -1) return;
    }
    this.solicitantGroups.removeAt(index);
  }

  addCreateRow(groupIndex: number): void {
    this.rowsOf(this.solicitantGroups.at(groupIndex)).push(this.newCreateRow());
    this.focusAfterRender(`[data-solicitant="${groupIndex}"] tbody tr:last-child input`);
  }

  async removeCreateRow(groupIndex: number, rowIndex: number): Promise<void> {
    const rows = this.rowsOf(this.solicitantGroups.at(groupIndex));
    if (rows.length <= 1) return;

    // Asks first only when the line has something filled in -- an empty one just goes.
    const row = rows.at(rowIndex);
    if (hasFilledValue(row)) {
      const v = row.getRawValue();
      const confirmed = await this.confirmDialog.ask({
        title: 'Elimini linia?',
        message: 'Linia va fi eliminată din comandă.',
        subject: [v.numeMaterial, v.cantitate != null ? `${v.cantitate} ${v.unitateMasura ?? ''}`.trim() : '']
          .filter(Boolean)
          .join(' · ') || `Linia ${rowIndex + 1}`,
        confirmText: 'Elimină',
        variant: 'danger',
      });
      if (!confirmed) return;
      rowIndex = rows.controls.indexOf(row);
      if (rowIndex === -1 || rows.length <= 1) return;
    }
    rows.removeAt(rowIndex);
  }

  // Moves focus into the field just added, so the user can type straight away.
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  private newSolicitantGroup(): FormGroup {
    return this.fb.group({
      idSolicitant: [null as number | null, Validators.required],
      rows: this.fb.array<FormGroup>([this.newCreateRow()]),
    });
  }

  private newCreateRow(): FormGroup {
    return this.withAgentToggle(
      this.fb.group({
        numeMaterial: ['', Validators.required],
        cantitate: [null as number | null, [Validators.required, Validators.min(0)]],
        unitateMasura: ['', Validators.required],
        idFurnizor: [null as number | null, Validators.required],
        prinAgent: [false],
        idAgent: [{ value: null as number | null, disabled: true }, Validators.required],
        termenLivrare: ['', Validators.required],
      }),
    );
  }

  // Ticking "prin agent" unlocks the row's Agent combobox (required from then on, as a
  // disabled control isn't validated) and loads the agenti; unticking clears it again.
  private withAgentToggle(row: FormGroup): FormGroup {
    row.get('prinAgent')!.valueChanges.subscribe(() => this.syncAgentControl(row));
    return row;
  }

  private syncAgentControl(row: FormGroup): void {
    const idAgent = row.get('idAgent')!;
    const prinAgent = row.get('prinAgent')!;
    if (prinAgent.enabled && prinAgent.value) {
      if (idAgent.disabled) idAgent.enable();
      this.loadAgenti();
    } else if (idAgent.enabled || idAgent.value != null) {
      idAgent.reset({ value: null, disabled: true });
    }
  }

  numeSolicitant(id: number): string {
    return this.numeSolicitantById().get(id) ?? '';
  }

  numeFurnizor(id: number): string {
    return this.numeFurnizorById().get(id) ?? '';
  }

  numeAgent(id: number | null): string {
    return id == null ? '' : (this.numeAgentById().get(id) ?? '');
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
          idSolicitant: Number(v.idSolicitant),
          idFurnizor: Number(v.idFurnizor),
          idAgent: v.prinAgent ? Number(v.idAgent) : null,
          numeMaterial: v.numeMaterial,
          cantitate: Number(v.cantitate),
          unitateMasura: v.unitateMasura,
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
      next: async () => {
        this.isSubmitting.set(false);
        // Saved: the reload in resetForm() should replace these rows, not keep them as unsaved edits.
        this.gridForm.markAsPristine();
        await this.confirmDialog.notifySaved();
        this.resetForm();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Comenzile nu au putut fi actualizate.');
      },
    });
  }

  // Only comenzi with nothing received yet can be deleted. Checks the saved value, so an
  // unsaved edit in the Recepționat cell doesn't change it.
  canDeleteGridRow(index: number): boolean {
    const comanda = this.gridRows[index];
    return comanda != null && !comanda.comandaReceptionata;
  }

  async deleteGridRow(index: number): Promise<void> {
    const comanda = this.gridRows[index];
    if (!comanda || !this.canDeleteGridRow(index)) return;

    const confirmed = await this.confirmDialog.ask({
      title: 'Ștergi comanda?',
      message: 'Comanda va fi ștearsă definitiv.',
      subject: `${comanda.numeMaterial} · ${comanda.cantitate} ${comanda.unitateMasura}`,
      confirmText: 'Șterge',
      variant: 'danger',
    });
    if (!confirmed) return;

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
    this.resetForm();
  }

  // Back to the current mode's starting state: nothing selected, fresh data. Used when
  // switching modes and after every successful save.
  private resetForm(): void {
    const mode = this.mode();
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.receptionatError.set(null);
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
        idSolicitant: Number(solicitantGroup.get('idSolicitant')!.value),
        idFurnizor: Number(v.idFurnizor),
        idAgent: v.prinAgent ? Number(v.idAgent) : null,
        numeMaterial: v.numeMaterial,
        cantitate: Number(v.cantitate),
        unitateMasura: v.unitateMasura,
        termenLivrare: v.termenLivrare,
        comandaReceptionata: 0,
        observatii: '',
      };
      return this.comandaService.create(payload).pipe(
        map(() => true),
        catchError(() => of(false)),
      );
    });

    forkJoin(requests).subscribe(async (results) => {
      this.isSubmitting.set(false);
      const failed = new Set(entries.filter((_, i) => !results[i]).map(({ row }) => row));

      if (failed.size === 0) {
        await this.confirmDialog.notifySaved();
        this.resetForm();
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
      const idSolicitant: number | null = solicitantGroup.get('idSolicitant')!.value;
      const label = (idSolicitant != null && this.numeSolicitant(idSolicitant)) || `Solicitantul ${g + 1}`;
      if (solicitantGroup.get('idSolicitant')!.invalid) {
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
    forkJoin([this.objectiveService.getAllCuLucrari(), this.objectiveService.getAll()]).subscribe({
      next: ([list, obiective]) => {
        this.aliasByIdObiectiv.set(new Map(obiective.map((o) => [o.id, o.alias])));
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
        this.solicitantOptions.set(list.map((s) => ({ value: s.id, label: s.numePrenume })));
        this.isLoadingSolicitanti.set(false);
      },
      error: () => {
        this.isLoadingSolicitanti.set(false);
        this.errorMessage.set('Solicitanții nu au putut fi încărcați.');
      },
    });
  }

  private loadFurnizori(): void {
    this.isLoadingFurnizori.set(true);
    this.furnizorService.getAll().subscribe({
      next: (list) => {
        this.furnizorOptions.set(list.map((f) => ({ value: f.id, label: f.nume })));
        this.isLoadingFurnizori.set(false);
      },
      error: () => {
        this.isLoadingFurnizori.set(false);
        this.errorMessage.set('Furnizorii nu au putut fi încărcați.');
      },
    });
  }

  // Called whenever agenti might be needed; only the first call (or a retry after a
  // failure) actually loads them.
  private loadAgenti(): void {
    if (this.isLoadingAgenti() || this.agentOptions().length > 0) return;

    this.isLoadingAgenti.set(true);
    this.agentService.getAll().subscribe({
      next: (list) => {
        this.agentOptions.set(list.map((a) => ({ value: a.id, label: a.numePrenume })));
        this.isLoadingAgenti.set(false);
      },
      error: () => {
        this.isLoadingAgenti.set(false);
        this.errorMessage.set('Agenții nu au putut fi încărcați.');
      },
    });
  }

  private loadComenzi(): void {
    this.isLoadingComenzi.set(true);
    this.comandaService.getAll().subscribe({
      next: (list) => {
        // The server's order shifts after updates; a fixed creation order keeps rows in place.
        this.comenzi.set([...list].sort(byCreatedAt));
        this.isLoadingComenzi.set(false);
      },
      error: () => {
        this.isLoadingComenzi.set(false);
        this.errorMessage.set('Comenzile nu au putut fi încărcate.');
      },
    });
  }
}

function labelsById(options: ComboOption[]): ReadonlyMap<number | string, string> {
  return new Map(options.map((o) => [o.value, o.label]));
}

// True when any field in the group (nested rows included) has a value the user entered.
// An unticked checkbox (false) counts as empty.
function hasFilledValue(control: FormGroup): boolean {
  const isFilled = (value: unknown): boolean =>
    Array.isArray(value)
      ? value.some(isFilled)
      : value !== null && typeof value === 'object'
        ? Object.values(value).some(isFilled)
        : value != null && value !== '' && value !== false;
  return isFilled(control.getRawValue());
}

// Oldest first; id breaks ties between comenzi created in the same instant (e.g. one save).
function byCreatedAt(a: Comanda, b: Comanda): number {
  const diff = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
  return diff !== 0 ? diff : a.id - b.id;
}

function toDateTimeInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : '';
}
