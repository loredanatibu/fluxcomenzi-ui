import { Component, ElementRef, HostListener, Injector, ViewChild, afterNextRender, effect, inject } from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';

// The one confirmation dialog, mounted in the app shell. Features never use it directly --
// they call ConfirmDialogService.ask() and await the answer.
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly dialog = inject(ConfirmDialogService);
  private readonly injector = inject(Injector);

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  @ViewChild('cancelButton') private cancelButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('confirmButton') private confirmButton?: ElementRef<HTMLButtonElement>;

  // Where focus was before the dialog opened, so it can go back there afterwards.
  private returnFocusTo: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const request = this.dialog.current();
      if (request) {
        this.returnFocusTo ??= document.activeElement as HTMLElement | null;
        afterNextRender(() => this.focusInitialButton(request.variant), { injector: this.injector });
      } else if (this.returnFocusTo) {
        const target = this.returnFocusTo;
        this.returnFocusTo = null;
        target.focus?.();
      }
    });
  }

  confirm(): void {
    this.dialog.close(true);
  }

  cancel(): void {
    this.dialog.close(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.dialog.current()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    } else if (event.key === 'Tab') {
      this.keepFocusInside(event);
    }
  }

  // Destructive actions start on Renunță, so a reflexive Enter doesn't delete anything.
  private focusInitialButton(variant: 'danger' | 'primary'): void {
    const button = variant === 'danger' ? this.cancelButton : this.confirmButton;
    button?.nativeElement.focus();
  }

  // Modal: Tab / Shift+Tab cycle between the dialog's own buttons only.
  private keepFocusInside(event: KeyboardEvent): void {
    const focusable = this.panel?.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !this.panel!.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !this.panel!.nativeElement.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }
}
