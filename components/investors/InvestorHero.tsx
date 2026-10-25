import type { ReactNode } from "react";
import { RollingFigure } from "@/components/ui/RollingFigure";
import type { Dictionary } from "@/lib/i18n";
import { investorFirm, type Investor } from "@/lib/investors";
import { cn, NO_VALUE } from "@/lib/utils";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/**
 * Detay kapağı — KOMPAKT KİMLİK KARTI (25 Ekim).
 *
 * Önceki kapak 168 piksellik portre, 56 puntoluk ad ve ayrı bir künye
 * şeridiyle 1440'ta ~420 piksel tutuyordu; asıl içerik (pozisyonlar) ikinci
 * ekrana kalıyordu. Şimdi tek kart: solda 72 piksellik portre ve kimlik,
 * sağda tek büyük sayı (dizin kartındaki sayıyla aynı kaynak), dipte
 * hairline ile ayrılmış künye satırı (`facts`: dönem, bildirim, pozisyon,
 * kaynak) — eskiden kartın altında ayrı bir şeritti.
 *
 * Sayı yüklemede yuvarlanıyor (`ui/RollingFigure`, JS'siz; ilk ekran
 * olduğu için görünüme giriş beklenmiyor). Metin opaklıkla değil dönüşümle
 * giriyor (`page-heading-copy`, MotionExperience).
 */
export function InvestorHero({
  investor,
  locale,
  t,
  figure,
  figureLabel,
  figureMeta,
  badge,
  facts,
  note,
  share,
}: {
  investor: Investor;
  locale: string;
  t: Dictionary["investors"];
  figure: string | null;
  figureLabel: string;
  figureMeta?: ReactNode;
  /** Sayının yanındaki yön rozeti (bu çeyrek net alıcı / satıcı). */
  badge?: ReactNode;
  /** Kartın dibindeki künye satırı (`FundStrip`, `CongressStrip`). */
  facts?: ReactNode;
  /** Künyenin altında, hairline ile ayrılmış uyarı (kapanan fon). */
  note?: string;
  /** Paylaş düğmesi (`PageShare`) — adın satırında. */
  share?: ReactNode;
}) {
  const closed = investor.status === "closed";
  return (
    <header className={cn(styles.detailHero, "page-frame")}>
      <div className={styles.detailTop}>
        <Portrait investor={investor} size="detail" priority className={styles.detailPortrait} />
        <div className={cn(styles.detailCopy, "page-heading-copy")}>
          {/* KURUM ADIN ALTINDA (9 Ekim 2026): üst künye yok. */}
          <div className={styles.detailNameRow}>
            <h1 className={styles.detailName}>{investor.name}</h1>
            {share && <div className={styles.detailShare}>{share}</div>}
          </div>
          <p className={styles.detailFirm}>
            {investorFirm(investor, locale)}
            {(closed || investor.kind === "congress") && (
              <span className={styles.badge} data-tone={closed ? "closed" : "congress"}>
                {closed ? t.fundClosed : t.congressBadge}
              </span>
            )}
          </p>
          <p className={styles.detailDek}>{locale === "en" ? investor.tagline.en : investor.tagline.tr}</p>
        </div>
        <div className={styles.detailFigure}>
          <span className={styles.detailFigureLabel}>{figureLabel}</span>
          <strong className="numeral">{figure ? <RollingFigure value={figure} /> : NO_VALUE}</strong>
          {(figureMeta || badge) && (
            <span className={styles.detailFigureMeta}>
              {badge}
              {figureMeta}
            </span>
          )}
        </div>
      </div>
      {facts}
      {note && <p className={styles.detailNote}>{note}</p>}
    </header>
  );
}
