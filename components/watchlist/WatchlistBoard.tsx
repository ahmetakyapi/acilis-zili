"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CaretDown,
  CaretUp,
  DotsSixVertical,
  MagnifyingGlass,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react/dist/ssr";
import {
  addSymbolToList,
  createWatchlist,
  deleteWatchlist,
  removeSymbolFromList,
  reorderWatchlistItems,
} from "@/app/actions/watchlist";
import { ChangePill } from "@/components/ui/primitives";
import type { SearchHit } from "@/app/api/search/route";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Favoriler panosu.
 * - Sembol ekleme: satır içi arama (komut paletiyle aynı uç), tıkla-ekle.
 * - Sıralama: masaüstünde sürükle-bırak, dokunmatikte ↑/↓ okları; sıra
 *   iyimser uygulanır ve sunucuya yazılır.
 * - Liste durumu props'tan gelir; yalnızca sıra farkı yerel tutulur, yenile
 *   sonrası kimlik eşlemesiyle birleşir (efektsiz, deterministik).
 */

export type BoardItem = { id: string; symbol: string };
export type BoardList = {
  id: string;
  name: string;
  color: string;
  items: BoardItem[];
};
/* `changePct` NULL OLABİLİR: sağlayıcı önceki kapanışı vermediğinde değişim
   "sıfır" değil "bilinmiyor". `ChangePill` bu durumu zaten nötr basıyor. */
export type BoardQuote = { price: number; changePct: number | null };

export type BoardLabels = {
  newList: string;
  newListName: string;
  listNamePlaceholder: string;
  createList: string;
  deleteList: string;
  /** Satırdaki çöp kutusu — listeyi değil YALNIZCA o sembolü çıkarır. */
  removeSymbol: string;
  deleteListConfirm: string;
  colorLegend: string;
  colorNames: Record<string, string>;
  addSymbol: string;
  symbolPlaceholder: string;
  empty: string;
  emptyAll: string;
  emptyAllHint: string;
  noResults: string;
  moveUp: string;
  moveDown: string;
  cancel: string;
};

const LIST_COLOR_CLASS: Record<string, string> = {
  primary: "bg-primary",
  brass: "bg-brass",
  up: "bg-up",
  down: "bg-down",
  flat: "bg-flat",
};

const QUICK_PICKS = ["NVDA", "AAPL", "MSFT", "TSLA", "AMD", "MU"] as const;

export function WatchlistBoard({
  lists,
  quotes,
  names,
  logos,
  locale,
  labels,
}: {
  lists: BoardList[];
  quotes: Record<string, BoardQuote>;
  names: Record<string, string>;
  logos: Record<string, string>;
  locale: Locale;
  labels: BoardLabels;
}) {
  return (
    <div className="flex flex-col gap-5">
      <NewListForm labels={labels} />
      {lists.length === 0 ? (
        <section className="panel">
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-soft">{labels.emptyAll}</p>
            <p className="max-w-sm text-xs text-muted">{labels.emptyAllHint}</p>
          </div>
        </section>
      ) : (
        lists.map((list) => (
          <ListPanel
            key={list.id}
            list={list}
            quotes={quotes}
            names={names}
            logos={logos}
            locale={locale}
            labels={labels}
          />
        ))
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Yeni liste — tek dokunuşla açılan satır içi form
   -------------------------------------------------------------------------- */

function NewListForm({ labels }: { labels: BoardLabels }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-(--radius-md) border border-dashed border-line-strong px-4 text-sm font-medium text-soft transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary"
      >
        <Plus weight="bold" size={16} />
        {labels.newList}
      </button>
    );
  }

  return (
    <section className="panel p-4 sm:p-5">
      <form
        action={async (formData: FormData) => {
          await createWatchlist(formData);
          setOpen(false);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-body">
            {labels.newListName}
          </span>
          <input
            name="name"
            required
            autoFocus
            maxLength={40}
            placeholder={labels.listNamePlaceholder}
            className="h-11 rounded-(--radius-md) border border-line bg-surface-elevated px-3.5 text-sm text-strong outline-none transition-colors placeholder:text-muted focus:border-line-focus"
          />
        </label>
        <fieldset className="flex items-center gap-1.5 pb-2">
          <legend className="sr-only">{labels.colorLegend}</legend>
          {Object.entries(LIST_COLOR_CLASS).map(([value, cls], index) => (
            <label key={value} className="cursor-pointer">
              {/* ERİŞİLEBİLİR AD. Etiketin metin içeriği boştu (içinde yalnızca
                  `sr-only` bir radio ve renkli bir daire vardı), dolayısıyla
                  beş seçenek de "seçenek düğmesi, işaretli değil" diye
                  okunuyor ve aralarında hiçbir ayrım kalmıyordu. `title`
                  yardımcı teknolojide güvenilir bir ad değil ve zaten iç
                  anahtarı ("primary", "brass") gösteriyordu. */}
              <input
                type="radio"
                name="color"
                value={value}
                defaultChecked={index === 0}
                aria-label={labels.colorNames[value] ?? value}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "block size-6 rounded-full border-2 border-transparent transition-all peer-checked:border-(--text-strong) peer-focus-visible:ring-2 peer-focus-visible:ring-(--line-focus)",
                  cls,
                )}
              />
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-2 pb-0.5">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-(--radius-md) bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            {labels.createList}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex size-11 items-center justify-center rounded-(--radius-md) text-muted transition-colors hover:bg-surface-elevated hover:text-strong"
            aria-label={labels.cancel}
          >
            <X size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Liste paneli — başlık + sıralanabilir satırlar + sembol ekleme
   -------------------------------------------------------------------------- */

function ListPanel({
  list,
  quotes,
  names,
  logos,
  locale,
  labels,
}: {
  list: BoardList;
  quotes: Record<string, BoardQuote>;
  names: Record<string, string>;
  logos: Record<string, string>;
  locale: Locale;
  labels: BoardLabels;
}) {
  const router = useRouter();

  return (
    /* `group/list`: liste başlığındaki silme düğmesi de satırlardaki gibi
       imleç kartın üstündeyken çıkıyor. Kart başına bir tane olduğu için
       satırlardaki kadar gürültülü değildi ama yıkıcı bir eylemin sürekli
       ekranda durması için de bir sebep yok. */
    <section className="panel group/list">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2.5 text-[15.5px] font-bold tracking-[-0.01em] text-strong">
          <span
            aria-hidden
            className={cn(
              "size-2.5 rounded-full",
              LIST_COLOR_CLASS[list.color] ?? "bg-primary",
            )}
          />
          {list.name}
          {/* Sayaç çıplak bir rakamdı ve liste adının devamı gibi
              okunuyordu ("Semiconductors 9"). Kendi hapına girdi. */}
          <span className="numeral rounded-full bg-surface-elevated px-2 py-[2px] text-[11px] font-semibold text-muted">
            {list.items.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(labels.deleteListConfirm)) return;
            const fd = new FormData();
            fd.set("listId", list.id);
            await deleteWatchlist(fd);
            router.refresh();
          }}
          aria-label={`${labels.deleteList}: ${list.name}`}
          title={labels.deleteList}
          className="inline-flex size-8 items-center justify-center rounded-(--radius-sm) text-muted opacity-100 transition hover:bg-down-wash hover:text-down opacity-0 group-focus-within/list:opacity-100 group-hover/list:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Trash weight="duotone" size={14} />
        </button>
      </div>

      {/* Ekleme kutusu listenin başında durur; eklenen sembol sona yazılır. */}
      <AddSymbolRow listId={list.id} labels={labels} />

      {list.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        <SortableRows
          list={list}
          quotes={quotes}
          names={names}
          logos={logos}
          locale={locale}
          labels={labels}
        />
      )}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Sıralanabilir satırlar
   -------------------------------------------------------------------------- */

function applyOrder(items: BoardItem[], order: string[] | null): BoardItem[] {
  if (!order) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const inOrder = order
    .map((id) => byId.get(id))
    .filter((item): item is BoardItem => Boolean(item));
  const rest = items.filter((item) => !order.includes(item.id));
  return [...inOrder, ...rest];
}

function SortableRows({
  list,
  quotes,
  names,
  logos,
  locale,
  labels,
}: {
  list: BoardList;
  quotes: Record<string, BoardQuote>;
  names: Record<string, string>;
  logos: Record<string, string>;
  locale: Locale;
  labels: BoardLabels;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<string[] | null>(null);
  const dragId = useRef<string | null>(null);

  const ordered = useMemo(
    () => applyOrder(list.items, order),
    [list.items, order],
  );

  const persist = useCallback(
    (ids: string[]) => {
      void reorderWatchlistItems(list.id, ids);
    },
    [list.id],
  );

  const moveTo = useCallback(
    (fromId: string, toId: string) => {
      const ids = ordered.map((item) => item.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from === -1 || to === -1 || from === to) return null;
      ids.splice(to, 0, ...ids.splice(from, 1));
      return ids;
    },
    [ordered],
  );

  const nudge = useCallback(
    (id: string, delta: -1 | 1) => {
      const ids = ordered.map((item) => item.id);
      const from = ids.indexOf(id);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= ids.length) return;
      ids.splice(to, 0, ...ids.splice(from, 1));
      setOrder(ids);
      persist(ids);
    },
    [ordered, persist],
  );

  return (
    <ul className="divide-y divide-line-soft">
      {ordered.map((item, index) => {
        const quote = quotes[item.symbol];
        return (
          <li
            key={item.id}
            draggable
            onDragStart={(event) => {
              dragId.current = item.id;
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              event.preventDefault();
              const from = dragId.current;
              if (!from || from === item.id) return;
              const ids = moveTo(from, item.id);
              if (ids) setOrder(ids);
            }}
            onDrop={(event) => event.preventDefault()}
            onDragEnd={() => {
              dragId.current = null;
              if (order) persist(order);
            }}
            className="group flex items-center gap-2 px-2 py-2.5 transition-colors hover:bg-primary-tint sm:px-3"
          >
            {/* Tutamak yalnızca imleç satırın üstündeyken görünür. Dokuz
                satırın hepsinde sürekli duran gri bir nokta ızgarası, listenin
                sol kenarında ikinci bir sütun gibi okunuyordu. */}
            <span
              aria-hidden
              className="hidden cursor-grab touch-none text-muted/60 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-hover:text-muted [@media(hover:none)]:opacity-100 sm:block"
              title="Sürükleyerek sırala"
            >
              <DotsSixVertical weight="duotone" size={15} />
            </span>

            <Link
              href={`/hisse/${item.symbol}`}
              prefetch={false}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              {logos[item.symbol] ? (
                <Image
                  src={logos[item.symbol]}
                  alt=""
                  width={26}
                  height={26}
                  className="size-[26px] shrink-0 rounded-[7px] border border-line-soft bg-white object-contain"
                />
              ) : (
                <span
                  aria-hidden
                  className="numeral flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-primary-wash text-[9px] font-bold text-primary"
                >
                  {item.symbol.slice(0, 2)}
                </span>
              )}
              {/* Sembol telefonda SABİT GENİŞLİKTE DEĞİL. `w-14` (56px) her
                  ekranda duruyordu ve dar telefonda satırın sabit sütunları
                  (fiyat 92 + değişim 86 + oklar 24 + sil 28 + boşluklar)
                  yeri bitirince bu kutu daralmıyor, TAŞIYORDU: sembol fiyatın
                  üstüne biniyor, şirket adı sıfır genişliğe düşüp tamamen
                  kayboluyordu. Sabit genişliğin işi geniş ekranda sütunları
                  hizalamak; telefonda hizalanacak yer zaten yok. */}
              <span className="numeral shrink-0 text-sm font-semibold text-strong sm:w-14">
                {item.symbol}
              </span>
              <span className="min-w-0 truncate text-xs text-soft">
                {names[item.symbol] ?? ""}
              </span>
            </Link>

            {/* Fiyat SABİT GENİŞLİKTE bir sütun. Genişlik içeriğe bağlıydı
                ("539,58" ile "1.211,61" arasında yirmi piksel fark var) ve
                sayılar sağdan hizasız duruyordu; okuyucu dokuz satırı
                karşılaştıramıyordu. Ayrıca fiyat gövde mürekkebindeydi ve
                yanındaki renkli yüzde rozeti onu gölgede bırakıyordu — oysa
                satırın ana sayısı fiyat. */}
            {/* Fiyat ve değişim TELEFONDA ALT ALTA, geniş ekranda yan yana.
                İkisi de sabit genişlikte sütun olarak yan yana dururken satır
                320-360px'te yeri bitiriyordu: sembol fiyatın üstüne biniyor,
                şirket adı sıfır genişliğe düşüyordu. Alt alta almak seksen
                piksel kazandırıyor ve iki sayı zaten aynı şeyin iki yüzü —
                sağ kenarda hizalı bir blok olarak da doğru okunuyor. */}
            <span className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="numeral text-right text-sm font-semibold text-strong sm:w-[92px]">
                {quote ? formatPrice(quote.price, locale) : "—"}
              </span>
              <span className="flex justify-end sm:w-[86px]">
                {quote ? (
                  <ChangePill
                    changePct={quote.changePct}
                    locale={locale}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </span>
            </span>

            {/* Sıralama okları ve silme, İMLEÇ SATIRDAYKEN çıkar.
                Üç ikon her satırda sürekli duruyordu: dokuz satırlık bir
                listede yirmi yedi düğme, üstelik biri yıkıcı.

                KOŞUL GENİŞLİK DEĞİL, İMLEÇ VARLIĞI — ve kural CASCADE
                SIRASINA göre kuruldu. Önce `sm:opacity-0` yazılmıştı: geniş
                ekranlı bir dokunmatik cihazda (tablet) düğmeler gizleniyor
                ve onları geri getirecek hover olayı hiç gelmiyordu.

                İkinci deneme `[@media(hover:hover)]:opacity-0` idi ve
                üretilen CSS ölçülünce o da yanlış çıktı: Tailwind serbest
                varyantları en sona basıyor, yani gizleyen kural gösterenden
                SONRA geliyor ve aynı özgüllükte olduğu için hover hiç
                çalışmıyordu.

                Doğrusu ters kurmak: taban gizli, hover ve klavye açıyor,
                DOKUNMATİK için `[@media(hover:none)]` sonda geldiği için
                tabanı eziyor ve orada düğmeler hep açık kalıyor.

                Klavyeyle gezen okuyucu için `group-focus-within` var: sekme
                tuşu satıra girdiğinde hepsi görünür oluyor. */}
            <span className="flex shrink-0 flex-col opacity-100 transition-opacity opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <button
                type="button"
                onClick={() => nudge(item.id, -1)}
                disabled={index === 0}
                aria-label={`${labels.moveUp}: ${item.symbol}`}
                className="flex size-9 items-center justify-center rounded text-muted transition-colors hover:bg-surface-elevated hover:text-strong disabled:opacity-25 sm:h-5 sm:w-6"
              >
                <CaretUp weight="duotone" size={13} />
              </button>
              <button
                type="button"
                onClick={() => nudge(item.id, 1)}
                disabled={index === ordered.length - 1}
                aria-label={`${labels.moveDown}: ${item.symbol}`}
                className="flex size-9 items-center justify-center rounded text-muted transition-colors hover:bg-surface-elevated hover:text-strong disabled:opacity-25 sm:h-5 sm:w-6"
              >
                <CaretDown weight="duotone" size={13} />
              </button>
            </span>

            <button
              type="button"
              onClick={async () => {
                const fd = new FormData();
                fd.set("itemId", item.id);
                await removeSymbolFromList(fd);
                router.refresh();
              }}
              aria-label={`${labels.removeSymbol}: ${item.symbol}`}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-(--radius-sm) text-muted/70 opacity-100 transition hover:bg-down-wash hover:text-down opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 sm:size-7"
            >
              <Trash weight="duotone" size={13} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------------------
   Sembol ekleme — satır içi arama
   -------------------------------------------------------------------------- */

function AddSymbolRow({
  listId,
  labels,
}: {
  listId: string;
  labels: BoardLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setBusy(false);
  }, []);

  // Debounce'lu arama — setState yalnızca zamanlayıcı/ağ callback'inde.
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) return;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits ?? []);
      } catch {
        // iptal edilen istekler sessizce geçilir
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query, open]);

  const add = useCallback(
    async (symbol: string) => {
      setBusy(true);
      const fd = new FormData();
      fd.set("listId", listId);
      fd.set("symbol", symbol);
      await addSymbolToList(fd);
      reset();
      router.refresh();
    },
    [listId, reset, router],
  );

  if (!open) {
    return (
      <div className="border-b border-line-soft px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 20);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) px-2 sm:min-h-[38px] text-sm font-medium text-primary transition-colors hover:bg-primary-wash"
        >
          <Plus weight="bold" size={15} />
          {labels.addSymbol}
        </button>
      </div>
    );
  }

  const shownHits = query.trim() ? hits.slice(0, 6) : [];

  return (
    <div className="border-b border-line-soft px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <MagnifyingGlass weight="duotone" size={15} className="shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") reset();
            if (event.key === "Enter") {
              event.preventDefault();
              const pick = shownHits[0]?.symbol ?? query.trim().toUpperCase();
              if (pick) void add(pick);
            }
          }}
          placeholder={labels.symbolPlaceholder}
          disabled={busy}
          className="h-10 flex-1 bg-transparent text-base text-strong outline-none placeholder:text-muted sm:text-sm"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={reset}
          aria-label={labels.cancel}
          className="flex size-8 shrink-0 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-surface hover:text-strong"
        >
          <X size={15} />
        </button>
      </div>

      {/* Sonuçlar ya da hızlı öneriler */}
      {shownHits.length > 0 ? (
        <ul className="mt-2 overflow-hidden rounded-(--radius-md) border border-line-soft">
          {shownHits.map((hit) => (
            <li key={hit.symbol}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void add(hit.symbol)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary-wash disabled:opacity-50"
              >
                <span className="numeral flex h-6 w-14 shrink-0 items-center justify-center rounded bg-primary-tint text-xs font-semibold text-primary">
                  {hit.symbol}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-body">
                  {hit.name}
                </span>
                <Plus weight="bold" size={14} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim() ? (
        <p className="mt-2 px-1 text-xs text-muted">{labels.noResults}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_PICKS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              disabled={busy}
              onClick={() => void add(symbol)}
              className="numeral min-h-[32px] rounded-full border border-line bg-surface px-3 text-xs font-semibold text-strong transition-colors hover:border-line-strong hover:bg-primary-tint disabled:opacity-50"
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
