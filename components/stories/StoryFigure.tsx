import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { parseBlocks, type Block } from "@/components/article/ArticleBody";
import { figureTone } from "@/components/stories/figure-tone";
import { cn, tieFigures, titleCaseLabel } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Mercek kartının görseli — YAZININ KENDİ BLOĞU.

   Burada bir süre manşetin sembolünden çizilen bir fiyat eğrisi duruyordu ve
   yanlıştı: sembol listesi yazının konusunu değil, yazıda ADI GEÇEN
   şirketleri sayıyor. Tahvil geri alımını anlatan bir yazının sembolleri QQQ
   ve SPY olabiliyor ve kartın yanında S&P 500'ün bir aylık kıvrımı
   beliriyordu — metinle ilgisi olmayan, üstelik "bu yazı bunu anlatıyor"
   diyen bir görsel. Yanlış bir görsel, görselsizlikten kötü.

   Oysa her mercek yazısı KENDİ görselini zaten taşıyor: gövdedeki `:::`
   blokları (CLAUDE.md → "yazıların görseli metinden çizilen bloklardır").
   Yazar o rakamları o yazı için seçiyor, yani ilgisiz olma ihtimali yok.
   Kart gövdenin ilk görsel bloğunu alıp kendi ölçüsünde çiziyor.

   Kart TÜM blok ailesini tanımıyor. Zaman çizelgesi ve akış şeması kart
   yüksekliğine sığmıyor, `grafik` ise ayrı bir veri çekimi istiyor; onlar
   atlanıp sıradaki uygun blok aranıyor. Hiç yoksa kart görselsiz basılıyor —
   uydurma bir görsel koymaktansa metin tek başına dursun.
   -------------------------------------------------------------------------- */

/** Kartın çizebildiği blok türleri — gövdedeki sırayla ilki alınır. */
const CARD_KINDS = ["stats", "shift", "share"] as const;
type CardKind = (typeof CARD_KINDS)[number];
export type StoryFigureBlock = Extract<Block, { kind: CardKind }>;

/** Karta sığan en fazla öğe; fazlası kutuyu bir tabloya çeviriyor. */
const MAX_ITEMS = 4;

function isCardBlock(block: Block): block is StoryFigureBlock {
  return (CARD_KINDS as readonly string[]).includes(block.kind);
}

/** Kartın çizeceği bloğun gövdedeki sırası; yoksa -1. */
export function storyFigureIndex(blocks: readonly Block[]): number {
  return blocks.findIndex(isCardBlock);
}

export function storyFigureOf(
  markdown: string | null | undefined,
  locale: string,
): StoryFigureBlock | null {
  if (!markdown) return null;
  const blocks = parseBlocks(markdown, locale);
  const index = storyFigureIndex(blocks);
  return index < 0 ? null : (blocks[index] as StoryFigureBlock);
}

/**
 * Kapaktaki blok gövdedekinin EKSİKSİZ kopyası mı?
 *
 * Yazı sayfası kapağında bu bloğu çiziyor ve gövde aynı dört rakamı hemen
 * aşağıda bir kez daha basıyordu (ölçüldü: 1440'ta kapakta 171, gövdede
 * 159 piksel; 390'da 207 + 233 — aynı 27.122,09 · +%12,53 · +%2,30 ·
 * 730 bin iki kez). Gövdedeki kopya ancak kapak bloğun TAMAMINI
 * gösteriyorsa düşürülüyor: `MAX_ITEMS`tan fazla öğesi olan rakam bloğunun
 * artanı yalnızca gövdede duruyor.
 *
 * Yalnızca `sayilar`. `oncesi` düşürülmüyor — kapak değişim yüzdesini
 * (`deltaPct`) basmıyor, gövde basıyor. `pay` da düşürülmüyor: kapak yazarın
 * ham değerini (`display`) yazıyor, gövde bütüne göre YÜZDEYİ; yazar mutlak
 * değer verdiyse iki çizim aynı bilgiyi taşımıyor.
 */
export function figureRepeatsBlock(block: Block): boolean {
  return block.kind === "stats" && block.items.length <= MAX_ITEMS;
}

export function StoryFigure({
  block,
  className,
  locale = "tr",
}: {
  block: StoryFigureBlock;
  className?: string;
  /** Künyelerin Title Case kuralı bu dilden (`titleCaseLabel`). */
  locale?: string;
}) {
  return (
    <figure
      data-kind={block.kind}
      className={cn(
        "flex min-w-0 flex-col",
        block.kind === "stats"
          ? /* RAKAM KAROLARININ KABI YÜZEYSİZ (8 Kasım). Yüzeyi her karo
               kendisi taşıyor; kabın da bir kutusu olunca kutu içinde
               kutu oluyordu. Künye ile karolar arası 10 piksel. */
            "gap-2.5"
          : /* Kendi yüzeyi var, gölgesi yok: derinlik ton farkıyla
               kuruluyor (CLAUDE.md). Üstünde durduğu degrade panelden bir
               kademe öne çıkıyor. */
            "gap-3 rounded-xl border border-primary-faint bg-surface-solid p-4",
        className,
      )}
    >
      {block.label && (
        <figcaption className="plate text-tiny">
          {block.label}
        </figcaption>
      )}
      {block.kind === "stats" && <Stats block={block} locale={locale} />}
      {block.kind === "shift" && <Shift block={block} />}
      {block.kind === "share" && <Share block={block} />}
    </figure>
  );
}

/**
 * Rakam karoları — yazının en çarpıcı sayıları, kart ölçüsünde.
 *
 * KARO DİLİ (8 Kasım, sahibinin isteği: "sağ taraftaki sayıları ve
 * bilgileri daha iyi ve görsel sunalım"). Önce sol kenarda ince bir dikey
 * çizgi ve düz bir sayı/künye yığınıydı; dört rakam birbirinden ayrışmıyor,
 * hangisinin düşüş hangisinin büyüklük olduğu ancak eksi işaretini
 * okuyunca anlaşılıyordu. Şimdi her rakam bir karo: zemin bir ton gömük
 * (`surface-sunken` — derinlik tonla, gölge yok), tepede 3 piksellik
 * durum şeridi (bilanço ve teknik kartlarının dili), işaretliyse rakamın
 * sağında yön ikonu.
 *
 * DİZİN NUMARASI DENENDİ, KALKTI. Karonun ilk sürümünde sol üstte "01"
 * gibi mono bir dizin ve ikon için ayrı bir satır vardı: 1440'ta kapak
 * şekli 197 → 296 piksele uzadı ve manşet kolonunu geçip kapağı
 * büyütüyordu — kapak dolgusu 1440×900'de Genel Özet ilk ekranda bitsin
 * diye ayarlı (StoryDetail.module.css). Dizin bilgi taşımıyordu; ikon
 * rakamın satırına alındı (ölçüm StoryDetail.module.css → "KAPAK
 * RAKAMLARI KARO").
 *
 * YÖN YALNIZ YAZARIN İŞARETİNDEN (`figureTone`). "−%42,9" kırmızı şerit,
 * kırmızı rakam ve aşağı ok taşıyor; "9,6 Mr $" işaretsiz bir büyüklük —
 * şeridi nötr çizgi, rakamı mürekkep, ikonu yok. Uydurma görsel yok:
 * karoda çizilen her şey değerin ve künyenin kendisinden.
 *
 * AYNI HATTA BİTİŞ. Karolar ızgaranın satırlarını paylaşıyor (`subgrid`:
 * rakam / künye iki satır); rakam satırın DİBİNE yaslı. Bir rakam
 * iki satıra kırılırsa komşusunun rakamı da aynı taban çizgisine iniyor,
 * künyeler aynı hatta başlıyor ve karolar eşit boyda bitiyor.
 */
function Stats({ block, locale }: { block: Extract<Block, { kind: "stats" }>; locale: string }) {
  const items = block.items.slice(0, MAX_ITEMS);
  return (
    <div
      data-part="grid"
      className={cn(
        "@container grid gap-2",
        /* Tek ya da üç rakam tek sütunda dizilirse kutu uzuyor; ikişerli
           ızgara hem kısa hem hizalı. Tek rakam varsa bölünecek bir şey
           yok. */
        items.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {items.map((item, index) => {
        const tone = figureTone(item.value);
        return (
          <div
            key={index}
            data-part="cell"
            data-tone={tone}
            className="relative row-span-2 grid min-w-0 grid-rows-subgrid gap-y-0 overflow-hidden rounded-lg bg-surface-sunken px-3 pt-3.5 pb-3"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 top-0 h-[3px]",
                tone === "up" ? "bg-up" : tone === "down" ? "bg-down" : "bg-line-strong",
              )}
            />
            {/* Punto ve satır yüksekliği bu satırda: ikon kutusu bir satır
                boyunda (`1lh`), rakam iki satıra kırılsa da ilk satırın
                ortasında duruyor.
                PUNTO IZGARANIN GENİŞLİĞİNE BAĞLI (`cqi`). İkon rakamın
                yanına gelince dar karoda "+%12,53" rakamın ortasından
                kırılıyordu ("+%12,5" / "3" — 1024'te kapak sütunu 107
                piksellik karo bırakıyor, 360'ta da). Punto tavanı aynı
                (`text-title`), ızgara daraldıkça iniyor; kırılma yalnız
                aralık tiresinde kalıyor. Kapsayıcı KARO DEĞİL IZGARA:
                `container-type` yerleşim sınırlaması getiriyor ve karoya
                verilince `subgrid` sessizce kapanıyordu (ölçüldü: satır
                şablonu `none`, komşu rakam dipleri 9 piksel kaydı). */}
            <div
              data-part="head"
              className="flex min-w-0 items-start gap-2 self-end text-[length:min(var(--text-title),6.5cqi)] leading-[1.15]"
            >
              {/* BİRİM SAYIDAN KOPMUYOR (`tieFigures`): "9,6 Mr $" dar
                  karoda "9,6 Mr" / "$" diye kırılmıyor. Aralıkta tireden
                  sonra kırılabiliyor (`spaceRanges`). */}
              <p
                data-part="value"
                className={cn(
                  "tote min-w-0 flex-1 [overflow-wrap:anywhere]",
                  tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-strong",
                )}
              >
                {tieFigures(titleCaseLabel(item.value, locale))}
              </p>
              {tone !== "flat" && (
                <span aria-hidden className="flex h-[1lh] shrink-0 items-center">
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-full",
                      tone === "up" ? "bg-up-wash text-up" : "bg-down-wash text-down",
                    )}
                  >
                    {tone === "up" ? (
                      <ArrowUpRight size={11} weight="bold" />
                    ) : (
                      <ArrowDownRight size={11} weight="bold" />
                    )}
                  </span>
                </span>
              )}
            </div>
            {item.note ? (
              /* KÜNYE 12 PİKSEL (`text-tiny`). Önce `text-micro` (8px) idi,
                 sonra 10 piksele çıktı; o da kapak görselinin altında
                 okunmuyordu (24 Eylül kapısı: künye ve başlık 11 piksele
                 eşitlendi; 9 Ekim'den beri metin tabanı 12). 8px döneminde
                 sistemdeki tek 8 piksellik CÜMLE oydu; o basamak iki
                 kelimelik plakalar için var (gün şeridinin ekseni gibi),
                 tam cümle için değil. İki satırda kesiliyor: yazar bazen
                 uzun bir cümle yazıyor ve üç satıra çıkan tek bir hücre
                 ızgaranın hizasını bozuyor. Cümlenin tamamı yazının içinde
                 zaten duruyor. (Yazı kapağı kesmiyor — StoryDetail.) */
              <p data-part="note" className="mt-1.5 line-clamp-2 text-tiny leading-[16px] text-muted">
                {titleCaseLabel(item.note, locale)}
              </p>
            ) : (
              <span aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Öncesi–sonrası — tek büyüklüğün iki hâli. */
function Shift({ block }: { block: Extract<Block, { kind: "shift" }> }) {
  const tone =
    block.deltaPct === null || block.deltaPct === 0
      ? "flat"
      : block.deltaPct > 0
        ? "up"
        : "down";
  return (
    <div className="flex items-center gap-3">
      <Side value={block.from.display} label={block.from.label} />
      <span
        aria-hidden
        className="shrink-0 text-lead leading-none text-primary-soft"
      >
        →
      </span>
      <Side
        value={block.to.display}
        label={block.to.label}
        className={
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : undefined
        }
      />
    </div>
  );
}

function Side({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span
        className={cn(
          "tote truncate text-lead leading-none tracking-[-0.02em] text-strong",
          className,
        )}
      >
        {value}
      </span>
      {label && (
        /* İki satır, kesik yok (31 Ekim): "Kioxia'nın Ekim-aralık…" sayının
           neyi ölçtüğünü yarıda bırakıyordu — etiket sayının anlamı. */
        <span className="mt-1.5 line-clamp-2 text-tiny leading-[15px] text-muted">
          {label}
        </span>
      )}
    </span>
  );
}

/** Pay dağılımı — tek yığın çubuk ve künyesi. */
function Share({ block }: { block: Extract<Block, { kind: "share" }> }) {
  const items = block.items.slice(0, MAX_ITEMS);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return null;
  /* Renkler yazı gövdesindeki blokla AYNI değişkenlerden: aynı veri iki
     ekranda iki farklı renkle çizilmemeli. */
  const swatch = (index: number) =>
    index < 4 ? `var(--share-${index + 1})` : "var(--share-rest)";

  return (
    <div className="flex flex-col gap-3">
      <span className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {items.map((item, index) => (
          <span
            key={index}
            className="block h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(item.value / total) * 100}%`,
              background: swatch(index),
            }}
          />
        ))}
      </span>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2 text-tiny">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: swatch(index) }}
            />
            <span className="min-w-0 flex-1 truncate text-body">
              {item.name}
            </span>
            <span className="numeral shrink-0 font-semibold text-strong">
              {item.display}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
