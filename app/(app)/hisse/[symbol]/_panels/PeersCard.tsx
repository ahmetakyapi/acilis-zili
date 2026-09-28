import Image from "next/image";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "../stock.module.css";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { ChangePill, EmptyValue, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { ScaleBar } from "@/components/markets/CompareScale";
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { indexMemberOf, peersOf } from "@/db/seed/indices";
import { subIndustryName } from "@/db/seed/sub-industries";
import { formatMoneyCompact, formatPrice, NO_VALUE } from "@/lib/utils";

/**
 * Aynı alt sektördeki şirketler — piyasa değerine göre SIRALI bir liste,
 * sayfanın şirketi kendi sırasında (24 Eylül).
 *
 * NEDEN LİSTE: sekiz kart dört sütunluk ızgarada 1440'ta 499, 390'da 891
 * piksel tutuyordu ve her kart aynı üç şeyi (logo, sembol, fiyat) büyük bir
 * boşluğun içinde gösteriyordu. Kartların söylemediği asıl şey şuydu: bu
 * şirket sektörünün NERESİNDE? Sayfanın şirketi listede hiç yoktu. Artık
 * dokuz satır, piyasa değerine göre sıralı; sayfanın şirketi vurgulu satırda
 * kendi sırasında, çubuk büyüklüğü UZUNLUK olarak veriyor (CLAUDE.md
 * "Karşılaştırılan her büyüklük bir de çizgi olarak okunur", `ScaleBar`).
 *
 * Piyasa değeri profil kartıyla AYNI kural (`liveMarketCap`): NVDA satırı
 * profilin tek büyük okumasıyla aynı sayı. FİYATTA ÇUBUK YOK — farklı
 * şirketlerin hisse fiyatları karşılaştırılabilir değil (CompareScale).
 * Sınıflandırma GICS'ten; aynı şirketin ikinci hisse sınıfı listeye girmez.
 */
export async function PeersCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const member = indexMemberOf(symbol);
  const peers = peersOf(symbol);
  if (peers.length === 0) return null;

  const meta = await getSymbolNames([symbol, ...peers.map((peer) => peer.symbol)]);
  const top = [...peers]
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 8);

  const status = await getStatus();
  const result = await getQuotes(
    [symbol, ...top.map((peer) => peer.symbol)],
    status,
  );
  const quotes = result.ok ? result.data : {};

  const rows = [
    { symbol, name: meta[symbol]?.name ?? symbol, self: true },
    ...top.map((peer) => ({ symbol: peer.symbol, name: peer.name, self: false })),
  ]
    .map((row) => ({
      ...row,
      cap: liveMarketCap(meta[row.symbol], quotes[row.symbol]?.price ?? null),
    }))
    .sort((a, b) => (b.cap ?? -1) - (a.cap ?? -1));
  const maxCap = Math.max(0, ...rows.map((row) => row.cap ?? 0));

  /* Karşılaştırma bağlantısı buraya konuyor çünkü soru tam burada doğuyor:
     benzer şirketleri yan yana gören biri "hangisi" diye sorar. Sembol
     listesi bu hissenin kendisiyle başlar ve en büyük üç rakiple dolar. */
  const compareSymbols = [symbol, ...top.map((peer) => peer.symbol)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, 4);

  return (
    <Panel className={styles.peersPanel}>
      {/* ALT SEKTÖR BAŞLIĞIN KÜNYESİNDE. Kendi satırında ("Alt Sektör:
          Yarı İletkenler") 33 piksel tutuyordu; başlığın sağı boştu. */}
      <PanelHeader
        title={t.stock.peers}
        meta={member?.sub ? subIndustryName(member.sub, locale) : undefined}
        action={
          <PanelLink href={`/karsilastir?semboller=${compareSymbols.join(",")}`}>
            {t.compare.addCta} →
          </PanelLink>
        }
      />
      <ol className={styles.peerList}>
        {rows.map((row) => {
          const quote = quotes[row.symbol];
          const logo = meta[row.symbol]?.logoUrl;
          const body = (
            <>
              {logo ? (
                <span className={styles.peerLogo}>
                  <Image src={logo} alt="" width={28} height={28} />
                </span>
              ) : (
                <span className={styles.peerMonogram} aria-hidden>
                  {row.symbol.slice(0, 1)}
                </span>
              )}
              <span className="min-w-0">
                <span className="numeral block text-sm font-bold text-strong">{row.symbol}</span>
                <span className="block truncate text-xs text-muted">{row.name}</span>
              </span>
              <span className="min-w-0 text-right">
                <span className="numeral block text-xs font-semibold text-strong">
                  {row.cap !== null ? formatMoneyCompact(row.cap, locale) : NO_VALUE}
                </span>
                {row.cap !== null && maxCap > 0 && (
                  <ScaleBar ratio={row.cap / maxCap} signed={false} emphasis={row.self} />
                )}
              </span>
              <span className={styles.peerQuote}>
                {quote ? (
                  <>
                    <span className="numeral text-xs text-body">
                      {formatPrice(quote.price, locale, { currency: true })}
                    </span>
                    <ChangePill changePct={quote.changePct} locale={locale} size="sm" />
                  </>
                ) : (
                  <EmptyValue label={t.common.noData} className="text-xs text-muted" />
                )}
              </span>
            </>
          );
          return (
            <li key={row.symbol} className="min-w-0">
              {row.self ? (
                <div className={styles.peerRow} data-self aria-current="page">
                  {body}
                </div>
              ) : (
                <Link href={`/hisse/${row.symbol}`} className={styles.peerRow} data-cc={row.symbol}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      {/* ŞİRKET KARTI — bu listenin satırları VE Şirket Özeti'ndeki logo
          şeridi (StockSummary: aynı sıralamanın ilk beşi, yani bu sekizin
          alt kümesi). Kayıt burada çünkü paket burada: kart satırın
          yanındaki fiyatla aynı sayıyı yazıyor, ikinci bir tur yok. */}
      <CompanyCards
        symbols={top.map((peer) => peer.symbol)}
        quotes={result.ok ? quotes : null}
        names={meta}
        status={status}
      />
    </Panel>
  );
}
