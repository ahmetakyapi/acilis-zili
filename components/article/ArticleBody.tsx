import { Fragment } from "react";
import Link from "next/link";
import { ArticleChart } from "./ArticleChart";
import { CHART_RANGES, type ChartRange } from "@/lib/providers/types";
import { cn, safeExternalUrl } from "@/lib/utils";

/* ==========================================================================
   Uzun metin gövdesi — rehber yazıları ve mercek yazıları

   Neden kendi çözümleyicimiz: sayfada tek bir markdown kütüphanesi bile
   ~30KB istemci paketi demek, oysa bu metinler sunucuda render ediliyor ve
   yalnızca bir alt kümeye ihtiyaç duyuyorlar. Desteklenenler:

     ## / ### başlık        > alıntı           | tablo |
     - madde / 1. madde     ---  ayraç         ::: kutu ... :::
     **kalın**  *eğik*  `kod`  [bağlantı](/hisse/NVDA)

   `:::` blokları yazıya görsel ritim veren tek özel sözdizimi. Dört metin
   kutusu (ornek · dikkat · ozet · tanim) ve altı görsel blok var:

       ::: sayilar Rakamlarla          ::: zaman Kronoloji
       %439 | ilk yarı getirisi        24 Temmuz | Yatırımcı mektubu...
       4x | brüt kaldıraç              30 Temmuz | Blok işlem
       :::                             :::

       ::: bar Temmuz kaybı            ::: pay Optik Modül Pazar Payı
       Micron | -34                    Zhongji Innolight | 27
       Nasdaq 100 | -10                Coherent | 18
       :::                             Diğerleri | 55
                                       :::

       ::: akis Bellekten Sunucuya     ::: oncesi Piyasa Değeri
       HBM | SK Hynix · Micron         52,5 Mr $ | 12 Haziran
       Paketleme | TSMC CoWoS          19 Mr $ | 29 Temmuz
       Hızlandırıcı | Nvidia GB200     :::
       :::

   Hepsinde satırlar `|` ile ayrılır. `bar` sayıyı yüzde kabul eder, çubuğu
   grubun en büyüğüne göre ölçekler ve işaretine göre renklendirir; `pay`
   bütünü yüzdeye çevirip tek bir yığın çubuğa böler; `akis` bir zinciri
   kutu-ok olarak çizer; `oncesi` tek bir büyüklüğün iki hâlini yan yana
   koyar ve arasındaki değişimi kendisi hesaplar.

   NEDEN FOTOĞRAF YOK: bu blok ailesi, yazılara görsel katmanın telifsiz ve
   bakımsız yolu. Model yalnızca metin yazıyor, çizimi site yapıyor; hiçbir
   yerde görsel barındırmak, kaynak aramak ya da telif kovalamak gerekmiyor
   ve tasarım dili her yazıda aynı kalıyor.

   Rutinin yazdığı metinlerde de aynı sözdizimi geçerli —
   docs/claude-rutinler.md içinde anlatılıyor.
   ========================================================================== */

type CalloutKind = "ornek" | "dikkat" | "ozet" | "tanim";

/* VARSAYILAN ETİKETLER İKİ DİLLİ. Dördü de sabit Türkçe yazılıydı ve
   bileşen `locale` almıyordu: yazar `::: ozet Summary` gibi kendi etiketini
   verdiği sürece sorun görünmüyor ama etiketi yazılmamış tek bir
   `::: ozet` bloğu İngilizce sayfada "ÖZET" başlığı basıyordu. Mercek
   yazıları ve bilanço analizleri rutinle üretiliyor, etiketin unutulması an
   meselesi. */
const CALLOUT: Record<
  CalloutKind,
  { defaultLabel: { tr: string; en: string }; box: string; kicker: string }
> = {
  ornek: {
    defaultLabel: { tr: "Örnek", en: "Example" },
    box: "border-primary-faint bg-primary-tint",
    kicker: "text-primary",
  },
  dikkat: {
    defaultLabel: { tr: "Dikkat", en: "Heads-Up" },
    box: "border-brass/35 bg-brass-wash",
    kicker: "text-brass",
  },
  ozet: {
    defaultLabel: { tr: "Özet", en: "Summary" },
    box: "border-line-strong bg-surface-elevated",
    kicker: "text-body",
  },
  tanim: {
    defaultLabel: { tr: "Tanım", en: "Definition" },
    box: "border-line bg-surface",
    kicker: "text-muted",
  },
};

function isCalloutKind(value: string): value is CalloutKind {
  return value in CALLOUT;
}

/* --------------------------------------------------------------------------
   Satır içi
   -------------------------------------------------------------------------- */

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="numeral rounded-xs bg-surface-elevated px-1 py-0.5 text-[0.9em] text-strong"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = LINK_PATTERN.exec(part);
    if (link) {
      const [, label, href] = link;
      const internal = href.startsWith("/");
      const className =
        "font-medium text-primary underline decoration-primary-faint underline-offset-2 transition-colors hover:text-primary-hover";

      if (internal) {
        return (
          <Link key={key} href={href} className={className}>
            {label}
          </Link>
        );
      }

      /* Mercek yazıları /api/mercek üzerinden geliyor, yani gövdeyi biz
         yazmıyoruz. `[tıkla](javascript:…)` bağlantısı JSX kaçışından
         geçer — href öznitelikleri kaçışın kapsamı dışında. Şema
         süzülmezse bağlantı düz metne düşer. */
      const external = safeExternalUrl(href);
      if (!external) return <span key={key}>{label}</span>;

      return (
        <a
          key={key}
          href={external}
          target="_blank"
          rel="noreferrer noopener"
          className={className}
        >
          {label}
        </a>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

/* --------------------------------------------------------------------------
   Blok çözümleme

   Satır satır ilerleyen basit bir durum makinesi. Liste, alıntı ve tablo
   ardışık satırları topladığı için önce onların bittiği yer bulunur.
   -------------------------------------------------------------------------- */

/**
 * Gövdenin ayrıştırılmış hâli.
 *
 * DIŞA AÇIK, çünkü yazının görselini yalnızca yazı sayfası kullanmıyor: ana
 * sayfadaki Mercek kartı da manşetin İLK görsel bloğunu kendi ölçüsünde
 * çiziyor (components/stories/StoryFigure.tsx). Sözdizimi tek yerde —
 * burada — ayrıştırılıyor; kart yalnızca kendi çizimini yapıyor. Yeni bir
 * blok türü eklerken kartın da onu tanıması gerekiyorsa oradaki listeye
 * eklemek yeter, ayrıştırma kendiliğinden geliyor.
 */
export type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "rule" }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "callout"; tone: CalloutKind; label: string; lines: string[] }
  | { kind: "stats"; label: string; items: { value: string; note: string }[] }
  | { kind: "timeline"; label: string; items: { when: string; text: string }[] }
  | {
      kind: "bars";
      label: string;
      items: { name: string; value: number; display: string }[];
    }
  | {
      kind: "share";
      label: string;
      items: { name: string; value: number; display: string }[];
    }
  | { kind: "flow"; label: string; items: { name: string; note: string }[] }
  | {
      kind: "shift";
      label: string;
      from: Magnitude;
      to: Magnitude;
      /** İki değer aynı birimdeyse hesaplanan değişim; değilse null. */
      deltaPct: number | null;
    }
  | { kind: "chart"; symbol: string; range: ChartRange; caption?: string };

/** Yüzdeler tam sayıysa ondalık basılmaz: "%27", "%12,5". */
function formatShare(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(".", ",");
}

/** Öncesi–sonrası bloğunun tek yanı: büyük sayı ve altında etiketi. */
function Side({
  value,
  tone,
}: {
  value: Magnitude;
  tone?: "up" | "down" | "flat";
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span
        className={cn(
          "tote text-heading leading-none sm:text-subdisplay",
          tone === "down" && "text-down",
          tone === "up" && "text-up",
        )}
      >
        {value.display}
      </span>
      {value.label && (
        <span className="mt-1.5 truncate text-small text-muted">
          {value.label}
        </span>
      )}
    </span>
  );
}

/** "52,5 Mr $" → { value: 52.5, unit: "Mr $", display: "52,5 Mr $" } */
export type Magnitude = {
  display: string;
  label: string;
  value: number | null;
  unit: string;
};

function parseMagnitude(raw: string, label: string): Magnitude {
  const trimmed = raw.trim();
  const match = /^[-+]?[\d.,\s]*\d/.exec(trimmed.replace(/^%/, ""));
  const numeric = match
    ? Number(match[0].replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."))
    : NaN;
  // Birim, sayıdan geriye kalan metin: "Mr $", "milyon adet", "%".
  const unit = match
    ? trimmed.replace(/^%/, "").replace(match[0], "").trim()
    : trimmed;
  return {
    display: trimmed,
    label,
    value: Number.isFinite(numeric) ? numeric : null,
    unit: trimmed.startsWith("%") ? "%" : unit,
  };
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");
}

export function parseBlocks(markdown: string, locale: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    // ::: kutu / sayilar / zaman / bar
    if (line.startsWith(":::")) {
      const header = line.slice(3).trim().split(/\s+/);
      const kindWord = (header.shift() ?? "").toLowerCase();
      const label = header.join(" ");
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(":::")) {
        if (lines[i].trim()) body.push(lines[i].trim());
        i += 1;
      }
      i += 1; // kapanış :::

      if (kindWord === "sayilar") {
        blocks.push({
          kind: "stats",
          label,
          items: body.map((row) => {
            const [value, ...rest] = row.split("|").map((c) => c.trim());
            return { value, note: rest.join(" · ") };
          }),
        });
        continue;
      }

      if (kindWord === "zaman") {
        blocks.push({
          kind: "timeline",
          label,
          items: body.map((row) => {
            const [when, ...rest] = row.split("|").map((c) => c.trim());
            return { when, text: rest.join(" ") };
          }),
        });
        continue;
      }

      /* ::: grafik MU | 1M | Micron Temmuz'da yüzde 34 düştü
         Sembolün gerçek fiyat serisi. Aralık geçersizse 1M'e düşer. */
      if (kindWord === "grafik") {
        const [symbolRaw, rangeRaw, ...captionParts] = (body[0] ?? label)
          .split("|")
          .map((c) => c.trim());
        const range = CHART_RANGES.includes(rangeRaw as ChartRange)
          ? (rangeRaw as ChartRange)
          : "1M";
        if (symbolRaw) {
          blocks.push({
            kind: "chart",
            symbol: symbolRaw.toUpperCase(),
            range,
            caption: captionParts.join(" ") || undefined,
          });
        }
        continue;
      }

      /* ::: pay — bütünün dağılımı. Sayılar yüzde kabul edilir; toplam
         100 değilse (kaynak yuvarlamışsa ya da mutlak değer yazılmışsa)
         toplama göre normalize edilir, yani çubuk her zaman bütünü doldurur. */
      if (kindWord === "pay") {
        const items = body.slice(0, 6).map((row) => {
          const [name, raw = ""] = row.split("|").map((c) => c.trim());
          const value = Number(raw.replace("%", "").replace(",", "."));
          return {
            name,
            value: Number.isFinite(value) ? Math.max(value, 0) : 0,
            display: raw,
          };
        });
        /* Dilimler BÜYÜKTEN KÜÇÜĞE sıralanır: renk basamakları sırayı taşıyor
           (koyudan açığa), o yüzden sıra rastgele olamaz — yazar %27'yi
           %35'ten önce yazdığında en açık ton en büyük paya düşüyor ve renk
           yalan söylüyordu. "Diğerleri" her hâlükârda sona ve nötr griye
           gider; büyüklüğü değil, artık kalanı temsil ediyor. */
        const isRest = (name: string) =>
          /^(diğer|diger|other)/i.test(name.trim());
        const sorted = [
          ...items.filter((item) => !isRest(item.name)).sort((a, b) => b.value - a.value),
          ...items.filter((item) => isRest(item.name)),
        ];
        if (sorted.length > 0)
          blocks.push({ kind: "share", label, items: sorted });
        continue;
      }

      /* ::: akis — tedarik zinciri gibi sıralı bir yol. */
      if (kindWord === "akis") {
        const items = body.map((row) => {
          const [name, ...rest] = row.split("|").map((c) => c.trim());
          return { name, note: rest.join(" · ") };
        });
        if (items.length > 0) blocks.push({ kind: "flow", label, items });
        continue;
      }

      /* ::: oncesi — tek bir büyüklüğün iki hâli. İlk satır önce, ikinci
         satır sonra. Değişim yüzdesi ancak İKİ DEĞER DE sayıya çevrilebiliyor
         ve BİRİMLERİ AYNIYSA hesaplanır: "52,5 Mr $" ile "19 Mn $"
         karşılaştırmak sessizce yanlış bir yüzde üretirdi. */
      if (kindWord === "oncesi") {
        const rows = body.slice(0, 2).map((row) => {
          const [value, ...rest] = row.split("|").map((c) => c.trim());
          return parseMagnitude(value, rest.join(" "));
        });
        if (rows.length === 2) {
          const [from, to] = rows;
          const comparable =
            from.value !== null &&
            to.value !== null &&
            from.value !== 0 &&
            from.unit.toLocaleLowerCase("tr") === to.unit.toLocaleLowerCase("tr");
          blocks.push({
            kind: "shift",
            label,
            from,
            to,
            deltaPct: comparable
              ? ((to.value as number) - (from.value as number)) /
                Math.abs(from.value as number) *
                100
              : null,
          });
        }
        continue;
      }

      if (kindWord === "bar") {
        blocks.push({
          kind: "bars",
          label,
          items: body.map((row) => {
            const [name, raw = ""] = row.split("|").map((c) => c.trim());
            // "-28,6" ya da "-28.6%" — virgül ondalık ayırıcı olabiliyor.
            const value = Number(raw.replace("%", "").replace(",", "."));
            return {
              name,
              value: Number.isFinite(value) ? value : 0,
              display: raw,
            };
          }),
        });
        continue;
      }

      const tone: CalloutKind = isCalloutKind(kindWord) ? kindWord : "ozet";
      blocks.push({
        kind: "callout",
        tone,
        label: label || CALLOUT[tone].defaultLabel[locale === "en" ? "en" : "tr"],
        lines: body,
      });
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ kind: "heading", level: 3, text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", level: 2, text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    // Tek # gövdede kullanılmaz — sayfa başlığı zaten ayrı alanda.
    if (line.startsWith("# ")) {
      blocks.push({ kind: "heading", level: 2, text: line.slice(2).trim() });
      i += 1;
      continue;
    }

    // Tablo: başlık satırı + ayraç
    if (
      line.startsWith("|") &&
      i + 1 < lines.length &&
      isTableDivider(lines[i + 1].trim())
    ) {
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i].trim()));
        i += 1;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quote.push(lines[i].trim().slice(2).trim());
        i += 1;
      }
      blocks.push({ kind: "quote", lines: quote });
      continue;
    }

    const bullet = /^[-*]\s+/;
    const numbered = /^\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        const matches = ordered ? numbered.test(current) : bullet.test(current);
        if (!matches) break;
        items.push(current.replace(ordered ? numbered : bullet, ""));
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    // Paragraf — boş satıra kadar tek metin.
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const current = lines[i].trim();
      if (
        current.startsWith("#") ||
        current.startsWith(">") ||
        current.startsWith(":::") ||
        current.startsWith("|") ||
        /^-{3,}$/.test(current) ||
        bullet.test(current) ||
        numbered.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

/* --------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

export function ArticleBody({
  markdown,
  locale = "tr",
  className,
}: {
  markdown: string;
  /** Etiketi yazılmamış `:::` kutularının varsayılan başlığı bundan gelir. */
  locale?: string;
  className?: string;
}) {
  const blocks = parseBlocks(markdown, locale);

  return (
    <div className={cn("flex flex-col gap-[18px]", className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;

        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              <h2
                key={key}
                className="display-ink display-ink-tight mt-3 w-fit text-title font-bold tracking-[-0.03em] sm:text-heading"
              >
                {block.text}
              </h2>
            ) : (
              <h3
                key={key}
                className="mt-1 text-lead font-bold tracking-[-0.02em] text-strong"
              >
                {block.text}
              </h3>
            );

          case "paragraph":
            return (
              <p
                key={key}
                className="text-read leading-[28px] text-body sm:text-base"
              >
                {renderInline(block.text, key)}
              </p>
            );

          case "list":
            return (
              <ul key={key} className="flex flex-col gap-2.5">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="flex gap-3 text-read leading-[27px] text-body"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0 select-none",
                        block.ordered
                          ? "numeral pt-px text-base font-bold text-primary"
                          : "pt-[10px]",
                      )}
                    >
                      {block.ordered ? (
                        String(itemIndex + 1).padStart(2, "0")
                      ) : (
                        <span className="block size-1.5 rounded-full bg-primary-faint" />
                      )}
                    </span>
                    <span>{renderInline(item, `${key}-${itemIndex}`)}</span>
                  </li>
                ))}
              </ul>
            );

          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-primary-faint pl-4 text-read italic leading-[28px] text-soft"
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>
                    {renderInline(line, `${key}-${lineIndex}`)}
                  </p>
                ))}
              </blockquote>
            );

          case "rule":
            return (
              <hr key={key} className="my-2 border-t border-line" aria-hidden />
            );

          case "table":
            return (
              /* KAYDIRMA KABI KLAVYEYLE ODAKLANABİLİR. Yazı içindeki tablo
                 dar ekranda kendi kabında kayıyor (420px'lik tablo 352px'lik
                 kapta) ama kap `tabindex` taşımadığı için fare ya da dokunma
                 olmadan sağdaki sütunlara HİÇ ulaşılamıyordu — WCAG 2.1.1.
                 Aynı düzeltme yönetim panelinde ve analiz tablosunda yapıldı;
                 bu üçüncü tablo atlanmıştı. Ad dile göre: ekran okuyucu
                 "kaydırılabilir bölge, Tablo" diye duyuruyor. */
              <div
                key={key}
                className="scroll-x rounded-(--radius-lg) border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
                tabIndex={0}
                role="region"
                aria-label={locale === "en" ? "Table" : "Tablo"}
              >
                <table className="w-full min-w-[420px] text-left text-base">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      {block.head.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          className="px-3.5 py-2.5 text-tiny font-bold uppercase tracking-[0.07em] text-muted sm:px-4"
                        >
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={cn(
                              "px-3.5 py-2.5 align-top leading-[22px] sm:px-4",
                              cellIndex === 0
                                ? "font-semibold text-strong"
                                : "text-body",
                            )}
                          >
                            {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          /* Sayı şeridi — yazının en çarpıcı dört-beş rakamı. Metnin içinde
             kaybolan bir sayı, kutuda bir bakışta okunuyor. */
          case "stats":
            return (
              <div key={key} className="flex flex-col gap-2.5">
                {block.label && (
                  <p className="plate text-nano tracking-[0.09em]">
                    {block.label}
                  </p>
                )}
                <div
                  className={cn(
                    "grid gap-2.5",
                    block.items.length % 3 === 0
                      ? "grid-cols-1 sm:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-4",
                  )}
                >
                  {block.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="rounded-(--radius-lg) border border-line bg-surface px-3.5 py-3"
                    >
                      <p className="tote text-title leading-none sm:text-heading">
                        {item.value}
                      </p>
                      <p className="mt-1.5 text-tiny leading-[16px] text-muted">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );

          /* Zaman çizelgesi — kronolojiyi paragrafa gömmek yerine gösterir. */
          case "timeline":
            return (
              <div key={key} className="flex flex-col gap-2.5">
                {block.label && (
                  <p className="plate text-nano tracking-[0.09em]">
                    {block.label}
                  </p>
                )}
                <ol className="flex flex-col">
                  {block.items.map((item, itemIndex) => {
                    const last = itemIndex === block.items.length - 1;
                    return (
                      <li key={itemIndex} className="flex gap-3.5">
                        <span
                          aria-hidden
                          className="relative w-3 shrink-0"
                        >
                          <span className="absolute left-0 top-[7px] size-3 rounded-full border-2 border-primary bg-page" />
                          {!last && (
                            <span className="absolute bottom-0 left-[5px] top-5 w-0.5 rounded-full bg-primary-faint" />
                          )}
                        </span>
                        <span className={cn("min-w-0", !last && "pb-4")}>
                          <span className="numeral block text-small font-bold uppercase tracking-[0.06em] text-primary">
                            {item.when}
                          </span>
                          <span className="mt-1 block text-read leading-[24px] text-body">
                            {renderInline(item.text, `${key}-${itemIndex}`)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );

          /* Yatay çubuk — yüzde karşılaştırmaları. Ölçek grubun en büyüğüne
             göre; renk yönü söyler, uzunluk büyüklüğü. */
          case "bars": {
            const peak = Math.max(
              ...block.items.map((item) => Math.abs(item.value)),
              0.01,
            );
            return (
              <div key={key} className="flex flex-col gap-2.5">
                {block.label && (
                  <p className="plate text-nano tracking-[0.09em]">
                    {block.label}
                  </p>
                )}
                <div className="flex flex-col gap-2 rounded-(--radius-lg) border border-line bg-surface px-4 py-4">
                  {block.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex items-center gap-3 text-base"
                    >
                      <span className="w-[122px] shrink-0 truncate text-body sm:w-[168px]">
                        {item.name}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            item.value < 0 ? "bg-down" : "bg-up",
                          )}
                          style={{
                            width: `${Math.max(
                              (Math.abs(item.value) / peak) * 100,
                              3,
                            )}%`,
                          }}
                        />
                      </span>
                      <span
                        className={cn(
                          "numeral w-[62px] shrink-0 text-right font-semibold",
                          item.value < 0 ? "text-down" : "text-up",
                        )}
                      >
                        {item.display}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          /* Pay dağılımı — tek yığın çubuk + adı ve yüzdesi yazılı satırlar.
             PASTA DEĞİL: dilim adları uzun ("Innolight dışı Çinli üreticiler")
             ve yakın değerler halkada okunmuyor; yatay yığın hem sıralamayı
             hem büyüklüğü doğru veriyor. Dilimler arasında 2px zemin boşluğu
             var — komşu basamaklar aynı renk ailesinden olduğu için sınırı
             boşluk çiziyor, renk farkı değil. */
          case "share": {
            const total = block.items.reduce((sum, item) => sum + item.value, 0);
            if (total <= 0) return null;
            const swatch = (index: number) =>
              index < 4 ? `var(--share-${index + 1})` : "var(--share-rest)";
            return (
              <div key={key} className="flex flex-col gap-2.5">
                {block.label && (
                  <p className="plate text-nano tracking-[0.09em]">
                    {block.label}
                  </p>
                )}
                <div className="rounded-(--radius-lg) border border-line bg-surface px-4 py-4">
                  <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
                    {block.items.map((item, itemIndex) => (
                      <span
                        key={itemIndex}
                        className="block h-full first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(item.value / total) * 100}%`,
                          background: swatch(itemIndex),
                        }}
                      />
                    ))}
                  </div>
                  <ul className="mt-3.5 flex flex-col gap-2">
                    {block.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="flex items-center gap-2.5 text-base"
                      >
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-[3px]"
                          style={{ background: swatch(itemIndex) }}
                        />
                        <span className="min-w-0 flex-1 truncate text-body">
                          {item.name}
                        </span>
                        <span className="numeral shrink-0 font-semibold text-strong">
                          %{formatShare((item.value / total) * 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          }

          /* Akış — bir zincirin halkaları. Geniş ekranda soldan sağa kutular
             ve aralarında ok; dar ekranda alt alta ve ok aşağı bakar. Ok bir
             yön işareti, süs değil: sıra bilgiyi taşıyor. */
          case "flow":
            return (
              <div key={key} className="flex flex-col gap-2.5">
                {block.label && (
                  <p className="plate text-nano tracking-[0.09em]">
                    {block.label}
                  </p>
                )}
                <ol className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
                  {block.items.map((item, itemIndex) => (
                    <Fragment key={itemIndex}>
                      {itemIndex > 0 && (
                        <li
                          aria-hidden
                          className="flex shrink-0 select-none items-center justify-center text-read leading-none text-primary-soft sm:px-1.5"
                        >
                          <span className="sm:hidden">↓</span>
                          <span className="hidden sm:inline">→</span>
                        </li>
                      )}
                      <li className="flex min-w-0 flex-col rounded-(--radius-lg) border border-line bg-surface px-3.5 py-3 sm:flex-1">
                        <span className="numeral text-nano font-bold tracking-[0.09em] text-primary">
                          {String(itemIndex + 1).padStart(2, "0")}
                        </span>
                        <span className="mt-1 text-base font-bold leading-tight text-strong">
                          {item.name}
                        </span>
                        {item.note && (
                          <span className="mt-1 text-small leading-[17px] text-muted">
                            {item.note}
                          </span>
                        )}
                      </li>
                    </Fragment>
                  ))}
                </ol>
              </div>
            );

          /* Öncesi–sonrası — tek bir büyüklüğün çöküşü ya da sıçraması.
             İki sayı aynı ölçekte yan yana; aradaki değişim ancak birimler
             aynıysa yazılır, yoksa ok tek başına konuşur. */
          case "shift": {
            const tone =
              block.deltaPct === null
                ? "flat"
                : block.deltaPct > 0
                  ? "up"
                  : block.deltaPct < 0
                    ? "down"
                    : "flat";
            return (
              <div key={key} className="flex flex-col gap-2.5">
                {block.label && (
                  <p className="plate text-nano tracking-[0.09em]">
                    {block.label}
                  </p>
                )}
                <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-line bg-surface px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <Side value={block.from} />

                  <span
                    aria-hidden
                    className="select-none text-read leading-none text-primary-soft sm:shrink-0 sm:text-lead"
                  >
                    <span className="sm:hidden">↓</span>
                    <span className="hidden sm:inline">→</span>
                  </span>

                  <Side value={block.to} tone={tone} />

                  {block.deltaPct !== null && (
                    <span
                      className={cn(
                        "numeral w-fit shrink-0 rounded-full px-2.5 py-1 text-small font-bold sm:ml-auto",
                        tone === "down"
                          ? "bg-down-wash text-down"
                          : tone === "up"
                            ? "bg-up-wash text-up"
                            : "bg-surface-elevated text-body",
                      )}
                    >
                      {block.deltaPct > 0 ? "+" : "−"}%
                      {formatShare(Math.abs(block.deltaPct))}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          case "chart":
            return (
              <ArticleChart
                key={key}
                symbol={block.symbol}
                range={block.range}
                caption={block.caption}
              />
            );

          case "callout": {
            const tone = CALLOUT[block.tone];
            return (
              <aside
                key={key}
                className={cn(
                  "rounded-(--radius-lg) border px-4 py-3.5 sm:px-5 sm:py-4",
                  tone.box,
                )}
              >
                <p
                  className={cn(
                    "text-nano font-bold uppercase tracking-[0.1em]",
                    tone.kicker,
                  )}
                >
                  {block.label}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {block.lines.map((line, lineIndex) => (
                    <p
                      key={lineIndex}
                      className="text-read leading-[25px] text-body"
                    >
                      {renderInline(line, `${key}-${lineIndex}`)}
                    </p>
                  ))}
                </div>
              </aside>
            );
          }
        }
      })}
    </div>
  );
}

/**
 * Okuma süresi — künyede "3 dk okuma" olarak görünür.
 *
 * 160 kelime/dk, İngilizce metinler için yaygın olan 200'den düşük: Türkçe
 * kelimeler daha uzun ve bu metinler tablo, kutu ve sayı içeriyor, yani
 * düz kurgudan yavaş okunuyor.
 */
const WORDS_PER_MINUTE = 160;

export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
