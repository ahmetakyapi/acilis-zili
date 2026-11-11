import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MorphTarget } from "@/components/motion/Morph";
import { LogoTile } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
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
import { PlanRail } from "./PlanRail";
import { PlanStrip } from "./PlanStrip";
import { SignalStrip } from "./SignalStrip";
import { changeToneClass, planPositionLabel, planReadingText, planReadingTone } from "./TechnicalCard";
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
    <header className={cover.root} data-verdict={verdict}>
      {/* ---- 1. satır: kimlik + görüş | fiyat ---- */}
      <div className={cover.row}>
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
              <h1>{symbol}</h1>
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

      {/* ---- 2. satır: gerekçe | planın okuması ---- */}
      <div className={cover.row}>
        <div className={cn(cover.cell, cover.thesis)}>
          <span className={cover.label}>{t.technical.thesisLabel}</span>
          <p className={cover.headline} lang={copyLang}>{tieFigures(copy.headline)}</p>
          {locale === "en" && !hasEnglish && (
            <p className="text-small text-muted">{t.technical.langNote}</p>
          )}
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
        <div className={cn(cover.cell, cover.reading)} data-tone={planReadingTone(reading)}>
          <span className={cover.label}>{t.technical.readingLabel}</span>
          <p>{planReadingText(reading, locale, t)}</p>
          {/* Plan cümlesi görüşü varsayıyor; anlamını soran okuyucu
              bir tık aşağıda, aynı sayfada cevabı buluyor. */}
          <a href="#technical-stance" className={cn("tap-44", styles.stanceGuideLink)}>
            {t.technical.stanceGuide.detailTitle.replace("{stance}", verdictLabel(verdict, t))}
          </a>
        </div>
      </div>

      {/* ---- 3. satır: plan (ana görsel) ---- */}
      {/* 21 Eylül: mobil kapak 1045px'ti. Plan tam genişlikte kendi
          bandında; gösterge özeti ayrıntılarını anlattığı bölüme indi.
          Böylece ilk ekran kimliği, görüşü ve planı birlikte okutur.

          ÖZET SONRA KAPAĞA GERİ GELDİ — ama aynı biçimde değil. 9e1c3b6
          kapağa `compact` dalı ekledi: üç sütun, tek satırlık okuma
          (`.signalsCompact`). Bölümdeki geniş şerit yerinde duruyor;
          kapaktaki bir BAKIŞ, oradaki bir ÖLÇÜ. 10 Kasım: bakış kapağın
          son satırına, yayın şeridinin yanına indi (yukarıdaki defter). */}
      {/* BÖLGESİZ TUT'TA İKİ GRİ KUTU YERİNE EKSEN (31 Ekim). "Nereden
          Alınır — Bölge Yok · Destek" ve "Nerede Satılır — Direnç" iki
          boş kalıptı; artık durumun adı, büyük destek—fiyat—direnç ekseni
          ve iki seviye kartı (gerekçe `OpenRange`). Koşul cümlesi hemen
          üstteki "Planın Okuması"nda. */}
      <div className={cn(styles.coverPlan, cover.plan)} data-draw>
        {openRange ? (
          <OpenRange {...openRange} size="lg" priceLabel={priceLabel} locale={locale} t={t} />
        ) : (
          <>
            {/* Kartların üstünde aynı sayılar tek eksende — gerekçe
                `LevelScale`. Bölgesiz TUT'un kendi ekseni var (`OpenRange`). */}
            <LevelScale price={price} {...levelProps} verdict={verdict} priceLabel={priceLabel} locale={locale} t={t} />
            {/* TELEFONDA KARTIN RAYI (10 Kasım). Etiketli ölçek 768'in altında
                gizli (yedi etiket 354 piksele sığmıyor) ve kapak telefonda
                yalnız rakamdı: seviyelerin fiyata göre NEREDE durduğu
                görünmüyordu — liste kartı için 25 Ekim'de verilen kararın
                ("ray katlanmaz, planın tek geometrisi") kapaktaki eksiği.
                Listeden gelen okur aynı rayı, aynı risk/getiri bacaklarıyla
                buluyor; bacaklar aynı sayıları taşıdığı için kapağın risk
                karşılaştırması telefonda basılmıyor (CSS `.coverRail`). */}
            <div className={styles.coverRail}>
              <PlanRail verdict={verdict} price={price} snapshotPrice={null} {...levelProps} locale={locale} t={t} />
            </div>
            <PlanStrip verdict={verdict} {...levelProps} size="lg" price={price} locale={locale} t={t} />
          </>
        )}
      </div>

      {/* ---- 4. satır: yayın şeridi | gösterge bakışı ---- */}
      <div className={cover.row}>
        {/* İKİ KÜNYE AYNI IZGARADA (24 Eylül) → ŞERİT (8 Kasım). "Bu Yayın"
            ve "Sıradaki Yayın" bir tanım listesiydi (solda ad, sağda dilim ve
            saat aynı sütunlarda; tarih yalnız bugün değilse). Sahibi bu
            kısmı özellikle "kötü görünüyor" diye işaretledi: 1440'ta kalan
            süre ("1 g 2 sa Sonra") sütuna sığmayıp tek başına ikinci satıra
            düşüyordu ve üç günlük nöbetten hangisinde olunduğu
            görünmüyordu. Artık /teknik-analiz kapağıyla AYNI bileşen: yayın
            gününün üç nöbeti, bu yayın işaretli, sıradaki yayın (başka
            güne düşüyorsa ayrı düğüm) ve kalan süre başlık satırının
            sağında. SIRADAKİ YAYIN okuyucunun ikinci sorusu: elindeki görüş
            NE KADAR SÜRE geçerli — cuma akşamı "pazartesi sabaha kadar
            böyle" bilgisi. Gerekçe ve ölçüm `EditionTrack`te.
            10 Kasım: şerit adın altından kapağın son satırına indi — künye,
            cevaplardan sonra. */}
        <div className={cn(cover.cell, cover.track)}>
          <EditionTrack edition={row} next={next} variant="current" locale={locale} t={t} />
        </div>
        <div className={cn(cover.cell, cover.signals)}>
          <SignalStrip snapshot={row.snapshot} price={price} locale={locale} t={t} compact />
        </div>
      </div>
    </header>
  );
}
