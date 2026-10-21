/* ==========================================================================
   Yazı gövdesinin ayrıştırılması — saf, React'siz

   AYRI MODÜL (20 Ekim). Ayrıştırıcı `ArticleBody.tsx`in içindeydi; orası
   istemci grafiği (`ArticleChart` → veritabanı, i18n) ve simge paketini
   içeri aldığı için `tsx` ile koşan birim testleri onu yükleyemiyordu.
   Test edilemeyen ayrıştırıcıda `#`, `>` ya da ayraçsız `|` ile başlayan
   tek satır dış döngüyü sonsuza kilitlemişti (bkz. `parseBlocks` →
   paragraf). Sözdiziminin anlatımı ve çizim `ArticleBody.tsx`te kalıyor;
   buradaki dışa açık adlar oradan yeniden dışa açılıyor, çağıranlar
   değişmedi. Yeni blok türünün ayrıştırması (`Block`, `parseBlocks`)
   burada, çizimi orada. Testler: `tests/article-parse.test.ts`.
   ========================================================================== */

import { CHART_RANGES, type ChartRange } from "@/lib/providers/types";
import { spaceRanges } from "@/lib/utils";

export type CalloutKind = "ornek" | "dikkat" | "ozet" | "tanim";

/* VARSAYILAN ETİKETLER İKİ DİLLİ. Dördü de sabit Türkçe yazılıydı ve
   bileşen `locale` almıyordu: yazar `::: ozet Summary` gibi kendi etiketini
   verdiği sürece sorun görünmüyor ama etiketi yazılmamış tek bir
   `::: ozet` bloğu İngilizce sayfada "ÖZET" başlığı basıyordu. Mercek
   yazıları ve bilanço analizleri rutinle üretiliyor, etiketin unutulması an
   meselesi. */
const CALLOUT_LABELS: Record<CalloutKind, { tr: string; en: string }> = {
  ornek: { tr: "Örnek", en: "Example" },
  dikkat: { tr: "Dikkat", en: "Heads-Up" },
  ozet: { tr: "Özet", en: "Summary" },
  tanim: { tr: "Tanım", en: "Definition" },
};

/* KENDİ ANAHTARI, `in` DEĞİL (20 Ekim). `in` kalıtılan anahtarları da
   sayıyor: `::: constructor` ya da `::: __proto__` kutu türü geçiyor,
   etiketsizken ayrıştırma `undefined.tr`de, etiketliyken editoryal çizim
   tanımsız ikonda düşüyordu — üyenin tek satırı moderasyon sayfasını
   çökertiyordu. Bilinmeyen tür yine `ozet`e iner. */
function isCalloutKind(value: string): value is CalloutKind {
  return Object.hasOwn(CALLOUT_LABELS, value);
}

/**
 * `**Ne Oldu:** ABD'nin 30 yıllık…` satırını terim ve metne ayırır.
 *
 * Rutinle üretilen özet kutuları neredeyse her zaman bu kalıpta yazılıyor —
 * "Ne Oldu", "Rakam", "Mekanizma", "Bundan Sonrası" — ama yapı yalnızca
 * KALIN METİNDİ: dört ayrı olgu tek bir gri paragraf duvarı olarak
 * okunuyordu. Terim ayrı bir alan olunca çizim onu künye gibi basabiliyor
 * ve dört olgu dört satır oluyor.
 *
 * Kalıba uymayan satır olduğu gibi kalıyor (terim yok): serbest paragraflı
 * kutular — rehber yazılarındaki tanımlar, uzun örnekler — hiç
 * etkilenmiyor.
 */
const CALLOUT_TERM = /^\*\*(.{1,48}?):\*\*\s*(.*)$/;

function parseCalloutLine(line: string): { term: string | null; text: string } {
  const match = CALLOUT_TERM.exec(line.trim());
  if (!match) return { term: null, text: line };
  const [, term, rest] = match;
  /* Metni olmayan bir terim künye değil başlık olurdu; o hâlde satır
     bütün olarak bırakılıyor. */
  if (!rest.trim()) return { term: null, text: line };
  return { term: term.trim(), text: rest.trim() };
}

/* --------------------------------------------------------------------------
   Satır içi

   BAĞLANTININ İKİ PARÇASI SINIRLI (20 Ekim): etiket en çok 300, adres en
   çok 2048 karakter. Sınırsız `[^\]]+` kapanmayan her `[` için satırın
   sonuna kadar tarıyordu; 39 bin `[` ya da tekrarlanan `[a](` üyenin
   40 binlik önizlemesinde 0,4–1,1 saniye tek süreçli sunucuyu kilitliyordu
   (ölçüldü). Sınırla en kötü durum ~50–85 ms. `LINK_PATTERN` aynı sınırı
   taşıyor ki eşleşmeyen uzun bir parça düz metin dalında bağlantıya
   dönmesin.
   -------------------------------------------------------------------------- */

export const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]{1,300}\]\([^)\s]{1,2048}\))/g;
export const LINK_PATTERN = /^\[([^\]]{1,300})\]\(([^)\s]{1,2048})\)$/;

/**
 * Başlık metninden kalıcı bir çapa kimliği.
 *
 * Türkçe harfler ASCII karşılığına iniyor — `toLowerCase()` TEK BAŞINA
 * yetmez ve tehlikelidir: "İ" küçültülünce "i̇" (birleşik nokta) üretiyor ve
 * adres çubuğunda okunmaz bir dizeye dönüşüyor. Eşleme elle yazılı, çünkü
 * `normalize("NFD")` ile aksan atmak "ı" ve "ş" gibi harfleri de öğütüyor.
 */
const ESKI_HARF_ESLEME: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u",
  Ç: "c", Ğ: "g", I: "i", İ: "i", Ö: "o", Ş: "s", Ü: "u",
};

/* ŞAPKALI HARFLER EKLENDİ. Eşlemede â/î/û yoktu ve "Hikâyeye Uymayan
   Taraf" başlığı `#b-hik-yeye-uymayan-taraf` kimliğini alıyordu (ölçüldü,
   fed-ilk-artirim-uzun-uc-dustu rayında); harf düşüyor, yerine boşluk
   tirelenmiş bir kopukluk geliyordu. "Hikâye" ve "Kâr" sekizden fazla
   mercek başlığında geçiyor ve bu kimlikler artık ray ile dar ekran
   içindekiler üzerinden adres çubuğuna ve paylaşılan bağlantılara çıkıyor.
   Eski eşleme `ESKI_HARF_ESLEME` olarak duruyor: `legacyHeadingIds` onunla
   ESKİ kimliği hesaplıyor ve başlığın içine görünmez bir çapa basılıyor,
   yani dışarıda paylaşılmış `#b-hik-yeye-…` bağlantıları da iniyor. */
const HARF_ESLEME: Record<string, string> = {
  ...ESKI_HARF_ESLEME,
  â: "a", î: "i", û: "u", Â: "a", Î: "i", Û: "u",
};

function basligaKimlik(
  text: string,
  esleme: Record<string, string> = HARF_ESLEME,
): string {
  const gövde = [...text]
    .map((ch) => esleme[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return gövde ? `b-${gövde}` : "";
}

/**
 * Gövdedeki her bloğun çapa kimliği — başlık değilse `null`.
 *
 * TEKİLLEŞTİRİLMİŞ. `basligaKimlik` tek başına iki aynı `##` başlığa aynı
 * `id`yi veriyordu (geçersiz HTML; çapa hep ilkine atlıyordu) ve yalnızca
 * sembolden oluşan bir başlığa `id=""` basıyordu. İkinci ve sonraki kopyalar
 * artık `-2`, `-3` ekini alıyor, boş kimlikli başlık hiç `id` almıyor.
 * İLK KOPYANIN KİMLİĞİ DEĞİŞMEDİ: dışarıda paylaşılmış bağlantılar çalışmaya
 * devam ediyor.
 *
 * Dışa açık, çünkü Mercek sayfası içindekiler listesini de buradan kuruyor:
 * liste ile başlığın kimliği aynı fonksiyondan gelmezse bağlantı boşa düşer.
 */
export function headingIds(blocks: readonly Block[]): (string | null)[] {
  return tekilKimlikler(blocks, HARF_ESLEME);
}

function tekilKimlikler(
  blocks: readonly Block[],
  esleme: Record<string, string>,
): (string | null)[] {
  const used = new Set<string>();
  /* KÖK BAŞINA SON EK (20 Ekim). Her kopya eki 2'den yeniden arıyordu:
     8 bin aynı `## a` başlığı (üyenin 40 binlik önizlemesine sığıyor)
     çağrı başına ~2 sn, çizim başına üç çağrı. Kaldığı yerden devam etmek
     aynı kimlikleri verir — `used` yalnızca büyüyor, yani atlanan ekler
     zaten doluydu. */
  const lastCopy = new Map<string, number>();
  return blocks.map((block) => {
    if (block.kind !== "heading") return null;
    const base = basligaKimlik(block.text, esleme);
    if (!base) return null;
    let id = base;
    if (used.has(id)) {
      let copy = lastCopy.get(base) ?? 1;
      do {
        copy += 1;
        id = `${base}-${copy}`;
      } while (used.has(id));
      lastCopy.set(base, copy);
    }
    used.add(id);
    return id;
  });
}

export type SectionItem = { id: string; label: string; number: number };

/**
 * İçindekiler — gövdenin `##` başlıkları, yazıdaki sırasıyla. Mercek ve
 * rehber aynı listeyi kuruyor; ikisi de buradan okuyor.
 *
 * Numara bütün `##` başlıkları sayıyor, yalnızca listelenenleri değil:
 * gövdedeki başlık numarası (CSS sayacı) ile listedeki numara aynı olmalı.
 * Kimliği olmayan başlık (yalnızca sembolden oluşan) sayıda yer tutuyor ama
 * listede yok — bağlantısı olmayan bir satır basılmaz.
 */
export function sectionIndex(blocks: readonly Block[]): SectionItem[] {
  const ids = headingIds(blocks);
  const items: SectionItem[] = [];
  let number = 0;
  blocks.forEach((block, index) => {
    if (block.kind !== "heading" || block.level !== 2) return;
    number += 1;
    const id = ids[index];
    if (id) items.push({ id, label: block.text, number });
  });
  return items;
}

/**
 * Şapkalı harf eşlemesinden ÖNCEKİ kimlik — yalnızca yenisinden farklıysa.
 *
 * Başlık bu kimliği içindeki boş bir `span`e basıyor; içindekiler ve ray
 * yalnızca yeni kimliği kullanıyor. Eski kimlik yeni kimliklerden biriyle
 * çakışırsa (başka bir başlık tam o metni taşıyorsa) basılmıyor: aynı
 * `id` iki kez geçersiz HTML olurdu ve çapa hep ilkine atlardı.
 *
 * `current`: çizim `headingIds`i zaten hesapladıysa ikinci kez
 * hesaplanmasın diye verilir (20 Ekim).
 */
export function legacyHeadingIds(
  blocks: readonly Block[],
  current: readonly (string | null)[] = headingIds(blocks),
): (string | null)[] {
  const taken = new Set(current.filter((id): id is string => id !== null));
  return tekilKimlikler(blocks, ESKI_HARF_ESLEME).map((legacy, index) =>
    legacy && legacy !== current[index] && !taken.has(legacy) ? legacy : null,
  );
}

/**
 * Editoryal çizimde bloğun yazıdaki GÖREVİ.
 *
 * Bu görevler bir dönem CSS'te `:has()` ile metnin biçiminden tahmin
 * ediliyordu ("son paragraf tamamen eğikse not"). Kırılgandı: seçici
 * desteğine ve işaretlemenin o anki şekline bağlıydı, test edilemiyordu.
 * Karar artık ayrıştırılmış bloklardan TS'te veriliyor ve `data-role`
 * olarak basılıyor; CSS yalnızca bu özniteliğe bakıyor.
 *
 *   summary  — yazı bir `:::` kutusuyla AÇILIYORSA o kutu (Genel Özet)
 *   lede     — ilk paragraf (özet kutusundan hemen sonra ya da en başta)
 *   takeaway — ilk sırada olmayan `ozet` kutusu: yazının dersi
 *   note     — sondaki tamamen eğik paragrafların hepsi: kaynak notu ve
 *              varsa ardından gelen düzeltme satırı
 */
export type BlockRole = "summary" | "lede" | "takeaway" | "note";

const ALL_ITALIC = /^\*(?!\*)[^*]+\*$/;

export function blockRoles(blocks: readonly Block[]): (BlockRole | null)[] {
  const roles: (BlockRole | null)[] = blocks.map(() => null);
  if (blocks[0]?.kind === "callout") roles[0] = "summary";
  const ledeAt = roles[0] === "summary" ? 1 : 0;
  if (blocks[ledeAt]?.kind === "paragraph") roles[ledeAt] = "lede";
  blocks.forEach((block, index) => {
    if (index > 0 && block.kind === "callout" && block.tone === "ozet") {
      roles[index] = "takeaway";
    }
  });
  /* SONDAKİ EĞİK PARAGRAFLARIN TAMAMI. Yalnızca son blok bakılıyordu ve
     altı yazıda (iki dil, 12 sayfa) gövde iki eğik paragrafla bitiyor:
     kaynak notu ("Bu yazı … dayanıyor") ve ardından bir düzeltme satırı.
     Not görevini yalnızca kısa düzeltme alıyor, uzun kaynak notu okuma
     puntosunda kalıyordu: astra-bellek-talebi-kospi-4-61'de 390'da 17
     piksel eğik, 224 piksel boy; 1440'ta 18 piksel, 153 piksel. Yürüyüş
     sondan geriye gidiyor ve görevi olan ilk blokta duruyor, yani bir
     lede ya da ders kutusu hiçbir zaman nota çevrilmiyor. */
  for (let i = blocks.length - 1; i > 0 && roles[i] === null; i -= 1) {
    const block = blocks[i];
    if (block.kind !== "paragraph" || !ALL_ITALIC.test(block.text.trim())) break;
    roles[i] = "note";
  }
  return roles;
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
  | {
      kind: "callout";
      tone: CalloutKind;
      label: string;
      /* Satır bir TERİM taşıyabilir: `**Ne Oldu:** …` kalıbı. Ayrıştırma
         çizimde değil burada yapılıyor ki çizim tarafı tek bir şekle
         baksın. */
      lines: { term: string | null; text: string }[];
    }
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

/* DOĞRUSAL DENETİM (20 Ekim). Eski `/^\|?[\s:|-]+\|[\s:|-]*$/` iç içe
   niceleyiciyle geri izliyordu: `|` ile başlayan satırın altındaki 39 bin
   `|` + `x` satırı 3,1 sn sürüyordu (ölçüldü). Aynı küme: satırın tamamı
   boşluk, `:`, `|`, `-`; ilk karakterden SONRA en az bir `|`; en az bir `-`.
   `| - : x`, sekme ve bölünmez boşluktan kurulan, uzunluğu 7'ye kadar
   bütün dizilerde (~960 bin) eskisiyle aynı sonucu veriyor. */
export function isTableDivider(line: string): boolean {
  return /^[\s:|-]+$/.test(line) && line.indexOf("|", 1) !== -1 && line.includes("-");
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
            /* Aralık tiresine ince boşluk — gerekçe `spaceRanges`. */
            return { value: spaceRanges(value), note: rest.join(" · ") };
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
        label: label || CALLOUT_LABELS[tone][locale === "en" ? "en" : "tr"],
        lines: body.map(parseCalloutLine),
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

    /* Paragraf — boş satıra kadar tek metin.

       İLK SATIR HER ZAMAN TÜKETİLİR (20 Ekim). Blok başlatıcıyla kesmek
       yalnız sonraki satırlar için: yukarıdaki dallar `#`, `>` ve `|`'nin
       yalnız dar biçimlerini alıyor (`# `, `> `, ayraçlı tablo). "####",
       ">alıntı" ya da ayraçsız "| a | b |" buraya düşüyor ve ilk satırda
       kesilirse `i` hiç ilerlemiyordu — dış döngü boş paragraf basarak
       sonsuza dönüyor, tek süreçli sunucu bellek bitene kadar kilitleniyordu.
       Üyenin yazı önizlemesi (`previewUserPostBody`) yazarken 700 ms'de bir
       buraya geldiği için tablonun ilk satırını yazıp duraksamak yetiyordu. */
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const current = lines[i].trim();
      if (
        paragraph.length > 0 &&
        (current.startsWith("#") ||
          current.startsWith(">") ||
          current.startsWith(":::") ||
          current.startsWith("|") ||
          /^-{3,}$/.test(current) ||
          bullet.test(current) ||
          numbered.test(current))
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
