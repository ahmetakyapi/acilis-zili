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
        "rounded-xl border border-line bg-surface p-5 sm:p-6",
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
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="text-read font-bold tracking-[-0.02em] text-strong">
          {children}
        </h2>
        {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
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
    <div className="rounded-lg border border-line bg-surface-elevated px-4 py-3.5">
      <p className="text-tiny font-semibold uppercase tracking-[0.06em] text-muted">
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
          "mt-1.5 font-bold leading-none tracking-[-0.03em] text-strong",
          value.length > 9 ? "text-title" : "text-heading",
        )}
      >
        {value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
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
 * Payı bar olarak da gösteren sıralı liste.
 *
 * Bar arka planda duruyor, ayrı bir sütunda değil: on beş satırlık bir
 * listede ayrı bar sütunu satır yüksekliğini ikiye katlıyor ve okuma yönünü
 * bölüyordu. Zemin dolgusu aynı bilgiyi yer kaplamadan veriyor.
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
    <ol className="flex flex-col gap-px">
      {rows.map((row) => {
        /* SIFIR SIFIR ÇİZİLİR. Taban `Math.max(2, …)` idi ve değeri sıfır
           olan satıra da %2'lik bir çubuk çiziyordu — bileşen genel, "hiç"
           ile "çok az" aynı görünmemeli. */
        const share = Math.round((row.value / max) * 100);
        const body = (
          <>
            {/* UÇ KAPAĞI. Dolgu `bg-primary-wash` panel yüzeyinden ancak
                1,1–1,3 kat ayrışıyor — projenin kendi `--bar` notunun
                "kayboluyor" dediği eşiğin altında. Dolguyu koyulaştırmak
                çözüm değil: üstünde metin duruyor ve %22 opaklıkta kontrast
                AA eşiğinin altına düşüyor. Bunun yerine dolgunun SAĞ UCUNA
                accent bir kapak; üstünde metin olmadığı için metin
                kontrastına dokunmuyor ve çubuğun nerede bittiği görünüyor.
                Pay %98'de sınırlı: tam 100'de kapak satırın sağ kenarına
                oturup değer sütununun kenarlığı gibi okunuyordu. */}
            {share > 0 && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-l-xs border-r-2 border-primary bg-primary-wash"
                style={{ width: `${Math.min(share, 98)}%` }}
              />
            )}
            <span className="relative min-w-0 flex-1 truncate pr-3">
              {row.label}
            </span>
            {row.secondary && (
              <span className="numeral relative shrink-0 pr-3 text-tiny text-muted">
                {row.secondary}
              </span>
            )}
            <span className="numeral relative shrink-0 font-semibold text-strong">
              {row.value.toLocaleString("tr-TR")}
            </span>
          </>
        );

        /* DOKUNMA HEDEFİ 44 PİKSEL — yalnızca bağlantı dalında. Satır
           `px-2.5 py-[7px] text-base` ile 33,5 piksel ediyordu ve iki liste
           (Trafik → Sayfalar, Üyeler → En Çok Takip Edilenler) on beşer
           tıklanabilir satır basıyor. Salt dolguyla 44 verilmiyor
           (`py-[11px]` 41,5 eder), o yüzden gerçek yükseklik. `.tap-44`
           BURADA KULLANILMAZ: satırlar alt alta ve sözde öğe bir alttaki
           satırın hedefini kapardı — gerekçe app/globals.css'te yazılı.
           Bağlantı olmayan dal (Cihaz, Dil) eski ölçüsünde kalıyor. */
        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                className="relative flex min-h-11 items-center rounded-xs px-2.5 py-[7px] text-base text-body transition-colors hover:bg-surface-elevated sm:min-h-8"
              >
                {body}
              </Link>
            ) : (
              <div className="relative flex items-center rounded-xs px-2.5 py-[7px] text-base text-body">
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
                  "pb-2 text-tiny font-semibold uppercase tracking-[0.05em] text-muted",
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
        "py-2.5 pl-3 first:pl-0",
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
