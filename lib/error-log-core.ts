import { createHash } from "node:crypto";

/**
 * Hata kaydının SAF parçaları — veritabanına dokunmadan test edilebilsin
 * diye `lib/error-log.ts`ten ayrı (testler `tests/error-log.test.ts`).
 *
 * NE TUTULMUYOR, NEDEN (README "Gizlilik", /kvkk). Kayıt bir arızanın
 * izini sürmek için var, bir okuyucunun izini sürmek için değil: kullanıcı
 * kimliği, IP ve tarayıcı künyesi HİÇBİR sütunda yok. Mesajın kendisi de
 * sızıntı yüzeyi olabiliyor — bir benzersizlik ihlali "Key (email)=(…)"
 * diye e-posta adresini metne taşıyor — o yüzden metin yazılmadan önce
 * e-posta ve IP biçimli parçalar örtülüyor ve kırpılıyor.
 */

/** Mesajın kırpıldığı uzunluk — panelde tek satır, iki satırda biter. */
export const ERROR_MESSAGE_MAX = 500;

/** Yığının kırpıldığı uzunluk — ilk kareler yeter, gerisi çerçeve kodu. */
export const ERROR_STACK_MAX = 4000;

/** Rota künyesinin tavanı — `normalizePath`in sınırıyla aynı. */
export const ERROR_ROUTE_MAX = 200;

/** Kayıtların tutulduğu gün sayısı; daha eskisini `purgeOldErrors` siler. */
export const ERROR_RETENTION_DAYS = 30;

/** Parmak izinin uzunluğu — özetin ilk 16 onaltılık hanesi. */
const FINGERPRINT_LENGTH = 16;

export type ErrorKind = "server" | "client";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
/* Tam bir IPv6'yı yakalamak için en az üç iki nokta üst üste gerekiyor:
   saat ("16:30") ve "Key:Value" gibi metinler örtülmesin. */
const IPV6 = /\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi;

/** E-posta ve IP biçimli parçaları örter, uzunluğu sınırlar. */
export function scrubErrorText(text: string, max: number): string {
  const scrubbed = text
    .replace(EMAIL, "[e-posta]")
    .replace(IPV4, "[ip]")
    .replace(IPV6, "[ip]")
    .trim();
  return scrubbed.length > max ? `${scrubbed.slice(0, max - 1)}…` : scrubbed;
}

/**
 * Aynı hatayı bir günde tek satırda toplayan anahtar.
 *
 * SUNUCU HATASINDA `digest`: Next onu mesaj ve yığından türetiyor ve
 * okuyucunun hata ekranında gördüğü kimlik de o — panelde aranabilir.
 * İstemci hatasında digest yok; mesajın İLK SATIRI özetleniyor (satır
 * sonrası çoğu zaman bileşen yığını ve her çizimde değişiyor).
 */
export function errorFingerprint(kind: ErrorKind, digest: string | null, message: string): string {
  if (digest) return digest.slice(0, 64);
  const firstLine = message.split("\n")[0] ?? "";
  return createHash("sha256")
    .update(`${kind}:${firstLine}`)
    .digest("hex")
    .slice(0, FINGERPRINT_LENGTH);
}

/** `unknown` bir hatadan mesaj ve yığın — atılan şey `Error` olmayabilir. */
export function describeError(error: unknown): { message: string; stack: string | null; digest: string | null } {
  if (error instanceof Error) {
    const digest =
      "digest" in error && typeof error.digest === "string" ? error.digest : null;
    return { message: error.message || error.name, stack: error.stack ?? null, digest };
  }
  return { message: typeof error === "string" ? error : "Bilinmeyen hata", stack: null, digest: null };
}
