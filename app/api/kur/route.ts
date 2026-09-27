import { NextResponse } from "next/server";
import { getUsdTryAt, istanbulToday } from "@/lib/providers/fx-history";
import { isIsoDate, TCMB_MIN_DATE, type IsoDate } from "@/lib/fx";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/* --------------------------------------------------------------------------
   Belirli günlerin TCMB döviz alış kuru — vergi hesaplayıcısının ucu.

   `?tarih=2024-03-15` tek gün, `?tarihler=2024-03-15,2025-01-10` toplu.
   TOPLU, çünkü hesaplayıcının her satırı iki gün soruyor (alış ve satış);
   yirmi satırlık bir döküm tek tek sorulsa kırk HTTP isteği olurdu ve oran
   sınırına ilk sayfada çarpardı.

   Dönen her kayıt BÜLTENİN KENDİ GÜNÜNÜ taşıyor: cumartesi sorulan bir
   günün cevabı cuma bültenidir ve ekran bunu yazar ("15 Mar · 14 Mar
   Bülteni") — sorulan günün kuruymuş gibi davranmaz.

   ---- Sınırlar ----

   Tarih aralığı 2005-01-03 ile bugün (İstanbul) arası. Öncesi eski lira
   cinsinden (gerekçe `TCMB_MIN_DATE`), sonrası henüz yok. Toplu istekte
   en fazla 40 gün: yirmi alış-satış çifti, gerçek bir yıllık dökümün çok
   üstünde.

   ORAN SINIRI İSTEK BAŞINA ve dar tutuldu (dakikada 30): her gün arka
   planda TCMB'ye en fazla on bir dosya isteği açabiliyor (hafta sonu ve
   bayram geri adımları). Geçmiş dosyalar otuz gün önbellekte kaldığı için
   aynı günün ikinci sorusu TCMB'ye gitmiyor; sınırın koruduğu şey
   önbelleğe henüz girmemiş günlerle TCMB'yi taramak.
   -------------------------------------------------------------------------- */

const MAX_DATES = 40;
const LIMIT = 30;
const WINDOW_MS = 60_000;

export type KurRate = {
  bulletinDate: IsoDate;
  buying: number;
  selling: number;
};

export type KurResponse =
  | { ok: true; rates: Record<IsoDate, KurRate | null> }
  | { ok: false; reason: "invalid-date" | "too-many" | "rate-limited" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("tarihler") ?? params.get("tarih") ?? "";
  const dates = [...new Set(raw.split(",").map((part) => part.trim()).filter(Boolean))];
  const today = istanbulToday();

  if (dates.length === 0) {
    return NextResponse.json<KurResponse>({ ok: false, reason: "invalid-date" }, { status: 400 });
  }
  if (dates.length > MAX_DATES) {
    return NextResponse.json<KurResponse>({ ok: false, reason: "too-many" }, { status: 400 });
  }
  if (!dates.every((date) => isIsoDate(date) && date >= TCMB_MIN_DATE && date <= today)) {
    return NextResponse.json<KurResponse>({ ok: false, reason: "invalid-date" }, { status: 400 });
  }

  const limited = rateLimit(clientKey(request, "kur"), LIMIT, WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json<KurResponse>(
      { ok: false, reason: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const results = await Promise.all(dates.map((date) => getUsdTryAt(date)));
  const rates: Record<IsoDate, KurRate | null> = {};
  dates.forEach((date, i) => {
    const result = results[i];
    rates[date] = result.ok
      ? {
          bulletinDate: result.data.bulletinDate,
          buying: result.data.buying,
          selling: result.data.selling,
        }
      : null;
  });

  return NextResponse.json<KurResponse>({ ok: true, rates });
}
