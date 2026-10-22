import { Fragment, type ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import {
  ArrowDown,
  ArrowRight,
  BookOpenText,
  Lightbulb,
  ListChecks,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { ArticleChart } from "./ArticleChart";
import { cn, safeExternalUrl, tieFigures, titleCaseLabel } from "@/lib/utils";
import type { AutoLinker } from "@/lib/autolink";
import {
  blockRoles,
  headingIds,
  INLINE_PATTERN,
  legacyHeadingIds,
  LINK_PATTERN,
  parseBlocks,
  type Block,
  type CalloutKind,
  type Magnitude,
} from "./parse-blocks";

/* Ayrıştırıcı saf bir modülde (gerekçe `parse-blocks.ts` başında);
   çağıranlar bu adları buradan almayı sürdürüyor. */
export {
  blockRoles,
  headingIds,
  legacyHeadingIds,
  parseBlocks,
  sectionIndex,
} from "./parse-blocks";
export type { Block, BlockRole, Magnitude, SectionItem } from "./parse-blocks";

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

/* Kutunun çizimi. Etiketi yazılmamış kutunun varsayılan başlığı
   ayrıştırmanın parçası: `parse-blocks.ts` → `CALLOUT_LABELS`. */
const CALLOUT: Record<
  CalloutKind,
  {
    box: string;
    kicker: string;
    /** Yalnızca editoryal çizimde (mercek, rehber) etiketin önünde duruyor. */
    icon: Icon;
  }
> = {
  ornek: {
    icon: Lightbulb,
    box: "border-primary-faint bg-primary-tint",
    /* Künye kendi kutusunun tintli zemininde duruyor: `--primary` orada 10
       pikselde 4,36'ya iniyor (gereken 4,5). Kardeş kutu `dikkat` aynı
       sebeple zaten mürekkep tonunu kullanıyor. */
    kicker: "text-primary-ink",
  },
  dikkat: {
    icon: WarningCircle,
    box: "border-brass/35 bg-brass-wash",
    kicker: "text-brass-ink",
  },
  ozet: {
    icon: ListChecks,
    box: "border-line-strong bg-surface-elevated",
    kicker: "text-body",
  },
  tanim: {
    icon: BookOpenText,
    box: "border-line bg-surface",
    kicker: "text-muted",
  },
};

/** Satırın tamamı kalınsa kutunun manşeti — `**Bir cümle.**`. */
const ALL_BOLD = /^\*\*[^*]+\*\*$/;

/**
 * İÇ İÇE BİÇİM ÇALIŞIR — kalının içindeki bağlantı ham metin kalmıyordu.
 *
 * `**[Bilançolar](/bilancolar)**` kalıbı kalın dalına düşüyor ve içerideki
 * metin olduğu gibi basılıyordu: rehberde okuyucunun gördüğü şey, kalın
 * puntoyla yazılmış `[Bilançolar](/bilancolar)` dizesiydi — hem tıklanmıyor
 * hem köşeli parantezler ekranda duruyordu. Depoda dört yerde var (iki dil ×
 * iki yazı) ve mercek gövdeleri veritabanından geldiği için ileride yenisi
 * yazılabilir. Kalın ve eğik artık içeriğini yeniden çözümlüyor; bağlantının
 * etiketi de öyle, yani `[**Kalın**](/adres)` de çalışıyor.
 *
 * Özyineleme kendiliğinden bitiyor: her adımda işaretçiler kırpılıyor, yani
 * bir sonraki metin aynı kalıba bir daha uymuyor. `kod` dalı BİLEREK dışarıda
 * — kod verbatim demektir, içinde biçim aranmaz.
 */
function renderInline(
  text: string,
  keyPrefix: string,
  /* Otomatik bağlantı (sözlük terimi, sembol). Bağlantı etiketinin içine
     GEÇİRİLMİYOR: `<a>` içinde `<a>` geçersiz HTML ve yazarın bağlantısı
     zaten bir hedef. Kod da dışarıda — kod verbatim. */
  linker?: AutoLinker | null,
  /* Kullanıcı içeriği (topluluk yazısı): dış bağlantı `ugc nofollow`
     taşır — Google'ın kullanıcı bağlantıları için istediği işaret; spam
     bağlantısının siteye iliştirilmesini de boşa çıkarır. */
  ugc = false,
): React.ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        /* `[&_a]` : içerideki bağlantı kendi `font-medium`ini taşıyor ve
           kalının ağırlığını yutuyordu — `**[Bilançolar](/bilancolar)**`
           komşu kalın etiketlerden bir kademe ince duruyordu. Torun
           seçici özgüllükte kazanıyor, yani bağlantı hem mavi hem kalın. */
        <strong key={key} className="font-semibold text-strong [&_a]:font-semibold">
          {renderInline(part.slice(2, -2), key, linker, ugc)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={key} className="italic">
          {renderInline(part.slice(1, -1), key, linker, ugc)}
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
      /* "/" tek başına İÇ YOL kanıtı değil (15 Ekim taraması): "//evil.com"
         protokol-göreli DIŞ adrestir ve tarayıcı "\"yi "/" saydığı için
         "/\evil.com" da öyle — ikisi de startsWith("/")'i geçip şema
         süzgecine hiç uğramadan <Link>'e biniyordu. Aynı "//" sınıfı
         safeRedirectTarget'ta (app/actions/auth.ts) zaten kapalı. */
      const internal =
        href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
      const className =
        /* `--primary` düz zeminde 4,63 ile geçiyor ama makale bağlantılarının
           çoğu RENKLİ KUTULARIN içinde (dikkat, ornek, ozet): orada zemin bir
           tık koyulaşıyor ve oran 4,01'e iniyor (ölçüldü, mercek yazısında
           14 piksel). `--primary-ink` tam bu iş için var — düz zeminde 5,75,
           kutuların içinde 5,4 — ve gözle iki ton neredeyse ayırt edilmiyor. */
        "font-medium text-primary-ink underline decoration-primary-faint underline-offset-2 transition-colors hover:text-primary-hover";

      if (internal) {
        return (
          <Link key={key} href={href} className={className}>
            {renderInline(label!, key, null, ugc)}
          </Link>
        );
      }

      /* Mercek yazıları /api/mercek üzerinden geliyor, yani gövdeyi biz
         yazmıyoruz. `[tıkla](javascript:…)` bağlantısı JSX kaçışından
         geçer — href öznitelikleri kaçışın kapsamı dışında. Şema
         süzülmezse bağlantı düz metne düşer. */
      const external = safeExternalUrl(href);
      if (!external) return <span key={key}>{renderInline(label!, key, null, ugc)}</span>;

      return (
        <a
          key={key}
          href={external}
          target="_blank"
          rel={ugc ? "ugc nofollow noreferrer noopener" : "noreferrer noopener"}
          className={className}
        >
          {renderInline(label!, key, null, ugc)}
        </a>
      );
    }

    if (linker) {
      const pieces = linker.split(part);
      if (pieces.length > 1 || typeof pieces[0] !== "string") {
        return (
          <span key={key}>
            {pieces.map((piece, pieceIndex) =>
              typeof piece === "string" ? (
                piece
              ) : (
                <Link
                  key={pieceIndex}
                  href={piece.href}
                  prefetch={false}
                  data-autolink=""
                  className={AUTO_LINK_CLASS}
                >
                  {piece.text}
                </Link>
              ),
            )}
          </span>
        );
      }
    }

    return <span key={key}>{part}</span>;
  });
}

/* OTOMATİK BAĞLANTI YAZARINKİNDEN BİR TON SESSİZ. Aynı mavi ve aynı
   kontrast (`--primary-ink`, gerekçesi yukarıda) ama alt çizgi noktalı:
   bir paragrafta beş terim bağlandığında düz çizgiler metni bir bağlantı
   listesine çeviriyordu. Noktalı çizgi "burada bir tanım var" diyor,
   "buradan git" demiyor. `prefetch={false}`: yazı başına yirmi bağlantı
   yirmi ön yükleme isteği demekti. */
const AUTO_LINK_CLASS =
  "text-primary-ink underline decoration-primary-faint decoration-dotted underline-offset-2 transition-colors hover:text-primary-hover";

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
        data-part="value"
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

/**
 * Şapkalı harf eşlemesinden önce paylaşılmış bağlantının indiği çapa.
 *
 * Başlığın İÇİNDE, boş ve satır içi: çapa atlaması başlığın ilk satırına
 * iniyor ve `html`in `scroll-padding-block`u burada da geçerli, yani eski
 * `#b-hik-yeye-…` bağlantısı yenisiyle aynı yere düşüyor. Metni olmadığı
 * için ne görünüyor ne okunuyor; rehber ve KVKK çizimi piksel piksel aynı.
 */
function LegacyAnchor({ id }: { id: string | null | undefined }) {
  if (!id) return null;
  return <span id={id} aria-hidden="true" />;
}

/* --------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

export function ArticleBody({
  markdown,
  locale = "tr",
  className,
  chartPlaceholder = false,
  blocks: blocksProp,
  variant = "default",
  skipIndex,
  afterLead,
  autoLink,
  ugc = false,
}: {
  markdown: string;
  /** Etiketi yazılmamış `:::` kutularının varsayılan başlığı bundan gelir. */
  locale?: string;
  className?: string;
  /**
   * `::: grafik` bloklarını GERÇEK grafik yerine künyeli bir yer tutucu
   * olarak çizer — yalnızca yönetim panelinin önizlemesi kullanıyor.
   *
   * NEDEN: önizleme bir sunucu eyleminin döndürdüğü JSX ve o ağaçtaki
   * `ArticleChart`, `PriceChartLazy` adında bir İSTEMCİ bileşeni yüklüyor.
   * Sunucu eyleminin istemci manifestinde o modül bulunmuyor ve React
   * "Could not find the module … in the React Client Manifest" diye
   * düşüyordu — ölçüldü, hata birebir buydu ve grafik bloğu taşıyan her
   * yazının önizlemesi bu yüzden açılmıyordu.
   *
   * Yer tutucu bir kayıp değil: editörün işi metni denetlemek ve grafiğin
   * içeriği metinden gelmiyor, sembol ile aralıktan geliyor — ikisi de
   * kutunun üstünde yazıyor. Yayındaki sayfada gerçek grafik çiziliyor.
   */
  chartPlaceholder?: boolean;
  /**
   * Önceden ayrıştırılmış gövde. Mercek sayfası içindekiler listesini ve
   * kapaktaki rakam bloğunu AYNI ayrıştırmadan kuruyor; bloklar buradan
   * verilince `skipIndex` ile `headingIds` aynı diziye bakıyor ve ikinci
   * bir ayrıştırmanın farklı bir `locale` ile kayması ihtimali kalmıyor.
   */
  blocks?: Block[];
  /**
   * `editorial`: Mercek ve rehberin okuma çizimi. Yalnızca `data-variant`,
   * `data-role` ve etiket ikonlarını ekliyor; görünüşün tamamı
   * `ArticleEditorial.module.css` içinde ve yalnızca oradan gelen sınıfla
   * açılıyor. KVKK ve panel önizlemesi `default` kalıyor ve piksel piksel
   * aynı çiziliyor.
   */
  variant?: "default" | "editorial";
  /** Bu sıradaki blok çizilmez — kapakta zaten eksiksiz duran rakam bloğu. */
  skipIndex?: number;
  /**
   * İlk bloktan sonra (ilk blok bir `:::` kutusuysa) ya da ilk bloktan önce
   * basılan düğüm. Mercek'te dar ekranın içindekiler kutusu buraya iniyor:
   * özetin altında, ilk paragrafın üstünde.
   */
  afterLead?: ReactNode;
  /**
   * Sözlük terimi ve sembol bağlantısı — İSTEĞE BAĞLI. Mercek, rehber ve
   * sözlük sayfası açıyor; KVKK ve panel önizlemesi açmıyor. Hukuk
   * metninde bir terimin sözlüğe gitmesi metnin bağlayıcı tanımını
   * bulandırır; önizleme ise bir sunucu eylemi ve orada sembol kümesi için
   * veritabanına gitmek, editörün her tuşunu bir sorguya bağlardı.
   *
   * Durum TUTAN bir nesne: "yalnızca ilk geçişte" kuralı yazının tamamına
   * yayılıyor ve bloklar sırayla çizildiği için ilk geçiş belge sırasındaki
   * ilk geçiş. Her çizim kendi nesnesini kurar (`lib/autolink-data.ts` →
   * `articleAutoLinker`); iki yazı aynı nesneyi paylaşmamalı.
   */
  autoLink?: AutoLinker | null;
  /** Gövde okuyucunun yazdığı metin (topluluk): dış bağlantılar `ugc nofollow`. */
  ugc?: boolean;
}) {
  const blocks = blocksProp ?? parseBlocks(markdown, locale);
  /* Yazarın elle verdiği sözlük ve hisse bağlantıları hedefi tüketiyor:
     gövde "[NVDA](/hisse/NVDA)" diyorsa ondan önceki ya da sonraki
     "(NVDA)" ikinci bir bağlantı almıyor. Blok ayrıştırmasından değil ham
     metinden okunuyor — bağlantı her blok türünün içinde durabilir. */
  if (autoLink) {
    for (const match of markdown.matchAll(/\]\((\/(?:sozluk|hisse)\/[^)\s]+)\)/g)) {
      autoLink.claim(match[1]);
    }
  }
  const ids = headingIds(blocks);
  const legacyIds = legacyHeadingIds(blocks, ids);
  const editorial = variant === "editorial";
  const roles = editorial ? blockRoles(blocks) : null;
  const leadAfterFirst = blocks[0]?.kind === "callout";

  const rendered = blocks.map((block, index) => {
        const key = `b${index}`;
        if (index === skipIndex) return null;
        const role = roles?.[index] ?? undefined;

        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              /* BAŞLIKLARIN `id`si VAR. Yazılar ortalama beş `##` başlık
                 taşıyor ve hiçbirine bağlantı verilemiyordu; `globals.css`
                 içindeki `scroll-padding-block` da hedefsiz kaldığı için
                 boşa yazılmıştı. Kimlik metinden türüyor (`headingIds`),
                 yani içerik değişmedikçe bağlantı da değişmiyor. */
              <h2
                key={key}
                id={ids[index] ?? undefined}
                data-block="heading"
                className="display-ink display-ink-tight mt-3 w-fit text-title font-bold tracking-[-0.03em] sm:text-heading"
              >
                <LegacyAnchor id={legacyIds[index]} />
                {block.text}
              </h2>
            ) : (
              <h3
                key={key}
                id={ids[index] ?? undefined}
                data-block="heading"
                className="mt-1 text-lead font-bold tracking-[-0.02em] text-strong"
              >
                <LegacyAnchor id={legacyIds[index]} />
                {block.text}
              </h3>
            );

          case "paragraph":
            return (
              /* PUNTO HER GENİŞLİKTE 14. `sm:text-base` bir REGRESYON:
                 yazıldığı gün `--text-base` diye bir token yoktu ve
                 `text-base` Tailwind'in 16 pikseli demekti, yani niyet
                 640 pikselden sonra metni BÜYÜTMEKTİ. Token ölçeği
                 kurulduğunda `--text-base` 13 piksele oturdu ve aynı sınıf
                 sessizce tersine döndü: geniş ekranda gövde 14'ten 13'e
                 iniyordu. Daha kötüsü aynı sütundaki liste, alıntı ve metin
                 kutuları 14'te kaldığı için masaüstünde paragraftan SONRA
                 gelen liste büyüyor gibi görünüyordu — tek sütunda dört
                 farklı boy. Satır arası da 13 puntoda 2,15 orana çıkıyordu.
                 Bu, sitenin asıl okuma yüzeyi; ölçek tek basamakta. */
              <p
                key={key}
                data-block="paragraph"
                data-role={role}
                className="text-read leading-[28px] text-body"
              >
                {renderInline(block.text, key, autoLink, ugc)}
              </p>
            );

          case "list":
            return (
              <ul
                key={key}
                data-block="list"
                data-ordered={block.ordered || undefined}
                className="flex flex-col gap-2.5"
              >
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
                    <span>{renderInline(item, `${key}-${itemIndex}`, autoLink, ugc)}</span>
                  </li>
                ))}
              </ul>
            );

          case "quote":
            return (
              <blockquote
                key={key}
                data-block="quote"
                className="border-l-2 border-primary-faint pl-4 text-read italic leading-[28px] text-soft"
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>
                    {renderInline(line, `${key}-${lineIndex}`, autoLink, ugc)}
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
                data-block="table"
                data-cols={block.head.length}
                className="scroll-x rounded-(--radius-lg) border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
                tabIndex={0}
                role="region"
                aria-label={locale === "en" ? "Table" : "Tablo"}
              >
                {/* ASGARİ GENİŞLİK YALNIZCA `sm` ÜSTÜNDE. 420 piksellik
                    taban her genişlikte geçerliydi ve 352 piksellik telefon
                    kabında tabloyu yatay kaydırmaya zorluyordu: KVKK
                    sayfasındaki beş tablonun beşi de sağ sütununu ancak
                    parmakla kaydırınca gösteriyordu. İki-üç sütunlu bu
                    tablolarda hücre metninin sarması kaydırmadan iyi —
                    dar ekranda dolgu ve punto da bir kademe iniyor. */}
                <table className="w-full text-left text-small sm:min-w-[420px] sm:text-base">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      {block.head.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          className="px-2.5 py-2 text-nano font-bold text-muted sm:px-4 sm:py-2.5 sm:text-tiny"
                        >
                          {/* Başlık satırı Title Case (CLAUDE.md): rutin
                              "Neden önemli" diye yazıyordu. */}
                          {titleCaseLabel(cell, locale)}
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
                            /* Sütun adı hücrenin üstünde: editoryal görünüm
                               dar ekranda satırı karta çeviriyor ve başlık
                               satırı görünmüyor (ArticleEditorial.module.css). */
                            data-label={cellIndex > 0 ? titleCaseLabel(block.head[cellIndex] ?? "", locale) : undefined}
                            className={cn(
                              "px-2.5 py-2 align-top leading-[18px] sm:px-4 sm:py-2.5 sm:leading-[22px]",
                              cellIndex === 0
                                ? "font-semibold text-strong"
                                : "text-body",
                            )}
                          >
                            {/* Sayı birimine bağlı, aralık tiresi nefesli
                                (`tieFigures`): dar hücrede "50,6–51,9 Mr" /
                                "$" diye kırılıyordu (sahibinin ekran
                                görüntüsü, 390). */}
                            {renderInline(tieFigures(cell), `${key}-${rowIndex}-${cellIndex}`, autoLink, ugc)}
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
              <div key={key} data-block="stats" className="oku-blok flex flex-col gap-2.5">
                {block.label && (
                  <p data-part="label" className="plate text-nano">
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
                      data-part="cell"
                      className="rounded-(--radius-lg) border border-line bg-surface px-3.5 py-3"
                    >
                      {/* Değer bazen SAYI DEĞİL KELİME ("Participation",
                          "Hourly earnings" — rehber, istihdam). Rakam
                          puntosunda 167 piksellik hücreden 27 piksel
                          taşıyordu (1440, EN, ölçüldü); kelime değer
                          editoryal çizimde bir kademe küçük basılıyor. */}
                      <p
                        data-part="value"
                        data-word={/\d/.test(item.value) ? undefined : ""}
                        className="tote text-title leading-none sm:text-heading"
                      >
                        {titleCaseLabel(item.value, locale)}
                      </p>
                      {/* KÜNYE TITLE CASE (26 Eylül). Rakamın altındaki satır bir
                          künye, cümle değil ("Teklifte Boğazın Açılmasına Kalan
                          Süre"); rutin cümle düzeninde yazıyordu. Dönüşüm
                          çizimde, Türkçe kuralıyla (`titleCaseLabel`). Değerin
                          birimi de ("7 gün" → "7 Gün"). */}
                      <p data-part="note" className="mt-1.5 text-tiny leading-[16px] text-muted">
                        {titleCaseLabel(item.note, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );

          /* Zaman çizelgesi — kronolojiyi paragrafa gömmek yerine gösterir. */
          case "timeline":
            return (
              <div key={key} data-block="timeline" className="oku-blok flex flex-col gap-2.5">
                {block.label && (
                  <p data-part="label" className="plate text-nano">
                    {block.label}
                  </p>
                )}
                <ol className="flex flex-col">
                  {block.items.map((item, itemIndex) => {
                    const last = itemIndex === block.items.length - 1;
                    return (
                      <li key={itemIndex} data-part="event" className="flex gap-3.5">
                        <span
                          aria-hidden
                          data-part="axis"
                          className="relative w-3 shrink-0"
                        >
                          <span className="absolute left-0 top-[7px] size-3 rounded-full border-2 border-primary bg-page" />
                          {!last && (
                            <span className="absolute bottom-0 left-[5px] top-5 w-0.5 rounded-full bg-primary-faint" />
                          )}
                        </span>
                        <span data-part="body" className={cn("min-w-0", !last && "pb-4")}>
                          <span data-part="when" className="numeral block text-small font-bold text-primary">
                            {item.when}
                          </span>
                          <span data-part="text" className="mt-1 block text-read leading-[24px] text-body">
                            {renderInline(item.text, `${key}-${itemIndex}`, autoLink, ugc)}
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
              <figure key={key} data-block="bars" className="oku-blok flex flex-col gap-2.5" data-article-visual="bars">
                {block.label && (
                  <figcaption data-part="label" className="plate text-nano">
                    {block.label}
                  </figcaption>
                )}
                <div className="flex flex-col gap-4">
                  {/* İKİ SATIR: üstte ad ve değer, altta tam genişlikte çubuk.
                      Üçü bir dönem tek satırdaydı ve ad sütunu SABİT genişlik
                      taşıyordu (dar ekranda 122px). Ölçüldü: 390 piksellik
                      ekranda makale satırı 290 piksel, yani 122 + 12 + 82 +
                      12 + 62 — ada 122 piksel, çubuğa yalnızca 82. Ad
                      `truncate` ile kırpılıyordu ve bu blokta adlar uzun
                      oluyor ("SK Securities (geri alımı yürütecek aracı
                      kurum)"); kırpılınca satırın neyi ölçtüğü okunmuyordu.

                      Sabit genişliklerin üçü de gitti: ad kalan alanı alıyor
                      ve gerekirse SARIYOR, çubuk kendi satırında tam genişlik
                      kullanıyor. Kalıp bu dosyadaki `pay` bloğuyla aynı —
                      iki çizim bloğu artık aynı düzeni kuruyor. */}
                  {block.items.map((item, itemIndex) => (
                    <div key={itemIndex} data-part="row" className="flex flex-col gap-1.5">
                      <div className="flex items-baseline gap-3 text-base">
                        <span data-part="name" className="min-w-0 flex-1 text-body">
                          {item.name}
                        </span>
                        <span
                          data-part="value"
                          className={cn(
                            "numeral shrink-0 font-semibold",
                            item.value < 0 ? "text-down" : "text-up",
                          )}
                        >
                          {item.display}
                        </span>
                      </div>
                      <span data-part="track" className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                        <span
                          data-motion-draw="line"
                          className={cn(
                            "oku-bar block h-full rounded-full",
                            item.value < 0 ? "bg-down" : "bg-up",
                          )}
                          style={{
                            width: `${(Math.abs(item.value) / peak) * 100}%`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </figure>
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
              <div key={key} data-block="share" className="oku-blok flex flex-col gap-2.5">
                {block.label && (
                  <p data-part="label" className="plate text-nano">
                    {block.label}
                  </p>
                )}
                <div data-part="panel" className="rounded-(--radius-lg) border border-line bg-surface px-4 py-4">
                  {/* ÖLÇEK KABA VERİLİYOR, SEGMENTLERE DEĞİL: her segment
                      kendi içinde büyüseydi aralarındaki 2 piksellik boşluklar
                      da ölçeklenir ve şerit büyürken kayardı. Kap soldan
                      büyüyor, paylar baştan doğru oranda. */}
                  <div data-part="track" className="oku-bar flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full" data-motion-draw="line">
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
                  <ul data-part="legend" className="mt-3.5 flex flex-col gap-2">
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
              <div key={key} data-block="flow" className="oku-blok flex flex-col gap-2.5">
                {block.label && (
                  <p data-part="label" className="plate text-nano">
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
                          {/* Metin oku (↓ →) yerine ikon: glif her yazı
                              tipinde ayrı boyda ve ayrı taban çizgisinde
                              duruyordu. */}
                          <ArrowDown size={18} weight="bold" aria-hidden className="sm:hidden" />
                          <ArrowRight size={18} weight="bold" aria-hidden className="hidden sm:block" />
                        </li>
                      )}
                      <li data-part="step" className="flex min-w-0 flex-col rounded-(--radius-lg) border border-line bg-surface px-3.5 py-3 sm:flex-1">
                        <span className="numeral text-nano font-bold text-primary">
                          {String(itemIndex + 1).padStart(2, "0")}
                        </span>
                        <span data-part="name" className="mt-1 text-base font-bold leading-tight text-strong">
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
              <div key={key} data-block="shift" className="oku-blok flex flex-col gap-2.5">
                {block.label && (
                  <p data-part="label" className="plate text-nano">
                    {block.label}
                  </p>
                )}
                <div data-part="panel" className="flex flex-col gap-3 rounded-(--radius-lg) border border-line bg-surface px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <Side value={block.from} />

                  <span
                    aria-hidden
                    className="select-none text-read leading-none text-primary-soft sm:shrink-0 sm:text-lead"
                  >
                    <ArrowDown size={18} weight="bold" aria-hidden className="sm:hidden" />
                    <ArrowRight size={22} weight="bold" aria-hidden className="hidden sm:block" />
                  </span>

                  <Side value={block.to} tone={tone} />

                  {block.deltaPct !== null && (
                    <span
                      data-part="delta"
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
            if (chartPlaceholder) {
              return (
                <figure
                  key={key}
                  data-block="chart-placeholder"
                  className="m-0 flex flex-col gap-2 rounded-(--radius-lg) border border-dashed border-line-strong bg-surface-sunken px-4 py-6 text-center"
                >
                  <span className="numeral text-base font-bold text-strong">
                    {block.symbol} · {block.range}
                  </span>
                  <span className="text-small text-muted">
                    Grafik yayındaki sayfada çizilir
                  </span>
                  {block.caption && (
                    <figcaption className="text-small text-body">
                      {block.caption}
                    </figcaption>
                  )}
                </figure>
              );
            }
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
            /* ETİKETLİ KUTU BİR TANIM LİSTESİ.
               Özet kutuları "Ne Oldu · Rakam · Mekanizma · Bundan Sonrası"
               diye dört ayrı OLGU taşıyor ama ekranda tek bir gri paragraf
               duvarıydı: etiketler yalnızca satır başındaki kalın metindi ve
               göz nereden nereye baktığını ancak okuyarak buluyordu. Ölçüldü,
               390 pikselde kutu 402 piksel — dört olgu için bir ekran boyu.

               Şimdi her olgu kendi satırı: etiket künye tipografisinde
               (`plate` ailesi, küçük ve seyrek), metin okuma puntosunda ve
               ikisi hairline'la ayrılmış. Geniş ekranda etiket sola sabit bir
               sütuna çekiliyor — künye ile metin aynı hizada başlıyor ve kutu
               bir künye tablosu gibi taranıyor.

               ETİKETSİZ SATIR ESKİSİ GİBİ. Rehberdeki tanım kutuları ve uzun
               örnekler serbest paragraf; onlar için liste açılmıyor, sıradan
               paragraf olarak basılıyorlar. */
            const terimli = block.lines.some((line) => line.term !== null);
            const ToneIcon = tone.icon;
            return (
              <aside
                key={key}
                data-block="callout"
                data-tone={block.tone}
                data-role={role}
                className={cn(
                  "rounded-(--radius-lg) border px-4 py-3.5 sm:px-5 sm:py-4",
                  tone.box,
                )}
              >
                <p
                  data-part="label"
                  className={cn(
                    "text-nano font-bold tracking-[0.02em]",
                    tone.kicker,
                  )}
                >
                  {editorial && (
                    <ToneIcon size={16} weight="bold" aria-hidden />
                  )}
                  {block.label}
                </p>
                {terimli ? (
                  <dl className="mt-3 flex flex-col">
                    {block.lines.map((line, lineIndex) => (
                      <div
                        key={lineIndex}
                        data-part="row"
                        className={cn(
                          "flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0",
                          "sm:flex-row sm:gap-4",
                          lineIndex > 0 && "border-t border-line-soft",
                        )}
                      >
                        {line.term && (
                          <dt data-part="term" className="shrink-0 text-nano font-bold leading-[18px] tracking-[0.02em] text-muted sm:w-[136px] sm:pt-[3px]">
                            {line.term}
                          </dt>
                        )}
                        <dd
                          data-part="def"
                          className={cn(
                            "min-w-0 text-read leading-[25px] text-body",
                            /* Etiketsiz satır iki sütunu birden alıyor:
                               etiket sütununun altında öksüz kalmasın. */
                            !line.term && "sm:ml-0",
                          )}
                        >
                          {renderInline(line.text, `${key}-${lineIndex}`, autoLink, ugc)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {block.lines.map((line, lineIndex) => (
                      <p
                        key={lineIndex}
                        /* Kutunun ilk satırı baştan sona kalınsa o satır
                           kutunun MANŞETİ: editoryal çizim onu büyük
                           basıyor (bkz. ArticleEditorial `lead`). */
                        data-part={
                          editorial && lineIndex === 0 && ALL_BOLD.test(line.text.trim())
                            ? "lead"
                            : undefined
                        }
                        className="text-read leading-[25px] text-body"
                      >
                        {renderInline(line.text, `${key}-${lineIndex}`, autoLink, ugc)}
                      </p>
                    ))}
                  </div>
                )}
              </aside>
            );
          }
        }
      });

  return (
    <div
      className={cn("flex flex-col gap-[18px]", className)}
      data-variant={editorial ? "editorial" : undefined}
    >
      {afterLead && !leadAfterFirst && afterLead}
      {rendered.map((node, index) =>
        index === 0 && afterLead && leadAfterFirst ? (
          <Fragment key="lead">
            {node}
            {afterLead}
          </Fragment>
        ) : (
          node
        ),
      )}
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
