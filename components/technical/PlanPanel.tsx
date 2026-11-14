import { verdictLabel, verdictOf } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import { planReading, type TechnicalSlot } from "@/lib/technical";
import { cn } from "@/lib/utils";
import { EditionTrack } from "./EditionTrack";
import { OpenRange, openRangeOf } from "./OpenRange";
import { PlanRail } from "./PlanRail";
import { PlanStrip } from "./PlanStrip";
import { planReadingText, planReadingTone } from "./card-text";
import styles from "./TechnicalPlan.module.css";
import parts from "./TechnicalParts.module.css";
import panel from "./PlanPanel.module.css";

/**
 * PLAN PANELİ: okuma cümlesi + plan kartları | yayın şeridi (14 Kasım 2026).
 *
 * Kapaktan indi (`TechnicalCover` → "KAHRAMAN"): kapak artık kimlik, görüş,
 * fiyat ve grafik. Okurun ikinci sorusu ("peki plan ne: nereden alınır,
 * nerede satılır, nerede vazgeçilir") kahramanın hemen altında, kendi
 * panelinde; künye (bu yayın ve sıradaki yayın) panelin sağ kolonunda.
 * İçerik aynı bileşenler (`PlanStrip`, `OpenRange`, `EditionTrack`), yalnız
 * yeri değişti; aşağıdaki kayıtlar kapaktan aynen taşındı. Ölçüm CSS'te.
 */
export function PlanPanel({
  row,
  price,
  priceLabel,
  next,
  hasChart,
  locale,
  t,
}: {
  row: TechnicalAnalysisRow;
  price: number | null;
  priceLabel: string;
  next: { at: Date; slot: TechnicalSlot } | null;
  /** Kapakta fiyat grafiği basıldı mı: basıldıysa telefonda kart rayı gerekmez. */
  hasChart: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const verdict = verdictOf(row.stance);
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
    <section id="technical-plan" className={panel.root} aria-labelledby="technical-plan-title">
      <div className={panel.main}>
        <div className={panel.head} data-tone={planReadingTone(reading)}>
          <h2 id="technical-plan-title" data-ink="plain" className={panel.title}>{t.technical.readingLabel}</h2>
          {/* Plan cümlesi görüşü varsayıyor; anlamını soran okuyucu
              bir tık aşağıda, aynı sayfada cevabı buluyor. */}
          <a href="#technical-stance" className={cn("tap-44", parts.stanceGuideLink)}>
            {t.technical.stanceGuide.detailTitle.replace("{stance}", verdictLabel(verdict, t))}
          </a>
        </div>
        <p className={panel.reading}>{planReadingText(reading, locale, t)}</p>

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
            bir ölçek (`LevelScale`). Gerekçe orada.
            14 Kasım: aynı kural bir adım daha — ölçek ile merdiven İKİSİ
            birden kalktı, seviyeler kapaktaki fiyat grafiğinin ekseninde
            (`PriceChart`); ölçek yalnız grafik basılamadığında kapakta. */}
        {/* 21 Eylül: mobil kapak 1045px'ti. Plan tam genişlikte kendi
            bandında; gösterge özeti ayrıntılarını anlattığı bölüme indi.
            Böylece ilk ekran kimliği, görüşü ve planı birlikte okutur.

            ÖZET SONRA KAPAĞA GERİ GELDİ — ama aynı biçimde değil. 9e1c3b6
            kapağa `compact` dalı ekledi: üç sütun, tek satırlık okuma
            (`.signalsCompact`). Bölümdeki geniş şerit yerinde duruyor;
            kapaktaki bir BAKIŞ, oradaki bir ÖLÇÜ. 10 Kasım: bakış kapağın
            son satırına, yayın şeridinin yanına indi.
            14 Kasım: bakış kapaktan KALKTI (görsel tur: tepe panelde yedi
            blok, hiyerarşi yok). Aynı üç ölçü "Göstergeler" bölümünün
            özet şeridinde duruyor; `SignalStrip`in `compact` dalı artık
            buradan çağrılmıyor. */}
        {/* BÖLGESİZ TUT'TA İKİ GRİ KUTU YERİNE EKSEN (31 Ekim). "Nereden
            Alınır — Bölge Yok · Destek" ve "Nerede Satılır — Direnç" iki
            boş kalıptı; artık durumun adı, büyük destek—fiyat—direnç ekseni
            ve iki seviye kartı (gerekçe `OpenRange`). Koşul cümlesi hemen
            üstteki "Planın Okuması"nda. */}
        <div className={cn(styles.coverPlan, panel.strip)} data-draw>
          {openRange ? (
            <OpenRange {...openRange} size="lg" priceLabel={priceLabel} locale={locale} t={t} />
          ) : (
            <>
              {/* TELEFONDA KARTIN RAYI (10 Kasım). Etiketli ölçek 768'in altında
                  gizli (yedi etiket 354 piksele sığmıyor) ve kapak telefonda
                  yalnız rakamdı: seviyelerin fiyata göre NEREDE durduğu
                  görünmüyordu — liste kartı için 25 Ekim'de verilen kararın
                  ("ray katlanmaz, planın tek geometrisi") kapaktaki eksiği.
                  Listeden gelen okur aynı rayı, aynı risk/getiri bacaklarıyla
                  buluyor; bacaklar aynı sayıları taşıdığı için kapağın risk
                  karşılaştırması telefonda basılmıyor (CSS `.coverRail`).
                  14 Kasım: fiyat grafiği telefonda da basılıyor (260 piksel,
                  seviyeler ekseninde); ray yalnız grafik YOKKEN kalıyor. */}
              {!hasChart && (
                <div className={styles.coverRail}>
                  <PlanRail verdict={verdict} price={price} snapshotPrice={null} {...levelProps} locale={locale} t={t} />
                </div>
              )}
              <PlanStrip verdict={verdict} {...levelProps} size="lg" price={price} locale={locale} t={t} />
            </>
          )}
        </div>
      </div>

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
          cevaplardan sonra. 14 Kasım: plan panelinin sağ kolonu. */}
      <div className={panel.track}>
        <EditionTrack edition={row} next={next} variant="current" locale={locale} t={t} />
      </div>
    </section>
  );
}
