import type { ReactNode } from "react";
import { RollingFigure } from "@/components/ui/RollingFigure";
import type { Dictionary } from "@/lib/i18n";
import { investorFirm, type Investor } from "@/lib/investors";
import { cn, NO_VALUE } from "@/lib/utils";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/**
 * Detay kapağı — solda büyük portre, sağda kimlik ve tek büyük sayı.
 *
 * Sayı yüklemede yuvarlanıyor (`ui/RollingFigure`, JS'siz; ilk ekran
 * olduğu için görünüme giriş beklenmiyor). Metin opaklıkla değil dönüşümle
 * giriyor (`page-heading-copy`, MotionExperience): en büyük boyalı öğe
 * beklemiyor.
 */
export function InvestorHero({
  investor,
  locale,
  t,
  figure,
  figureLabel,
  figureMeta,
  note,
  share,
}: {
  investor: Investor;
  locale: string;
  t: Dictionary["investors"];
  figure: string | null;
  figureLabel: string;
  figureMeta?: ReactNode;
  /** Kapağın dibinde hairline ile ayrılmış künye (kapanan fon). */
  note?: string;
  /** Paylaş düğmesi (`PageShare`) — açıklama cümlesinin ardında. */
  share?: ReactNode;
}) {
  const closed = investor.status === "closed";
  return (
    <header className={cn(styles.detailHero, "page-frame")}>
      <Portrait investor={investor} size="hero" priority className={styles.detailPortrait} />
      <div className={cn(styles.detailCopy, "page-heading-copy")}>
        <p className="page-eyebrow">
          {investorFirm(investor, locale)}
          {(closed || investor.kind === "congress") && (
            <span className={styles.badge} data-tone={closed ? "closed" : "congress"}>
              {closed ? t.fundClosed : t.congressBadge}
            </span>
          )}
        </p>
        <h1 className={styles.detailName}>{investor.name}</h1>
        <p className={styles.detailDek}>{locale === "en" ? investor.tagline.en : investor.tagline.tr}</p>
        {share && <div className={styles.detailShare}>{share}</div>}
        <div className={styles.detailFigure}>
          <span className={styles.detailFigureLabel}>{figureLabel}</span>
          <strong className="numeral">{figure ? <RollingFigure value={figure} /> : NO_VALUE}</strong>
          {figureMeta && <span className={styles.detailFigureMeta}>{figureMeta}</span>}
        </div>
      </div>
      {note && <p className={styles.detailNote}>{note}</p>}
    </header>
  );
}
