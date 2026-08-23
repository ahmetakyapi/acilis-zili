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
      /* ALT BAŞLIK AĞIRLIKLA AYRIŞIYOR, PUNTOYLA DEĞİL. Bülten
         paragrafları "Haftanın asıl sınavı cuma günü Wyoming'de:" gibi
         kalın bir giriş ibaresiyle açılıyor ve bu ibare işlevi gereği bir
         alt başlık. Ama paragrafın İÇİNDE, aynı satırda devam ediyor:
         puntosu büyütülseydi ilk satırın taban çizgisi bozulur, metin
         basamaklı görünürdü. Ayrım bu yüzden 700 ağırlıkla kuruluyor;
         gövde de bir basamak büyüdüğü için ibare zaten daha iri. */
      <strong key={`${keyPrefix}-${i}`} className="font-bold text-strong">
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

  /* OKUMA ÖLÇÜSÜ SINIRLI.
     Bülten sayfası (`size === "page"`) tam genişlikte akıyordu: ölçüldü,
     1280 pikselde satırlar ~117, 1440 pikselde ~134 karakter. Rahat okuma
     ölçüsü 50–75 karakter; 90'ın üstünde göz satır sonundan satır başına
     dönerken yerini kaybediyor ve bülten sitenin ASIL okuma yüzeyi.
     Ölçü `ch` ile veriliyor (punto değişirse birlikte değişiyor) ama `ch`
     RAKAM genişliğini ölçüyor ve ortalama harften geniş: 74ch denendiğinde
     gerçek satırlar 83–93 karakter çıktı, sayılarak doğrulandı. 62ch
     sitenin başka okuma yüzeylerinde kullanılan ölçüyle de aynı.
     Kart sürümünde (`size` başka) kolon zaten dar, sınıra gerek yok. */
  /* OKUMA ÖLÇÜSÜ VE PUNTO — İKİ YÜZEYDE DE.
     Bülten sayfası tam genişlikte akıyordu: ölçüldü, 1280 pikselde satırlar
     ~117, 1440 pikselde ~134 karakter. Rahat okuma ölçüsü 50–75 karakter;
     90'ın üstünde göz satır sonundan satır başına dönerken yerini kaybediyor
     ve bülten sitenin ASIL okuma yüzeyi. Ölçü `ch` ile veriliyor (punto
     değişirse birlikte değişiyor) ama `ch` RAKAM genişliğini ölçüyor ve
     ortalama harften geniş: 74ch denendiğinde gerçek satırlar 83–93 karakter
     çıktı, sayılarak doğrulandı.

     KART SÜRÜMÜNDE ÖLÇÜ SINIRI YOK — DENENDİ VE GERİ ALINDI. Kart ana
     kolona taşınınca satırlar 130 karaktere çıktı ve sayfadaki 62ch sınırı
     karta da uygulandı. Ekranda karşılığı kötü çıktı: sayfa sürümü kendi
     kabına oturuyor, kart ise 1240 piksellik tam genişlikte bir blok ve
     metin sol yarıda kalınca sağda avuç içi kadar boş bir alan açılıyor.
     Sınırı boşluğu kapatacak kadar genişletmek de anlamsız — 150ch pratikte
     sınırsız demek. Uzun satırın bedeli, yarısı boş duran bir karttan az.
     Kazanç puntoda alındı: 13/20 denetim ve tablo basamağıydı, 14/22 okuma
     basamağı. Sayfa sürümü sınırını koruyor; tam metin orada okunuyor. */
  const text =
    size === "page"
      ? "max-w-[62ch] text-read leading-[25px]"
      : "text-read leading-[22px]";

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
                /* İki yüzeyde de aynı basamak: gövde 14 punto, başlık 16.
                   Kartta 13'tü ve gövdeyle aynı boya gelmişti. */
                "text-lead",
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
 *
 * SONRA DÖRDE. Kart ana kolona taşındı ve manşet manşet ölçüsüne çıktı; blok
 * artık sayfanın başyazısı gibi duruyor ama açıkta kalan metin o hissi
 * karşılamıyordu. Dördüncü paragraf tipik bültende günün ikinci başlığını
 * tamamlıyor. Beşe çıkarmak sınırı anlamsızlaştırırdı — kart hâlâ bir GİRİŞ,
 * metnin kendisi değil.
 */
const OPEN_LINES = 4;

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
