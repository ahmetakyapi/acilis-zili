import Link from "next/link";
import type { PublishDay } from "@/lib/admin-data";
import { formatEtDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Yayın ritmi takvimi — hangi gün ne yazıldı, hangi gün boş kaldı.
 *
 * NEDEN VAR: panel "bugünün bülteni var mı" sorusunu cevaplıyordu ama
 * "geçen ay hangi günler boş kaldı" sorusunu değil. Bir rutin birkaç gün
 * durup sonra devam ettiğinde geriye dönüp bakmanın hiçbir yolu yoktu.
 * Izgara boşlukları tek bakışta gösteriyor; dolu bir güne basmak kaydını
 * açıyor, yani geçmişe gitmenin yolu da bu.
 *
 * ÜÇ ŞERİDİN BEKLENTİSİ FARKLI ve tek bir dolu/boş durumu ikisinde yalan
 * söylerdi:
 *
 *   · BÜLTEN her iş günü bekleniyor. Hafta sonu ve tatilde boş olması eksik
 *     DEĞİL — rutinin kendi kuralı "piyasa kapalıysa o gün için yazı yazma"
 *     diyor. O günler gri zeminde ve hiçbir zaman kırmızı olmuyor.
 *   · MERCEK günde İKİ koşum (11:30 ve 23:30 TR) ama koşullu: anlatmaya
 *     değer olay yoksa yazmıyor. Hücre adet gösteriyor, yargı vermiyor.
 *   · ANALİZ yalnızca aday çeyrek varsa yazılıyor ve aday geçmişi
 *     tutulmuyor — boş bir gün "yazılmadı" değil, "aday yoktu" olabilir.
 *     Bu yüzden o şeritte boş hücre nötr.
 *
 * RENK TEK TAŞIYICI DEĞİL: dolu hücre hem renk hem adet yazısı taşıyor,
 * eksik hücre de kendi işaretini. Hücrenin `title`ı tam tarihi ve durumu
 * söylüyor; ızgarayı hiç okuyamayan için altında aynı bilgi metin olarak
 * duran bir künye var.
 */

const GUNLER = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"] as const;

type Serit = "daily" | "stories" | "analyses";

export function PublishGrid({ days }: { days: PublishDay[] }) {
  if (days.length === 0) {
    return (
      <p className="py-8 text-center text-base text-muted">
        Ritim için henüz yeterli kayıt yok.
      </p>
    );
  }

  /* Izgara pazartesi başlıyor (haftalık bülten oraya çapalanıyor), yani
     satırlar yediye tam bölünüyor ve ilk hücre her zaman pazartesi. */
  const haftalar: PublishDay[][] = [];
  for (let i = 0; i < days.length; i += 7) haftalar.push(days.slice(i, i + 7));

  return (
    <div className="flex flex-col gap-4">
      {(
        [
          {
            key: "daily" as const,
            baslik: "Günlük Bülten",
            not: "hafta sonu ve tatilde yazılmaz",
          },
          {
            key: "stories" as const,
            baslik: "Mercek Yazısı",
            not: "koşullu — günde en çok iki koşum",
          },
          {
            key: "analyses" as const,
            baslik: "Bilanço Analizi",
            not: "koşullu — aday çeyrek varsa yazılır",
          },
        ] satisfies { key: Serit; baslik: string; not: string }[]
      ).map((serit) => (
        <div key={serit.key} className="flex flex-col gap-1.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-small font-semibold text-strong">
              {serit.baslik}
            </span>
            <span className="text-tiny text-muted">{serit.not}</span>
          </p>

          <div className="flex gap-1.5">
            {/* Gün başlıkları solda tek sütun: yedi sütunun üstüne yazmak
                üç şeritte üç kez tekrar demekti. */}
            <div className="flex shrink-0 flex-col gap-[3px] pt-[2px]">
              {GUNLER.map((g) => (
                <span
                  key={g}
                  className="numeral flex h-5 items-center text-nano text-muted"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Haftalar sütun sütun, en eskiden yeniye — okuma yönü zamanla
                aynı. Dar ekranda kayıyor; sekiz hafta 8×22 = 176 piksel,
                zaten sığıyor ama şerit büyürse kaymaya hazır. */}
            <div className="scroll-x flex min-w-0 flex-1 gap-[3px]">
              {haftalar.map((hafta) => (
                <div key={hafta[0].day} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }, (_, i) => hafta[i]).map(
                    (gun, i) =>
                      gun ? (
                        <Hucre key={gun.day} gun={gun} serit={serit.key} />
                      ) : (
                        <span
                          key={`bos-${i}`}
                          aria-hidden
                          className="h-5 w-5 rounded-xs"
                        />
                      ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* İŞARETLERİN ANLAMI YAZILI — renk tek taşıyıcı değil. */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-tiny text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-xs bg-primary" />
          Yazıldı
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3 w-3 rounded-xs border border-down bg-down-wash"
          />
          Beklenirken yazılmadı
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-xs bg-surface-sunken" />
          Hafta sonu ve tatil
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-xs border border-line" />
          Yazılmadı — beklenmiyordu da
        </span>
      </p>
    </div>
  );
}

function Hucre({ gun, serit }: { gun: PublishDay; serit: Serit }) {
  const tarih = formatEtDateShort(gun.day, "tr");

  if (serit === "daily") {
    /* Bülten tek şeritte iki kaydı taşıyor: günlük her iş günü, haftalık
       yalnızca pazartesi. Hücre günlüğü gösteriyor, haftalık olan güne
       küçük bir çentik düşüyor — ayrı bir şerit sekiz haftada yalnızca
       sekiz dolu hücre çizerdi. */
    const bekleniyor = !gun.offDay && !gun.isToday;
    const durum = gun.daily
      ? "yazıldı"
      : gun.offDay
        ? "piyasa kapalı — beklenmiyordu"
        : gun.isToday
          ? "bugün · gün sürüyor"
          : "yazılmadı";
    const kutu = (
      <span
        title={`${tarih} · Günlük bülten: ${durum}${gun.weekly ? " · haftalık bülten de bu güne yazıldı" : ""}`}
        className={cn(
          "relative flex h-5 w-5 items-center justify-center rounded-xs text-nano font-bold",
          gun.daily
            ? "bg-primary text-on-primary"
            : gun.offDay
              ? "bg-surface-sunken"
              : bekleniyor
                ? "border border-down bg-down-wash"
                : "border border-line",
        )}
      >
        {gun.daily ? "•" : ""}
        {gun.weekly && (
          <span
            aria-hidden
            className="absolute -right-px -top-px h-1.5 w-1.5 rounded-full bg-chart-b"
          />
        )}
      </span>
    );
    /* GEÇMİŞE GİTMENİN YOLU: dolu hücre kendi bültenini açıyor. Boş hücre
       bağlantı olmuyor — gidilecek bir kayıt yok. */
    return gun.daily ? (
      <Link href={`/bulten?tarih=${gun.day}`} aria-label={`${tarih} bülteni`}>
        {kutu}
      </Link>
    ) : (
      kutu
    );
  }

  const adet = serit === "stories" ? gun.stories : gun.analyses;
  return (
    <span
      title={`${tarih} · ${adet === 0 ? "yazılmadı" : `${adet} kayıt`}`}
      className={cn(
        "numeral flex h-5 w-5 items-center justify-center rounded-xs text-nano font-bold",
        adet === 0
          ? gun.offDay
            ? "bg-surface-sunken"
            : "border border-line"
          : "bg-primary text-on-primary",
      )}
    >
      {adet > 0 ? adet : ""}
    </span>
  );
}
