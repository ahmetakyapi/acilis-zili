import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Yönetim panelinin kendi parçaları.
 *
 * DİL: panel yalnızca Türkçe. Sitenin geri kalanı sözlükten besleniyor ve o
 * kural yerinde duruyor; burası okuyucuya değil SAHİBİNE bakan bir ekran ve
 * iki dilli tutmak sözlüğe seksen anahtar daha ekler, hiçbiri hiçbir zaman
 * İngilizce okunmaz. Karar bilinçli, unutulmuş değil.
 *
 * Parçalar `components/ui/primitives.tsx` yerine ayrı duruyor çünkü ölçüleri
 * farklı: panel yoğun bir veri ekranı, okuma ekranı değil. Sayı kutuları
 * daha sıkı, tablolar daha küçük puntolu. Renk ve kenarlık tokenları ise
 * aynı — panel siteden kopuk görünmemeli.
 */

/* --------------------------------------------------------------------------
   Kutular
   -------------------------------------------------------------------------- */

export function AdminPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        /* Dolgu bir kademe açıldı (20/24 → 20/28) ve panel köşesi
           yumuşadı: yönetim ekranları veri yoğun ve panel içi nefes
           payı, satır aralığından daha çok işe yarıyor. */
        "rounded-(--radius-xl) border border-line bg-surface p-5 sm:p-7",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function AdminPanelTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    /* BAŞLIK BİR KADEME BÜYÜDÜ ve künyeyle arası açıldı. Panel başlığı ile
       künye 13/12,5 puntoyla neredeyse aynı boydaydı; ikisi tek bir gri blok
       gibi okunuyor, gözün panele girdiği yer belli olmuyordu. Başlık artık
       15,5 punto ve künye 12,5'te kalıyor — hiyerarşi ölçüden geliyor,
       renkten değil. */
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
      <div className="min-w-0">
        <h2 className="text-lead font-bold tracking-[-0.02em] text-strong">
          {children}
        </h2>
        {hint && (
          <p className="mt-1.5 text-small leading-relaxed text-muted">{hint}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Sayı kutusu
   -------------------------------------------------------------------------- */

export type StatTone = "neutral" | "up" | "down";

/**
 * Tek ölçü. Değişim yüzdesi VARSA gösterilir, uydurulmaz: karşılaştırılacak
 * önceki dönem yoksa (ölçüm yeni kurulmuşsa) satır hiç çizilmez. Sıfırdan
 * bir sayıya çıkışı "%∞ artış" diye yazmak da bir tür uydurma kesinlik.
 */
export function StatBox({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { text: string; tone: StatTone; srLabel: string } | null;
}) {
  return (
    /* Kutu dolgusu ve etiket–sayı aralığı açıldı: dört kutu yan yana
       duruyor ve sıkışık dolgu onları tek bir şerit gibi gösteriyordu. */
    <div className="rounded-(--radius-lg) border border-line bg-surface-elevated px-4 py-4 sm:px-5">
      <p className="text-tiny font-semibold uppercase tracking-[0.07em] text-muted">
        {label}
      </p>
      {/* `tabular-nums` YOK. Kutu içinde hizalanacak ikinci bir sayı olmadığı
          için sabit genişlikli rakamların tek etkisi noktalama işaretlerini
          de o genişliğe çekmekti: "1,0" ekranda "1 , 0", "11:00" ise
          "11 : 00" diye okunuyordu.

          Uzun değerler bir basamak küçülüyor: tarih ya da "Bugün koştu" gibi
          bir metin 26 puntoda dar kutuda ikiye bölünüyordu. */}
      <p
        className={cn(
          "mt-2 font-bold leading-none tracking-[-0.03em] text-strong",
          value.length > 9 ? "text-title" : "text-heading",
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {delta && (
          <span
            className={cn(
              "numeral text-small font-semibold",
              delta.tone === "up" && "text-up",
              delta.tone === "down" && "text-down",
              delta.tone === "neutral" && "text-muted",
            )}
          >
            {delta.text}
            {/* Yön ekran okuyucuya da söyleniyor: "−%12" işareti gören için
                açık ama sesletimde tire kaybolabiliyor. */}
            <span className="sr-only"> ({delta.srLabel})</span>
          </span>
        )}
        {sub && <span className="text-small text-muted">{sub}</span>}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">{children}</div>
  );
}

/* --------------------------------------------------------------------------
   Sıralı liste — "en çok okunan sayfalar" gibi
   -------------------------------------------------------------------------- */

export type RankRow = {
  key: string;
  label: string;
  /** Satırın tıklanabilir olduğu yer — yoksa düz metin. */
  href?: string;
  value: number;
  /** İkinci sayı, künye olarak sağda: tekil ziyaretçi gibi. */
  secondary?: string;
};

/**
 * Sıralı liste — "en çok okunan sayfalar" gibi.
 *
 * ÇUBUK SATIRIN ZEMİNİ DEĞİL, ALTINDAKİ İNCE ŞERİT.
 *
 * Dolgu bir dönem satırın arka planıydı (`bg-primary-wash`) ve iki sorun
 * birden üretiyordu. Birincisi görünürlük: o token panel yüzeyinden ancak
 * 1,1–1,3 kat ayrışıyor, yani çubuk neredeyse yok. Depoda bu tam olarak
 * bilinen bir hata — `--bar` tokeni "gece temasında çubuklar 1,35'e düşüp
 * kayboluyordu" diye ayrıca açılmış ve bu liste onu hiç kullanmıyordu.
 * İkincisi okunabilirlik: metin çubuğun üstünde durduğu için dolgu
 * koyulaştırılamıyordu — koyulaştırınca kontrast AA eşiğinin altına
 * düşüyordu. Yani çubuk ya görünmez ya metin okunmaz oluyordu.
 *
 * Şerit satırın ALTINA inince ikisi de çözülüyor: dolgu artık tam accent
 * renkte, üstünde metin olmadığı için kontrast kısıtı yok, metin de temiz
 * bir zeminde duruyor. Ayrı bir bar SÜTUNU değil — o, satır yüksekliğini
 * ikiye katlayıp okuma yönünü bölüyordu; şerit satırın kendi genişliğinde
 * ve üç piksel.
 *
 * SAYI SÜTUNU SABİT GENİŞLİKTE. Değerler sağa yaslıydı ama genişlikleri
 * satırdan satıra değiştiği için sütun kenarı zikzak çiziyordu; on beş
 * satırlık bir listede göz her satırda sayıyı yeniden arıyordu.
 */
export function RankList({
  rows,
  emptyLabel = "Kayıt yok",
}: {
  rows: RankRow[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-base text-muted">{emptyLabel}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ol className="flex flex-col">
      {rows.map((row) => {
        /* SIFIR SIFIR ÇİZİLİR. Taban `Math.max(2, …)` idi ve değeri sıfır
           olan satıra da %2'lik bir çubuk çiziyordu — bileşen genel, "hiç"
           ile "çok az" aynı görünmemeli. */
        const share = Math.round((row.value / max) * 100);
        const body = (
          <>
            <span className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              {row.secondary && (
                <span className="numeral shrink-0 text-tiny text-muted">
                  {row.secondary}
                </span>
              )}
              <span className="numeral w-16 shrink-0 text-right text-read font-bold text-strong">
                {row.value.toLocaleString("tr-TR")}
              </span>
            </span>
            <span
              aria-hidden
              /* Ray `--bar` tokeninde: o token zaten "gece temasında çubuklar
                 kayboluyordu" diye açılmış ve tam bu iş için ayarlı.
                 Opaklık modifikatörü YOK — token kendi alfasını taşıyor,
                 üstüne bir kat daha koymak rayı görünmez yapıyordu. */
              className="block h-[3px] w-full overflow-hidden rounded-full bg-bar"
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${share}%` }}
              />
            </span>
          </>
        );

        /* DOKUNMA HEDEFİ 44 PİKSEL — yalnızca bağlantı dalında. `.tap-44`
           BURADA KULLANILMAZ: satırlar alt alta ve sözde öğe bir alttaki
           satırın hedefini kapardı, gerekçe app/globals.css'te yazılı. */
        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                className="flex min-h-11 flex-col justify-center gap-1.5 rounded-(--radius-sm) px-2.5 py-2.5 text-base text-body transition-colors hover:bg-surface-elevated sm:min-h-0"
              >
                {body}
              </Link>
            ) : (
              <div className="flex flex-col justify-center gap-1.5 rounded-(--radius-sm) px-2.5 py-2.5 text-base text-body">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------------------
   Tablo
   -------------------------------------------------------------------------- */

export function AdminTable({
  head,
  label,
  children,
}: {
  head: string[];
  /** Kaydırılabilir bölgenin adı — ekran okuyucu bunu duyurur. */
  label: string;
  children: React.ReactNode;
}) {
  return (
    /* Dar ekranda tablo KENDİ kabında kayar. Sayfa gövdesinin yatay
       kaymasına izin verilmiyor (globals.css'te html/body kilitli) ve
       dolayısıyla geniş içerik kendi kaydırmasını kendisi taşımak zorunda. */
    /* KAYDIRMA KABI KLAVYEYLE ODAKLANABİLİR. Kap kayıyordu ama `tabindex`
       taşımadığı için klavyeyle gezen okuyucu sağdaki sütunlara HİÇ
       ulaşamıyordu — fare ya da dokunma olmadan tablonun yarısı erişilemez
       kalıyordu (WCAG 2.1.1). `role="region"` + ad, ekran okuyucunun da
       "kaydırılabilir bir bölge" diye duyurmasını sağlıyor. */
    <div
      className="scroll-x -mx-1 overflow-x-auto px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="w-full min-w-[520px] border-collapse text-base">
        <thead>
          <tr className="border-b border-line-strong text-left">
            {head.map((cell, i) => (
              <th
                key={cell}
                scope="col"
                className={cn(
                  "pb-2.5 text-tiny font-semibold uppercase tracking-[0.06em] text-muted",
                  i > 0 && "pl-3",
                  i === head.length - 1 && "text-right",
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-line last:border-0">{children}</tr>;
}

export function AdminCell({
  children,
  align = "left",
  strong,
  numeral,
  rowHeader,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  strong?: boolean;
  /**
   * Ayırıcı taşıyan sayı hücresi — tarih, binlik noktalı adet.
   *
   * Prop bir dönem `mono` adını taşıyordu ve hiçbir mono aile
   * uygulamıyordu: ad yaptığı işi yanlış söylüyordu. Uyguladığı şey
   * sitenin `.numeral` sınıfı, adı da o.
   *
   * `.numeral` yalnızca harf aralığını sıkıştırır — RAKAM HİZASI GERİ
   * GELMEZ. Kök `font-variant-numeric` ayarı ölçülerek kapatılmıştı
   * ("$1.258,58" → "$1 . 258 , 58"). Hizayı bu hücrelerde `text-right`
   * sağlıyor, sınıf değil.
   */
  numeral?: boolean;
  /** Satırı TANIMLAYAN ilk hücre — `th scope="row"` olarak basılır. */
  rowHeader?: boolean;
}) {
  /* Satır başlığı işaretlenmemişti: hücre hücre gezen ekran okuyucu
     kullanıcısı "13.08.2026 · 4" duyuyor ama hangi üyenin satırında
     olduğunu bilmiyordu. */
  const Tag = rowHeader ? "th" : "td";
  return (
    <Tag
      scope={rowHeader ? "row" : undefined}
      className={cn(
        "py-3 pl-3 first:pl-0",
        align === "right" && "text-right",
        strong ? "font-semibold text-strong" : "text-body",
        numeral && "numeral",
        rowHeader && "text-left font-semibold",
      )}
    >
      {children}
    </Tag>
  );
}

/* --------------------------------------------------------------------------
   Durum rozeti
   -------------------------------------------------------------------------- */

export function HealthDot({ tone }: { tone: "ok" | "warn" | "down" | "idle" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-up",
        tone === "warn" && "bg-brass",
        tone === "down" && "bg-down",
        tone === "idle" && "bg-muted",
      )}
    />
  );
}

/** Rengin taşıdığı anlam metinle de yazılır — renk tek başına bilgi taşımaz. */
export const HEALTH_LABEL: Record<"ok" | "warn" | "down" | "idle", string> = {
  ok: "Sağlıklı",
  warn: "Dikkat",
  down: "Sorunlu",
  idle: "Beklemede",
};
