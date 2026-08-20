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
    size === "page" ? "text-read leading-[25px]" : "text-base leading-5";

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
                size === "page" ? "text-lead" : "text-base",
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

/**
 * Katlanmadan önce açıkta kalan satır sayısı.
 *
 * ÖLÇÜ İKİ KEZ YANLIŞ KONDU. Önce "ilk paragraf + onu izleyen ilk üç madde"
 * idi; günlük bültende maddeler metnin SONUNDA olduğu için bu, sekiz
 * paragrafın tamamını açıkta bırakıyordu — ana sayfada özet kartı ekranın
 * yarısını kaplıyor, altındaki her şey katlamanın arkasına düşüyordu.
 *
 * Şimdi ölçü mutlak: manşetin altında üç paragraf. Kart bir GİRİŞ, metnin
 * kendisi değil; okumaya devam etmek isteyen düğmeye basıyor. Geriye tek
 * satır kalıyorsa hiç katlanmıyor (aşağıdaki kural) — bir paragrafı saklayan
 * katlama kendi düğmesi kadar yer tutuyor ve okuyucuya hiçbir şey
 * kazandırmıyor.
 *
 * İKİYDİ, ÜÇE ÇIKTI. İki paragraf günün özetini kesiyordu: bülten tipik
 * olarak "dün ne oldu" ile açılıp ikinci paragrafta mekanizmayı anlatıyor ve
 * üçüncüde günün ikinci başlığına geçiyor. İkide kesmek, okuyucuyu tek bir
 * hikâyenin ortasında bırakıyordu.
 */
const OPEN_LINES = 3;

export function BriefBody({
  markdown,
  moreLabel,
  lessLabel,
  collapsible = true,
  size = "card",
}: {
  markdown: string;
  /** `collapsible` iken katlanmış bölümün açma etiketi. */
  moreLabel?: string;
  /** Açıkken düğmenin metni — kapatmanın da bir yolu olmalı. */
  lessLabel?: string;
  collapsible?: boolean;
  size?: "card" | "page";
}) {
  const lines = markdown.split("\n").filter((line) => line.trim());

  if (!collapsible) {
    return <BriefLines lines={lines} startNumber={1} size={size} />;
  }

  const base = Math.min(lines.length, OPEN_LINES);

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
        /* `<details>` KALIYOR, istemci durumu değil: katlama JS gelmeden de
           çalışıyor ve kartın hidratlanmasını beklemiyor. Değişen tek şey
           tetikleyicinin görünümü — okla önlenmiş bir metin satırıydı,
           sayfanın en uzun metninin altında fark edilmiyordu. Artık kendi
           kenarlığı olan bir denetim ve açıkken kapanma yolunu da veriyor. */
        <details className="group/brief mt-3.5">
          <summary className="inline-flex min-h-9 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md border border-primary-faint px-3.5 text-small font-semibold text-primary transition-colors hover:bg-primary-tint [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="transition-transform group-open/brief:rotate-90"
            >
              ›
            </span>
            <span className="group-open/brief:hidden">{moreLabel}</span>
            <span className="hidden group-open/brief:inline">{lessLabel}</span>
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
