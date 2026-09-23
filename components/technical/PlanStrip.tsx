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
 *   · alım planı varsa (AL, bölgeli TUT): alım · satış · vazgeçme. Risk /
 *     getiri oranı liste kartında altındaki rayda (`PlanRail`), detay
 *     kapağında bu bileşenin `lg` dalında.
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
     (`formatRange`) aynı işaret.

     TİRE DE GERİ ALINDI: OK (→), 23 Eylül. "Aralıkla aynı işaret" tam da
     kusurdu. Hemen üstteki satır bir ARALIK ("Nereden Alınır 1.821,75 –
     1.876,86 $"), bu satır iki AYRI hedef ("Nerede Satılır 1.952,59 –
     2.354,39 $", SNDK) ve ikisi yan yana aynı görünüyordu: iki hedef bir
     satış bölgesi gibi okunuyordu. Ok ne künye noktası ne aralık tiresi;
     "sonra bir sonraki seviye" diyor. Ekran okuyucu oku okumuyor, araya
     virgül koyuyor. Kırılma düzeni yukarıdaki iki kayıtla aynı. */
  const list = (values: readonly number[]) =>
    values.length === 0 ? null : values.map((value, index) => (
      <Fragment key={value}>
        <span className={styles.planItem}>
          {index === values.length - 1 ? money(value) : formatPrice(value, locale)}
          {index < values.length - 1 && (
            <>
              <span className={styles.planSep} aria-hidden> →</span>
              <span className="sr-only">, </span>
            </>
          )}
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
      /* SONRAKİ DESTEK — YALNIZCA LİSTE KARTINDA (23 Eylül). SAT kartının
         iki satırı, komşu AL/TUT kartlarının üç satırlık plan satırında 32
         piksellik bir cep bırakıyordu (1440, ONDS, ölçüldü). Boşluk
         esnetilmez, doldurulur: rutinin yazdığı ikinci destek, "destek
         kırılırsa düşüş nereye" sorusunun cevabı. Yoksa satır hiç basılmaz
         ("Bu Yayında Yok" demek burada eksik bir plan gibi okunurdu). Detay
         kapağında fiyat haritası bütün destekleri zaten sıralıyor. */
      ...(size === "sm" && supports[1] !== undefined
        ? [{ kind: "support" as const, label: t.technical.planNextSupport, value: money(supports[1]) }]
        : []),
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

  // 22 September: the detail cover gets a compact level board and two
  // common-zero risk bars. 23 September: the list card's risk strip moved
  // onto its level rail (`PlanRail`), so the ratio is computed here only.
  if (size === "lg") {
    const rr = hasEntry ? riskReward(entryHigh, stop, targets) : null;
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

  /* RİSK ŞERİDİ BURADAN ÇIKTI (23 Eylül) — liste kartında artık seviye
     çizgisiyle tek bir çizim: `PlanRail`. Kaydı da onunla gitti; oran,
     çapa, ham tutar ve ölçek kararlarının dördü de orada yaşıyor. Burada
     yalnızca üç soru ve üç sayı kalıyor. */
  return (
    <div className={styles.planStrip}>
      <dl className={styles.planCells} style={{ "--cells": cells.length } as React.CSSProperties}>
        {cells.map((cell) => (
          <div key={cell.label} className={styles.planCell} data-kind={cell.kind}>
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
    </div>
  );
}
