import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { VerdictPill } from "@/components/ui/VerdictPill";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  } from "@/lib/analysis";
import type { AnalysisIndexRow, SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { MetricStrip } from "@/components/earnings/MetricStrip";
import { robustScale } from "@/lib/analysis-visuals";
import { cn, formatPercentPlain } from "@/lib/utils";
import { LogoTile } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import styles from "./RecentAnalysesStrip.module.css";

/**
 * Takvim sekmesinin altındaki "son yazılan analizler" şeridi.
 *
 * NEDEN VAR: takvim BUGÜNDEN İLERİYE bakıyor, analizler ise açıklanmış —
 * yani geçmiş — bilançolara ait. Satırlara düşen "AL · 77 · Analiz" rozeti
 * bu yüzden yalnızca aynı gün açıklayan şirketlerde ateşleniyor; dünkü ya da
 * geçen haftaki analizler takvimde hiç görünmüyordu. Okuyucunun onları
 * bulmak için Analizler sekmesine geçmesi gerekiyordu.
 *
 * Şerit tek satır: takvimle yarışmıyor, yalnızca "burada okunacak bir şey
 * var" diyor. Analiz yoksa hiçbir şey basmaz — boş bir kart, henüz analiz
 * yazılmamış bir sitede her gün tekrar eden bir vaat olurdu.
 *
 * VERİ SAYFADAN GELİYOR (20 Ekim). Şerit kendi `getAnalyses`ini çeken bir
 * sunucu bileşeniydi ve üstünde Suspense yok: sorgusu ancak sayfa gövdesi
 * döndükten SONRA başlıyor, ilk bayta üçüncü bir sıralı Neon turu
 * ekliyordu. Sayfa artık onu takvimle aynı turda soruyor
 * (`app/(app)/bilancolar/page.tsx`); `SymbolAnalyses`in kalıbı.
 */
export function RecentAnalysesStrip({
  rows,
  meta,
  t,
  locale,
}: {
  rows: AnalysisIndexRow[];
  meta: Record<string, SymbolMeta>;
  t: Dictionary;
  locale: Locale;
}) {
  if (rows.length === 0) return null;
  /* Tepki şeritleri şeridin ortak ölçeğinde — ana sayfanın öne çıkan
     kartındaki ölçülerle aynı dil (LatestAnalyses). */
  const reactionScale = robustScale(rows.map((row) => row.reactionPct));
  const L = t.analysisVisuals.list;

  return (
    <section
      aria-label={t.analysis.recentStrip}
      /* SAYFANIN TEK ACCENT YÜZEYİ. Takvim sayfasında dokuz-on nötr kutu alt
         alta akıyor ve hiçbirinin önceliği yok; oysa burada OKUNACAK tek şey
         bu şerit, gerisi bakılacak veri. Depoda bu tam olarak belgeli bir
         desen (ana sayfadaki mercek bloğu, arşiv manşeti, bilanço karar
         şeridi hepsi aynı yüzeyi kullanıyor) ve glow değil: iki accent
         wash'ın ton farkı. Sayfada rakip bir accent yüzey yok — cesaret bir
         kez harcanıyor. Çipler kendi `bg-surface-solid` zemininde kalıyor,
         yani bu yüzeyin bir kademe ÖNÜNDE duruyorlar. */
      /* BELİRGİNLİK KENARLIK VE YÜKSEKLİKTEN, ZEMİNDEN DEĞİL. Zemini bir
         kademe derinleştirmek denendi ve ÖLÇÜMDE DÜŞTÜ: `--primary-faint`
         yoğunluğunda etiketin kontrastı 4,04:1'e iniyor, yani AA'yı
         kaybediyor (mevcut wash'ta 4,77). Metin okunabilirliğini görsel
         ağırlığa değişmek olmazdı.
         Kalan kaldıraçlar metni etkilemiyor: kenarlık bir kademe koyu,
         dolgu 3.5 → 4, köşe yarıçapı panellerinkiyle aynı (`xl`). Şerit
         artık sayfadaki öteki kutularla aynı dilde ve kenarı belirgin.
         Geniş ekranda dikey dolgu 5 → 3.5 (25 Ekim, ilk ekran turu): çipler
         44 piksel, şerit 84 → 72 ve altındaki takvim listesi yukarı çıkıyor.
         ≥1600'de (`min-[100rem]`; piksel birimli değişken `sm:` ile aynı
         birimde olmadığı için sıralamada ondan önce düşüyor, dolgu
         değişmiyordu — ölçüldü) 3.5 → 2 (25 Ekim, doğrulama turu): şerit
         74 → 62; gerekçe
         ve ölçüm `components/earnings/horizon/EarningsHorizon.module.css`
         sonunda. */
      /* BAŞLIK ÜSTTE, ÇİPLER TAM GENİŞLİKTE (31 Ekim): başlık solda, çipler
         ortada kayan şerit ve "Tümünü Gör" sağdaydı; son çip yarım kesilip
         bağlantının dibine yapışıyordu. Gerekçe ve ölçüm
         `RecentAnalysesStrip.module.css` başında. */
      className={styles.strip}
    >
      <div className={styles.head}>
        {/* ETİKET YÜZEYİN KENDİ MÜREKKEBİNDE. `plate` künyeyi `--text-muted`
            ile basıyor ve o gri, sayfanın nötr zemini için ayarlı; accent
            wash'ın üstünde şeridin ne olduğunu söyleyen TEK metin geri plana
            düşüyordu, içerik çipleri öne çıkarken. `--primary-ink` hem
            yüzeyle aynı aileden hem bir tık daha kontrastlı (ölçüldü: wash
            zemininde 4,67:1, muted 4,56:1 — ikisi de AA geçiyor, ama biri
            bandın parçası gibi okunuyor). Punto ve harf aralığı DEĞİŞMEDİ:
            rol hâlâ künye, yalnızca aidiyeti düzeldi. */}
        {/* BAŞLIK OLDU (24 Eylül, sahibinin isteği: "biraz küçük kalmış,
            bir tık daha belirgin olsun"). Künye puntosunda bir `plate`tı;
            şerit sayfanın okunacak tek yüzeyi olduğu hâlde en küçük metni
            onun adıydı. Artık panel başlıklarıyla aynı basamakta bir `h2`
            ve öteki başlıklar gibi mavi degradede. */}
        <h2 className={styles.title}>
          {t.analysis.recentStrip}
        </h2>
        {/* "Tümü" etiketle aynı satırda, her genişlikte (31 Ekim'e dek
            yalnız telefonda; geniş ekranda şeridin sağ ucundaydı). */}
        <Link href="/bilancolar/analizler" className={styles.all}>
          {t.common.showAll} →
        </Link>
      </div>

      {/* Dar ekranda çipler kırılmak yerine kayar — sekiz analiz alt alta
          dizilince şerit bir listeye dönüşüyordu. Şerit yalnızca yatay
          kayıyor (dikey taşma kesik — globals.css). 31 Ekim: kaydırma
          yalnız telefonda; ≥640'ta kabın genişliğine sığan kadar TAM çip. */}
      <div className={styles.rail}>
      <ScrollEdges as="ul" className={`no-scrollbar ${styles.list}`}>
        {rows.map((row) => {
          const verdict = verdictOf(row.verdict);
          const logoUrl = meta[row.symbol]?.logoUrl;
          return (
            <li key={`${row.symbol}-${row.period}`} className={styles.item}>
              <Link
                href={analysisHref(row.symbol, row.period)}
                prefetch={false}
                title={row.headline}
                /* ÇİP 44 PİKSEL, KENDİSİ (24 Eylül). 32 piksellikti ve
                   dokunma alanını `.tap-44` ile görünmeden büyütüyordu;
                   şerit "küçük kalmış" bulundu. Hap artık hedefin kendisi
                   kadar: logo 26, sembol 15 punto. */
                /* MİNİ KART (31 Ekim, sahibinin isteği: "görselliği
                   artıralım"). Hap biçimli çip yalnız sembol + görüş +
                   dönem taşıyordu; şirket adı yoktu, analizin ne dediği
                   ancak tıklayınca okunuyordu. Şimdi tepede görüşün 3
                   piksellik şeridi (bilanço kartlarının dili), kimlik
                   satırında şirket adı, dipte görüş hapı ve piyasanın ilk
                   tepkisi sıfır merkezli şeritte. */
                className={styles.chip}
                data-verdict={verdict}
              >
                <span className={styles.identity}>
                  <LogoTile symbol={row.symbol} logoUrl={logoUrl} size="sm" />
                  <span className={styles.names}>
                    <span className={styles.symbol}>{row.symbol}</span>
                    <span className={styles.company}>{row.company}</span>
                  </span>
                  {/* Hangi çeyreğin okunduğu: `periodLabel` sorguda geliyor. */}
                  <span className={`figure ${styles.period}`}>{row.periodLabel}</span>
                </span>
                <span className={styles.foot}>
                  <VerdictPill verdict={verdict} label={verdictLabel(verdict, t)} score={row.score} size="xs" />
                  {row.reactionPct !== null ? (
                    <span className={styles.reaction}>
                      <span className={styles.reactionHead}>
                        <span>{L.reaction}</span>
                        <b className={cn("numeral", row.reactionPct >= 0 ? "text-up" : "text-down")}>
                          {row.reactionPct >= 0 ? "▲" : "▼"} {formatPercentPlain(row.reactionPct, locale, 1)}
                        </b>
                      </span>
                      <MetricStrip value={row.reactionPct} scale={reactionScale} />
                    </span>
                  ) : (
                    <span className={styles.noReaction}>{L.noReaction}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ScrollEdges>
      </div>
    </section>
  );
}
