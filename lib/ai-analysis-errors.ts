import Anthropic from "@anthropic-ai/sdk";

/*
 * Claude analizinin hata sınıflandırması (25 Ekim) — `server-only` dışında
 * ki test edilebilsin. Canlıda BE raporu izsiz düştü: hata metni bilerek
 * yazılmıyordu, sınıfı da. Artık rota sınıf/kod/türü günlüğe yazıyor ve
 * çabuk düşen geçici hatada bir kez yeniden deneniyor (lib/ai-analysis.ts).
 */

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504, 529]);

/** Geçici üst katman hatası mı: bağlantı kopması ya da aşırı yük / sunucu kodu. Zaman aşımı DEĞİL. */
export function isTransient(error: unknown): boolean {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return false;
  if (error instanceof Anthropic.APIConnectionError) return true;
  return error instanceof Anthropic.APIError && typeof error.status === "number" && TRANSIENT_STATUS.has(error.status);
}

/**
 * Düşen raporun SIZDIRMAYAN künyesi — sunucu günlüğü için: hata sınıfı,
 * HTTP kodu ve API'nin hata türü. Üst katmanın mesaj metni yazılmaz.
 */
export function failureKind(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    const type = (error.error as { error?: { type?: string } } | undefined)?.error?.type;
    return [error.constructor.name, error.status ?? "-", type ?? "-"].join(" ");
  }
  if (error instanceof Error) return error.name === "Error" ? error.message.slice(0, 40) : error.name;
  return "unknown";
}
