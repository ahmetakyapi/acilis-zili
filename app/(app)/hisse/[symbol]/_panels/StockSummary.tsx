import { Buildings, CalendarBlank, Stack, TreeStructure, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { guideArticle } from "@/content/guide";
import { DOW_MEMBERS, NDX_MEMBERS, SPX_MEMBERS, indexMemberOf, peersOf } from "@/db/seed/indices";
import { getHolidays, getNextReport, getSymbolNames } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { sectorLabel } from "@/lib/sectors";
import { subIndustryName } from "@/db/seed/sub-industries";
import { cn, formatEtDateLong } from "@/lib/utils";
import { earningsWindow } from "./earnings-time";
import styles from "./depth.module.css";

/**
 * Şirket özeti — sağlayıcı verisinin üstüne sitenin KENDİ cümleleri.
 *
 * NEDEN. Sayfanın metni bir dönem tümüyle sağlayıcı verisiydi: rakamlar,
 * tablolar, grafik. Arama motoru için bu, binlerce benzer sayfadan biri;
 * okuyucu için de "bu şirket nerede duruyor" sorusunun cevabı dağınık
 * (endeks üyeliği hiçbir yerde yazmıyordu, sonraki bilanço profil kartının
 * bir satırıydı). Özet yalnızca BİLDİĞİMİZİ yazıyor ve her cümle bir
 * kaynaktan: endeks tohumu (üyelik, GICS), takvim tablosu (sonraki rapor),
 * rehber (bağlantılar). Uydurma yok: bilinmeyen parça cümleden düşüyor.
 *
 * Aynı parçalar `generateMetadata` açıklamasına da giriyor (`summaryFacts`).
 *
 * KÜNYE, CÜMLE DEĞİL (28 Eylül). Panel Gündem bölümünün başında tam
 * genişlikte tek bir cümle bloğuydu ve 1860 piksellik bir kutunun yarısında
 * iki satır metin duruyordu. Artık derinlik ızgarasında, temettünün yanında;
 * bildiklerimiz ikonlu bir künye ızgarası (endeks, sektör, alt sektör,
 * sonraki bilanço, aynı alt sektör) ve alt sektörün en büyük beş şirketinin
 * logo şeridi. Cümleler arama motoru ve ekran okuyucu için duruyor, künyenin
 * altında. Izgaranın son satırında tek kalırsa panel tam genişliğe yayılıyor
 * ve künye sütunları çoğalıyor (depth.module.css).
 */
/** Logo şeridindeki en büyük alt sektör şirketi. */
const PEER_LOGOS = 5;

const INDEX_NAMES = [
  { name: "S&P 500", members: SPX_MEMBERS },
  { name: "Nasdaq 100", members: NDX_MEMBERS },
  { name: "Dow Jones", members: DOW_MEMBERS },
] as const;

export function indexListOf(symbol: string): string[] {
  return INDEX_NAMES.filter((index) => index.members.some((member) => member.symbol === symbol)).map(
    (index) => index.name,
  );
}

function joinList(items: readonly string[], t: Dictionary): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")}${t.stockDepth.listJoin}${items.at(-1)}`;
}

export type SummaryFacts = {
  name: string;
  indices: string[];
  sector: string | null;
  sub: string | null;
  next: { date: string; hour: string | null } | null;
};

/** Özetin ve künyenin ortak girdisi — üçü de yerel okuma, sağlayıcıya gitmiyor. */
export async function summaryFacts(symbol: string, locale: Locale): Promise<SummaryFacts> {
  const [meta, next] = await Promise.all([getSymbolNames([symbol]), getNextReport(symbol)]);
  const member = indexMemberOf(symbol);
  return {
    name: meta[symbol]?.name ?? member?.name ?? symbol,
    indices: indexListOf(symbol),
    sector: sectorLabel(member?.sector, locale),
    sub: member?.sub ? subIndustryName(member.sub, locale) : null,
    next,
  };
}

/** `generateMetadata` açıklamasının ek cümleleri — endeks ve sonraki bilanço. */
export function metaExtras(facts: SummaryFacts, locale: Locale, t: Dictionary): string {
  const parts: string[] = [];
  if (facts.indices.length > 0) parts.push(t.stockDepth.metaIndex.replace("{list}", joinList(facts.indices, t)));
  if (facts.next) parts.push(t.stockDepth.metaNext.replace("{date}", formatEtDateLong(facts.next.date, locale)));
  return parts.join(" ");
}

/** Özetin bağlantı verdiği rehber yazıları — sırası sorunun doğduğu sıra. */
function guideSlugs(facts: SummaryFacts): string[] {
  return [
    ...(facts.next ? ["bilanco-gunu-nasil-okunur"] : []),
    ...(facts.indices.length > 0 ? ["endeks"] : []),
    ...(facts.sector ? ["sektor-rotasyonu"] : []),
    "hisse-senedi",
  ];
}

export async function StockSummary({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const d = t.stockDepth;
  const peers = peersOf(symbol);
  const [facts, holidays, peerMeta] = await Promise.all([
    summaryFacts(symbol, locale),
    getHolidays(),
    getSymbolNames(peers.map((peer) => peer.symbol)),
  ]);
  const when = facts.next ? earningsWindow(facts.next.date, facts.next.hour, holidays, locale, t) : null;
  const peerCount = peers.length;
  /* Pencere adı sözlükte Title Case (rozet); cümlenin içinde küçük harfle.
     `tr-TR` şart: "İ" doğru küçülsün (CLAUDE.md, Türkçe büyük harf tuzağı). */
  const lower = (text: string) => text.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US");

  const sentences = [
    facts.indices.length > 0
      ? (facts.indices.length === 1 ? d.sumIndexOne : d.sumIndexMany)
          .replace("{ad}", facts.name)
          .replace("{list}", joinList(facts.indices, t))
      : null,
    facts.sector
      ? facts.sub
        ? d.sumSectorSub.replace("{sektor}", facts.sector).replace("{alt}", facts.sub)
        : d.sumSector.replace("{sektor}", facts.sector)
      : null,
    peerCount > 0 ? d.sumPeers.replace("{n}", String(peerCount)) : null,
    facts.next && when
      ? facts.next.hour === "amc" || facts.next.hour === "bmo" || facts.next.hour === "dmh"
        ? d.sumNext
            .replace("{date}", formatEtDateLong(facts.next.date, locale))
            .replace("{window}", when.clock ? `${lower(when.window)} (${when.clock})` : lower(when.window))
        : d.sumNextUnknown.replace("{date}", formatEtDateLong(facts.next.date, locale))
      : null,
  ].filter((s): s is string => s !== null);

  /* Hiçbir şey bilinmiyorsa (endeks dışı, takvimsiz) panel yok: tek başına
     bir rehber bağlantısı bir özet değil. */
  if (sentences.length === 0) return null;

  const guides = guideSlugs(facts)
    .map((slug) => guideArticle(slug, locale))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  /* Logo şeridi piyasa değerine göre: alt sektörü en çok temsil eden beş
     şirket. Değeri bilinmeyen sona. */
  const topPeers = [...peers]
    .sort((a, b) => (peerMeta[b.symbol]?.marketCap ?? -1) - (peerMeta[a.symbol]?.marketCap ?? -1))
    .slice(0, PEER_LOGOS);

  const cells: { key: string; icon: ReactNode; label: string; value: ReactNode; meta?: ReactNode }[] = [];
  if (facts.indices.length > 0) {
    cells.push({ key: "index", icon: <Stack size={16} weight="duotone" />, label: d.sumFactIndex, value: facts.indices.join(" · ") });
  }
  if (facts.sector) {
    cells.push({ key: "sector", icon: <Buildings size={16} weight="duotone" />, label: d.sumFactSector, value: facts.sector });
  }
  if (facts.sub) {
    cells.push({ key: "sub", icon: <TreeStructure size={16} weight="duotone" />, label: d.sumFactSub, value: facts.sub });
  }
  if (facts.next && when) {
    cells.push({
      key: "next",
      icon: <CalendarBlank size={16} weight="duotone" />,
      label: d.sumFactNext,
      value: <span className="numeral">{formatEtDateLong(facts.next.date, locale)}</span>,
      meta: <span className="numeral">{when.approx ?? when.window}</span>,
    });
  }
  if (peerCount > 0) {
    cells.push({
      key: "peers",
      icon: <UsersThree size={16} weight="duotone" />,
      label: d.sumFactPeers,
      value: <span className="numeral">{d.sumPeerCount.replace("{n}", String(peerCount))}</span>,
      meta: (
        <span className={styles.summaryPeers}>
          {topPeers.map((peer) => (
            <Link key={peer.symbol} href={`/hisse/${peer.symbol}`} prefetch={false} aria-label={peerMeta[peer.symbol]?.name ?? peer.symbol}>
              <LogoTile symbol={peer.symbol} logoUrl={peerMeta[peer.symbol]?.logoUrl ?? null} size="sm" />
            </Link>
          ))}
        </span>
      ),
    });
  }

  return (
    <Panel className={cn(styles.panel, styles.summaryPanel)}>
      <PanelHeader title={d.sumTitle} />
      <div className={styles.body}>
        <dl className={styles.summaryFacts} data-motion-stagger>
          {cells.map((cell) => (
            <div key={cell.key} className={styles.summaryFact}>
              <dt>
                <span className={styles.summaryIcon} aria-hidden>{cell.icon}</span>
                {cell.label}
              </dt>
              <dd>{cell.value}</dd>
              {cell.meta && <dd className={styles.summaryMeta}>{cell.meta}</dd>}
            </div>
          ))}
        </dl>
        <p className={styles.summaryText}>{sentences.join(" ")}</p>
        {guides.length > 0 && (
          <p className={styles.guides}>
            <span>{d.sumGuides}</span>
            {guides.map((guide) => (
              <Link key={guide.slug} href={`/rehber/${guide.slug}`} prefetch={false} className="tap-44">
                {guide.title}
              </Link>
            ))}
          </p>
        )}
      </div>
    </Panel>
  );
}
