"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   "Ayrıca bugün açıklayanlar" — açılana kadar ÇİZİLMEYEN sembol kalabalığı.

   Bu blok bir `<details>` idi: kapalı görünüyor ama içindeki her çip tam
   hâliyle sunucuda çiziliyor, HTML'e yazılıyor ve tarayıcıya gönderiliyordu.
   Ölçüm: haftalık görünümde 1.354 gizli çip, 1,13 MB HTML ve 3.523 DOM
   düğümünün yaklaşık %40'ı. Telefondaki okuyucu, hiç açmayacağı bir listenin
   tamamını indiriyor ve tarayıcısı onu yerleştiriyordu — "kalabalık ilk
   bakışta görünmez" tasarım kararının bedeli, kalabalığın yine de taşınması
   olmuştu.

   Çözüm çipleri istemciye VERİ olarak geçirmek: bir sembol dizisi birkaç
   kilobayt, aynı sembollerin HTML'i yüz kilobaytlarca. Açılınca çiziliyor,
   kapalıyken ne DOM'da ne de yükte yer kaplıyor.

   `<details>` yerine düğme kullanmanın bedeli, JS gelmeden bloğun
   açılamaması. Kabul edilebilir: bu bir kademeli açılım öğesi, sayfanın
   çekirdek içeriği değil — günün önemli şirketleri zaten üstteki iki katmanda
   sunucuda çizilmiş durumda.
   -------------------------------------------------------------------------- */

export type ReportingGroup = {
  label: string;
  tone: "pre" | "post" | "neutral";
  /** Yalnızca sembol ve takip bayrağı — çipin ihtiyacı olan her şey. */
  symbols: { symbol: string; watched: boolean }[];
};

export function AlsoReporting({
  label,
  groups,
  total,
}: {
  label: string;
  groups: ReportingGroup[];
  total: number;
}) {
  const [open, setOpen] = useState(false);

  if (total === 0) return null;

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-10 items-center gap-2 py-1.5 text-base text-muted transition-colors hover:text-body"
      >
        <CaretDown
          weight="duotone"
          size={15}
          aria-hidden
          className={cn("transition-transform", open && "rotate-180")}
        />
        {label}
        <span className="numeral">({total})</span>
      </button>

      {open && (
        <Panel className="mt-1 px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3.5">
            {groups
              .filter((group) => group.symbols.length > 0)
              .map((group) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-tiny font-semibold text-muted">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        group.tone === "pre"
                          ? "bg-up"
                          : group.tone === "post"
                            ? "bg-primary"
                            : "bg-flat",
                      )}
                    />
                    {group.label}
                    <span className="numeral">({group.symbols.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.symbols.map((item) => (
                      <Link
                        key={item.symbol}
                        href={`/hisse/${item.symbol}`}
                        prefetch={false}
                        className={cn(
                          // min-h-8: sembol çipleri 26px'lik dokunma hedefi
                          // bırakıyordu; sık dizilmiş bir ızgarada parmakla
                          // komşusuna basmak kolaydı.
                          "inline-flex min-h-8 items-center rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold transition-colors hover:border-line-strong hover:bg-primary-tint hover:text-primary",
                          item.watched
                            ? "border-primary-faint bg-primary-wash text-primary-ink"
                            : "text-body",
                        )}
                      >
                        {item.symbol}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
