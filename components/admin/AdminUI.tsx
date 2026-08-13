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
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-strong">
          {children}
        </h2>
        {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
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
  delta?: { text: string; tone: StatTone } | null;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-elevated px-4 py-3.5">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
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
          value.length > 9 ? "text-[19px]" : "text-[26px]",
        )}
      >
        {value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        {delta && (
          <span
            className={cn(
              "text-[12px] font-semibold tabular-nums",
              delta.tone === "up" && "text-up",
              delta.tone === "down" && "text-down",
              delta.tone === "neutral" && "text-muted",
            )}
          >
            {delta.text}
          </span>
        )}
        {sub && <span className="text-[12px] text-muted">{sub}</span>}
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
    return <p className="py-6 text-center text-[13px] text-muted">{emptyLabel}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ol className="flex flex-col gap-px">
      {rows.map((row) => {
        const share = Math.max(2, Math.round((row.value / max) * 100));
        const body = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-[5px] bg-primary-wash"
              style={{ width: `${share}%` }}
            />
            <span className="relative min-w-0 flex-1 truncate pr-3">
              {row.label}
            </span>
            {row.secondary && (
              <span className="relative shrink-0 pr-3 text-[11.5px] text-muted tabular-nums">
                {row.secondary}
              </span>
            )}
            <span className="relative shrink-0 font-semibold text-strong tabular-nums">
              {row.value.toLocaleString("tr-TR")}
            </span>
          </>
        );

        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                className="relative flex items-center rounded-[5px] px-2.5 py-[7px] text-[13px] text-body transition-colors hover:bg-surface-elevated"
              >
                {body}
              </Link>
            ) : (
              <div className="relative flex items-center rounded-[5px] px-2.5 py-[7px] text-[13px] text-body">
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
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) {
  return (
    /* Dar ekranda tablo KENDİ kabında kayar. Sayfa gövdesinin yatay
       kaymasına izin verilmiyor (globals.css'te html/body kilitli) ve
       dolayısıyla geniş içerik kendi kaydırmasını kendisi taşımak zorunda. */
    <div className="scroll-x -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line-strong text-left">
            {head.map((cell, i) => (
              <th
                key={cell}
                scope="col"
                className={cn(
                  "pb-2 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted",
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
  mono,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "py-2.5 pl-3 first:pl-0",
        align === "right" && "text-right",
        strong ? "font-semibold text-strong" : "text-body",
        mono && "tabular-nums",
      )}
    >
      {children}
    </td>
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
