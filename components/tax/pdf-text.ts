/**
 * PDF → metin satırları, TARAYICIDA.
 *
 * `pdfjs-dist` yalnızca bu modül içe aktarıldığında yükleniyor ve bu modül
 * de yalnızca okuyucu bir PDF seçtiğinde (`StatementImport` → dinamik
 * `import()`). Sayfanın ilk JS'ine hiçbir parçası girmiyor; ölçüm
 * TaxCalculator başındaki notta.
 *
 * AĞA ÇIKAN TEK ŞEY çalışan (worker) dosyasının kendisi ve o da bu sitenin
 * kendi statik dosyası. Belge `data` olarak veriliyor: pdf.js dosyayı hiçbir
 * yere göndermiyor, yazı tipi ya da CMap indirmiyor (`disableFontFace`,
 * `useSystemFonts: false`). Belgenin içindeki formlar (XFA) da açılmıyor.
 *
 * SATIRLAR NASIL KURULUYOR. pdf.js metni parça parça veriyor (her parça bir
 * konumla). Aynı yatay hatta duran parçalar bir satır; hat, parçanın dikey
 * konumu ve yazı boyunun yarısı kadar bir payla eşleşiyor. Satır içinde
 * parçalar soldan sağa diziliyor ve aralarındaki boşluk yazı boyundan
 * büyükse SEKME ile birleşiyor: tablolarda sekme sütun sınırıdır ve
 * ayrıştırıcı ("Apple Inc." gibi) boşluklu hücreleri böyle ayırabiliyor.
 */

export class PdfPasswordError extends Error {
  constructor(readonly wrong: boolean) {
    super("password");
  }
}

type Piece = { x: number; y: number; w: number; h: number; str: string };

/** Aynı satır sayılan dikey sapma, yazı boyunun oranı olarak. */
const LINE_TOLERANCE = 0.5;
/** Bu genişlikten büyük boşluk sütun sınırı: yazı boyunun katı. */
const CELL_GAP = 0.9;
/** Bundan küçük boşluk aynı sözcüğün parçası (harf aralığı), punto birimi. */
const WORD_GAP = 0.5;
/** pdf.js'nin `PasswordResponses.INCORRECT_PASSWORD` değeri. */
const WRONG_PASSWORD = 2;

let workerPort: Worker | null = null;

export async function pdfLines(
  file: File,
  options: { password?: string; onPage?: (page: number, total: number) => void } = {},
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerPort) {
    /* `new URL(…, import.meta.url)` derleyiciye çalışanı ayrı bir dosya
       olarak paketlemesini söylüyor; sürüm kütüphaneyle hep aynı kalıyor
       (public/ altına elle kopyalanan bir çalışan sürüm kayardı). */
    workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    pdfjs.GlobalWorkerOptions.workerPort = workerPort;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({
    data,
    password: options.password,
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (error) {
    if (error instanceof pdfjs.PasswordException) {
      throw new PdfPasswordError(error.code === WRONG_PASSWORD);
    }
    throw error;
  }

  const lines: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      options.onPage?.(n, doc.numPages);
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const pieces: Piece[] = [];
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const [, , , scaleY, x, y] = item.transform as number[];
        pieces.push({ x, y, w: item.width, h: Math.abs(scaleY) || item.height || 1, str: item.str });
      }
      lines.push(...groupLines(pieces));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return lines;
}

/** Parçaları satırlara: yukarıdan aşağı, soldan sağa. Saf; ayrıca sınanabilir. */
export function groupLines(pieces: readonly Piece[]): string[] {
  const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Piece[][] = [];
  for (const piece of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - piece.y) <= Math.max(row[0].h, piece.h) * LINE_TOLERANCE) row.push(piece);
    else rows.push([piece]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let text = "";
    let end = Number.NEGATIVE_INFINITY;
    for (const piece of row) {
      if (text !== "") {
        const gap = piece.x - end;
        text += gap > piece.h * CELL_GAP ? "\t" : gap > WORD_GAP ? " " : "";
      }
      text += piece.str;
      end = piece.x + piece.w;
    }
    return text.replace(/[ ]+/g, " ").trim();
  });
}
