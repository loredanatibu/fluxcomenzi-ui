import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NgControl } from '@angular/forms';

export interface ComboOption {
  value: number | string;
  label: string;
}

// Searchable dropdown -- drop-in replacement for a native <select> that filters
// its option list as the user types. Works as a reactive form control
// (formControlName, like DateInputComponent) or standalone via [value]/(valueChange).
@Component({
  selector: 'app-combo-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './combo-select.component.html',
  styleUrl: './combo-select.component.scss',
})
export class ComboSelectComponent implements ControlValueAccessor {
  @Input()
  set options(value: ComboOption[] | null) {
    this.optionsSignal.set(value ?? []);
    // Re-sync the displayed text once options arrive after a value was already
    // set (e.g. the list loads asynchronously after writeValue ran first).
    this.query.set(this.labelFor(this.selected()));
  }
  get options(): ComboOption[] {
    return this.optionsSignal();
  }

  @Input()
  set value(value: number | string | null) {
    this.applyValue(value);
  }

  @Input() placeholder = 'Selectează';
  @Input() loading = false;
  @Input() loadingText = 'Se încarcă...';
  @Input() emptyText = 'Niciun rezultat';
  @Input() disabled = false;
  // Blocks free-text typing but the dropdown still opens on click/focus to pick a value.
  @Input() selectOnly = false;
  // Typing edits the displayed text in place instead of clearing the selection to
  // search; the text is not reverted to the option's label on blur. Use this when
  // the field doubles as an editable value tied to the picked option (e.g. renaming
  // the selected record), rather than a pure picker.
  @Input() freeText = false;
  @Output() readonly valueChange = new EventEmitter<number | string | null>();
  @Output() readonly queryChange = new EventEmitter<string>();

  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly optionsSignal = signal<ComboOption[]>([]);

  readonly selected = signal<number | string | null>(null);
  readonly query = signal('');
  readonly isOpen = signal(false);
  readonly activeIndex = signal(-1);

  readonly filteredOptions = computed(() => {
    const q = normalize(this.query());
    const opts = this.optionsSignal();
    if (!q) return opts;
    return opts.filter((o) => normalize(o.label).includes(q));
  });

  private onChange: (value: number | string | null) => void = () => {};
  private onTouchedFn: () => void = () => {};

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  get isInvalid(): boolean {
    return !!this.ngControl?.invalid && !!this.ngControl?.touched;
  }

  writeValue(value: number | string | null): void {
    this.applyValue(value);
  }

  registerOnChange(fn: (value: number | string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(text: string): void {
    this.query.set(text);
    this.isOpen.set(true);
    this.activeIndex.set(-1);

    if (this.freeText) {
      this.queryChange.emit(text);
      return;
    }

    if (this.selected() !== null) {
      this.commit(null);
    }
  }

  onFocus(): void {
    if (!this.disabled) this.isOpen.set(true);
  }

  onBlur(): void {
    this.isOpen.set(false);
    if (!this.freeText) {
      this.query.set(this.labelFor(this.selected()));
    }
    this.onTouchedFn();
  }

  selectOption(option: ComboOption): void {
    this.query.set(option.label);
    this.isOpen.set(false);
    this.commit(option.value);
  }

  onKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.isOpen.set(true);
      this.activeIndex.set(Math.min(this.activeIndex() + 1, opts.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
    } else if (event.key === 'Enter') {
      const active = opts[this.activeIndex()];
      if (active) {
        event.preventDefault();
        this.selectOption(active);
      }
    } else if (event.key === 'Escape') {
      this.isOpen.set(false);
    }
  }

  private applyValue(value: number | string | null): void {
    this.selected.set(value);
    this.query.set(this.labelFor(value));
  }

  private commit(value: number | string | null): void {
    this.selected.set(value);
    this.onChange(value);
    this.valueChange.emit(value);
  }

  private labelFor(value: number | string | null): string {
    return this.optionsSignal().find((o) => o.value === value)?.label ?? '';
  }
}

// Accent-insensitive match so "obiectiv" also finds "Obiectivul Șos. Berceni".
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
