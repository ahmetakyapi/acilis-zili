"use client";

import { useState, type CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { earningsHref } from "@/lib/earnings-company";
import styles from "./AlsoReporting.module.css";

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

   KATLAMA BİR KARO (14 Kasım, görsel tur). Düğme soluk tek satırdı ("⌄ Diğer
   Açıklayanlar (101)"): içinde ne olduğu okunmuyor, kart ızgarasının altında
   sayfanın artığı gibi duruyordu. Şimdi kapalıyken de içeriğini SÖYLEYEN bir
   karo: kaç şirket (büyük sayı), pencerelere dağılımı (tek kulvarda üç
   dilim + sayıları) ve en büyüklerinin sembolleri. Karo kart ızgarasının
   son hücresi olur ve satırın kalanını doldurur (`EarningsCalendar` →
   "SABİT SÜTUN"); ızgara yoksa tam genişlik bir şerit. Dar karoda bilgiler
   alt alta, geniş karoda yan yana (kap sorgusu, modülde). Açılan panel
   ızgaranın tam genişliğinde, karonun hemen altında. Yük gerekçesi aynen
   duruyor: karoya yalnız birkaç sembol adı iniyor, çipler yine açılınca.
   -------------------------------------------------------------------------- */

type ReportingGroup = {
  label: string;
  tone: "pre" | "post" | "neutral";
  /** Yalnızca sembol ve takip bayrağı — çipin ihtiyacı olan her şey. */
  symbols: { symbol: string; watched: boolean }[];
};

export function AlsoReporting({
  label,
  groups,
  total,
  inline = false,
  unit,
  preview = [],
  labels,
}: {
  label: string;
  groups: ReportingGroup[];
  total: number;
  /**
   * SEYREK GÜN (10 Kasım, görsel kalite turu): günün görünür katmanında
   * hiç kart yoksa bu liste günün TAMAMI; kapalı bir katlama bölümü boş
   * gösteriyordu. `inline` iken düğme ve panel yok, çipler pencere adıyla
   * tek satırda açık basılır. Çağıran sembol sayısını sınırlıyor
   * (`SPARSE_INLINE_MAX`), yani yukarıdaki HTML yükü gerekçesi bozulmuyor.
   */
  inline?: boolean;
  /** Sayının birimi: "Şirket". */
  unit?: string;
  /** Karoda adı yazılan birkaç sembol (en büyükler). */
  preview?: readonly string[];
  labels?: { largest: string; open: string; close: string };
}) {
  const [open, setOpen] = useState(false);

  if (total === 0) return null;

  const filled = groups.filter((group) => group.symbols.length > 0);

  const body = (
    <div className={cn("flex", inline ? "flex-wrap items-center gap-x-5 gap-y-2.5" : "flex-col gap-3.5")}>
      {filled.map((group) => (
        <div key={group.label} className={cn("flex gap-2", inline ? "flex-wrap items-center" : "flex-col")}>
          <p className="flex items-center gap-1.5 text-tiny font-semibold text-muted">
            {group.label}
            <span className="numeral">({group.symbols.length})</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.symbols.map((item) => (
              <Link
                key={item.symbol}
                /* Takvimin bütün girişleri şirketin bilanço sayfasına
                   (24 Ekim, gerekçe EarningsCalendar hero kartı). */
                href={earningsHref(item.symbol)}
                prefetch={false}
                className={cn(
                  // min-h-8: sembol çipleri 26px'lik dokunma hedefi
                  // bırakıyordu; sık dizilmiş bir ızgarada parmakla
                  // komşusuna basmak kolaydı.
                  "tap-44 inline-flex min-h-8 items-center rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold transition-colors hover:border-line-strong hover:bg-primary-tint hover:text-primary",
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
  );

  if (inline) return <div className="py-1">{body}</div>;

  const shownPreview = preview.slice(0, total);
  const hidden = total - shownPreview.length;

  return (
    /* `display: contents`: karo ile açılan panel kart ızgarasının DOĞRUDAN
       hücreleri olur (karo satırın kalanında, panel tam genişlikte);
       ızgara dışında ikisi alt alta blok. */
    <div className={styles.wrap}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={styles.tile}
      >
        {/* İç sarmalayıcı: kap sorgusu kabın KENDİSİNİ biçimleyemez. */}
        <span className={styles.inner}>
        <span className={styles.head}>
          <span className={styles.label}>{label}</span>
          <span className={styles.count}>
            <b className="figure">{total}</b>
            {unit && <span>{unit}</span>}
          </span>
        </span>

        {/* PENCERE DAĞILIMI: tek kulvarda üç dilim, yanında sayıları. Dilim
            tonu büyüklük tonunun (`--bar-soft`) üç basamağı; yön rengi
            DEĞİL (eski listede açılış öncesi yeşil noktayla işaretliydi:
            yeşil bu sitede "yükseliş" demek). Çizim sayıların kopyası,
            `aria-hidden`. */}
        <span className={styles.windows}>
          <span aria-hidden className={styles.lane}>
            {filled.map((group) => (
              <i key={group.label} data-tone={group.tone} style={{ "--n": group.symbols.length } as CSSProperties} />
            ))}
          </span>
          <span className={styles.legend}>
            {filled.map((group) => (
              <span key={group.label} data-tone={group.tone}>
                <i aria-hidden />
                <span className={styles.legendName}>{group.label}</span>
                <b className="figure">{group.symbols.length}</b>
              </span>
            ))}
          </span>
        </span>

        {shownPreview.length > 0 && labels && (
          <span className={styles.preview}>
            <span className={styles.previewLabel}>{labels.largest}</span>
            <span className={styles.previewList}>
              {shownPreview.map((symbol) => (
                <span key={symbol} className={styles.previewChip}>
                  {symbol}
                </span>
              ))}
              {hidden > 0 && <span className={cn("figure", styles.previewMore)}>+{hidden}</span>}
            </span>
          </span>
        )}

        <span className={styles.action}>
          {labels ? (open ? labels.close : labels.open) : null}
          <CaretDown weight="bold" size={13} aria-hidden className={cn(styles.caret, open && styles.caretOpen)} />
        </span>
        </span>
      </button>

      {/* `step-in`: yüzlerce çipli panel tek karede patlıyordu; açılan
          içerik evin hazır giriş sınıfıyla geliyor (reduce korumalı). */}
      {open && (
        <Panel className={cn("step-in px-4 py-3.5 sm:px-5", styles.panel)}>
          {body}
        </Panel>
      )}
    </div>
  );
}
