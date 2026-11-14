import { TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, PanelLink } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import { approxPoints, type Row } from "./index-shared";
import styles from "./MarketExperience.module.css";

/* ---- En çok artan / düşen kartları ---- */

export function MoverPanel({
  title,
  kind,
  rows,
  showContribution,
  contributionLabel,
  locale,
  t,
  meta,
  scaleMax,
}: {
  title: string;
  kind: "up" | "down";
  rows: Row[];
  showContribution: boolean;
  contributionLabel: string;
  locale: Locale;
  t: Dictionary;
  /** Başlığın yanındaki künye — kaç şirketten seçildiği. */
  meta?: string;
  scaleMax: number;
}) {
  if (rows.length === 0) return null;

  return (
    /* Panel DEĞİL bölüm (14 Kasım 2026): iki liste tek panelin iki yarısı;
       kabı ve ortak ölçek notu sayfada (page.tsx → "TEK PANEL, İKİ YARI"). */
    <section className={styles.mover} aria-label={title}>
      {/* KARŞILAŞTIRMAYA GİDEN YOL. Ekran gezinmede görünmüyor ve siteye
          girenin çoğu varlığını bilmiyordu; oysa "günün en çok artan beşi"
          listesi, karşılaştırmanın en doğal başlangıcı. Liste sabit değil,
          o anki sıralamadan türüyor. */}
      <div className={styles.moverHeading}>
        <h2 data-ink="solid"><span className={styles.moverHeadingIcon} data-direction={kind}>
          {kind === "up" ? <TrendUp size={18} weight="bold" aria-hidden /> : <TrendDown size={18} weight="bold" aria-hidden />}
        </span>{title}</h2>
        <div className={styles.moverHeadingMeta}>
          {meta && <span>{meta}</span>}
          {rows.length >= 2 && <PanelLink href={`/karsilastir?semboller=${rows.slice(0, 4).map((row) => row.member.symbol).join(",")}`}>
            {t.compare.compareFirstFour}
          </PanelLink>}
        </div>
      </div>
      <ul className="divide-y divide-line-soft" data-motion-stagger>
        {rows.map((row) => {
          const changePct = row.quote?.changePct ?? 0;
          const width = (Math.abs(changePct) / scaleMax) * 100;
          /* RENK SATIRIN KENDİ DEĞERİNDEN, PANELİN ADINDAN DEĞİL.
             `tone` propu panelin tamamını boyuyordu: düşüşle geçen bir günde
             "Günün En Çok Artanları" listesindeki beş satırın hepsi eksi
             olabiliyor ve eksi yüzdeler YEŞİL basılıyordu. Panelin adı bir
             sıralama yönü, satırın rengi ise bir olgu. */
          const satirTon = directionOf(row.quote?.changePct);
          return (
            <li key={row.member.symbol} data-draw>
              {/* prefetch={false}: bu bağlantı bir LİSTE SATIRINDA ve satır
                  sayısı altmışa çıkıyor. Next varsayılanı, görünür alana
                  giren her bağlantıyı önden ısıtıyor — altmış satır altmış
                  sunucu isteği demek. Sitedeki öteki liste satırları
                  (şirketler, bilanço takvimi, analiz tablosu) bunu zaten
                  yapıyordu; endeks bileşenleri gözden kaçmış. */}
              <Link
                href={`/hisse/${row.member.symbol}`}
                prefetch={false}
                className={styles.moverLink}
                data-cc={row.member.symbol}
              >
                <div className={styles.moverIdentity}>
                  {/* SIRA NUMARASI KALKTI (6 Kasım). Beşli kartın sağ üstünde
                      12 piksellik "1…5" logodan kopuk duruyordu ve yeni bilgi
                      taşımıyordu: sıra kartın yerinden (soldan sağa, telefonda
                      yukarıdan aşağı) ve çubuğun boyundan zaten okunuyor. */}
                  <LogoTile symbol={row.member.symbol} logoUrl={row.logoUrl} size="sm" className={styles.moverLogo} />
                  <span className={styles.moverCompany}>
                    <span className="shrink-0 text-base font-bold text-strong">
                      {row.member.symbol}
                    </span>
                    {/* İKİ SATIR, KESİLMEZ (17 Ekim): beş sütunlu kartta ad tek
                        satırda "Northrop Grumm…" diye kırpılıyordu. */}
                    <span className="min-w-0 line-clamp-2 text-tiny leading-snug text-muted" title={row.member.name}>
                      {row.member.name}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "numeral shrink-0 text-sm font-bold",
                      directionText(satirTon),
                    )}
                  >
                    {formatPercent(row.quote?.changePct, locale)}
                  </span>
                </div>

                {/* Both panels use the same maximum absolute percentage. */}
                {/* KALIN ÇUBUK (14 Kasım 2026, görsel tur). Şerit kulvarla aynı
                    5 piksel ve %70 saydamdı: beş kartın altında ince bir
                    çizgi gibi kalıyor, sayıya eşlik etmiyordu. Sitenin ortak
                    değer çubuğu: 5 piksellik kulvar üstünde 8 piksellik OPAK
                    dolgu (globals.css → "DEĞER ÇUBUĞU"); çizim kapısı
                    satırda (`data-draw`). Ölçek aynı (iki listenin ortak en
                    büyük mutlak yüzdesi), not panelin künye bandında. */}
                <div className={styles.moverTrack}>
                  <span className={cn("value-lane", styles.moverLane)} aria-hidden>
                    <i
                      className="value-bar bar-fill"
                      data-tone={satirTon}
                      style={{ left: 0, width: `${Math.min(100, width).toFixed(2)}%` }}
                    />
                  </span>
                  {showContribution && row.contribution !== null && (
                    <span className="numeral shrink-0 text-nano text-muted">
                      {contributionLabel} {approxPoints(row.contribution, locale)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
