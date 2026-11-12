import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Une erreur inattendue est survenue.';
  if (error.status === 0) return "L'API est injoignable. Vérifiez qu'elle est démarrée.";

  const body = error.error as { title?: string; errors?: Record<string, string[]> } | null;
  const details = body?.errors ? Object.values(body.errors).flat() : [];
  if (details.length > 0) return details.join(' ');

  return body?.title ?? 'Une erreur est survenue.';
}