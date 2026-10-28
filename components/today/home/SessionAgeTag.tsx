import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MarketStatus } from "@/lib/market-hours";
import { sessionAgeLabel } from "@/lib/session-age";
import styles from "./SessionAgeTag.module.css";

/**
 * "HANGİ SEANS" KÜNYESİ — geçmiş seansı anlatan ana sayfa panellerinde
 * (Son Seansın Silueti, Günün Grafiği) başlığın altındaki ilk öğe (28 Ekim).
 *
 * Sahibinin iPhone ekranı, 28 Ekim 22:29 TR: seans açıkken iki panel 27
 * Ekim'i anlatıyordu ve "sanki bugünün işlemi gibi anlaşılıyor". Tarih
 * yazılıydı ("27 Ekim Kapanışı") ama sessiz künyedeydi; tarih okuyucuya
 * "bu dün" demiyor, hesabı ona bırakıyor. Künye artık göreli günü söylüyor
 * ("Dünkü Seans", hafta sonrası "Cuma Seansı") ve tonla ayrışıyor
 * (`surface-sunken` + geri saat imi — renk değil: yön rengi değil, mavi
 * etkileşim değil). Bugünün seansı açıkken panel bir cümleyle bunu da
 * söylüyor (`sessionIsLiveElsewhere`, aşağıda).
 *
 * Göreli günün hesabı `lib/session-age.ts`te (testi
 * `tests/session-age.test.ts`).
 */
export function SessionAgeTag({ dateEt, locale, t, nowMs }: { dateEt: string; locale: Locale; t: Dictionary; nowMs: number }) {
  return (
    <span className={styles.tag}>
      <ClockCounterClockwise weight="bold" size={12} aria-hidden />
      {sessionAgeLabel(dateEt, locale, t, nowMs)}
    </span>
  );
}

/** Bugünün ana seansı açıkken ve panel başka bir günü anlatırken tek cümle. */
export function sessionIsLiveElsewhere(status: MarketStatus, dateEt: string): boolean {
  return status.isRegularOpen && status.sessionDate !== dateEt;
}
