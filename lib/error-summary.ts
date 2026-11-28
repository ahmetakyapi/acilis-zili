/**
 * HATA SATIRININ OKUNUR ADI (28 Kasım, sahibinin isteği: Sistem › Uygulama
 * Hataları "alt satıra kaymasın, daha anlaşılabilir okunabilir dursun").
 *
 * Panel ham mesajı iki satıra kadar basıyordu: Next'in "Route /karsilastir
 * used `headers()` inside `after()` while rendering…" uyarısı, Drizzle'ın
 * bütün sütun listesini taşıyan "Failed query: select …" metni her satırı
 * iki-üç satıra geriyordu ve aynı hata farklı kimliklerle (digest) alt alta
 * üç kez duruyordu. Burada iki iş yapılıyor:
 * - Bilinen kalıplar kısa bir Title Case ada ve tek satırlık ayrıntıya
 *   iniyor ("Eski Sürüm Parçası Yüklenemedi" · `0jnm2cdhe_lcp.css`). Ham
 *   mesaj kaybolmuyor; panelde açılır satırda tam hâliyle duruyor.
 * - Aynı tür + rota + ada düşen gruplar tek satırda birleşiyor: sayılar
 *   toplanıyor, gün sayısı en büyüğü (gün listesi elde yok — toplamak aynı
 *   günü iki kez sayardı), son görülme en yenisi, kimlikler listede.
 * Saf modül; testler tests/error-summary.test.ts.
 */

export type ErrorSummary = { title: string; detail: string | null };

type Rule = { test: RegExp; summary: (m: RegExpMatchArray) => ErrorSummary };

const RULES: Rule[] = [
  {
    test: /used `(\w+)\(\)` inside `after\(\)`/,
    summary: (m) => ({
      title: `Bağlantı Kopunca ${m[1]}() Okundu`,
      detail: "Okur sayfa bitmeden ayrıldı",
    }),
  },
  {
    test: /(?:Failed to load chunk|Loading (?:CSS )?chunk \S+ failed)[^\S\n]*(\S*)/i,
    summary: (m) => ({
      title: "Eski Sürüm Parçası Yüklenemedi",
      detail: m[1] ? (m[1].split("/").pop() ?? m[1]) : "Yeni sürüm sonrası açık kalan sekme",
    }),
  },
  {
    test: /^Failed query: (select|insert|update|delete)\b[\s\S]*?\b(?:from|into|update)\s+"(\w+)"/i,
    summary: (m) => ({
      title: "Veritabanı Sorgusu Düştü",
      detail: `${m[1].toLocaleUpperCase("tr-TR")} · ${m[2]}`,
    }),
  },
  {
    test: /^(?:Load failed|Failed to fetch|NetworkError)/i,
    summary: () => ({ title: "Ağ İsteği Tamamlanmadı", detail: "Tarayıcı isteği yarıda kesti" }),
  },
];

const MAX_TITLE = 90;

export function summarizeError(message: string): ErrorSummary {
  const clean = message.trim();
  for (const rule of RULES) {
    const m = clean.match(rule.test);
    if (m) return rule.summary(m);
  }
  const first = clean.split("\n")[0] ?? clean;
  return { title: first.length > MAX_TITLE ? `${first.slice(0, MAX_TITLE - 1)}…` : first, detail: null };
}

type Groupable = {
  kind: string;
  route: string;
  message: string;
  digest: string | null;
  count: number;
  days: number;
  lastAt: Date;
};

export type MergedErrorGroup<G extends Groupable> = G & {
  summary: ErrorSummary;
  digests: string[];
  /** Birleşen ham mesajlar (benzersiz). */
  messages: string[];
};

/** Aynı tür + rota + ada düşen grupları birleştirir; sıra en son görülene göre. */
export function mergeErrorGroups<G extends Groupable>(groups: readonly G[]): MergedErrorGroup<G>[] {
  const merged = new Map<string, MergedErrorGroup<G>>();
  for (const group of groups) {
    const summary = summarizeError(group.message);
    const key = `${group.kind}\u0000${group.route}\u0000${summary.title}\u0000${summary.detail ?? ""}`;
    const held = merged.get(key);
    if (!held) {
      merged.set(key, {
        ...group,
        summary,
        digests: group.digest ? [group.digest] : [],
        messages: [group.message],
      });
      continue;
    }
    held.count += group.count;
    held.days = Math.max(held.days, group.days);
    if (group.lastAt > held.lastAt) held.lastAt = group.lastAt;
    if (group.digest && !held.digests.includes(group.digest)) held.digests.push(group.digest);
    if (!held.messages.includes(group.message)) held.messages.push(group.message);
  }
  return [...merged.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}
