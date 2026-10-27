import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
  // Filters only once the user types: on focus the box still shows the picked option's label,
  // which would otherwise narrow the list down to that one option and hide every alternative.
  private readonly isFiltering = signal(false);

  // The list is position: fixed (viewport coordinates), so no ancestor with overflow --
  // a scrolling form, a table cell -- can clip it. Its box is measured from the input
  // each time it opens and kept in sync while the page scrolls or resizes.
  readonly listPosition = signal<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({
    left: 0,
    width: 0,
    maxHeight: LIST_MAX_HEIGHT,
  });
  @ViewChild('textInput', { static: true }) private textInput!: ElementRef<HTMLInputElement>;

  readonly filteredOptions = computed(() => {
    const q = normalize(this.query());
    const opts = this.optionsSignal();
    if (!q || !this.isFiltering()) return opts;
    return opts.filter((o) => normalize(o.label).includes(q));
  });

  private onChange: (value: number | string | null) => void = () => {};
  private onTouchedFn: () => void = () => {};

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    // Scroll events don't bubble, so listen in the capture phase: that also catches a
    // scrolling form or table around the combobox, not just the page itself.
    const onScroll = () => this.onViewportChange();
    window.addEventListener('scroll', onScroll, true);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll, true));
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
    this.isFiltering.set(true);
    this.open();
    // The first match is highlighted, so Enter picks it without reaching for the arrow keys.
    this.activeIndex.set(this.freeText ? -1 : 0);

    if (this.freeText) {
      this.queryChange.emit(text);
    }
    // Typing only searches: the selection changes once an option is picked, so leaving the
    // box mid-search keeps the previous value instead of an empty, invalid one (see onBlur).
  }

  onFocus(): void {
    this.isFiltering.set(false);
    if (!this.disabled) this.open();
  }

  onBlur(): void {
    this.isOpen.set(false);
    this.isFiltering.set(false);
    if (!this.freeText) {
      // Emptying the box is how a selection is cleared; any other unpicked text is dropped.
      if (!this.query().trim() && this.selected() !== null) this.commit(null);
      this.query.set(this.labelFor(this.selected()));
    }
    this.onTouchedFn();
  }

  selectOption(option: ComboOption): void {
    this.query.set(option.label);
    this.isOpen.set(false);
    this.isFiltering.set(false);
    this.commit(option.value);
  }

  onKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open();
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

  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.isOpen()) this.updateListPosition();
  }

  private open(): void {
    this.updateListPosition();
    this.isOpen.set(true);
  }

  // Opens downwards when there's room, otherwise upwards (e.g. a combobox near the bottom
  // of the window), never taller than the space actually available on that side.
  private updateListPosition(): void {
    const rect = this.textInput.nativeElement.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap * 2;
    const spaceAbove = rect.top - gap * 2;
    const openUp = spaceBelow < Math.min(LIST_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;

    this.listPosition.set(
      openUp
        ? {
            bottom: window.innerHeight - rect.top + gap,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.min(LIST_MAX_HEIGHT, spaceAbove),
          }
        : {
            top: rect.bottom + gap,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.min(LIST_MAX_HEIGHT, spaceBelow),
          },
    );
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

const LIST_MAX_HEIGHT = 220;

// Accent-insensitive match so "obiectiv" also finds "Obiectivul Șos. Berceni".
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
