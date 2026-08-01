import Link from "next/link";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Uzun metin gövdesi — rehber yazıları ve mercek yazıları

   Neden kendi çözümleyicimiz: sayfada tek bir markdown kütüphanesi bile
   ~30KB istemci paketi demek, oysa bu metinler sunucuda render ediliyor ve
   yalnızca bir alt kümeye ihtiyaç duyuyorlar. Desteklenenler:

     ## / ### başlık        > alıntı           | tablo |
     - madde / 1. madde     ---  ayraç         ::: kutu ... :::
     **kalın**  *eğik*  `kod`  [bağlantı](/hisse/NVDA)

   `:::` kutuları yazıya görsel ritim veren tek özel sözdizimi:
       ::: ornek Nvidia'nın 2026 ikinci çeyreği
       Şirket beklentinin %12 üzerinde gelir açıkladı...
       :::
   Türleri: ornek · dikkat · ozet · tanim. Rutinin yazdığı metinlerde de
   aynı sözdizimi geçerli, docs/claude-mercek-ajani.md içinde anlatılıyor.
   ========================================================================== */

type CalloutKind = "ornek" | "dikkat" | "ozet" | "tanim";

const CALLOUT: Record<
  CalloutKind,
  { defaultLabel: string; box: string; kicker: string }
> = {
  ornek: {
    defaultLabel: "Örnek",
    box: "border-primary-faint bg-primary-tint",
    kicker: "text-primary",
  },
  dikkat: {
    defaultLabel: "Dikkat",
    box: "border-brass/35 bg-brass-wash",
    kicker: "text-brass",
  },
  ozet: {
    defaultLabel: "Özet",
    box: "border-line-strong bg-surface-elevated",
    kicker: "text-body",
  },
  tanim: {
    defaultLabel: "Tanım",
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
          className="numeral rounded-[5px] bg-surface-elevated px-1 py-0.5 text-[0.9em] text-strong"
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
      return internal ? (
        <Link key={key} href={href} className={className}>
          {label}
        </Link>
      ) : (
        <a
          key={key}
          href={href}
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

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "rule" }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "callout"; tone: CalloutKind; label: string; lines: string[] };

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

function parseBlocks(markdown: string): Block[] {
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

    // ::: kutu
    if (line.startsWith(":::")) {
      const header = line.slice(3).trim().split(/\s+/);
      const kindWord = (header.shift() ?? "").toLowerCase();
      const tone: CalloutKind = isCalloutKind(kindWord) ? kindWord : "ozet";
      const label = header.join(" ") || CALLOUT[tone].defaultLabel;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(":::")) {
        if (lines[i].trim()) body.push(lines[i].trim());
        i += 1;
      }
      i += 1; // kapanış :::
      blocks.push({ kind: "callout", tone, label, lines: body });
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
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const blocks = parseBlocks(markdown);

  return (
    <div className={cn("flex flex-col gap-[18px]", className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;

        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              <h2
                key={key}
                className="display-ink display-ink-tight mt-3 w-fit text-[21px] font-bold tracking-[-0.03em] sm:text-[24px]"
              >
                {block.text}
              </h2>
            ) : (
              <h3
                key={key}
                className="mt-1 text-[16.5px] font-bold tracking-[-0.02em] text-strong"
              >
                {block.text}
              </h3>
            );

          case "paragraph":
            return (
              <p
                key={key}
                className="text-[15.5px] leading-[28px] text-body sm:text-base"
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
                    className="flex gap-3 text-[15.5px] leading-[27px] text-body"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0 select-none",
                        block.ordered
                          ? "numeral pt-px text-[13px] font-bold text-primary"
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
                className="border-l-2 border-primary-faint pl-4 text-[16px] italic leading-[28px] text-soft"
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
              <div key={key} className="scroll-x rounded-(--radius-lg) border border-line">
                <table className="w-full min-w-[420px] text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      {block.head.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-muted sm:px-4"
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
                    "text-[10.5px] font-bold uppercase tracking-[0.1em]",
                    tone.kicker,
                  )}
                >
                  {block.label}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {block.lines.map((line, lineIndex) => (
                    <p
                      key={lineIndex}
                      className="text-[14.5px] leading-[25px] text-body"
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
