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

export interface NotifyOptions {
  title: string;
  message?: string;
  okText?: string;
}

// What the dialog renders: a two-button confirmation ('confirm') or a one-button notice
// ('notify', e.g. "Salvare efectuată cu succes").
export interface ConfirmRequest {
  kind: 'confirm' | 'notify';
  title: string;
  message: string;
  subject?: string;
  confirmText: string;
  cancelText: string;
  variant: 'danger' | 'primary' | 'success';
}

// App-wide replacement for window.confirm()/alert(): `if (await dialog.ask({...}))` and
// `await dialog.notify({...})`. The dialog itself (ConfirmDialogComponent) is rendered once,
// in the app shell, and reads `current`.
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly current = signal<ConfirmRequest | null>(null);
  private resolve?: (confirmed: boolean) => void;

  ask(options: ConfirmOptions): Promise<boolean> {
    // Only one dialog at a time: a new request dismisses (cancels) any open one.
    this.close(false);

    this.current.set({
      kind: 'confirm',
      confirmText: 'Confirmă',
      cancelText: 'Renunță',
      variant: 'primary',
      ...options,
    });
    return new Promise<boolean>((resolve) => (this.resolve = resolve));
  }

  // One-button notice; resolves once the user dismisses it (OK, Esc or a click outside).
  notify(options: NotifyOptions): Promise<void> {
    this.close(false);

    this.current.set({
      kind: 'notify',
      title: options.title,
      message: options.message ?? '',
      confirmText: options.okText ?? 'OK',
      cancelText: '',
      variant: 'success',
    });
    return new Promise<void>((resolve) => (this.resolve = () => resolve()));
  }

  // Shown after every successful save.
  notifySaved(): Promise<void> {
    return this.notify({ title: 'Salvare efectuată cu succes' });
  }

  close(confirmed: boolean): void {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.current.set(null);
    resolve?.(confirmed);
  }
}
