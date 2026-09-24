import { cn } from "@/lib/utils";

/**
 * Karşılaştırma ölçülerinin GÖZLE OKUNAN katmanı.
 *
 * NEDEN: tabloda dört sütun ve on bir satır var; hepsi aynı puntoda, aynı
 * renkte sayılar. "Hangisi büyük" sorusunun cevabı okunarak veriliyordu —
 * dört sayıyı basamak basamak karşılaştırmak gerekiyordu ve 390 pikselde
 * "173,16" ile "87,56" yan yana dururken göz bunu tek bakışta yapamıyor.
 * Satırın altına inen ince çubuk aynı sayıyı BİR de uzunluk olarak
 * söylüyor: sıralama okumadan çıkıyor, sayı yine yerinde duruyor.
 *
 * Çubuk bir YARGI DEĞİL, bir büyüklük. Hangi F/K'nin "iyi" olduğunu bu ekran
 * söylemiyor; yalnızca hangisinin büyük olduğunu gösteriyor. Bu yüzden lider
 * vurgulanmıyor, renk de yalnızca işaretten geliyor (artı/eksi), değerden
 * değil.
 *
 * SON FİYAT SATIRINDA ÇUBUK YOK ve olmaması bilinçli: farklı şirketlerin
 * hisse fiyatları karşılaştırılabilir bir ölçü değil (bölünme oranı kadar
 * keyfi). Orada bir çubuk, olmayan bir sıralamayı varmış gibi gösterirdi.
 *
 * `aria-hidden`: çubuk sayının kopyası, yeni bilgi taşımıyor. Ekran okuyucu
 * satırı iki kez okumamalı.
 */

export function ScaleBar({
  ratio,
  signed,
  tone = "neutral",
  emphasis = false,
  className,
}: {
  /** −1 ile 1 arası; işaretsiz modda 0 ile 1. */
  ratio: number;
  /** Satırda eksi bir değer var mı — çubuğun SIFIRI nerede. */
  signed: boolean;
  /**
   * Çubuğun rengi.
   *
   * `signal`: getiri satırları. Sayının kendisi zaten yeşil/kırmızı ve
   * çubuğun mavi olması aynı hücrede iki ayrı işaret bırakıyordu. Renk
   * satırın tamamına değil HER DEĞERE ayrı bakıyor: dördü de artıdayken de
   * yeşil kalıyor, yani bir sembol eksiye düştüğünde ötekilerin rengi
   * değişmiyor.
   *
   * `neutral`: büyüklük satırları (piyasa değeri, F/K, beta…). Orada
   * yön diye bir şey yok; yüksek F/K "kötü" demek değil ve renk öyle
   * okunurdu.
   */
  tone?: "neutral" | "signal";
  /**
   * Satırın öznesi — hisse sayfasındaki benzerler listesinde sayfanın
   * kendi şirketi. Tam `--primary`; öteki çubuklar olağan tonda kalıyor.
   * Varsayılan kapalı: /karsilastir'da hiçbir satır öne çıkmıyor.
   */
  emphasis?: boolean;
  className?: string;
}) {
  const oran = Math.min(1, Math.abs(ratio));
  const yuzde = oran * 100;
  const eksi = ratio < 0;

  return (
    /* RAY SAĞA YASLI. Sütundaki sayılar sağa yaslı ve çubuk onların sağ
       kenarıyla aynı hatta bitiyor; geniş ekranda 287 piksellik hücrenin
       tamamına yayılan bir ray sayıdan kopuk duruyordu. */
    <span
      aria-hidden
      className={cn(
        "mt-1.5 ml-auto block h-[3px] w-full max-w-[128px] rounded-full bg-(--line-soft)",
        className,
      )}
    >
      <span
        className="block h-full rounded-full"
        style={{
          ...(signed
            ? {
                /* Sıfır tam ortada: artı sağa, eksi sola açılıyor. */
                marginLeft: eksi ? `${50 - yuzde / 2}%` : "50%",
                width: `${yuzde / 2}%`,
              }
            : { marginLeft: `${100 - yuzde}%`, width: `${yuzde}%` }),
          background:
            tone === "signal"
              ? eksi
                ? "var(--down)"
                : "var(--up)"
              : emphasis
                ? "var(--primary)"
                : "color-mix(in srgb, var(--primary) 58%, transparent)",
        }}
      />
    </span>
  );
}

/**
 * 52 hafta bandı — iki sayı değil, bir KONUM.
 *
 * Bant hücrede "86,62 — 212,19 $" diye duruyordu ve 390 pikselde 64
 * piksellik sütuna sığmayıp iki satıra bölünüyordu (ölçüldü: satır 60px,
 * öteki satırlar 41px). Asıl sorun genişlik değil okuma biçimiydi: bandın
 * kendisi değil, fiyatın bandın NERESİNDE durduğu soruluyor. Ray bunu tek
 * bakışta veriyor, uçlar da yerinde kalıyor.
 *
 * İŞARETÇİ YALNIZCA AYNI PARA BİRİMİNDE. ADR'de fiyat dolar, bant ana
 * borsanın parası; işaretçi o zaman bandın dışına düşer ve hisse zirvesinin
 * üstündeymiş gibi görünürdü. Fiyat verilmezse ray uçlarıyla kalıyor.
 */
export function RangeTrack({ position }: { position: number | null }) {
  const yer = position === null ? null : Math.min(1, Math.max(0, position));
  return (
    <span
      aria-hidden
      /* ÖLÇEK ÇUBUĞUYLA AYNI GENİŞLİK. Ray hücrenin tamamına yayılıyordu
         ve 1440 pikselde 283 piksellik bir ray, üstündeki 128 piksellik
         çubukların çok solundan başlıyordu: aynı sütunda iki ayrı sol
         kenar. Ray da sağa yaslı ve aynı tavanda. */
      className={cn(
        "relative mt-1.5 ml-auto block h-[3px] w-full max-w-[128px] rounded-full",
        /* İŞARETÇİSİZ RAY DAHA KOYU. Boş bir ölçek çubuğuyla aynı tonda
           duruyordu ve ADR satırında (işaretçi yok, gerekçesi yukarıda)
           "veri gelmemiş" ya da "sıfır" gibi okunuyordu. Bant orada ve
           uçları yazılı; ray onu bir ARALIK olarak göstermeli. */
        position === null ? "bg-(--line-strong)" : "bg-(--line-soft)",
      )}
    >
      {yer !== null && (
        <>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${yer * 100}%`,
              background:
                "color-mix(in srgb, var(--primary) 45%, transparent)",
            }}
          />
          <span
            className="absolute top-1/2 h-[9px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--text-strong)"
            style={{ left: `${yer * 100}%` }}
          />
        </>
      )}
    </span>
  );
}
