import { fiscalOfSlug, type FiscalQuarter } from "@/lib/fiscal";

/**
 * BEKLENTİNİN TEK KAYNAĞI — bir çeyreğin HBK beklentisi hangi kayıttan
 * okunur (28 Kasım 2026, Görsel Tur 4, tasarım denetimi #5).
 *
 * NEDEN: aynı çeyreğin sürprizi sitede iki ayrı sayıyla duruyordu. Dell 3Ç
 * FY2027: `/bilancolar/dell` kahramanı ve Beklenti Karnesi "+%40,1"
 * (Finnhub'ın sürpriz ucu, beklenti 6,75 $), aynı sayfanın Bilanço
 * Analizleri satırı, 3Ç analiz sayfası ve ana sayfa "%44,1" (analiz kaydı,
 * beklenti 6,56 $); 2Ç'de %40,5 / %43,0. Gerçekleşen (9,45 $) iki kaynakta
 * aynı; ayrışan BEKLENTİ: sağlayıcı konsensüsü rapordan sonra da güncelleniyor,
 * analiz ise rapor günü basında konuşulan konsensüsle yazılıyor ve metnin
 * içinde ("beklentiyi %44 aştı") o sayıyı birkaç kez kullanıyor.
 * `.claude/rules/veri-ve-onbellek.md` → "Aynı sayı iki yerde duruyorsa aynı
 * kaynaktan gelir".
 *
 * SEÇİM: çeyreğin yayımlanmış analizi varsa O. Analiz metni değiştirilemez
 * (rutin yazdı, sayı paragraflara geçti); sayfadaki rakamı metne uydurmak
 * tek tutarlı yol. Analizi olmayan çeyrek sağlayıcıdan kalır. Kayıt beklentiyi
 * ayrı alan olarak tutmuyor, gerçekleşen ve sapmadan geri çözülür
 * (`eps / (1 + sapma/100)`); yuvarlanmaz, yoksa yeniden hesaplanan sapma
 * kaydınkinden bir onda bir sapabilirdi (6,56 → %44,05).
 */

/** Analiz kaydının bu hesap için gereken alanları (`AnalysisIndexRow` alt kümesi). */
export type RecordedAnalysis = {
  period: string;
  reportDate: string;
  eps: number | null;
  epsSurprisePct: number | null;
};

export type ConsensusSource = "analysis" | "provider";

/** Gerçekleşen ve yüzde sapmadan beklentiyi geri çözer; çözülemezse `null`. */
export function recordedEstimate(eps: number | null, surprisePct: number | null): number | null {
  if (eps === null || surprisePct === null || !Number.isFinite(eps) || !Number.isFinite(surprisePct)) return null;
  const ratio = 1 + surprisePct / 100;
  /* Sapma %-100 ve altı tabanı sıfırlar ya da eksiye çevirir; beklentinin
     işareti de eps'ten çözülemez (zarar eden şirkette yüzde zaten yazılmaz,
     `epsSurprise` dolar farkına geçer). Böyle kayıt sağlayıcıya bırakılır. */
  if (ratio <= 0 || eps <= 0) return null;
  return eps / ratio;
}

/** Bir çeyreğin analiz kaydı: önce mali çeyrek, yoksa rapor günü (±3 gün). */
export function analysisForQuarter<T extends RecordedAnalysis>(
  analyses: readonly T[],
  quarter: { fiscal?: FiscalQuarter | null; reportDate?: string | null },
): T | null {
  if (quarter.fiscal) {
    const { year, quarter: q } = quarter.fiscal;
    const hit = analyses.find((row) => {
      const fiscal = fiscalOfSlug(row.period);
      return fiscal !== null && fiscal.year === year && fiscal.quarter === q;
    });
    if (hit) return hit;
  }
  const date = quarter.reportDate;
  if (!date) return null;
  const at = Date.parse(`${date}T12:00:00Z`);
  return (
    analyses.find((row) => Math.abs(Date.parse(`${row.reportDate}T12:00:00Z`) - at) <= 3 * 86_400_000) ?? null
  );
}

/**
 * Çeyreğin EPS çifti tek kaynaktan: analiz varsa gerçekleşen ve beklenti
 * kayıttan, yoksa sağlayıcıdan. `source` künyede yazılır.
 */
export function reconcileEps<T extends RecordedAnalysis>(
  provider: { epsActual: number | null; epsEstimate: number | null },
  analysis: T | null,
): { epsActual: number | null; epsEstimate: number | null; source: ConsensusSource } {
  const estimate = analysis ? recordedEstimate(analysis.eps, analysis.epsSurprisePct) : null;
  if (analysis && estimate !== null && analysis.eps !== null) {
    return { epsActual: analysis.eps, epsEstimate: estimate, source: "analysis" };
  }
  return { epsActual: provider.epsActual, epsEstimate: provider.epsEstimate, source: "provider" };
}
