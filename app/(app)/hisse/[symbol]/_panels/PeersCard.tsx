import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "../stock.module.css";
import peerStyles from "./peers.module.css";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { LogoTile, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { MoveFigure, rowStep } from "@/components/markets/BoardTable";
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { indexMemberOf, peersOf } from "@/db/seed/indices";
import { subIndustryName } from "@/db/seed/sub-industries";
import { cn, formatMoneyCompact, formatPrice, NO_VALUE } from "@/lib/utils";
import { FoldToggle } from "@/components/ui/FoldToggle";

/** Telefonda açık gelen satır (28 Eylül, Gündem'i kısaltma işi). Dokuz satır
    390'da 556 piksel tutuyordu; sayfanın şirketi beşin dışına düşse de
    katlanmıyor — listenin asıl söylediği onun sırası. */
const PEER_FOLD = 5;

/**
 * Aynı alt sektördeki şirketler — piyasa değerine göre SIRALI bir liste,
 * sayfanın şirketi kendi sırasında (24 Eylül).
 *
 * NEDEN LİSTE: sekiz kart dört sütunluk ızgarada 1440'ta 499, 390'da 891
 * piksel tutuyordu ve her kart aynı üç şeyi (logo, sembol, fiyat) büyük bir
 * boşluğun içinde gösteriyordu. Kartların söylemediği asıl şey şuydu: bu
 * şirket sektörünün NERESİNDE? Sayfanın şirketi listede hiç yoktu. Artık
 * dokuz satır, piyasa değerine göre sıralı; sayfanın şirketi vurgulu satırda
 * kendi sırasında.
 *
 * Piyasa değeri profil kartıyla AYNI kural (`liveMarketCap`): NVDA satırı
 * profilin tek büyük okumasıyla aynı sayı. FİYATTA ÇUBUK YOK — farklı
 * şirketlerin hisse fiyatları karşılaştırılabilir değil (CompareScale).
 * Sınıflandırma GICS'ten; aynı şirketin ikinci hisse sınıfı listeye girmez.
 *
 * TARİHÇE — PİYASA DEĞERİ ÇUBUĞU (24 Eylül → 10 Kasım). Liste ilk hâlinde
 * piyasa değerini bir de uzunluk olarak veriyordu (`ScaleBar`; CLAUDE.md
 * "Karşılaştırılan her büyüklük bir de çizgi olarak okunur"); 25 Ekim'de
 * çubuk LOGARİTMİK ölçeğe geçti (`logScale`, lib/peer-spread.ts: doğrusalda
 * en büyük şirketin dışındakiler nokta kadar kalıyordu) ve panelin dibine
 * "sol uç 100 Mr $, her eşit adım on kat" künyesi eklendi.
 *
 * 10 Kasım 2026 (gece), sahibinin kararı: "piyasa değerini direkt yazsak
 * daha doğru" ve "nokta/eksen çözdürme". Logaritmik çubuk okurun çözmesi
 * gereken bir çizimdi: iki kat uzun çubuk iki kat büyük şirket demiyordu,
 * bunu söylemek için ayrı bir künye cümlesi gerekiyordu. ÇUBUK VE KÜNYE
 * KALKTI; piyasa değeri koyu mürekkeple doğrudan yazılıyor (Endeks
 * Bileşenleri'yle aynı karar, `arayuz.md` → "Piyasa değeri gibi büyüklükler
 * doğrudan YAZILIR"); sıra zaten büyüklüğü söylüyor. Satırın çizimi artık
 * GÜNLÜK DEĞİŞİM: sıfır ortalı 8 piksellik kalın çubuk ve yön renginde
 * güçlü yüzde — ortak tablo parçasının `MoveFigure`ı (ölçek sabit,
 * lib/market-scales.ts; Şirketler ve Endeks Bileşenleri ile aynı uzunluk
 * aynı hareket). Kimlik de aynı aileye büyüdü: logo 28 → 36 (telefonda
 * 32), sembol 14 → 16/700, ad soluk 12 → gövde 13,5. Fiyat piyasa
 * değerinin altında sessiz künye (karşılaştırılmaz, ama okur arıyor).
 * `logScale` ve testi lib'de duruyor (başka kullanıcısı kalmadı; silme
 * kararı ana oturumun). Ölçüm peers.module.css sonunda.
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
  const folded = (index: number, self: boolean) => index >= PEER_FOLD && !self;
  const foldCount = rows.filter((row, index) => folded(index, row.self)).length;

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
      <FoldToggle
        id="peers-fold"
        hiddenCount={foldCount}
        more={t.stockDepth.peersShowMore.replace("{n}", String(foldCount))}
        less={t.common.less}
      >
      {/* `data-draw`: çubuklar liste ekrana girince dolar (DrawGate);
          kademe satırda (`rowStep`). */}
      <ol className={peerStyles.list} data-draw>
        {rows.map((row, index) => {
          const quote = quotes[row.symbol];
          const body = (
            <>
              <LogoTile symbol={row.symbol} logoUrl={meta[row.symbol]?.logoUrl} size="lg" className={peerStyles.logo} />
              <span className={peerStyles.id}>
                <span className={peerStyles.symbol}>{row.symbol}</span>
                <span className={peerStyles.name} title={row.name}>{row.name}</span>
              </span>
              <span className={peerStyles.cap}>
                <b className={cn("numeral", row.cap === null && peerStyles.none)}>
                  {row.cap !== null ? formatMoneyCompact(row.cap, locale) : NO_VALUE}
                </b>
                {quote && <span className="numeral">{formatPrice(quote.price, locale, { currency: true })}</span>}
              </span>
              <span className={peerStyles.move}>
                <MoveFigure value={quote ? quote.changePct : null} locale={locale} />
              </span>
            </>
          );
          return (
            <li key={row.symbol} className={peerStyles.item} data-fold={folded(index, row.self) ? "" : undefined} style={rowStep(index)}>
              {row.self ? (
                <div className={peerStyles.row} data-self aria-current="page">
                  {body}
                </div>
              ) : (
                <Link href={`/hisse/${row.symbol}`} className={peerStyles.row} data-cc={row.symbol}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      </FoldToggle>
      {/* ŞİRKET KARTI — bu listenin satırları VE Şirket Özeti'ndeki logo
          şeridi (StockSummary: aynı sıralamanın ilk beşi, yani bu sekizin
          alt kümesi). Kayıt burada çünkü paket burada: kart satırın
          yanındaki fiyatla aynı sayıyı yazıyor, ikinci bir tur yok. */}
      <CompanyCards
        symbols={top.map((peer) => peer.symbol)}
        quotes={result.ok ? quotes : null}
        stale={result.ok && Boolean(result.stale)}
        names={meta}
        status={status}
      />
    </Panel>
  );
}
