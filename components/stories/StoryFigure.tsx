import { parseBlocks, type Block } from "@/components/article/ArticleBody";
import { cn } from "@/lib/utils";

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

export function storyFigureOf(
  markdown: string | null | undefined,
  locale: string,
): StoryFigureBlock | null {
  if (!markdown) return null;
  for (const block of parseBlocks(markdown, locale)) {
    if ((CARD_KINDS as readonly string[]).includes(block.kind)) {
      return block as StoryFigureBlock;
    }
  }
  return null;
}

export function StoryFigure({
  block,
  className,
}: {
  block: StoryFigureBlock;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        /* Kendi yüzeyi var, gölgesi yok: derinlik ton farkıyla kuruluyor
           (CLAUDE.md). Üstünde durduğu degrade panelden bir kademe öne
           çıkıyor. */
        "flex min-w-0 flex-col gap-3 rounded-xl border border-primary-faint bg-surface-solid p-4",
        className,
      )}
    >
      {block.label && (
        <figcaption className="plate text-nano tracking-[0.09em]">
          {block.label}
        </figcaption>
      )}
      {block.kind === "stats" && <Stats block={block} />}
      {block.kind === "shift" && <Shift block={block} />}
      {block.kind === "share" && <Share block={block} />}
    </figure>
  );
}

/** Rakam şeridi — yazının en çarpıcı sayıları, kart ölçüsünde. */
function Stats({ block }: { block: Extract<Block, { kind: "stats" }> }) {
  const items = block.items.slice(0, MAX_ITEMS);
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-3.5",
        /* Tek ya da üç rakam tek sütunda dizilirse kutu uzuyor; ikişerli
           ızgara hem kısa hem hizalı. Tek rakam varsa bölünecek bir şey
           yok. */
        items.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <p className="tote text-lead leading-none tracking-[-0.02em] text-strong">
            {item.value}
          </p>
          {item.note && (
            /* Künye iki satırda kesiliyor: yazar bazen tam bir cümle
               yazıyor ve üç satıra çıkan tek bir hücre ızgaranın hizasını
               bozuyor. Cümlenin tamamı yazının içinde zaten duruyor. */
            <p className="mt-1.5 line-clamp-2 text-micro leading-[14px] text-muted">
              {item.note}
            </p>
          )}
        </div>
      ))}
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
        <span className="mt-1.5 truncate text-micro leading-[14px] text-muted">
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
