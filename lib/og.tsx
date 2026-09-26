import type { Locale } from "@/lib/i18n";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SESSION_BOUNDS } from "@/lib/market-hours";
import {
  BELL_BODY_PATH,
  BELL_CLAPPER,
  BELL_HANGER,
  BELL_LIP,
  BELL_VIEWBOX,
} from "@/components/brand/BellMark";

/**
 * Paylaşım görsellerinin ortak dili.
 *
 * Her rota kendi `opengraph-image.tsx`'ini yazıyor ama hepsi buradaki
 * çerçeveyi kullanıyor: aynı zemin, aynı marka kilidi, aynı alt şerit.
 * WhatsApp'ta bir bilanço linki ile bir rehber linki farklı şeyler
 * gösteriyor ama ikisi de aynı siteye ait olduğu bir bakışta belli.
 *
 * SATORI'NİN SINIRLARI — buradaki her tuhaflığın sebebi bu:
 * - CSS değişkeni çözmez. `var(--primary)` çalışmaz, renkler aşağıda SABİT
 *   yazılıyor ve kaynağı `app/globals.css` `:root` (ışık paleti).
 * - Birden fazla çocuğu olan her düğümde `display` açıkça yazılmalı.
 * - `gap` çalışır, `grid` çalışmaz; her şey flex.
 * - Font gömülü olmalı; sistem fontuna düşerse marka tipografisi kaybolur.
 *
 * BİLİNEN SINIR — İNGİLİZCE PAYLAŞIM KARTI. Kart metinleri artık sözlükten
 * geliyor ve istek `/en/...` altından gelirse İngilizce çiziliyor. Ama
 * sayfanın kendi `og:image` etiketi ÖNEKSİZ adresi yazıyor: dosya tabanlı
 * OG kuralında adresi Next üretiyor ve o, proxy'nin yeniden yazdığı iç yolu
 * (`/hisse/NVDA/opengraph-image-<id>`) kullanıyor. Yani `/en/hisse/NVDA`
 * paylaşıldığında tarayıcı önekSİZ adresi çekiyor ve Türkçe kartı alıyor.
 *
 * Denendi, olmadı: `metadataBase`i `/en` ile kurmak canonical'ı da
 * bozuyor (alternates göreli yol veriyor, taban iki kez ekleniyor);
 * `openGraph.images`i elle yazmak ise Next'in ürettiği `<id>` ve karma
 * sorgusunu bilmeyi gerektiriyor. Gerçek çözüm OG rotalarını `/en` altında
 * ikilemek; maliyeti faydasının şu an üstünde. Sayfanın BAŞLIĞI ve
 * AÇIKLAMASI iki dilli, doğru olmayan tek şey kartın içindeki metin.
 *
 * SONUCU: KART ROTALARI DİLİ İSTEKTEN OKUMUYOR.
 *
 * Yukarıdaki sınır yüzünden dört dinamik kart rotası (`hisse/[symbol]`,
 * `mercek/[slug]`, `rehber/[slug]`, `bilancolar/[symbol]/[period]`)
 * `getI18n()` çağırdığı hâlde ondan hiçbir zaman `en` alamıyordu: istek
 * öneksiz geliyor, paylaşım tarayıcısı da çerez taşımıyor. Yani çağrı
 * çıktıyı hiç değiştirmiyordu.
 *
 * Bu yüzden dört rota artık dili sabit alıyor (`DEFAULT_LOCALE`): çıktı bit
 * bit aynı, yalnızca istek başına yapılan iki gereksiz okuma (`headers()`,
 * `cookies()`) kalkıyor.
 *
 * ÖNBELLEK DENENDİ, İŞE YARAMADI — not düşülüyor ki bir daha denenmesin.
 * `export const revalidate` eklendi ve ölçüldü: dört rota derleme
 * çıktısında `prerender-manifest.json` → `dynamicRoutes` altına HİÇ
 * girmiyor, üretim sunucusunda yanıtlarda `x-nextjs-cache` başlığı hiç
 * çıkmıyor (öneksiz kardeşleri, ör. `/piyasalar/opengraph-image`, `HIT`
 * veriyor). Sebebi dinamik segment: Next, metadata görsel rotalarını üst
 * sayfanın `generateStaticParams`ından türetmiyor — `/rehber/[slug]`
 * sayfasının bu fonksiyonu VAR ve OG rotası yine önceden üretilmiyor.
 * Yani `revalidate` burada ölü yapılandırmaydı; kaldırıldı.
 *
 * Kart gerçekten önbelleklenecekse iki yol var: OG rotasının KENDİSİNE
 * `generateStaticParams` yazmak (hisse için 800 sembol × PNG, canlı fiyat
 * gösteren bir kartta anlamsız) ya da kartı bir Route Handler'a taşıyıp
 * `Cache-Control`ü elle vermek. İkisi de bugünkü faydanın üstünde.
 *
 * Kartların gerçekten İngilizcesi istendiğinde çözüm yine burada değil:
 * dilin adrese girmesi gerekiyor. O gün geldiğinde `params.locale` bu
 * rotalara kendiliğinden gelir ve sabit dil kaldırılır.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/* ---- Işık paleti (app/globals.css `:root`) ---- */
export const C = {
  page: "#f7f9fb",
  surface: "#ffffff",
  strong: "#101c2b",
  body: "#54677c",
  muted: "#75879a",
  primary: "#0d74c4",
  primaryDeep: "#0a5a9a",
  primarySoft: "#3a93d6",
  primaryWash: "#e7f1fa",
  primaryTint: "#f2f7fc",
  primaryFaint: "#c4dcf0",
  up: "#0f8f63",
  upWash: "#e4f4ee",
  down: "#ce2044",
  downWash: "#fae7eb",
  line: "#e5eaf0",
  lineSoft: "#eef2f6",
} as const;

/** Accent degradesi — kartın altındaki gün şeridinin seans bandı. */
export const BRAND_GRADIENT =
  "linear-gradient(145deg, #6fd0ff 0%, #2f95e8 46%, #124f9e 100%)";

/**
 * Marka işareti — mavi degrade karo, üstte parlaklık, beyaz zil.
 * Sitedeki `--mark-*` token'larının açık tema değerleri; Satori CSS
 * değişkeni okumuyor. Kaynak ve gerekçe: components/brand/BellMark.tsx
 */
export const MARK = {
  tile:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 50%), linear-gradient(150deg, #5cc4ff 0%, #1f86e0 48%, #0b3f86 100%)",
  edge: "rgba(255, 255, 255, 0.18)",
  ink: "#ffffff",
  lip: "#ffffff",
} as const;

/* ==========================================================================
   Font
   ========================================================================== */

/**
 * Marka fontu DEPODA (`assets/fonts`), Google'dan çekilmiyor.
 *
 * Çalışma anında `fonts.gstatic.com`'a gitmek her soğuk render'a bir ağ
 * turu ekliyor ve o istek başarısız olduğunda kart sessizce sistem fontuna
 * düşüyordu — yani paylaşım görseli, ağın keyfine göre başka bir yazı
 * karakteriyle çıkıyordu. İki dosya toplam ~190KB.
 */
let cached: { name: string; data: ArrayBuffer; weight: 400 | 700 }[] | null =
  null;

export async function ogFonts() {
  if (cached) return cached;
  const dir = join(process.cwd(), "assets", "fonts");
  const [regular, bold] = await Promise.all([
    readFile(join(dir, "SchibstedGrotesk-Regular.ttf")),
    readFile(join(dir, "SchibstedGrotesk-Bold.ttf")),
  ]);
  cached = [
    { name: "Schibsted", data: regular.buffer as ArrayBuffer, weight: 400 },
    { name: "Schibsted", data: bold.buffer as ArrayBuffer, weight: 700 },
  ];
  return cached;
}

/* ==========================================================================
   Parçalar
   ========================================================================== */

/**
 * Zil işareti — icon.svg ile aynı çizim, Satori'nin anladığı sadelikte.
 * `size` KARONUN boyu: görüş kutusu zili karonun içine kendisi yerleştiriyor
 * (BELL_VIEWBOX), çağıran ayrıca oran hesaplamıyor.
 */
export function BellGlyph({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={BELL_VIEWBOX} fill={MARK.ink}>
      <rect {...BELL_HANGER} />
      <path d={BELL_BODY_PATH} />
      <rect {...BELL_LIP} fill={MARK.lip} />
      <circle {...BELL_CLAPPER} />
    </svg>
  );
}

/* BÜYÜK HARF YOK (26 Eylül). Künyeler burada `upper()` ile büyük harfe
   çevriliyordu ("ABD PİYASA TAKİBİ", "AÇILIŞ"). Sitenin kuralı ise
   cümle olmayan her metnin Title Case yazılması; `.plate` da 24 Eylül'de
   büyük harften çıkmıştı ve kart onun gerisinde kalmıştı. Sözlükteki
   değerler zaten Title Case, kart onları olduğu gibi basıyor. Fonksiyonun
   dile göre büyütme notu (Türkçede `i`nin büyüğü `İ`) artık gereksiz. */

/** Marka kilidi — karo + ad. Her kartın sol üstünde aynı yerde. */
export function BrandLock({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18.67,
          display: "flex",
          backgroundImage: MARK.tile,
          boxShadow: `inset 0 0 0 1px ${MARK.edge}`,
        }}
      >
        <BellGlyph size={56} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: C.strong,
          }}
        >
          Açılış Zili
        </span>
        {label && (
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.01em",
              color: C.primary,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Gün şeridi — ürünün imzası.
 *
 * Kartın altında ince bir seans çizgisi: kapalı uçlar sessiz, seans bandı
 * accent. Sitedeki gün şeridinin (`components/today/DayFlow.tsx`) tek satıra
 * indirilmiş hâli; kartı marka olarak tanınır kılan şey bu.
 */
export function DayRailMark() {
  /* GERÇEK ORANLAR (26 Eylül). Şerit 150/640/250 piksellik keyfi parçalarla
     çiziliyordu; ana kartın etiketli rayı ise seansın gerçek oranlarını
     (ET 04:00–20:00 penceresinde açılış %34,4, kapanış %75) kullanıyor.
     İki kart aynı günü anlatsın diye bu şerit de aynı oranlarda. */
  const start = SESSION_BOUNDS.preMarketOpen;
  const span = SESSION_BOUNDS.afterHoursClose - start;
  const open = ((SESSION_BOUNDS.regularOpen - start) / span) * 100;
  const close = ((SESSION_BOUNDS.regularClose - start) / span) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", height: 8 }}>
      <div
        style={{
          width: `${open}%`,
          height: 8,
          borderTopLeftRadius: 99,
          borderBottomLeftRadius: 99,
          background: C.line,
        }}
      />
      <div style={{ width: `${close - open}%`, height: 8, backgroundImage: BRAND_GRADIENT }} />
      <div
        style={{
          width: `${100 - close}%`,
          height: 8,
          borderTopRightRadius: 99,
          borderBottomRightRadius: 99,
          background: C.line,
        }}
      />
    </div>
  );
}

/**
 * Yön üçgeni — ÇİZİLİYOR, yazılmıyor.
 *
 * Sitede yön `▲`/`▼` karakterleriyle veriliyor ama Schibsted Grotesk bu
 * geometrik şekilleri içermiyor: karta basınca yerine tofu kutusu (□)
 * çıkıyordu. Satori eksik glifi başka bir fonttan tamamlamıyor, o yüzden
 * şekil metin değil vektör.
 */
export function Tri({ up, color }: { up: boolean; color: string }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill={color}>
      <path d={up ? "M8 1l7 12H1z" : "M8 13L1 1h14z"} />
    </svg>
  );
}

/** Künye çipi — kartın alt satırındaki küçük etiketler. */
export function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "up" | "down";
}) {
  const map = {
    neutral: { bg: C.surface, fg: C.body, bd: C.line },
    primary: { bg: C.primaryWash, fg: C.primary, bd: C.primaryFaint },
    up: { bg: C.upWash, fg: C.up, bd: C.upWash },
    down: { bg: C.downWash, fg: C.down, bd: C.downWash },
  }[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        borderRadius: 12,
        background: map.bg,
        border: `1px solid ${map.bd}`,
        color: map.fg,
        fontSize: 22,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Kart iskeleti.
 *
 * Zemin sayfa grisi, üstünde beyaz belge yüzeyi — sitedeki karne dokusunun
 * aynısı. Sol üstte marka, ortada içerik, altta gün şeridi. `accent` sağ
 * üstteki büyük ölçüyü (skor halkası, fiyat, sembol) taşır.
 */
export function OgFrame({
  eyebrow,
  children,
  accent,
  footer,
  rail,
}: {
  eyebrow?: string;
  children: React.ReactNode;
  accent?: React.ReactNode;
  footer?: React.ReactNode;
  /** Alt şeridin yerine geçen ray — ana kart etiketli seans rayını basıyor. */
  rail?: React.ReactNode;
  /** Eski çağrı yerleri dil geçiriyordu; künye artık dönüştürülmediği için
      kullanılmıyor (bkz. yukarıdaki "BÜYÜK HARF YOK"). */
  locale?: Locale;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.page,
        padding: 40,
        fontFamily: "Schibsted",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 28,
          padding: "44px 52px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <BrandLock label={eyebrow} />
          {accent}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {children}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {footer && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {footer}
            </div>
          )}
          {rail ?? <DayRailMark />}
        </div>
      </div>
    </div>
  );
}

/** Başlık — kartın taşıdığı asıl cümle. */
export function OgTitle({
  children,
  size = 66,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <div
      style={{
        fontSize: size,
        lineHeight: 1.06,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color: C.strong,
        display: "flex",
      }}
    >
      {children}
    </div>
  );
}

/** Alt açıklama — iki satırı geçmemeli, Satori kırpmıyor. */
export function OgDek({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 27,
        lineHeight: 1.35,
        color: C.body,
        display: "flex",
        maxWidth: 900,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Uzun metni kartta güvenli uzunluğa indirir.
 *
 * Satori satır kırpma (line-clamp) desteklemiyor: sığmayan metin kutudan
 * taşıp kartı bozuyor. Kesme kelime sınırında yapılıyor, sonuna tek nokta
 * üçlüsü konuyor.
 */
export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > max * 0.6 ? at : max).trimEnd()}…`;
}

/* ==========================================================================
   Bölüm kartı — tek şablon, her bölüm kendi metnini verir
   ========================================================================== */

/**
 * Piyasalar, Takvim, Şirketler gibi liste ekranlarının kartı.
 *
 * Bu ekranların paylaşımı bir içeriği değil bir BÖLÜMÜ işaret ediyor;
 * hepsi aynı iskeleti kullanıyor ve yalnızca başlık, açıklama ve künye
 * çipleri değişiyor. Her bölüm için ayrı bir tasarım yapmak, aynı sitenin
 * kartlarını birbirine yabancılaştırırdı.
 */
export function sectionOg({
  eyebrow,
  title,
  dek,
  chips,
}: {
  eyebrow: string;
  title: string;
  dek: string;
  chips?: string[];
}) {
  return (
    <OgFrame
      eyebrow={eyebrow}
      footer={
        chips && chips.length > 0 ? (
          <>
            {chips.map((c, i) => (
              <Chip key={c} tone={i === 0 ? "primary" : "neutral"}>
                {c}
              </Chip>
            ))}
          </>
        ) : undefined
      }
    >
      <OgTitle size={title.length > 24 ? 60 : 72}>{title}</OgTitle>
      <OgDek>{dek}</OgDek>
    </OgFrame>
  );
}
