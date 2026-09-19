import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { distancePct, formatRange, ladderOf, priceMapLayout, type MapRung, type TechnicalCopy } from "@/lib/technical";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./Technical.module.css";

/** Etiket başına ayrılan dikey yer. Bütün satırlar aynı yükseklikte. */
const ROW_GAP = 46;
/** Stopun altındaki bölgeye ayrılan dip şeridi — künyesi de içinde. */
const VOID_STRIP = 34;
const MIN_HEIGHT = 360;
const MAX_HEIGHT = 720;

/**
 * Fiyat haritası — seviyeler dikey eksende, fiyata ORANTILI.
 *
 * Merdivenin (eşit aralıklı satırlar) yerine geldi. Orada 2 dolar uzaktaki
 * destek ile 20 dolar uzaktaki hedef aynı mesafede duruyordu ve "hedef uzak,
 * stop yakın" bilgisi yalnızca yüzde sütununda yaşıyordu. Haritada her
 * seviye kendi yerinde: alım bölgesi haritayı boydan boya geçen bir kuşak,
 * stopun altı soluk kırmızı bir alan (plan orada geçersiz), şu anki fiyat
 * eksendeki tek nokta. Sıra ve uzaklık ilk bakışta okunuyor.
 *
 * Ölçek `priceMapLayout` içinde ESNİYOR: birbirine yapışık seviyeler
 * ayrılıyor, uzak olanların arası korunuyor ve her etiket kendi çentiğinin
 * hizasında kalıyor. Bağ çizgisi yok, çünkü bağlanacak iki ayrı nokta yok.
 *
 * NOTLAR HARİTANIN İÇİNDE DEĞİL ALTINDA. Bir dönem her not kendi seviyesinin
 * satırına giriyordu ve satırlar ÇAKIŞIYORDU: itme algoritması her satıra
 * sabit `ROW_GAP` ayırıyor ama notlu bir satır 390 pikselde üç satıra
 * sarıp 104 piksele çıkıyordu (ölçüldü: dört çakışma, en kötüsü 39 piksel;
 * "Alım Bölgesi"nin notu "Stop"un fiyatının üstüne biniyordu). Notun
 * yüksekliği sarmaya, sarma genişliğe bağlı — sunucu bunu bilemez, yani
 * sabit bir pay vermek tahmin olurdu. Haritanın işi sıralama ve uzaklık;
 * "bu seviye nereden geldi" bir cümle ve cümlenin yeri listedir. Artık her
 * satır aynı yükseklikte (33 piksel) ve 46 piksellik ayrım her zaman yeter.
 *
 * Yükseklik satır sayısından hesaplanıyor (ölçmeye gerek yok): her satıra
 * `ROW_GAP` piksel, alt sınır 360, üst 720. Uzaklık fiyattan seviyeye
 * (LevelLadder'daki gerekçe): hedef için artı, stop için eksi.
 */
export function PriceMap({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  copy,
  verdict,
  priceLabel,
  lang,
  locale,
  t,
}: {
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  copy: TechnicalCopy;
  verdict: VerdictKey;
  priceLabel: string;
  /** Notların dili — İngilizce sayfada çevrilmemiş metin Türkçe okunur. */
  lang: string;
  locale: Locale;
  t: Dictionary;
}) {
  const levels = ladderOf({ entryLow, entryHigh, stop, targets, supports, resistances });
  if (levels.length + (price !== null ? 1 : 0) < 2) return null;

  const rows = levels.length + (price !== null ? 1 : 0);
  /* STOP ALTI ŞERİDİ YERLEŞİMİN DIŞINDA. Yükseklik son satırdan hemen sonra
     bitiyordu ve stopun altındaki kırmızı alan iki piksele sıkışıp yalnız
     bir kesikli çizgi olarak kalıyordu (ölçüldü: 1769–1771). Haritayı
     büyütmek tek başına çözmedi: yerleşim boyu ne verilirse satırları ona
     yayıyor, yani şerit yine kapanıyordu. Satırlar KISA boya yerleşiyor,
     kutu şerit kadar UZUN çiziliyor; aradaki fark stopun altına kalıyor. */
  const layoutHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rows * ROW_GAP + 40));
  const height = layoutHeight + (stop !== null ? VOID_STRIP : 0);
  const { rungs, scale } = priceMapLayout(levels, price, { height: layoutHeight, gap: ROW_GAP });
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const sellSide = verdict === "sell";

  const labelOf = (rung: MapRung): string => {
    switch (rung.kind) {
      case "target":
        return (sellSide ? t.technical.sellLevel : t.technical.target).replace("{n}", String(rung.order ?? 1));
      case "resistance":
        return t.technical.resistance;
      case "entry":
        return t.technical.entryZone;
      case "support":
        return t.technical.support;
      case "stop":
        return t.technical.stop;
      case "price":
        return priceLabel;
    }
  };

  /* Notlar seviye sırasına göre: hedefler, alım bölgesi, stop. Yalnızca
     yazılmış olanlar listeye giriyor; hiçbiri yoksa liste hiç basılmıyor. */
  const noteList = rungs
    .map((rung) => ({
      /* Hedef notu ÜÇ hedefi birden anlatıyor ("ilk iki hedef … üçüncüsü …")
         ama ilk hedefin satırına bağlı; "Hedef 1" diye etiketlenince not
         yalnız o seviyeyi tarif ediyormuş gibi okunuyordu. */
      label: rung.kind === "target" ? (sellSide ? t.technical.planTargets : t.technical.targetsLabel) : labelOf(rung),
      text: noteOf(rung, copy),
    }))
    .filter((item): item is { label: string; text: string } => item.text !== null);

  const entryTop = entryLow !== null && entryHigh !== null ? scale(entryHigh) : null;
  const entryBottom = entryLow !== null && entryHigh !== null ? scale(entryLow) : null;
  /* STOP ALTI BÖLGESİ SATIRIN ALTINDAN BAŞLIYOR, ORTASINDAN DEĞİL.
     Kesikli kenar `scale(stop)`tan çizilince stop satırının tam ortasından
     geçiyor ve yazının üstünü çiziyordu (ölçüldü, 390). Bölgenin anlamı
     "bu satırın ALTINDA kalan her şey"; sınırı da satırın alt kenarı. */
  const stopRung = rungs.find((rung) => rung.kind === "stop");
  const stopY = stopRung ? stopRung.markY + ROW_GAP / 2 : null;
  const priceY = price !== null ? scale(price) : null;

  const kindOf = (rung: MapRung) =>
    rung.kind === "target" && sellSide ? "sellLevel" : rung.kind;

  return (
    <>
    {/* SÜTUN BAŞLIĞI HARİTANIN İÇİNDE. "Fiyata Uzaklık" bölüm başlığının
        sağ ucunda duruyordu ve orası panelin tam genişliği; harita 460
        pikselle sınırlanınca başlık yüzde sütununun 300 piksel sağında
        kaldı (1440'ta ölçüldü) ve neyi anlattığı okunmaz oldu. Artık
        haritanın kendi sağ kenarına hizalı: satırın sağ dolgusu 14 piksel,
        başlığınki de öyle, yani yüzdelerle aynı hatta biter. */}
    <p className={styles.mapHead}>{t.technical.levelsNote}</p>
    <div className={styles.map} style={{ height }} data-verdict={verdict}>
      {/* ---- Bölgeler: alım bandı ve stop altı ----
          Haritanın TAMAMINA yayılıyorlar, 27 piksellik ray şeridine değil.
          Şeritteyken ikisi de birer işaretti; oysa bunlar seviye değil
          ALAN: "şu fiyatla şu fiyat arası" ve "şu fiyatın altı". Bir grafik
          bunu nasıl gösteriyorsa öyle — arkaya serilmiş soluk bir kuşak,
          üstünde satırlar. Yan fayda: alım bölgesi ve stop satırlarının
          kendi zeminine gerek kalmıyor, satır zaten bandın içinde duruyor.

          Kuşağın altında DİKEY bir "Plan Geçersiz" yazısı vardı ve
          haritanın en karmaşık öğesiydi. Ölçüldü: 10 puntoluk yazı 25
          piksellik şeritte 75 piksel yer istiyor; yatay hâline haritada yer
          yok — bölgenin üst ucunda stop satırı, altında öteki satırlar var
          (satır aralığı 46, satır yüksekliği 34, arada 12 piksel kalıyor).
          Bilgi zaten stop satırının kendisinde ve kırmızı kuşak onu
          tekrarlıyor. */}
      {/* `aria-hidden` KUŞAKLARIN TAMAMINDA DEĞİL. Alım bandı bir çizim,
          ekran okuyucuya söyleyecek bir şeyi yok; stop altı kuşağının
          künyesi ise bir CÜMLE ve başka hiçbir yerde geçmiyor. Kapsayıcıyı
          bütünüyle gizlemek o cümleyi de götürüyordu. */}
      <div className={styles.mapZones}>
        {stopY !== null && (
          /* BÖLGE ADINI SÖYLÜYOR. Kuşak bir süre sessizdi: stop satırının
             altında kesikli bir çizgi ve solan kırmızı bir alan vardı,
             hiçbir yerinde ne olduğu yazmıyordu (ölçüldü, 390: 28 piksellik
             boş bir şerit). Okuyucu kırmızıdan "kötü" çıkarıyor ama NE
             olduğunu çıkaramıyor.

             Bir dönem burada DİKEY bir "Plan Geçersiz" yazısı vardı ve
             haritanın en karmaşık öğesi olduğu için kaldırılmıştı — o karar
             25 piksellik RAY ŞERİDİ için verilmişti, kuşak o zaman eksenin
             içindeydi. Kuşak artık haritanın tamamına yayılıyor ve yatay bir
             künye rahat sığıyor: gerekçe ortadan kalktı, karar değişti.

             Künye satır etiketleriyle aynı hatta (`left:52px` + satır
             dolgusu), yani "Stop"un tam altında okunuyor. */
          <span className={styles.mapZoneVoid} style={{ top: stopY }}>
            <span className={styles.mapZoneVoidLabel}>{t.technical.zoneBelowStop}</span>
          </span>
        )}
        {entryTop !== null && entryBottom !== null && (
          <span
            aria-hidden
            className={styles.mapZoneEntry}
            style={{ top: entryTop, height: Math.max(6, entryBottom - entryTop) }}
          />
        )}
      </div>

      {/* ---- Eksen: çizgi, çentikler ---- */}
      <div className={styles.mapRail} aria-hidden>
        <span className={styles.mapLine} />
        {/* ÇENTİK, NOKTA DEĞİL. Noktalar 14 piksel çapındaydı ve eksen fiyata
            orantılı: MU'da direnç (930,88), son fiyat (929,53) ve ilk hedef
            (926,44) 6 ve 13 piksel arayla düşüyor (ölçüldü), yani üç nokta
            iç içe geçip tek bir lekeye dönüşüyordu. Çentik yatay ve 3 piksel
            kalın: aynı üç seviye artık bir cetvelin yakın gradasyonları gibi
            okunuyor, çakışma diye bir şey kalmıyor. Yakınlık gizlenmiyor,
            DOĞRU gösteriliyor. */}
        {rungs
          .filter((rung) => rung.kind !== "price" && rung.kind !== "entry")
          .map((rung) => (
            <span
              key={`tick-${rung.kind}-${rung.price}`}
              className={styles.mapTick}
              data-kind={kindOf(rung)}
              style={{ top: rung.markY }}
            />
          ))}
        {/* Eksendeki TEK nokta şu anki fiyat: "buradasın" işareti başka hiçbir
            şeye benzemiyor ve panel renginde bir halkayla komşu çentiklerden
            ayrılıyor. */}
        {priceY !== null && <span className={styles.mapHere} style={{ top: priceY }} />}
      </div>

      {/* KILAVUZ ÇİZGİSİ KALKTI. Etiket artık kendi çentiğinin tam
          hizasında (ölçek esniyor, bkz. `priceMapLayout`), yani bağlanacak
          iki ayrı nokta yok. Telefonda o katman 23 piksel genişti ve
          dört-beş neredeyse dikey çizgi taşıyordu; haritanın en karmaşık
          parçasıydı ve hiçbir bilgi taşımıyordu — hangi çentiğin hangi
          satıra ait olduğunu artık ortak hiza söylüyor. */}

      {/* ---- Basamaklar ---- */}
      <ol className={styles.mapRungs}>
        {rungs.map((rung) => {
          const kind = kindOf(rung);
          const reference = rung.kind === "entry" && rung.high !== undefined ? rung.high : rung.price;
          const distance = rung.kind === "price" ? null : distancePct(reference, price);
          const value =
            rung.kind === "entry" && rung.high !== undefined
              ? formatRange(rung.price, rung.high, locale)
              : money(rung.price);
          const crossed = crossedState(rung.kind, distance);
          return (
            <li key={`${rung.kind}-${rung.price}`} className={styles.mapRung} data-kind={kind} style={{ top: rung.labelY }}>
              <span className={styles.mapLabel}>{labelOf(rung)}</span>
              <span className={cn(styles.mapPrice, "numeral")}>{value}</span>
              <span className={styles.mapDistance}>
                {crossed && (
                  <b className={styles.mapCrossed} data-state={crossed}>
                    {crossed === "passed" ? t.technical.levelPassed : t.technical.levelBroken}
                  </b>
                )}
                {distance !== null && (
                  /* YÜZDE YÖNÜNÜ RENKLE DE SÖYLÜYOR. Sütun tek tonda
                     duruyordu ve haritanın kendi dili zaten renkliydi:
                     fiyatın ÜSTÜNDEKİ çentikler yeşil, ALTINDAKİLER
                     kırmızı. Aynı satırın yüzdesi nötr kalınca bir seviyenin
                     hangi tarafta olduğu iki ayrı yerden (çentiğin rengi ve
                     sayının işareti) okunuyordu. Artık ikisi aynı şeyi
                     söylüyor: artı yukarısı, eksi aşağısı.

                     Renk TEK TAŞIYICI DEĞİL — `formatPercent` işareti
                     kendisi yazıyor, yani yön renk körlüğünde de okunuyor
                     (deponun her yerindeki kural).

                     Geçilmiş bir hedefte yeşil "Geçildi" rozetinin yanında
                     kırmızı bir yüzde durabiliyor ve bu bir çelişki değil,
                     iki ayrı soru: rozet "ulaşıldı mı", yüzde "şimdi ne
                     tarafta". */
                  <span
                    className="numeral"
                    data-dir={distance > 0 ? "up" : distance < 0 ? "down" : "flat"}
                  >
                    {formatPercent(distance, locale, 1)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
    {noteList.length > 0 && (
      /* Tanım listesi: terim seviyenin adı, tanım nereden geldiği. Dar
         ekranda alt alta, geniş ekranda iki sütun — makale kutularındaki
         `**Etiket:**` kalıbıyla aynı okuma biçimi. */
      <dl className={styles.mapNotes} lang={lang}>
        {noteList.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.text}</dd>
          </div>
        ))}
      </dl>
    )}
    </>
  );
}

/**
 * Fiyat bu seviyeyi GEÇTİ Mİ — ve geçmesi ne anlama geliyor?
 *
 * Uzaklık sütunu yönü işaretin ARTI/EKSİ oluşuna göre renklendiriyordu ve o
 * renk bu haritada ters okunuyor: ekranda "Hedef 1 · 208,16 $ · −%1,7"
 * KIRMIZI duruyordu, oysa fiyatın ilk hedefi geçmiş olması planın iyi
 * gitmesi demek. Aynı kural stopta doğru çalışıyordu (stop yukarıda kalmışsa
 * kırmızı) — yani tek bir işaret kuralı iki zıt anlamı birden taşıyamıyor.
 *
 * Yön artık HARİTANIN KENDİSİNDE: satır fiyat satırının üstündeyse seviye
 * yukarıda, altındaysa aşağıda. Sütun yalnızca mesafeyi söylüyor ve rengi
 * nötr. Geçilmiş seviyeye ayrıca tek kelimelik bir işaret düşüyor, çünkü
 * geçilmek seviyenin ANLAMINI değiştiriyor: hedef gerçekleşti, stop
 * kırıldı — ikisi de plana dair bir haber.
 */
function crossedState(
  kind: string,
  distance: number | null,
): "passed" | "broken" | null {
  if (distance === null) return null;
  /* Hedef ve direnç fiyatın ALTINA düştüyse geçilmiştir; stop ve destek
     fiyatın ÜSTÜNDE kaldıysa kırılmıştır. Alım bölgesinin iki ucu var ve
     fiyatın bölgeye göre yeri kapakta zaten tek bir çiple yazılı. */
  if (kind === "target" || kind === "resistance") {
    return distance < 0 ? "passed" : null;
  }
  if (kind === "stop" || kind === "support") {
    return distance > 0 ? "broken" : null;
  }
  return null;
}

function noteOf(level: { kind: string; order?: number }, copy: TechnicalCopy): string | null {
  if (level.kind === "entry") return copy.entryNote ?? null;
  if (level.kind === "stop") return copy.stopNote ?? null;
  if (level.kind === "target" && level.order === 1) return copy.targetsNote ?? null;
  return null;
}
