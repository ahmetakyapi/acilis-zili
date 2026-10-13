import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Rutin kuralları — TEK KAYNAK (`content/kurallar/*.md`).
 *
 * NEDEN (13 Ekim). Paragraf bütünlüğü, para birimi, "sayı/rakam", özel ad
 * tablosu, meslek terimleri ve sayı biçimi dört talimatta ayrı ayrı
 * yazılıydı. Talimat sınırı 65.536 bayt; Mercek 53,7 KB, Bilanço 57,0 KB'a
 * gelmişti ve bir kuralı düzeltmek dört yeri düzeltmek demekti (biri hep
 * unutuluyor). Artık her talimat koşunun başında `/api/kurallar?gorev=…`
 * okuyor: ortak dosya + göreve özgü ek, tek metin.
 *
 * DOSYA, VERİTABANI DEĞİL: kural değişikliği bir commit, geçmişi `git log`.
 * Sunucu depo kopyasından (`WorkingDirectory=/srv/acilis-zili/current`)
 * okuyor; `next start` derlenmiş çıktıyı değil çalışma dizinini görüyor.
 *
 * TASLAK KAPISI. Dosyanın ilk satırı `<!-- durum: taslak -->` ise uç 503
 * döner: talimatlar ortak kuralları bu uca devrettikten sonra boş ya da
 * yarım bir dosya sessizce "kural yok" demek olurdu. Rutin 503'te koşuyu
 * durdurur, kuralsız yazmaz.
 *
 * SÜRÜM, içeriğin özeti (`X-Kurallar-Surum`): elle artırılan bir numara
 * unutulur, özet unutulmaz. Rutin yazdığı kaydın künyesine bu sürümü
 * koyabilir; hangi kuralla yazıldığı sonradan okunur.
 */

export const KURAL_GOREVLERI = ["mercek", "bilanco", "gunluk", "haftalik"] as const;
export type KuralGorevi = (typeof KURAL_GOREVLERI)[number];

export function isKuralGorevi(value: string | null): value is KuralGorevi {
  return value !== null && (KURAL_GOREVLERI as readonly string[]).includes(value);
}

const DIR = path.join(process.cwd(), "content", "kurallar");
const TASLAK = /^<!--\s*durum:\s*taslak\s*-->/;

export type KurallarSonucu =
  | { ok: true; text: string; version: string; files: string[] }
  | { ok: false; reason: "draft" | "missing"; files: string[] };

/** Saf birleştirme — test edilebilir. */
export function birlestir(parcalar: { file: string; text: string }[]): KurallarSonucu {
  const files = parcalar.map((parca) => parca.file);
  const drafts = parcalar.filter((parca) => TASLAK.test(parca.text.trimStart()));
  if (drafts.length > 0) return { ok: false, reason: "draft", files: drafts.map((parca) => parca.file) };
  const text = parcalar.map((parca) => parca.text.trim()).join("\n\n---\n\n") + "\n";
  const version = createHash("sha256").update(text).digest("hex").slice(0, 12);
  return { ok: true, text, version, files };
}

export async function kurallariOku(gorev: KuralGorevi): Promise<KurallarSonucu> {
  const files = ["ortak.md", `${gorev}.md`];
  try {
    const parcalar = await Promise.all(
      files.map(async (file) => ({ file, text: await readFile(path.join(DIR, file), "utf8") })),
    );
    return birlestir(parcalar);
  } catch {
    return { ok: false, reason: "missing", files };
  }
}
