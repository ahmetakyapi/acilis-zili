/**
 * "Verilerimi İndir"in biçimi — saf, veritabanına dokunmuyor (testler
 * `tests/account-export.test.ts`). Okuma `lib/account-export.ts`te.
 *
 * NEDEN (28 Eylül). KVKK m. 11 okuyucuya işlenen verisini öğrenme hakkı
 * veriyor ve /kvkk metni hesabı silmenin yolunu gösteriyordu ama
 * verinin kendisini almanın yolunu göstermiyordu: tek seçenek GitHub'dan
 * başvuru yazıp otuz gün beklemekti. Hesabın tuttuğu her alan artık
 * Ayarlar'dan tek tıkla iniyor.
 *
 * NE VAR, NE YOK. Kaydedilen her üye alanı var (KVKK metnindeki tablo):
 * hesap künyesi, dil ve tema, takip listeleri (adı, rengi yani etiketi,
 * sırası), listelerdeki semboller ve notları, profil ikonu. Şifre özeti
 * YOK — geri döndürülemez ve dışarı çıkması yalnızca kırılma denemesine
 * malzeme olur. Rol de yok: bir yetki, okuyucunun verisi değil.
 */

export const EXPORT_FORMAT_VERSION = 1;

export type AccountExport = {
  format: "acilis-zili/account-export";
  version: number;
  exportedAt: string;
  account: {
    username: string;
    email: string;
    locale: string;
    theme: string;
    createdAt: string;
    lastSeenAt: string | null;
  };
  avatar: { icon: string | null; color: string | null } | null;
  watchlists: {
    name: string;
    /** Listenin renk etiketi — token adı ("primary", "brass"…). */
    color: string;
    sortOrder: number;
    createdAt: string;
    items: {
      symbol: string;
      note: string | null;
      sortOrder: number;
      addedAt: string;
    }[];
  }[];
  /**
   * Portföy pozisyonları — `null` tablo okunamadıysa. Boş listeyle
   * karışmasın: "hiç pozisyonun yok" ile "şu an okunamadı" ayrı cevaplar.
   * CSV'de YOK; CSV takip listelerinin tablo biçimi, tam kopya JSON.
   */
  portfolio:
    | {
        symbol: string;
        quantity: number;
        /** Hisse başı alış fiyatı, dolar. */
        costUsd: number;
        /** "YYYY-MM-DD" */
        boughtAt: string;
        note: string | null;
      }[]
    | null;
};

/**
 * Hücre kaçışı (RFC 4180): virgül, tırnak ya da satır sonu varsa tırnağa
 * alınır, içteki tırnak ikilenir.
 *
 * FORMÜL ENJEKSİYONU: `=`, `+`, `-`, `@` ile başlayan hücre bir tablo
 * programında formül olarak çalışır. Not alanı serbest metin; başına tek
 * tırnak konuyor ki dosyayı açan okuyucunun kendi notu ona komut
 * çalıştırmasın.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_HEAD = [
  "list_name",
  "list_color",
  "list_order",
  "symbol",
  "note",
  "item_order",
  "added_at",
] as const;

/**
 * CSV: her satır bir listedeki bir sembol. Tablo programına açılacak
 * biçim bu — hesap künyesi ve profil ikonu tek satırlık bilgiler ve JSON
 * dosyasında. Boş liste de kaybolmasın diye sembolsüz bir satırla yazılıyor.
 *
 * Başta UTF-8 BOM var: Excel onsuz Türkçe karakterleri ("Büyüme") bozuk
 * açıyor.
 */
export function accountExportCsv(data: AccountExport): string {
  const rows: string[] = [CSV_HEAD.join(",")];
  for (const list of data.watchlists) {
    if (list.items.length === 0) {
      rows.push([list.name, list.color, list.sortOrder, null, null, null, null].map(csvCell).join(","));
      continue;
    }
    for (const item of list.items) {
      rows.push(
        [list.name, list.color, list.sortOrder, item.symbol, item.note, item.sortOrder, item.addedAt]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return `﻿${rows.join("\r\n")}\r\n`;
}

/** İndirilen dosyanın adı: "acilis-zili-verilerim-2026-09-28.json". */
export function exportFileName(day: string, extension: "json" | "csv"): string {
  return `acilis-zili-verilerim-${day}.${extension}`;
}
