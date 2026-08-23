import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NgControl } from '@angular/forms';

export type DateInputType = 'date' | 'datetime-local';

// Model contract matches the native `<input type="date">` / `<input type="datetime-local">`
// value format ('' | 'yyyy-mm-dd' | 'yyyy-mm-ddThh:mm'), so it's a drop-in replacement for
// existing formControlName bindings — only the on-screen text is dd.mm.yyyy.
@Component({
  selector: 'app-date-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-input.component.html',
  styleUrl: './date-input.component.scss',
})
export class DateInputComponent implements ControlValueAccessor {
  @Input() type: DateInputType = 'date';

  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  displayValue = '';
  nativeValue = '';
  disabled = false;

  private digits = '';
  private onChange: (value: string) => void = () => {};
  private onTouchedFn: () => void = () => {};

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  get placeholder(): string {
    return this.type === 'date' ? 'zz.ll.aaaa' : 'zz.ll.aaaa hh:mm';
  }

  get isInvalid(): boolean {
    return !!this.ngControl?.invalid && !!this.ngControl?.touched;
  }

  writeValue(value: string | null): void {
    this.digits = isoToDigits(value ?? '', this.type);
    this.displayValue = formatDigits(this.digits, this.type);
    this.nativeValue = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onTextInput(rawValue: string): void {
    this.digits = digitsOnly(rawValue).slice(0, maxDigits(this.type));
    this.displayValue = formatDigits(this.digits, this.type);

    const iso = digitsToIso(this.digits, this.type);
    this.nativeValue = iso ?? '';
    this.onChange(iso ?? '');
  }

  onBlur(): void {
    this.onTouchedFn();
  }

  openPicker(nativeInput: HTMLInputElement): void {
    try {
      nativeInput.showPicker?.();
    } catch {
      // Unsupported in this browser — the visible text field remains fully usable.
    }
  }

  onNativePicked(rawValue: string): void {
    this.digits = isoToDigits(rawValue, this.type);
    this.displayValue = formatDigits(this.digits, this.type);
    this.nativeValue = rawValue;
    this.onChange(rawValue);
    this.onTouchedFn();
  }
}

function maxDigits(type: DateInputType): number {
  return type === 'date' ? 8 : 12;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function formatDigits(digits: string, type: DateInputType): string {
  let out = '';
  if (digits.length > 0) out += digits.slice(0, 2);
  if (digits.length > 2) out += '.' + digits.slice(2, 4);
  if (digits.length > 4) out += '.' + digits.slice(4, 8);
  if (type === 'datetime-local' && digits.length > 8) out += ' ' + digits.slice(8, 10);
  if (type === 'datetime-local' && digits.length > 10) out += ':' + digits.slice(10, 12);
  return out;
}

function digitsToIso(digits: string, type: DateInputType): string | null {
  if (digits.length !== maxDigits(type)) return null;

  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return null;

  if (type === 'date') return `${yyyy}-${mm}-${dd}`;

  const hh = digits.slice(8, 10);
  const min = digits.slice(10, 12);
  if (Number(hh) > 23 || Number(min) > 59) return null;

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function isoToDigits(value: string, type: DateInputType): string {
  if (!value) return '';

  if (type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!m) return '';
    const [, yyyy, mm, dd] = m;
    return dd + mm + yyyy;
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return '';
  const [, yyyy, mm, dd, hh, min] = m;
  return dd + mm + yyyy + hh + min;
}
