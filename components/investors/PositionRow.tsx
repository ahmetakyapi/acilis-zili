import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { MoveTone } from "./format";
import styles from "./Investors.module.css";

/**
 * 13F pozisyon tablosunun tek satırı (20 Ekim).
 *
 * İKİ TARAF AYNI DOSYAYI ÇİZİYOR: ilk satırlar sunucuda (`FundDetail`),
 * açılır kalan istemcide (`PositionsMore`). `"use client"` DEĞİL — sunucu
 * bileşeni bu satırı kendisi çiziyor, istemci modülü de içe aktarabiliyor
 * (CLAUDE.md "İstemci/sunucu sınırı").
 *
 * Hücre metinleri sunucuda biçimleniyor (`FundDetail` → `positionRowView`),
 * buraya yalnızca basılacak dizeler geliyor: sözlük ve biçimleyiciler
 * istemciye taşınmıyor, sayı biçimi dile göre sunucuda kalıyor
 * (`AnalysisTable` ile aynı karar).
 */
export type PositionRowView = {
  cusip: string;
  rank: number;
  ticker: string | null;
  issuer: string;
  logoUrl: string | null;
  /** Sembol bizim tablomuzda var: satır hisse sayfasına bağlanıyor. */
  linkable: boolean;
  shares: string;
  value: string;
  weight: string;
  /** Ağırlık çubuğunun boyu — portföyün en büyük pozisyonuna göre yüzde. */
  bar: number;
  /** Önceki dönem yoksa (karşılaştırma yok) null; sütun hiç basılmıyor. */
  move: { tone: MoveTone; label: string; change: string | null; note: string | null } | null;
};

export function PositionRow({ row }: { row: PositionRowView }) {
  return (
    <tr>
      <td className={cn("numeral", styles.colRank)}>{row.rank}</td>
      <th scope="row" className={styles.companyCell}>
        {row.linkable && row.ticker ? (
          <Link href={`/hisse/${row.ticker}`} prefetch={false} className={styles.company} data-cc={row.ticker}>
            <CompanyInner position={row} />
          </Link>
        ) : (
          <span className={styles.company}>
            <CompanyInner position={row} />
          </span>
        )}
      </th>
      <td className={cn("numeral", styles.num, styles.colShares)}>{row.shares}</td>
      <td className={cn("numeral", styles.num, styles.colValue)}>{row.value}</td>
      <td className={styles.colWeight}>
        <span className={styles.weightCell}>
          <span className="numeral">{row.weight}</span>
          <span className={styles.weightTrack} aria-hidden>
            <i style={{ width: `${row.bar}%` }} />
          </span>
        </span>
      </td>
      {row.move && (
        <td className={cn(styles.num, styles.colChange)}>
          <span className={styles.moveChip} data-tone={row.move.tone}>
            {row.move.label}
            {row.move.change && <b className="numeral">{row.move.change}</b>}
          </span>
          {row.move.note && <small className={styles.cellNote}>{row.move.note}</small>}
        </td>
      )}
    </tr>
  );
}

export function CompanyInner({ position }: { position: { ticker: string | null; logoUrl: string | null; issuer: string } }) {
  return (
    <>
      {position.ticker ? (
        <LogoTile symbol={position.ticker} logoUrl={position.logoUrl} size="sm" />
      ) : (
        <span className={styles.noLogo} aria-hidden />
      )}
      <span className={styles.companyText}>
        <b className="numeral">{position.ticker ?? position.issuer}</b>
        <small>{position.issuer}</small>
      </span>
    </>
  );
}
