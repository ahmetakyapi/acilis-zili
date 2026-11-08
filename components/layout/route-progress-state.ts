import type { InkSceneName } from "@/lib/ink/scenes";

/**
 * Gezinme göstergesinin durumu — saf, düz modül (8 Kasım, durum makinesi
 * denetimi § 11). Mağaza ve çizim components/layout/RouteProgress.tsx'te;
 * testi tests/route-progress-state.test.ts.
 *
 * TEK ANLIK GÖRÜNTÜ. Önceden dört modül değişkeniydi (`runId`, `localQuery`,
 * `inlineFeedback`, `targetScene`); mağaza yalnız `runId`yi yayıyor,
 * ötekiler render sırasında modülden okunuyordu ve `stop` yalnız `runId`yi
 * sıfırlıyordu — biten koşunun "sayfa içi sorgu" işareti bir sonraki
 * koşuya kadar asılı kalıyordu. Şimdi hepsi tek nesnede, her değişim yeni
 * nesne (useSyncExternalStore kimlikle karşılaştırır) ve `stop` hepsini
 * sıfırlar. Biten koşunun çıkış sönmesi için gereken alanları (kart mı,
 * hangi sahne) bileşen ÖNCEKİ anlık görüntüden okur.
 *
 * Koşu numarası korunuyor (gerekçe RouteProgress.tsx → "KOŞU NUMARASI"):
 * 0 boşta, sıfırdan büyük her sayı ayrı gezinme; `seq` sayaçtır.
 */
export type RouteProgressState = {
  /** 0 boşta; sıfırdan büyük her sayı ayrı bir gezinme. */
  run: number;
  /** Son verilen koşu numarası — `stop` sıfırlamaz, numaralar tekrarlanmasın. */
  seq: number;
  /** Aynı sayfada sorgu değişimi (filtre, sıralama): bölge kendi bekler. */
  query: boolean;
  /** Sorgu bölgesi görünür alanda: genel kart açılmaz. */
  inline: boolean;
  /** Beklemede oynayacak sahne; hedef yoksa açılış sahnesi. */
  scene: InkSceneName;
};

/** Başlatmanın hedefe dair bildiği; `null` = hedefsiz (geri tuşu, dil değişimi). */
export type RouteProgressTarget = { query: boolean; inline: boolean; scene: InkSceneName } | null;

export type RouteProgressEvent = { type: "start"; target: RouteProgressTarget } | { type: "stop" };

export const ROUTE_PROGRESS_IDLE: RouteProgressState = { run: 0, seq: 0, query: false, inline: false, scene: "intro" };

export function reduceRouteProgress(state: RouteProgressState, event: RouteProgressEvent): RouteProgressState {
  if (event.type === "stop") {
    if (state.run === 0 && !state.query && !state.inline && state.scene === "intro") return state;
    return { ...ROUTE_PROGRESS_IDLE, seq: state.seq };
  }
  const { target } = event;
  // Hedefsiz başlatma süren koşuyu bölmez.
  if (state.run !== 0 && !target) return state;
  const query = target?.query ?? false;
  const inline = target?.inline ?? false;
  // Consecutive filters share the visible wait. Resetting its delay briefly
  // revealed the old result between clicks (measured at ~140ms).
  if (state.run !== 0 && state.query && query && state.inline === inline) return state;
  const seq = state.seq + 1;
  return { run: seq, seq, query, inline, scene: target?.scene ?? "intro" };
}

/**
 * Bu adrese giden bağlantı sayfa gezinmesi mi. API uçları sayfa değil:
 * dosya indiren ya da JSON dönen bir uçta adres değişmez ve gösterge 30 sn
 * frene kadar "yükleniyor" kalırdı (`download` özniteliği unutulmuş
 * dışa aktarma bağlantısı). Öteki muafiyetler (`download`,
 * `data-no-progress`, `data-shallow`, başka pencere) bağlantının
 * özniteliğinde, RouteProgress dinleyicisinde.
 */
export function isPagePath(pathname: string): boolean {
  return pathname !== "/api" && !pathname.startsWith("/api/");
}
