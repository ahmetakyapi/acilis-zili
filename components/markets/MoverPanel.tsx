import { TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, PanelLink } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import { approxPoints, type Row } from "./index-shared";
import styles from "./MarketsOverview.module.css";

/* ---- En çok artan / düşen: LOGO KAROLARI ----

   28 Kasım 2026 (görsel tur 3; sahibinin sözü: "logolar gözükmeye devam
   etsin… tekrar eden şeylerden uzaklaşalım"). Önce: tek panelin iki yarısı,
   her yarıda beş sütunlu kart (küçük logo, sembol, iki satır ad, yüzde,
   kalın çubuk) — on kart aynı "satır + çubuk + yüzde" kalıbını yineliyor,
   başlık satırları ve künyeler iki kez. Sonra: her liste bir başlık satırı
   ve çukur bir rayın içinde beş KARO; karonun yıldızı logo ve yüzde. Zemin
   nötr (sahibinin itirazı: "aynı anda her yerde yeşil dolu öğeler göz
   yoruyor"); yön rengi yüzdede ve karonun dibindeki ortak ölçekli çubukta.
   Ölçek notu iki listenin altında tek satır (6 Kasım kararı yerinde). */

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
    <section className={styles.mover} aria-label={title}>
      {/* KARŞILAŞTIRMAYA GİDEN YOL. Ekran gezinmede görünmüyor ve siteye
          girenin çoğu varlığını bilmiyordu; oysa "günün en çok artan beşi"
          listesi, karşılaştırmanın en doğal başlangıcı. Liste sabit değil,
          o anki sıralamadan türüyor. */}
      <div className={styles.moverHead}>
        <h2 className="text-lead font-bold">
          <span className={styles.moverIcon} data-direction={kind}>
            {kind === "up" ? <TrendUp size={16} weight="bold" aria-hidden /> : <TrendDown size={16} weight="bold" aria-hidden />}
          </span>
          {title}
        </h2>
        {meta && <span className={cn("numeral", styles.moverMeta)}>{meta}</span>}
        {rows.length >= 2 && (
          <PanelLink href={`/karsilastir?semboller=${rows.slice(0, 4).map((row) => row.member.symbol).join(",")}`}>
            {t.compare.compareFirstFour}
          </PanelLink>
        )}
      </div>
      <ul className={styles.tiles} data-motion-stagger>
        {rows.map((row) => {
          const changePct = row.quote?.changePct ?? 0;
          const width = (Math.abs(changePct) / scaleMax) * 100;
          /* RENK SATIRIN KENDİ DEĞERİNDEN, PANELİN ADINDAN DEĞİL.
             Düşüşle geçen bir günde "Günün En Çok Artanları" listesindeki
             beş satırın hepsi eksi olabiliyor ve eksi yüzdeler YEŞİL
             basılıyordu. Panelin adı bir sıralama yönü, satırın rengi bir olgu. */
          const tone = directionOf(row.quote?.changePct);
          return (
            <li key={row.member.symbol} data-draw>
              {/* prefetch={false}: liste satırı; görünür alana giren her
                  bağlantıyı önden ısıtmak sunucu isteği demek. */}
              <Link
                href={`/hisse/${row.member.symbol}`}
                prefetch={false}
                className={styles.tile}
                data-cc={row.member.symbol}
                aria-label={`${row.member.symbol} · ${row.member.name} · ${formatPercent(row.quote?.changePct, locale)}`}
              >
                <LogoTile symbol={row.member.symbol} logoUrl={row.logoUrl} size="md" className={styles.tileLogo} />
                <span className={styles.tileSymbol}>{row.member.symbol}</span>
                {/* Dow'da adın yerini puan katkısı alır (ölçüldü 1440: ikisi
                    birden karoyu 24 piksel uzatıp genişlik panelinin dibinden
                    71 piksel aşağıda bitiriyordu). Ad karonun künyesinde
                    (`aria-label`, şirket kartı). */}
                {!(showContribution && row.contribution !== null) && (
                  <span className={styles.tileName} title={row.member.name}>{row.member.name}</span>
                )}
                <span className={cn("numeral", styles.tilePct, directionText(tone))}>
                  {formatPercent(row.quote?.changePct, locale)}
                </span>
                {showContribution && row.contribution !== null && (
                  <span className={cn("numeral", styles.tileNote)}>
                    {contributionLabel} {approxPoints(row.contribution, locale)}
                  </span>
                )}
                {/* İki liste aynı ölçeği paylaşır (iki listenin ortak en büyük
                    mutlak yüzdesi); ortak değer çubuğu, çizim kapısı karoda. */}
                <span className={cn("value-lane", styles.tileLane)} aria-hidden>
                  <i
                    className="value-bar bar-fill"
                    data-tone={tone}
                    style={{ left: 0, width: `${Math.min(100, width).toFixed(2)}%` }}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
