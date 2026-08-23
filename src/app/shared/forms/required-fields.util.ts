import { FormGroup } from '@angular/forms';

// Shared across all create/update/delete forms: marks every control touched (so native
// inputs and app-date-input/app-combo-select pick up their `ng-invalid.ng-touched` /
// `isInvalid` highlighting) and builds one error message naming exactly which required
// fields are still missing. Disabled controls (e.g. fields not editable in the current
// mode) are skipped since Angular already excludes them from form validity.
export function getRequiredFieldsMessage(form: FormGroup, fieldLabels: Record<string, string>): string | null {
  form.markAllAsTouched();

  if (form.valid) return null;

  const missing = Object.entries(fieldLabels)
    .filter(([name]) => form.get(name)?.enabled && form.get(name)?.invalid)
    .map(([, label]) => label);

  return missing.length > 0
    ? `Completează câmpurile obligatorii: ${missing.join(', ')}.`
    : 'Completează câmpurile obligatorii.';
}
