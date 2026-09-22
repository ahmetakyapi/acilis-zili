import { Fragment } from "react";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatRange, riskReward } from "@/lib/technical";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import styles from "./Technical.module.css";

type Cell = { kind: "entry" | "target" | "stop" | "sellLevel" | "support" | "resistance"; label: string; value: string | null };

/**
 * Plan şeridi — okuyucunun üç sorusu, üç hücre.
 *
 * Seviyeler bir süre çizginin altında lejant olarak duruyordu: "Stop ·
 * Alım Bölgesi · Hedefler" ve 11 punto sayılar. Sorunun kendisi yazılı
 * değildi; okuyucu "alım bölgesi"nin alım yeri olduğunu, "hedef"in satış
 * yeri olduğunu kendi çeviriyordu. Hücreler soruyu başlık olarak taşıyor
 * (NEREDEN ALINIR / NEREDE SATILIR / NEREDE VAZGEÇİLİR) ve sayı büyük.
 *
 * Görüşe göre hücreler değişiyor:
 *   · alım planı varsa (AL, bölgeli TUT): alım · satış · vazgeçme, altında
 *     risk/getiri oranı — bölgenin üst ucundan ölçülür (bkz. `riskReward`).
 *   · SAT: tepkide satış seviyeleri ve en yakın destek — alım hücresi yok,
 *     çünkü plan alım planı değil.
 *   · bölgesiz TUT: en yakın destek ve direnç — izlenecek iki seviye.
 *
 * "Bu Yayında Yok" hücresi boş bırakılmıyor: AL'da hedef zorunlu ama TUT'ta
 * bölge var hedef olmayabilir; sessiz bir boşluk "unutulmuş" gibi okunur.
 */
export function PlanStrip({
  verdict,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  size = "sm",
  locale,
  t,
}: {
  verdict: VerdictKey;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  /** `lg`: detail level board and risk comparison; rows stack on phones. */
  size?: "sm" | "lg";
  locale: Locale;
  t: Dictionary;
}) {
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  /* PARA BİRİMİ LİSTEDE BİR KEZ, SONDA. Üç hedef üç kez "$" taşıyınca
     "Nerede Satılır" hücresi sayfanın en uzun satırı oluyordu ve 390
     pikselde etiketin üstüne dayanıyordu. Hepsi aynı para biriminde;
     tekrarlanan sembol bilgi değil gürültü. `formatRange` ile aynı karar. */
  /* AYRAÇ KENDİNDEN ÖNCEKİ SAYIYA BAĞLI. Ayraç ayrı bir kardeş olarak
     yazılıyordu ve satır ondan ÖNCE kırılabiliyordu: masaüstünde üç hedef
     sütuna sığmayınca "941,65 · 955,70" üstte, "· 989,96 $" altta kalıyordu —
     baştaki nokta satırı kırık gösteriyor. Ayraç artık sayıyla aynı kutuda
     ve kutu `nowrap`: bir sayı ile onu izleyen nokta hiç ayrılmıyor.

     KIRILMA NOKTASI AYRI BİR BOŞLUK OLARAK YAZILIYOR. İlk hâlde boşluk da
     `nowrap` kutunun İÇİNDEYDİ (" · ") ve kutular arasında JSX'te hiç boşluk
     yok — yani satırın kırılabileceği tek bir yer kalmamıştı. Kart tek
     sütunlu olduğu için orada görünmedi; detay kapağında hücreler üç sütunlu
     ızgaraya girince "Nerede Satılır" sütunu (üç hedef, 380 piksel) 300
     piksellik sütundan taşıp "Nerede Vazgeçilir"in üstüne biniyordu —
     "989,96 $" ile "889,00 $" üst üste basılıyordu (1440'ta ölçüldü).
     Boşluk artık kutuların ARASINDA duran ayrı bir metin düğümü: kırılma
     yeri var, nokta yine önceki sayıya yapışık.

     AYRAÇ TİRE, NOKTA DEĞİL. Nokta bu sayfada künye ayracı ("Seans İçi ·
     19:45 TR"); üç hedef aynı işaretle dizilince üç ayrı künye gibi
     okunuyordu. Tire "seviyeden seviyeye" der — aralık yazımıyla
     (`formatRange`) aynı işaret. */
  const list = (values: readonly number[]) =>
    values.length === 0 ? null : values.map((value, index) => (
      <Fragment key={value}>
        <span className={styles.planItem}>
          {index === values.length - 1 ? money(value) : formatPrice(value, locale)}
          {index < values.length - 1 && <span className={styles.planSep} aria-hidden> –</span>}
        </span>
        {index < values.length - 1 && " "}
      </Fragment>
    ));
  const hasEntry = entryLow !== null && entryHigh !== null;

  let cells: { kind: Cell["kind"]; label: string; value: React.ReactNode }[];
  if (verdict === "sell") {
    cells = [
      { kind: "sellLevel", label: t.technical.planSellLevels, value: list(targets.length ? targets : resistances) },
      { kind: "support", label: t.technical.planNearestSupport, value: supports[0] !== undefined ? money(supports[0]) : null },
    ];
  } else if (hasEntry) {
    cells = [
      { kind: "entry", label: t.technical.planEntry, value: formatRange(entryLow, entryHigh, locale) },
      { kind: "target", label: t.technical.planTargets, value: list(targets) },
      { kind: "stop", label: t.technical.planStop, value: stop !== null ? money(stop) : null },
    ];
  } else {
    cells = [
      { kind: "support", label: t.technical.planNearestSupport, value: supports[0] !== undefined ? money(supports[0]) : null },
      { kind: "resistance", label: t.technical.planNearestResistance, value: resistances[0] !== undefined ? money(resistances[0]) : null },
      ...(targets.length ? [{ kind: "target" as const, label: t.technical.planTargets, value: list(targets) }] : []),
    ];
  }

  const rr = hasEntry ? riskReward(entryHigh, stop, targets) : null;

  // 22 September: the detail cover gets a compact level board and two
  // common-zero risk bars; small list cards retain their existing strip.
  if (size === "lg") {
    const labels: Partial<Record<Cell["kind"], string>> = {
      entry: t.technical.entryZone, target: t.technical.targetsLabel, stop: t.technical.stop,
    };
    const maxLeg = rr ? Math.max(rr.riskAbs, rr.rewardAbs) : 1;
    return <div className={styles.planOverview} data-has-risk={!!rr}>
      <dl className={styles.overviewCells} style={{ "--cells": cells.length } as React.CSSProperties}>
        {cells.map(cell => <div key={cell.kind} className={styles.overviewCell} data-kind={cell.kind}>
          <dt><i className={styles.legendDot} data-kind={cell.kind} aria-hidden />{labels[cell.kind] ?? cell.label}</dt>
          <dd className={cn("numeral", cell.value === null && styles.planEmpty)}>{cell.value ?? t.technical.planNone}</dd>
        </div>)}
      </dl>
      {rr && <div className={styles.riskComparison}>
        <p><span>{t.technical.riskReward}</span><strong className="numeral">{t.technical.riskRewardValue.replace("{n}", formatPrice(rr.ratio, locale, { digits: 1 }))}</strong></p>
        <dl>{(["risk", "reward"] as const).map(leg => {
          const abs = leg === "risk" ? rr.riskAbs : rr.rewardAbs;
          const pct = leg === "risk" ? rr.riskPct : rr.rewardPct;
          return <div key={leg} data-leg={leg}>
            <dt>{leg === "risk" ? t.technical.riskLeg : t.technical.rewardLeg}</dt>
            <dd><b className="numeral">{money(abs)}</b><span className="numeral">{formatPercentPlain(pct, locale, 1)}</span></dd>
            <span className={styles.riskComparisonTrack} aria-hidden><i style={{ width: `${abs / maxLeg * 100}%` }} /></span>
          </div>;
        })}</dl>
        <small>{t.technical.riskAnchor.replace("{n}", money(rr.anchor))}</small>
      </div>}
    </div>;
  }

  return (
    <div className={styles.planStrip}>
      <dl className={styles.planCells} style={{ "--cells": cells.length } as React.CSSProperties}>
        {cells.map((cell) => (
          <div key={cell.kind} className={styles.planCell} data-kind={cell.kind}>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind={cell.kind} />
              {cell.label}
            </dt>
            <dd className={cn("numeral", cell.value === null && styles.planEmpty)}>
              {cell.value ?? t.technical.planNone}
            </dd>
          </div>
        ))}
      </dl>
      {rr && (
        /* RİSK ŞERİDİ: ORAN, ÇAPA, İKİ BACAK VE ÖLÇEKLİ ÇUBUK.
           Şerit bir dönem tek satırdı: "Risk / Getiri · 1 : 0,3 · Risk %3,0 ·
           Getiri %1,0". Üç şey eksikti. (1) ÇAPA: yüzdeler bölgenin
           tepesinden ölçülüyor ama ekranda onun hemen üstünde "Son Fiyat
           928,88 $" duruyor ve okuyucu yüzdeyi ondan sanıyor — aradaki fark
           MU'da on iki dolar. Çapa artık adıyla yazılı. (2) HAM TUTAR: "%3,0"
           soyut, "27,84 $" değil; hisse fiyatını bilmeyen okuyucu yüzdeyi
           paraya çeviremiyor. İkisi yan yana. (3) ÖLÇEK: oran bir sayı olarak
           "1 : 0,3" okunmuyordu — iki bacağın GENİŞLİĞİ okunuyor. Çubuk
           tutarlarla orantılı (`flex-grow`), yani riskin getiriden üç kat
           geniş durduğu bir kurulum tek bakışta belli oluyor. Çubuk yalnızca
           görsel; sayıların tamamı altındaki satırda. */
        <div className={styles.risk}>
          <p className={styles.riskHead}>
            <span>{t.technical.riskReward}</span>
            <b className="numeral">{t.technical.riskRewardValue.replace("{n}", formatPrice(rr.ratio, locale, { digits: 1 }))}</b>
            <span className={styles.riskAnchor}>{t.technical.riskAnchor.replace("{n}", money(rr.anchor))}</span>
          </p>
          {/* Bacak genişlikleri tutarların kendisi: flex-grow oranı çiziyor,
              yüzde hesabı yok. `flex-basis:0` + `min-width` CSS'te — uçta
              kalan bacak (1 : 8 gibi) tamamen kaybolmasın. */}
          <span aria-hidden className={styles.riskBar}>
            <i data-leg="risk" style={{ flexGrow: rr.riskAbs }} />
            <i data-leg="reward" style={{ flexGrow: rr.rewardAbs }} />
          </span>
          <p className={styles.riskLegs}>
            <span data-leg="risk">
              <span className={styles.riskName}>{t.technical.riskLeg}</span>
              <b className="numeral">{money(rr.riskAbs)}</b>
              <span className={styles.planSep} aria-hidden>·</span>
              <span className="numeral">{formatPercentPlain(rr.riskPct, locale, 1)}</span>
            </span>
            <span data-leg="reward">
              <span className={styles.riskName}>{t.technical.rewardLeg}</span>
              <b className="numeral">{money(rr.rewardAbs)}</b>
              <span className={styles.planSep} aria-hidden>·</span>
              <span className="numeral">{formatPercentPlain(rr.rewardPct, locale, 1)}</span>
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
