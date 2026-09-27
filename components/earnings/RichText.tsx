import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { AutoLinker } from "@/lib/autolink";

/**
 * Analiz metinlerindeki satır içi biçimlendirme — yalnızca iki şey:
 * `[metin](/adres)` bağlantısı ve `**kalın**`.
 *
 * NEDEN VAR: rutin, mercek yazılarındaki alışkanlıkla rehber bağlantısı
 * koyuyor ve bunu bazen ham HTML olarak yazıyordu (`<a href="…">`). Alan düz
 * metin basıldığı için etiket ekranda olduğu gibi görünüyordu. Prompt artık
 * markdown istiyor ama tek başına yeterli değil: metni üreten taraf model,
 * yani biçim er ya da geç kayacak. Site okuyabildiğini render eder,
 * okuyamadığını olduğu gibi bırakır.
 *
 * `dangerouslySetInnerHTML` YOK. Metin parçalara ayrılıp React elemanı
 * olarak kuruluyor; kaçmayan bir karakter kalmıyor. Ham HTML gelirse de
 * zararsız biçimde metin olarak basılır — ama artık en azından bağlantı
 * markdown'ı çalıştığı için modelin ona kayma sebebi kalmıyor.
 *
 * Adresler süzülüyor: yalnızca site içi yollar (`/rehber/...`) ve https
 * kabul ediliyor. `javascript:` gibi bir şema geldiğinde bağlantı düşer,
 * metni kalır.
 */

/**
 * Üç kalıp: markdown bağlantısı, `**kalın**` ve — savunma olarak — düpedüz
 * `<a href="…">…</a>`.
 *
 * Sonuncusu prompt'ta yasak ama yazılmış analizlerde var: ekranda etiketin
 * kendisi görünüyordu. Yeniden yazılmalarını beklemek yerine burada
 * karşılanıyor; nasılsa çıktı bir React elemanı, HTML enjeksiyonu değil.
 */
const TOKEN =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|<a\s+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/g;

function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^https:\/\//i.test(href)) return href;
  return null;
}

export function RichText({
  text,
  linker,
}: {
  text: string;
  /**
   * Sözlük ve sembol bağlantısı — `ArticleBody`deki `autoLink`in aynısı ve
   * aynı nesne sayfanın BÜTÜN metin alanlarına geçiyor: analiz özet,
   * bölümler ve madde listeleri olarak parça parça çiziliyor ama "yalnızca
   * ilk geçişte" kuralı analizin tamamına yayılmalı. Yalnızca düz metin
   * parçalarına uygulanıyor; kalın ve bağlantı etiketi olduğu gibi kalıyor.
   */
  linker?: AutoLinker | null;
}) {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  const plain = (segment: string) => {
    if (!linker) {
      nodes.push(segment);
      return;
    }
    for (const piece of linker.split(segment)) {
      if (typeof piece === "string") {
        nodes.push(piece);
        continue;
      }
      nodes.push(
        <Link
          key={key++}
          href={piece.href}
          prefetch={false}
          data-autolink=""
          className="text-primary underline decoration-primary-faint decoration-dotted underline-offset-2 hover:decoration-primary"
        >
          {piece.text}
        </Link>,
      );
    }
  };

  if (linker) {
    for (const match of text.matchAll(TOKEN)) {
      const href = match[2] ?? match[4];
      if (href) linker.claim(href);
    }
  }

  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > cursor) plain(text.slice(cursor, at));

    const [raw, mdText, mdHref, boldText, htmlHref, htmlText] = match;
    const linkText = mdText ?? htmlText;
    const href = mdHref ?? htmlHref;
    if (boldText !== undefined) {
      nodes.push(
        <b key={key++} className="font-bold text-strong">
          {boldText}
        </b>,
      );
    } else {
      const safe = href ? safeHref(href) : null;
      if (!safe) {
        // Adres güvenli değil: bağlantı kurulmaz, görünen metni kalır.
        nodes.push(linkText);
      } else if (safe.startsWith("/")) {
        nodes.push(
          <Link
            key={key++}
            href={safe}
            className="text-primary underline decoration-primary-faint underline-offset-2 hover:decoration-primary"
          >
            {linkText}
          </Link>,
        );
      } else {
        nodes.push(
          <a
            key={key++}
            href={safe}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline decoration-primary-faint underline-offset-2 hover:decoration-primary"
          >
            {linkText}
          </a>,
        );
      }
    }
    cursor = at + raw.length;
  }

  if (cursor < text.length) plain(text.slice(cursor));
  return <>{nodes}</>;
}
