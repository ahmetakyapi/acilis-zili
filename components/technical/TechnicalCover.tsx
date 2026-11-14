import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MorphTarget } from "@/components/motion/Morph";
import { LogoTile } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { planPosition, stanceChangeLabel } from "@/lib/technical";
import { technicalHeadingParts } from "@/lib/seo-titles";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import { cn, directionOf, directionText, formatPercent, formatPrice, tieFigures } from "@/lib/utils";
import type { Bar } from "@/lib/providers/types";
import { LevelScale } from "./LevelScale";
import { openRangeOf } from "./OpenRange";
import { PriceChart } from "./PriceChart";
import { changeToneClass, planPositionLabel } from "./TechnicalCard";
import styles from "./Technical.module.css";
import cover from "./TechnicalCover.module.css";

/**
 * Detay sayfasının kapağı — `app/(app)/teknik-analiz/[symbol]/page.tsx`ten taşındı
 * (8 Kasım). Sayfa veriyi topluyor, kapak yalnız çiziyor; böylece kapak
 * sahte veriyle de basılıp ölçülebiliyor. Kapağın karar kayıtları burada.
 *
 * DÖRT SATIRLIK DEFTER (10 Kasım, sahibinin isteği: teknik ekranları bugünkü
 * görsel dile getirmek). Kapak iki kolondu: solda kimlik + yayın şeridi +
 * gerekçe, sağda fiyat + okuma + göstergeler, altta plan bandı. Sekiz blok
 * eşit ağırlıktaydı; sayfanın en büyük sayısı (fiyat, 40 piksel) sağ kolonun
 * tepesinde, yayın şeridi ise (künye) sol kolonun en değerli yerinde, adın
 * hemen altındaydı. Sıra artık okurun sorularının sırası ve her satırın iki
 * hücresi aynı soruya cevap veriyor:
 *   1. NE, KAÇ PARA: kimlik + görüş hapı | fiyat (display, 48/700)
 *   2. NEDEN, ŞİMDİ NE: görüşün gerekçesi | planın okuması
 *   3. PLAN: fiyat ölçeği + seviye kartları (tam genişlik, ana görsel)
 *   4. KÜNYE: yayın şeridi | gösterge bakışı
 * Satırlar kıl çizgiyle ayrık, hücreler dikey kıl çizgiyle: tek yüzeyde
 * çizgili bir defter, kutu içinde kutu yok (okuma kutusunun çerçevesi ve
 * gerekçenin gri kutusu kalktı). Şirket sayfasının başlığıyla aynı kurgu:
 * kimlik satırı, altında display fiyat. Görüş rengi kartlardaki gibi
 * tepedeki 3 piksellik şeritte. Yerleşim `TechnicalCover.module.css`te;
 * `Technical.module.css`teki `.coverMain` / `.coverSide` / `.coverIdentity`
 * / `.coverThesis` / `.coverTrack` kuralları artık kullanılmıyor (kayıtları
 * tarihçe). Ölçüm (1440×900, NVDA/AMD/AAPL): kapak 729/724/724 → 787
 * piksel — 58 piksel uzadı ama ilk ekrana artık kimlik, fiyat, gerekçe,
 * okuma ve PLANIN TAMAMI sığıyor (plan bandı y=745'te bitiyor; eskiden
 * seviye kartları ekranın alt kenarında kesiliyordu), künye satırı katın
 * altında. Satırlarda iki hücrenin dip farkı 0–15 / 28–34 / 1–8 piksel
 * (1440–1024); eski kapakta sol kolon sağdan 60–110 piksel kısaydı.
 *
 * KAHRAMAN: KİMLİK + GÖRÜŞ + FİYAT + GRAFİK (14 Kasım 2026, görsel tur
 * "Zil Defteri"; sahibinin isteği: "gerçek bir tasarımcı gözünden"). Dört
 * satırlık defter tek panelde YEDİ blok taşıyordu (kimlik, fiyat, gerekçe,
 * okuma, ölçek, iki plan kutusu, yayın şeridi, üç gösterge) ve hiçbiri
 * ötekinden ağır değildi; sayfada fiyatın GEÇMİŞİ ise hiç yoktu. Kapak artık
 * üç kat: kimlik ve görüş solda, display fiyat sağda (tek satır, dikey
 * çizgi yok); altında görüşün gerekçesi tek cümle; sonra ana görsel, fiyat
 * grafiği (`PriceChart`: altı ay, ortalamalar, yayındaki seviyeler aynı
 * eksende). Planın okuması, plan kartları ve yayın şeridi hemen alttaki
 * `PlanPanel`e indi; üç göstergelik bakış kalktı (aynı üç ölçü "Göstergeler"
 * bölümünün özet şeridinde, bölüm çubuğundan tek dokunuş).
 * Bar yoksa ya da seri bayatsa grafik YER BIRAKMAZ: eski etiketli ölçek
 * (`LevelScale`) kapakta kalır, bölgesiz TUT'ta eksen `PlanPanel`deki
 * `OpenRange`dedir. Ölçüm dosyanın sonunda, CSS'te.
 */
export function TechnicalCover({
  symbol,
  company,
  logoUrl,
  row,
  previousStance,
  price,
  changePct,
  priceLabel,
  priceBadge,
  bars = null,
  locale,
  t,
}: {
  symbol: string;
  company: string | null;
  logoUrl: string | null | undefined;
  row: TechnicalAnalysisRow;
  previousStance: VerdictKey | null;
  price: number | null;
  changePct: number | null;
  priceLabel: string;
  priceBadge: string | null;
  /** Günlük barlar (1Y). Yoksa/bayatsa null: grafik basılmaz, ölçek kalır. */
  bars?: readonly Bar[] | null;
  locale: Locale;
  t: Dictionary;
}) {
  const meta: Record<string, { logoUrl?: string | null }> = { [symbol]: { logoUrl } };
  const verdict = verdictOf(row.stance);
  const change = stanceChangeLabel(verdict, previousStance, t);
  const hasEnglish = row.copy.en !== null && row.copy.en !== undefined;
  const copy = locale === "en" ? (row.copy.en ?? row.copy.tr) : row.copy.tr;
  const copyLang = locale === "en" && !hasEnglish ? "tr" : locale;
  const position = planPosition(price, row.entryLow, row.entryHigh, row.stop);
  const openRange = openRangeOf(verdict, price, row);
  const levelProps = {
    entryLow: row.entryLow,
    entryHigh: row.entryHigh,
    stop: row.stop,
    targets: row.targets,
    supports: row.supports,
    resistances: row.resistances,
  };
  /* İkisi de veri yoksa `null` döner (bileşenlerin kendi kuralı); kat
     ancak biri çizilecekse açılır. */
  const chart =
    bars && bars.length > 0
      ? PriceChart({ bars, price, ...levelProps, verdict, priceLabel, locale, t })
      : null;
  const scale = chart ? null : LevelScale({ price, ...levelProps, verdict, priceLabel, locale, t });

  return (
    <header className={cover.root} data-verdict={verdict}>
      {/* ---- 1. kat: kimlik + görüş | fiyat ---- */}
      <div className={cover.top}>
        {/* KİMLİK BLOĞU HİSSE SAYFASINA GİDİYOR.
            Logo ile ad sayfanın en büyük öğesiydi ve hiçbir yere
            gitmiyordu: teknik görüşü okuyan okuyucunun bir sonraki isteği
            şirketin grafiğine bakmak ama künye çubuğu /teknik-analiz LİSTESİNE
            çıkıyor, hisseye değil. Bağlantı logo + sembol + adı BİRLİKTE
            sarıyor; üçü aynı şeyi söylüyor, üç ayrı sekme durağı olmaları
            gerekmiyor. Künye satırları (bu yayının saati, sıradaki yayın)
            bağlantının DIŞINDA: onlar şirketin kimliği değil yayının
            damgası — ekran okuyucuya bağlantının adı olarak okunmaları da
            yanlış olurdu. */}
        {/* GÖRÜŞ ADIN SAĞINDA, AYNI SATIRDA. Rozet bir dönem künyenin
            altında kendi satırındaydı; telefonda kapak logo, ad, iki
            künye satırı, rozet, başlık cümlesi diye altı kat üst üste
            biniyordu ve okuyucunun ilk sorusu ("bu hissede ne
            görünüyor") dördüncü katta cevaplanıyordu. Ad ile görüş
            artık aynı satırı paylaşıyor: sol uçta kimlik, sağ uçta
            tek kelime. */}
        <div className={cn(cover.cell, cover.identity)}>
          <Link href={`/hisse/${symbol}`} className={cover.nameLink} data-morph-stage>
            {/* Teknik kartından gelindiyse logo kartın yerinden buraya uçuyor.
                KİMLİK TEK HİZALI BLOK (8 Kasım, sahibinin isteği: "logo ile
                sembol/ad daha iyi dursun"). Logo 56 pikseldi, yanındaki iki
                satır (44 puntoluk sembol + ad) 75 piksel tutuyordu ve logo
                ortada küçük bir kare gibi kalıyor, sembol yukarı, ad aşağı
                kayıyordu; ok sembolün sağ üstünde ayrı bir işaret gibi
                duruyordu. Logo artık bloğun boyunda (72, `2xl`) ve sembol ile
                ad onun üst ve alt kenarına oturuyor; ok adın sonunda. */}
            <MorphTarget morphKey={`logo:${symbol}`}>
              <LogoTile symbol={symbol} logoUrl={meta[symbol]?.logoUrl} size="2xl" />
            </MorphTarget>
            <div className={cover.nameText}>
              <h1><span className="sr-only">{technicalHeadingParts(company, symbol, locale)[0]}</span>{symbol}<span className="sr-only">{technicalHeadingParts(company, symbol, locale)[1]}</span></h1>
              {/* ŞİRKET ADI KENDİ SATIRINDA. Dört parça tek künyeye dizilince
                  ("Micron Technology Inc · Seans İçi · 16 Eylül Çarşamba ·
                  19:45 TR") telefonda sarıp son parçayı tek başına alta
                  atıyordu — "TR" bir satır kaplıyordu. Adın uzunluğu şirkete
                  göre değiştiği için sarmanın nereden olacağı da her sayfada
                  farklıydı. Ad artık kendi satırında ve künyede yalnızca
                  YAYIN bilgisi kalıyor; liste kartı da sembol ile adı ayrı
                  satırda basıyor, kapak onunla aynı dile geldi. */}
              <p className={cover.company}>
                {company ?? symbol}
                {/* Dokunmatikte `:hover` yok: bağlantı olduğunu söyleyen tek
                    şey bu ok. 8 Kasım: sembolün yanından adın sonuna indi
                    (yukarıdaki kayıt); ölçüsü yine `em`, adın puntosuyla. */}
                <ArrowUpRight className={cover.go} weight="bold" aria-hidden />
              </p>
            </div>
          </Link>
          <div className={cover.stance}>
            {/* Etiket yalnızca ekran okuyucuya: gerekçe `.stancePill` yorumunda. */}
            <span className="sr-only">{t.technical.stanceLabel}</span>
            <VerdictPill verdict={verdict} label={verdictLabel(verdict, t)} size="custom" className={cover.pill} />
            {change && <span className={cn(styles.change, changeToneClass(verdict))}>{change}</span>}
          </div>
        </div>

        <div className={cn(cover.cell, cover.quote)}>
          <div className={styles.priceHead}>
            <span className={styles.priceLabel}>{priceLabel}</span>
            {priceBadge && <span className={styles.delayBadge}>{priceBadge}</span>}
          </div>
          <div className={cover.priceRow}>
            {/* Kapağın display sayısı yuvarlanarak oturuyor (`RollingFigure`:
                CSS, sunucu son kareyi basar) — açılış sırası başlık → sayı →
                ölçek ve imler → göstergeler. Fiyat yoksa düz "–". */}
            {price !== null ? (
              <RollingFigure value={formatPrice(price, locale, { currency: true })} className={cn(cover.price, "numeral")} />
            ) : (
              <span className={cn(cover.price, "numeral text-muted")}>{formatPrice(price, locale, { currency: true })}</span>
            )}
            {changePct !== null && (
              <span className={cn("numeral text-lead font-semibold", directionText(directionOf(changePct)))}>
                {formatPercent(changePct, locale)}
              </span>
            )}
          </div>
          {/* Analiz anındaki fiyat ancak FARKLIYSA yazılıyor: aynı sayının
              iki etiketle yan yana durması bilgi değil. */}
          {(position || (row.snapshot.price !== null && price !== null && Math.abs(row.snapshot.price - price) >= 0.005)) && (
            <div className={cover.priceContext}>
              {position && (
                <span className={styles.plan} data-kind={position.kind}>
                  {planPositionLabel(position, locale, t)}
                </span>
              )}
              {row.snapshot.price !== null && price !== null && Math.abs(row.snapshot.price - price) >= 0.005 && (
                <span className={styles.priceNote}>
                  {t.technical.atAnalysis}: {formatPrice(row.snapshot.price, locale, { currency: true })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- 2. kat: görüşün gerekçesi (tek cümle) ---- */}
      <div className={cover.thesis}>
        {/* Etiket yalnız ekran okuyucuya (14 Kasım): cümle kimliğin hemen
            altında, görüş hapının yanında başlıyor; "Görüşün Gerekçesi"
            künyesi görünür hâlde yedinci küçük başlıktı. */}
        <span className="sr-only">{t.technical.thesisLabel}</span>
        <p className={cover.headline} lang={copyLang}>{tieFigures(copy.headline)}</p>
        {locale === "en" && !hasEnglish && (
          <p className="text-small text-muted">{t.technical.langNote}</p>
        )}
      </div>

      {/* ---- 3. kat: ana görsel ----
          Grafik varsa o; yoksa eski etiketli ölçek (`LevelScale`, 8 Kasım
          kaydı orada). Bölgesiz TUT'un kendi ekseni `PlanPanel`deki
          `OpenRange`de; orada ölçek zaten basılmıyordu. İkisi de yoksa kat
          yer bırakmaz. */}
      {chart ? (
        <div className={cover.visual}>{chart}</div>
      ) : !openRange && scale ? (
        <div className={cover.visual} data-draw>{scale}</div>
      ) : null}
    </header>
  );
}
