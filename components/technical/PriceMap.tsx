import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary } from "@/lib/i18n";
import { ladderOf, type TechnicalCopy } from "@/lib/technical";
import styles from "./Technical.module.css";

/*
 * ESKİ FİYAT HARİTASI SİLİNDİ (31 Ekim, sahibinin onayı: "olur silelim").
 * Dikey, fiyata orantılı `PriceMap` bileşeni teknik sayfada `PriceLadder`
 * ile değiştirilmişti ve hiçbir yerden çağrılmıyordu. Dosyada yalnız hâlâ
 * kullanılan iki parça kaldı: seviye notları (`PriceMapNotes`) ve geçilmiş
 * seviyenin anlamı (`crossedState`, PriceLadder okuyor). Haritanın ölçek
 * dersleri (asgari ayrım ile kutu bütçesinin ayrı sayılar olması, notların
 * haritanın içinde çakışması) git geçmişinde: d17648d8 öncesi bu dosya.
 */

/** Notes share the same real levels as the map. They sit in a full-width
 * editorial row so a long explanation no longer stretches only the map's
 * column. Missing levels never acquire a note from a different plan. */
export function PriceMapNotes({ copy, verdict, lang, t, ...levels }: {
  copy: TechnicalCopy; verdict: VerdictKey; lang: string; t: Dictionary;
  entryLow: number | null; entryHigh: number | null; stop: number | null;
  targets: readonly number[]; supports: readonly number[]; resistances: readonly number[];
}) {
  const notes = ladderOf(levels).map((level) => ({
    label: level.kind === "target" ? (verdict === "sell" ? t.technical.planTargets : t.technical.targetsLabel)
      : level.kind === "entry" ? t.technical.entryZone : t.technical.stop,
    text: noteOf(level, copy),
  })).filter((note): note is { label: string; text: string } => Boolean(note.text));
  if (!notes.length) return null;
  return <section className={styles.planNotes} aria-labelledby="technical-plan-notes">
    <h2 id="technical-plan-notes" className={styles.sectionTitle}>{t.technical.levelRationale}</h2>
    <dl className={styles.mapNotes} lang={lang}>
      {notes.map((note) => <div key={note.label}><dt>{note.label}</dt><dd>{note.text}</dd></div>)}
    </dl>
  </section>;
}

/**
 * Fiyat bu seviyeyi GEÇTİ Mİ — ve geçmesi ne anlama geliyor?
 *
 * Uzaklık sütunu yönü işaretin ARTI/EKSİ oluşuna göre renklendiriyordu ve o
 * renk bu haritada ters okunuyor: ekranda "Hedef 1 · 208,16 $ · −%1,7"
 * KIRMIZI duruyordu, oysa fiyatın ilk hedefi geçmiş olması planın iyi
 * gitmesi demek. Aynı kural stopta doğru çalışıyordu (stop yukarıda kalmışsa
 * kırmızı) — yani tek bir işaret kuralı iki zıt anlamı birden taşıyamıyor.
 *
 * Yön artık HARİTANIN KENDİSİNDE: satır fiyat satırının üstündeyse seviye
 * yukarıda, altındaysa aşağıda. Sütun yalnızca mesafeyi söylüyor ve rengi
 * nötr. Geçilmiş seviyeye ayrıca tek kelimelik bir işaret düşüyor, çünkü
 * geçilmek seviyenin ANLAMINI değiştiriyor: hedef gerçekleşti, stop
 * kırıldı — ikisi de plana dair bir haber.
 */
export function crossedState(
  kind: string,
  distance: number | null,
): "passed" | "broken" | null {
  if (distance === null) return null;
  /* Hedef ve direnç fiyatın ALTINA düştüyse geçilmiştir; stop ve destek
     fiyatın ÜSTÜNDE kaldıysa kırılmıştır. Alım bölgesinin iki ucu var ve
     fiyatın bölgeye göre yeri kapakta zaten tek bir çiple yazılı. */
  if (kind === "target" || kind === "resistance") {
    return distance < 0 ? "passed" : null;
  }
  if (kind === "stop" || kind === "support") {
    return distance > 0 ? "broken" : null;
  }
  return null;
}

function noteOf(level: { kind: string; order?: number }, copy: TechnicalCopy): string | null {
  if (level.kind === "entry") return copy.entryNote ?? null;
  if (level.kind === "stop") return copy.stopNote ?? null;
  if (level.kind === "target" && level.order === 1) return copy.targetsNote ?? null;
  return null;
}
