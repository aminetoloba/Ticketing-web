import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type QrScanner from 'qr-scanner';
import { map } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth-service';
import { EventsApi } from '../../core/events-api';
import { EventDto } from '../../core/models';
import { StaffApi } from '../../core/staff-api';

interface ScanOutcome {
  ok: boolean;
  message: string;
  detail?: string;
  code: string;
  at: Date;
}

const HISTORY_SIZE = 20;
// Le QR reste devant la caméra pendant plusieurs lectures : on ignore le même code pendant ce délai
const SAME_CODE_COOLDOWN_MS = 5000;
const CODE_FORMAT = /^[0-9A-Fa-f]{32}$/;

@Component({
  selector: 'app-scan',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class Scan {
  private readonly staffApi = inject(StaffApi);
  private readonly eventsApi = inject(EventsApi);
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private scanner: QrScanner | null = null;
  private lastRead: { value: string; at: number } | null = null;

  protected readonly cameraOn = signal(false);
  protected readonly cameraStarting = signal(false);
  protected readonly cameraError = signal<string | null>(null);

  protected readonly events = signal<EventDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly eventControl = new FormControl('', { nonNullable: true });
  // Les codes générés par l'API font 32 caractères hexadécimaux
  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[0-9A-Fa-f]{32}$/)],
  });

  protected readonly scanning = signal(false);
  protected readonly last = signal<ScanOutcome | null>(null);
  protected readonly history = signal<ScanOutcome[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.scanner?.destroy());
    
    // Un administrateur peut contrôler n'importe quel événement : il choisit dans le catalogue.
    // Un membre du staff ne voit que les événements où il est affecté.
    const isAdmin = inject(AuthService).role() === 'Admin';
    const source$ = isAdmin
      ? this.eventsApi.list({ pageSize: 100 }).pipe(map((result) => result.items))
      : this.staffApi.myEvents();

    source$.subscribe({
      next: (events) => {
        this.events.set(events);
        // Un seul événement : inutile de le faire choisir
        if (events.length === 1) this.eventControl.setValue(events[0].id);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(apiErrorMessage(error));
        this.loading.set(false);
      },
    });

    // Changer d'événement efface le dernier résultat : il ne le concerne plus
    this.eventControl.valueChanges.subscribe(() => this.last.set(null));
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.scan();
  }

    protected scan(): void {
    if (this.code.invalid) {
      this.code.markAsTouched();
      return;
    }
    this.submitCode(this.code.value.trim());
  }

  // Commun à la saisie et à la caméra
  private submitCode(code: string): void {
    const eventId = this.eventControl.value;

    // Une seule requête à la fois : pas de faux « déjà utilisé » sur un double envoi
    if (!eventId || this.scanning()) return;

    this.scanning.set(true);

    this.staffApi.checkIn(eventId, code).subscribe({
      next: (result) =>
        this.record({
          ok: true,
          message: 'Billet valide',
          detail: result.ticketTypeName,
          code,
          at: new Date(),
        }),
      error: (error: unknown) =>
        this.record({ ok: false, message: this.failureMessage(error), code, at: new Date() }),
    });
  }

  protected async startCamera(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video || this.cameraOn() || this.cameraStarting()) return;

    // Les navigateurs n'autorisent la caméra que sur localhost ou en https
    if (!window.isSecureContext || !navigator.mediaDevices) {
      this.cameraError.set("La caméra n'est utilisable qu'en https ou sur localhost.");
      return;
    }

    this.cameraStarting.set(true);
    this.cameraError.set(null);

    try {
      // Chargée à la demande : les utilisateurs qui n'utilisent pas la caméra ne la téléchargent pas
      const { default: Scanner } = await import('qr-scanner');

      if (!(await Scanner.hasCamera())) {
        this.cameraError.set('Aucune caméra détectée sur cet appareil.');
        return;
      }

      this.scanner = new Scanner(video, (result) => this.onDecoded(result.data), {
        preferredCamera: 'environment', // caméra arrière des téléphones
        returnDetailedScanResult: true,
        maxScansPerSecond: 5,
        highlightScanRegion: true,
        highlightCodeOutline: true,
      });

      await this.scanner.start();
      this.cameraOn.set(true);
    } catch (error) {
      this.scanner?.destroy();
      this.scanner = null;
      this.cameraError.set(this.cameraErrorMessage(error));
    } finally {
      this.cameraStarting.set(false);
    }
  }

  protected stopCamera(): void {
    this.scanner?.destroy();
    this.scanner = null;
    this.cameraOn.set(false);
  }

  private onDecoded(data: string): void {
    const value = data.trim();
    const now = Date.now();

    if (this.scanning()) return;
    if (this.lastRead && this.lastRead.value === value && now - this.lastRead.at < SAME_CODE_COOLDOWN_MS) return;
    this.lastRead = { value, at: now };

    if (!this.eventControl.value) {
      this.last.set({ ok: false, message: "Choisissez d'abord un événement.", code: value, at: new Date() });
      return;
    }

    // Un QR code qui n'est pas un de nos billets : on ne dérange pas l'API
    if (!CODE_FORMAT.test(value)) {
      this.record({ ok: false, message: 'QR code non reconnu', code: value, at: new Date() });
      return;
    }

    this.submitCode(value);
  }

  private cameraErrorMessage(error: unknown): string {
    const name = error instanceof Error ? error.name : '';

    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return "L'accès à la caméra a été refusé. Autorisez-le dans les paramètres du navigateur, puis réessayez.";
    }
    if (name === 'NotReadableError') return 'La caméra est utilisée par une autre application.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'Aucune caméra utilisable sur cet appareil.';
    }
    if (typeof error === 'string' && error.toLowerCase().includes('camera not found')) {
      return 'Aucune caméra détectée sur cet appareil.';
    }
    return 'Impossible de démarrer la caméra.';
  }

  protected maskedCode(code: string): string {
    return code.length > 8 ? `${code.slice(0, 8)}…` : code;
  }

  private record(outcome: ScanOutcome): void {
    this.last.set(outcome);
    this.history.update((list) => [outcome, ...list].slice(0, HISTORY_SIZE));
    this.scanning.set(false);

    // Prêt pour le billet suivant
    this.code.reset('');
    if (!this.cameraOn()) this.codeInput()?.nativeElement.focus();

    // Retour tactile pour le staff qui ne regarde pas l'écran (téléphones compatibles)
    if (typeof navigator.vibrate === 'function') navigator.vibrate(outcome.ok ? 80 : [80, 60, 80]);
  }

  private failureMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return "Vous n'êtes pas affecté à cet événement.";
    }
    return apiErrorMessage(error);
  }
}