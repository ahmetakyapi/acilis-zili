import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import type { Overview } from "@/lib/investor-data";
import type { CrowdEntry } from "@/lib/investor-view";
import { investorBySlug, type Investor } from "@/lib/investors";
import { quarterLabel } from "./format";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/**
 * "Bu Çeyreğin Hareketleri" — aynı hisseye aynı yönde giden yatırımcılar.
 *
 * İki sütun, iki yön: solda en çok alınanlar (yeni açan + artıran), sağda
 * en çok satılanlar (tamamen satan + azaltan). Her satırda kaç yatırımcının
 * ne yaptığı SAYI olarak, kimlerin yaptığı PORTRE olarak ve sayının
 * büyüklüğü bir ÇİZGİ olarak (CLAUDE.md: karşılaştırılan her büyüklük bir
 * de çizgi olarak okunur). Çizginin ölçeği iki sütunda ORTAK: soldaki 5
 * ile sağdaki 5 aynı uzunlukta.
 *
 * Çizgi YATIRIMCI SAYISINI ölçer (alımda yeni açan + artıran, satışta
 * tamamen satan + azaltan), pozisyonun dolar değerini DEĞİL — veri
 * kişi sayısı. Bu yüzden sütun başında "Yatırımcı Sayısı" künyesi var.
 *
 * Satır düzeni (29 Eylül, ölçüldü): eski satır dört kattı (ad, rozet,
 * portre, altta tam genişlik çizgi) ve 94 pikseldi; çizgi ayrı bir satır
 * gibi duruyor, dolu yeşil/kırmızı haplar ekranın en ağır lekesi oluyordu.
 * Şimdi iki hat: üstte kimlik + ölçü (çizgi ve sayı yan yana), altta
 * hareketin dökümü + portreler. Rozet yok; güçlü hareket yön renginde
 * metin, zayıf olan sessiz metin. Satır sabit yükseklikte ki iki sütunun
 * satırları aynı hatta dursun.
 */
/* Yığında en çok BEŞ karo: kalabalıkta dört portre + "+N" karosu. "+N"
   portreyle aynı boyda bir karo, yığının son elemanı — sağ sütun her
   satırda aynı genişlikte ve yığınlar aynı sağ hatta biter (30 Eylül,
   gerekçe Investors.module.css → "SAĞ SÜTUN SABİT"). "+1" hiç çıkmaz:
   beş kişide beşinci karo portrenin kendisi. */
const PORTRAIT_SLOTS = 5;

export function MoversBoard({
  movers,
  known,
  locale,
  t,
}: {
  movers: Overview["movers"];
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Dictionary["investors"];
}) {
  const peak = Math.max(
    1,
    ...movers.buys.map((entry) => entry.opened.length + entry.added.length),
    ...movers.sells.map((entry) => entry.exited.length + entry.trimmed.length),
  );
  const empty = movers.buys.length === 0 && movers.sells.length === 0;
  /* KARŞI YÖN (1 Ekim). Aynı hisse iki sütunda birden duruyorsa (GOOGL'u
     yedi yatırımcı alırken beşi satıyor) her satır ötekinin kalabalığını
     da söylüyor. YALNIZCA iki listede de varsa: listeler kesik (en çok
     `MOVERS_LIMIT`, en az iki kişi), yani öteki listede yokluk "karşı
     yönde kimse yok" demek değil — orada hiçbir şey basılmıyor. */
  const buyCrowd = new Map(movers.buys.map((entry) => [entry.key, entry.opened.length + entry.added.length]));
  const sellCrowd = new Map(movers.sells.map((entry) => [entry.key, entry.exited.length + entry.trimmed.length]));

  return (
    <Panel className={styles.moversPanel}>
      <PanelHeader
        title={t.moversTitle}
        meta={
          movers.period
            ? t.moversMeta
                .replace("{period}", quarterLabel(movers.period, t))
                .replace("{count}", String(movers.investors))
            : undefined
        }
      />
      {empty ? (
        <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">{t.moversEmpty}</p>
      ) : (
        <div className={styles.movers}>
          <MoverColumn
            title={t.buysTitle}
            tone="up"
            entries={movers.buys}
            parts={(entry) => [
              { count: entry.opened.length, label: t.opened, strong: true },
              { count: entry.added.length, label: t.added, strong: false },
            ]}
            who={(entry) => [...entry.opened, ...entry.added]}
            against={(entry) => sellCrowd.get(entry.key) ?? 0}
            againstLabel={t.moversAgainstBuy}
            peak={peak}
            known={known}
            locale={locale}
            scale={t.moversScale}
          />
          <MoverColumn
            title={t.sellsTitle}
            tone="down"
            entries={movers.sells}
            parts={(entry) => [
              { count: entry.exited.length, label: t.exited, strong: true },
              { count: entry.trimmed.length, label: t.trimmed, strong: false },
            ]}
            who={(entry) => [...entry.exited, ...entry.trimmed]}
            against={(entry) => buyCrowd.get(entry.key) ?? 0}
            againstLabel={t.moversAgainstSell}
            peak={peak}
            known={known}
            locale={locale}
            scale={t.moversScale}
          />
        </div>
      )}
      <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">{t.moversNote}</p>
    </Panel>
  );
}

function MoverColumn({
  title,
  tone,
  entries,
  parts,
  who,
  against,
  againstLabel,
  peak,
  known,
  scale,
}: {
  title: string;
  tone: "up" | "down";
  entries: CrowdEntry[];
  parts: (entry: CrowdEntry) => { count: number; label: string; strong: boolean }[];
  who: (entry: CrowdEntry) => string[];
  against: (entry: CrowdEntry) => number;
  againstLabel: string;
  peak: number;
  known: Record<string, SymbolMeta>;
  locale: string;
  scale: string;
}) {
  return (
    <section className={styles.moverColumn} data-tone={tone}>
      <header className={styles.moverHead}>
        {/* Sayı başlığın DIŞINDA: `main h3` degrade mürekkebi alıyor ve
            içindeki sayı da maviye boyanıp başlığın parçası gibi okunuyordu. */}
        <span className={styles.moverTitle}>
          <h3>{title}</h3>
          <span className="numeral">{entries.length}</span>
        </span>
        {/* Çubuğun neyi ölçtüğü sütunun başında, çubuğun tam üstünde. */}
        <span className={styles.moverScale}>{scale}</span>
      </header>
      <ol className={styles.moverList} data-motion-stagger>
        {entries.map((entry) => {
          const meta = entry.ticker ? known[entry.ticker] : undefined;
          const counted = parts(entry).filter((part) => part.count > 0);
          const total = counted.reduce((sum, part) => sum + part.count, 0);
          const slugs = who(entry);
          const opposite = against(entry);
          const investors = slugs.map((slug) => investorBySlug(slug)).filter((investor): investor is Investor => investor !== null);
          const shown = investors.slice(0, investors.length > PORTRAIT_SLOTS ? PORTRAIT_SLOTS - 1 : PORTRAIT_SLOTS);
          const body = (
            <>
              {entry.ticker ? (
                <LogoTile symbol={entry.ticker} logoUrl={meta?.logoUrl} size="md" />
              ) : (
                <span className={styles.noLogo} aria-hidden />
              )}
              <span className={styles.moverId}>
                <b className="numeral">{entry.ticker ?? entry.issuer}</b>
                <small>{meta?.name ?? entry.issuer}</small>
              </span>
              {/* Sayı ve çizgi AYNI hücrede: çizgi satırın altında ayrı bir
                  satır olarak durduğunda neyi ölçtüğü okunmuyordu. Çizginin
                  ölçeği iki sütunda ortak; koyu parça güçlü hareket (yeni
                  açan / tamamen satan), açık parça artıran / azaltan — altta
                  aynı iki tonun noktası bu yüzden lejant görevi görüyor. */}
              <span className={styles.moverMeasure} aria-hidden>
                <span className={styles.moverTrack}>
                  <span className={styles.moverFill} data-motion-draw="line" style={{ width: `${(total / peak) * 100}%` }}>
                    {counted.map((part) => (
                      <i key={part.label} data-strong={part.strong || undefined} style={{ flexGrow: part.count }} />
                    ))}
                  </span>
                </span>
                <b className="numeral">{total}</b>
              </span>
              <span className={styles.moverParts}>
                {counted.map((part) => (
                  <span key={part.label} className={styles.moverPart} data-strong={part.strong || undefined}>
                    {part.label.replace("{count}", String(part.count))}
                  </span>
                ))}
                {opposite > 0 && (
                  <span className={styles.moverPart} data-against>
                    {againstLabel.replace("{count}", String(opposite))}
                  </span>
                )}
              </span>
              <span className={styles.moverFaces}>
                {/* "+1" YERİNE PORTRE (28 Eylül): tek bir yatırımcı artıyorsa
                    çip onun portresine dönüşüyor. Portre 24 piksel ve
                    öncekinin üstüne biniyor; "+1" çipi hiç yer kazandırmıyor.
                    30 Eylül: "+N" artık yığının içinde portre boyunda bir
                    karo (PORTRAIT_SLOTS).
                    Ad, portrenin üzerine gelince `title` ile; ekran okuyucu
                    tam listeyi gizli metinden duyar. */}
                {shown.map((investor) => (
                  <span key={investor.slug} className={styles.moverFace} title={investor.name} aria-hidden>
                    <Portrait investor={investor} size="chip" />
                  </span>
                ))}
                {investors.length > shown.length && (
                  <span className={styles.moverMore} aria-hidden>
                    +{investors.length - shown.length}
                  </span>
                )}
                <span className="sr-only">{investors.map((investor) => investor.name).join(", ")}</span>
              </span>
            </>
          );
          return (
            <li key={entry.key} className="min-w-0">
              {entry.ticker && meta ? (
                <Link href={`/hisse/${entry.ticker}`} prefetch={false} className={styles.moverRow} data-cc={entry.ticker}>
                  {body}
                </Link>
              ) : (
                <div className={styles.moverRow}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
