import { headingOf } from "@/lib/brief";
import { cn } from "@/lib/utils";

/**
 * Günlük bülten gövdesi için mini biçimlendirici — tam markdown değil,
 * brifingin kullandığı alt küme: **kalın**, "- " madde imi, boş satır
 * paragraf arası. Maddeler mockup'taki gibi numaralanır (01, 02, 03).
 *
 * İki yerde kullanılıyor: ana sayfadaki özet kartı (`collapsible`, ilk blok
 * açık gerisi katlı — 376px'lik kolonu metrelerce uzatmasın) ve bülten
 * arşivi (tamamı açık, orada okumaya gelinmiş).
 *
 * BÖLÜM BAŞLIKLARI
 * ----------------
 * Haftalık bülten gövdeyi ikiye ayırıyor: "Geçen Hafta ne oldu" ve "Bu Hafta
 * ne var". Bu ayrımın görsel bir karşılığı olmadan iki bölüm tek bir metin
 * yığınına dönüşüyor ve haftalık bültenin bütün kurgusu kayboluyordu.
 *
 * İki yazım da başlık sayılır:
 *   `## Geçen Hafta`      — standart markdown
 *   `**Geçen Hafta**`     — TAMAMI kalın olan tek satırlık paragraf
 *
 * İkincisi bilinçli: rutin uzun süre başlık desteği olmadığı için bu deseni
 * kullandı ve yazılmış arşiv kayıtları öyle duruyor. Kalın bir satırın tek
 * başına paragraf olması zaten "başlık" demektir; öyle de gösteriliyor.
 * Madde numaralandırması her başlıkta SIFIRLANIR — "Bu Hafta" bölümünün ilk
 * maddesi 07 değil 01 olmalı.
 */

/** Son başlıktan bu yana kaç madde var — katlanan kısım oradan devam eder. */
function bulletsSinceLastHeading(lines: string[]): number {
  let count = 0;
  for (const line of lines) {
    if (headingOf(line)) count = 0;
    else if (line.trim().startsWith("- ")) count++;
  }
  return count;
}

/* Başlık tanıma ve satır içi işaretleme temizliği `lib/brief.ts` içine
   taşındı: RSS beslemesi de aynı kuralı uyguluyor (öğe açıklaması gövdenin
   ilk satırını ham alıyordu ve okuyucularda "## Geçen Hafta" görünüyordu).
   İki ayrı kopya er geç birbirinden ayrı düşer. */

function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-strong">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  );
}

function BriefLines({
  lines,
  startNumber,
  size,
}: {
  lines: string[];
  startNumber: number;
  size: "card" | "page";
}) {
  /* Madde numaraları render sırasında sayaç artırmadan, önceden türetilir.
     Her bölüm başlığında sayaç sıfırlanır: "Bu Hafta"nın ilk maddesi
     "Geçen Hafta"nın devamı değil, kendi listesinin başıdır. */
  const bulletNumberOf = new Map<number, number>();
  let counter = startNumber;
  lines.forEach((line, index) => {
    if (headingOf(line)) {
      counter = 1;
      return;
    }
    if (line.trim().startsWith("- ")) {
      bulletNumberOf.set(index, counter++);
    }
  });

  const text =
    size === "page" ? "text-[15px] leading-[25px]" : "text-[13px] leading-5";

  return (
    <div
      className={cn(
        "flex flex-col",
        size === "page" ? "mt-5 gap-3.5" : "mt-3.5 gap-2.5",
      )}
    >
      {lines.map((line, index) => {
        const trimmed = line.trim();

        const heading = headingOf(line);
        if (heading) {
          return (
            <h3
              key={index}
              className={cn(
                "display-ink display-ink-tight w-fit font-bold tracking-[-0.02em] text-strong",
                // İlk başlık üstten boşluk almaz; sonrakiler bölümleri ayırır.
                index > 0 && (size === "page" ? "mt-3" : "mt-1.5"),
                size === "page" ? "text-[17px]" : "text-[14px]",
              )}
            >
              {heading}
            </h3>
          );
        }

        if (trimmed.startsWith("- ")) {
          return (
            <p key={index} className={cn("flex gap-2.5 text-body", text)}>
              <span className="numeral shrink-0 font-bold text-primary">
                {String(bulletNumberOf.get(index) ?? startNumber).padStart(2, "0")}
              </span>
              <span>{renderInline(trimmed.slice(2), String(index))}</span>
            </p>
          );
        }
        return (
          <p key={index} className={cn("text-body", text)}>
            {renderInline(trimmed, String(index))}
          </p>
        );
      })}
    </div>
  );
}

export function BriefBody({
  markdown,
  moreLabel,
  collapsible = true,
  size = "card",
}: {
  markdown: string;
  /** `collapsible` iken katlanmış bölümün açma etiketi. */
  moreLabel?: string;
  collapsible?: boolean;
  size?: "card" | "page";
}) {
  const lines = markdown.split("\n").filter((line) => line.trim());

  if (!collapsible) {
    return <BriefLines lines={lines} startNumber={1} size={size} />;
  }

  /* Açıkta duran kısım: ilk paragraf + onu izleyen ilk üç madde.
     Maddesiz metinde (haftalık bülten düz paragraf yazılıyor) eşik ikiydi
     ve üç paragraflık bir özette "Tümünü Gör" TEK paragraf için çıkıyordu. */
  const firstBulletAt = lines.findIndex((line) => line.trim().startsWith("- "));
  const base =
    firstBulletAt === -1
      ? Math.min(lines.length, 3)
      : Math.min(lines.length, firstBulletAt + 3);

  /* Geriye tek satır kalıyorsa hiç katlanmıyor. Bir paragrafı saklayan
     katlama, kendi düğmesi kadar yer tutuyor ve okuyucuya hiçbir şey
     kazandırmıyor — üstelik "arkada çok şey var" diye yanlış bir izlenim
     bırakıyor. Kural iki bülten türüne de aynı işliyor. */
  const cut = lines.length - base <= 1 ? lines.length : base;

  return (
    <>
      <BriefLines lines={lines.slice(0, cut)} startNumber={1} size={size} />
      {cut < lines.length && (
        /* Katlanan kısmın numarası, açıkta kalan kısmın SON BAŞLIĞINDAN
           sonraki madde sayısından devam eder; başlık yoksa baştan sayar. */
        <details className="group/brief mt-3">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="transition-transform group-open/brief:rotate-90"
            >
              ›
            </span>
            {moreLabel}
          </summary>
          <BriefLines
            lines={lines.slice(cut)}
            startNumber={bulletsSinceLastHeading(lines.slice(0, cut)) + 1}
            size={size}
          />
        </details>
      )}
    </>
  );
}
