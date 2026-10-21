import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  // Shown emphasised under the message -- typically the name of the record affected.
  subject?: string;
  confirmText?: string;
  cancelText?: string;
  // 'danger' for destructive actions (red confirm button, warning icon, focus starts on
  // Renunță so Enter can't delete by accident); 'primary' for everything else.
  variant?: 'danger' | 'primary';
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'subject'>> {
  subject?: string;
}

// App-wide replacement for window.confirm(): `if (await confirm.ask({...}))`. The dialog
// itself (ConfirmDialogComponent) is rendered once, in the app shell, and reads `current`.
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly current = signal<ConfirmRequest | null>(null);
  private resolve?: (confirmed: boolean) => void;

  ask(options: ConfirmOptions): Promise<boolean> {
    // Only one dialog at a time: a new request dismisses (cancels) any open one.
    this.close(false);

    this.current.set({
      confirmText: 'Confirmă',
      cancelText: 'Renunță',
      variant: 'primary',
      ...options,
    });
    return new Promise<boolean>((resolve) => (this.resolve = resolve));
  }

  close(confirmed: boolean): void {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.current.set(null);
    resolve?.(confirmed);
  }
}
