import { Injectable } from '@angular/core';

export interface DateRangeValidationResult {
  valid: boolean;
  message: string | null;
}

// Generic start/end date check, reusable anywhere two date fields need to
// stay ordered (objective dates today, order/task deadlines tomorrow).
@Injectable({ providedIn: 'root' })
export class DateRangeService {
  // A missing or unparseable date is treated as valid -- there's nothing to
  // compare yet, and required-ness is a separate concern for the caller.
  // `message` lets each caller phrase the error for its own two fields.
  validate(
    dateStart: string | Date | null | undefined,
    dateEnd: string | Date | null | undefined,
    message = 'Data de start trebuie să fie mai mică decât data de final.',
  ): DateRangeValidationResult {
    const start = toDate(dateStart);
    const end = toDate(dateEnd);

    if (!start || !end) {
      return { valid: true, message: null };
    }

    if (start.getTime() >= end.getTime()) {
      return { valid: false, message };
    }

    return { valid: true, message: null };
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}
