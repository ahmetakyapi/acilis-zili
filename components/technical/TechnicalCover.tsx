import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MorphTarget } from "@/components/motion/Morph";
import { LogoTile } from "@/components/ui/primitives";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  planPosition,
  planReading,
  stanceChangeLabel,
  type TechnicalSlot,
} from "@/lib/technical";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import { cn, directionOf, directionText, formatPercent, formatPrice, tieFigures } from "@/lib/utils";
import { EditionTrack } from "./EditionTrack";
import { LevelScale } from "./LevelScale";
import { OpenRange, openRangeOf } from "./OpenRange";
import { PlanStrip } from "./PlanStrip";
import { SignalStrip } from "./SignalStrip";
import { changeToneClass, planPositionLabel, planReadingText, planReadingTone } from "./TechnicalCard";
import styles from "./Technical.module.css";

/**
 * Detay sayfasının kapağı — `app/(app)/teknik/[symbol]/page.tsx`ten taşındı
 * (8 Kasım). Sayfa veriyi topluyor, kapak yalnız çiziyor; böylece kapak
 * sahte veriyle de basılıp ölçülebiliyor. Kapağın karar kayıtları burada.
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
  next,
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
  next: { at: Date; slot: TechnicalSlot } | null;
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
  const reading = planReading(verdict, price, row);
  const openRange = openRangeOf(verdict, price, row);
  const levelProps = {
    entryLow: row.entryLow,
    entryHigh: row.entryHigh,
    stop: row.stop,
    targets: row.targets,
    supports: row.supports,
    resistances: row.resistances,
  };

  return (
    <header className={styles.cover} data-verdict={verdict}>
      <div className={styles.coverMain} data-motion-intro>
        {/* KİMLİK BLOĞU HİSSE SAYFASINA GİDİYOR.
            Logo ile ad sayfanın en büyük öğesiydi ve hiçbir yere
            gitmiyordu: teknik görüşü okuyan okuyucunun bir sonraki isteği
            şirketin grafiğine bakmak ama künye çubuğu /teknik LİSTESİNE
            çıkıyor, hisseye değil. Bağlantı logo + sembol + adı BİRLİKTE
            sarıyor; üçü aynı şeyi söylüyor, üç ayrı sekme durağı olmaları
            gerekmiyor. Künye satırları (bu yayının saati, sıradaki yayın)
            bağlantının DIŞINDA: onlar şirketin kimliği değil yayının
            damgası — ekran okuyucuya bağlantının adı olarak okunmaları da
            yanlış olurdu. */}
        <div className={styles.coverIdentity}>
          {/* GÖRÜŞ ADIN SAĞINDA, AYNI SATIRDA. Rozet bir dönem künyenin
              altında kendi satırındaydı; telefonda kapak logo, ad, iki
              künye satırı, rozet, başlık cümlesi diye altı kat üst üste
              biniyordu ve okuyucunun ilk sorusu ("bu hissede ne
              görünüyor") dördüncü katta cevaplanıyordu. Ad ile görüş
              artık aynı satırı paylaşıyor: sol uçta kimlik, sağ uçta
              tek kelime. Künye satırları o satırın altında kalıyor. */}
          <div className={styles.coverHead}>
          <Link href={`/hisse/${symbol}`} className={styles.coverNameLink} data-morph-stage>
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
            <div className={styles.coverNameText}>
              <h1>{symbol}</h1>
              {/* ŞİRKET ADI KENDİ SATIRINDA. Dört parça tek künyeye dizilince
                  ("Micron Technology Inc · Seans İçi · 16 Eylül Çarşamba ·
                  19:45 TR") telefonda sarıp son parçayı tek başına alta
                  atıyordu — "TR" bir satır kaplıyordu. Adın uzunluğu şirkete
                  göre değiştiği için sarmanın nereden olacağı da her sayfada
                  farklıydı. Ad artık kendi satırında ve künyede yalnızca
                  YAYIN bilgisi kalıyor; liste kartı da sembol ile adı ayrı
                  satırda basıyor, kapak onunla aynı dile geldi. */}
              <p className={styles.coverCompany}>
                {company ?? symbol}
                {/* Dokunmatikte `:hover` yok: bağlantı olduğunu söyleyen tek
                    şey bu ok. 8 Kasım: sembolün yanından adın sonuna indi
                    (yukarıdaki kayıt); ölçüsü yine `em`, adın puntosuyla. */}
                <ArrowUpRight className={styles.coverGo} weight="bold" aria-hidden />
              </p>
            </div>
          </Link>
          <div className={styles.stanceRow}>
            {/* Etiket yalnızca ekran okuyucuya: gerekçe `.stancePill` yorumunda. */}
            <span className="sr-only">{t.technical.stanceLabel}</span>
            <VerdictPill verdict={verdict} label={verdictLabel(verdict, t)} size="custom" className={styles.stancePill} />
            {change && <span className={cn(styles.change, changeToneClass(verdict))}>{change}</span>}
          </div>
          </div>
          {/* İKİ KÜNYE AYNI IZGARADA (24 Eylül) → ŞERİT (8 Kasım). "Bu Yayın"
              ve "Sıradaki Yayın" bir tanım listesiydi (solda ad, sağda dilim ve
              saat aynı sütunlarda; tarih yalnız bugün değilse). Sahibi bu
              kısmı özellikle "kötü görünüyor" diye işaretledi: 1440'ta kalan
              süre ("1 g 2 sa Sonra") sütuna sığmayıp tek başına ikinci satıra
              düşüyordu ve üç günlük nöbetten hangisinde olunduğu
              görünmüyordu. Artık /teknik kapağıyla AYNI bileşen: yayın
              gününün üç nöbeti, bu yayın işaretli, sıradaki yayın (başka
              güne düşüyorsa ayrı düğüm) ve kalan süre başlık satırının
              sağında. SIRADAKİ YAYIN okuyucunun ikinci sorusu: elindeki görüş
              NE KADAR SÜRE geçerli — cuma akşamı "pazartesi sabaha kadar
              böyle" bilgisi. Gerekçe ve ölçüm `EditionTrack`te. */}
          <div className={styles.coverTrack}>
            <EditionTrack edition={row} next={next} variant="current" locale={locale} t={t} />
          </div>
        </div>
        <div className={styles.coverThesis}>
          <span className={styles.thesisLabel}>{t.technical.thesisLabel}</span>
          <p className={styles.coverHeadline} lang={copyLang}>{tieFigures(copy.headline)}</p>
        </div>

        {locale === "en" && !hasEnglish && (
          <p className="text-small text-muted">{t.technical.langNote}</p>
        )}
      </div>

      <div className={styles.coverSide}>
        <div className={styles.coverQuote}>
          <div className={styles.priceHead}>
            <span className={styles.priceLabel}>{priceLabel}</span>
            {priceBadge && <span className={styles.delayBadge}>{priceBadge}</span>}
          </div>
          <div className={styles.priceRow}>
            <span className={cn(styles.priceNow, "numeral")}>
              {formatPrice(price, locale, { currency: true })}
            </span>
            {changePct !== null && (
              <span className={cn("numeral text-lead font-semibold", directionText(directionOf(changePct)))}>
                {formatPercent(changePct, locale)}
              </span>
            )}
          </div>
          {/* Analiz anındaki fiyat ancak FARKLIYSA yazılıyor: aynı sayının
              iki etiketle yan yana durması bilgi değil. */}
          <div className={styles.priceContext}>
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
        </div>
        {/* SEVİYE ÇİZGİSİ BURADAN KALKTI — aynı plan sayfada ÜÇ KEZ
            çiziliyordu: plan şeridi sayılarla, çizgi yatay eksende, fiyat
            haritası dikey eksende. Üçünün de kaynağı aynı beş sayı.
            Çizgi `aria-hidden` ve etiketsiz: ekranda soluk bir ray,
            yeşil bir kapsül, mavi bir nokta ve iki çentik duruyordu —
            okuyucunun gördüğü şey bir ölçü değil, bozuk bir sürgü
            denetimi. Aynı bilgiyi harita adlarıyla, fiyatlarıyla ve
            uzaklıklarıyla zaten veriyor.
            Liste kartında DURUYOR: orada harita yok, çizgi planın tek
            geometrisi (`TechnicalCard`).
            8 Kasım: kapağa yine bir eksen geldi ama bu kayda uyarak —
            ETİKETLİ (her işaretin adı ve fiyatı yazılı) ve sağ kolonda değil
            plan bandının tepesinde, kartların sayılarını tek çizgide okutan
            bir ölçek (`LevelScale`). Gerekçe orada. */}
        <div className={styles.reading} data-tone={planReadingTone(reading)}>
          <span className={styles.readingLabel}>{t.technical.readingLabel}</span>
          <p>{planReadingText(reading, locale, t)}</p>
          {/* Plan cümlesi görüşü varsayıyor; anlamını soran okuyucu
              bir tık aşağıda, aynı sayfada cevabı buluyor. */}
          <a href="#technical-stance" className={cn("tap-44", styles.stanceGuideLink)}>
            {t.technical.stanceGuide.detailTitle.replace("{stance}", verdictLabel(verdict, t))}
          </a>
        </div>
        <SignalStrip snapshot={row.snapshot} price={price} locale={locale} t={t} compact />
      </div>

      {/* 21 Eylül: mobil kapak 1045px'ti. Plan tam genişlikte kendi
          bandında; gösterge özeti ayrıntılarını anlattığı bölüme indi.
          Böylece ilk ekran kimliği, görüşü ve planı birlikte okutur.

          ÖZET SONRA KAPAĞA GERİ GELDİ — ama aynı biçimde değil. 9e1c3b6
          kapağa `compact` dalı ekledi: üç sütun, tek satırlık okuma,
          kapak sütununun dibine hizalı (`.signalsCompact`). Bölümdeki
          geniş şerit yerinde duruyor; kapaktaki bir BAKIŞ, oradaki bir
          ÖLÇÜ. Bu not bir süre yalnızca inişi anlatıyordu ve kodla
          çelişiyordu; iki hâl de burada yazılı olsun. */}
      {/* BÖLGESİZ TUT'TA İKİ GRİ KUTU YERİNE EKSEN (31 Ekim). "Nereden
          Alınır — Bölge Yok · Destek" ve "Nerede Satılır — Direnç" iki
          boş kalıptı; artık durumun adı, büyük destek—fiyat—direnç ekseni
          ve iki seviye kartı (gerekçe `OpenRange`). Koşul cümlesi hemen
          üstteki "Planın Okuması"nda. */}
      <div className={styles.coverPlan}>
        {openRange ? (
          <OpenRange {...openRange} size="lg" priceLabel={priceLabel} locale={locale} t={t} />
        ) : (
          <>
            {/* Kartların üstünde aynı sayılar tek eksende — gerekçe
                `LevelScale`. Bölgesiz TUT'un kendi ekseni var (`OpenRange`). */}
            <LevelScale price={price} {...levelProps} verdict={verdict} priceLabel={priceLabel} locale={locale} t={t} />
            <PlanStrip verdict={verdict} {...levelProps} size="lg" price={price} locale={locale} t={t} />
          </>
        )}
      </div>
    </header>
  );
}
