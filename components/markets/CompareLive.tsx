"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import type { CompareBarsResponse } from "@/app/api/karsilastir/route";
import { CompareChart } from "@/components/markets/CompareChart";
import { useRouteNavigating } from "@/components/layout/RouteProgress";
import {
  ChangePill,
  DataError,
  LogoTile,
  Panel,
  Segment,
  SegmentItem,
  Skeleton,
} from "@/components/ui/primitives";
import { seriesColorOf } from "@/lib/chart-series";
import {
  COMPARE_RANGES,
  DEFAULT_COMPARE_RANGE,
  compareHref,
  coverageNote,
  isCompareRange,
  periodChangePct,
  type CompareRange,
  type CompareSeries,
} from "@/lib/compare";
import type { Locale } from "@/lib/i18n/config";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";

/**
 * Karşılaştırma ekranının CANLI KATMANI — aralık istemcide değişiyor.
 *
 * NEDEN: aralık denetimi altı `<Link>`ti ve her tıklama tam bir sunucu
 * gezinmesiydi. Sunucu kotasyonları, şirket künyelerini, beş ölçü bloğunu ve
 * barları yeniden çözüyordu — oysa aralıktan etkilenen tek şey barlar. Bekleme
 * boyunca ekranda hâlâ ESKİ aralığın yüzdeleri duruyordu ve okuyucu düğmeye
 * bastıktan sonra hiçbir sayının değişmediği yarım saniyelik bir ekrana
 * bakıyordu: denetim bozuk gibi okunuyordu.
 *
 * Artık aralık burada bir durum, barlar `/api/karsilastir`den geliyor ve
 * aralık başına önbelleğe alınıyor: 6A→1Y→6A gidip gelen okuyucu ikinci kez
 * ağa çıkmıyor. Düğmenin üzerine gelmek ya da klavyeyle odaklanmak isteği
 * ÖNCEDEN başlatıyor — tıklandığında veri çoktan elde oluyor.
 *
 * AÇILIŞ ARALIĞI İÇİN AĞA ÇIKILMIYOR: ilk seriler sunucudan geliyor
 * (`initialSeries`) ve önbellek onlarla tohumlanıyor. Kalıp `PriceChart` ile
 * aynı; oradaki gerekçe de aynı.
 *
 * SUNUCU BİLEŞENLERİ ÇOCUK OLARAK GEÇİYOR. Sağlayıcı istemci bileşeni ama
 * sardığı ağacın çoğu sunucuda çiziliyor (tablo, ölçü hücreleri, künyeler);
 * yalnızca aralığa BAĞLI hücreler istemci. Tabloyu bütünüyle istemciye
 * taşımak beş ölçü bloğunu ve şirket künyelerini de tarayıcıya indirmek
 * olurdu ve hiçbiri aralıkla değişmiyor.
 */

/* Boş dizi MODÜL SEVİYESİNDE: her çizimde yeni bir `[]` üretmek `useMemo`
   bağımlılıklarını her seferinde tazeler ve bileşenler boşuna yeniden
   çiziliyordu. */
const NO_SERIES: CompareSeries[] = [];

/** İmlecin/odağın bir aralığın üzerinde durması gereken süre — ön yükleme. */
const PREFETCH_DELAY_MS = 180;

export type CompareLabels = {
  /** Aralık denetiminin adı — "Grafik Aralığı". */
  rangeLabel: string;
  /** Kısa aralık etiketleri: TR'de 1A · 3A · 6A · YBB · 1Y · 5Y. */
  ranges: Record<CompareRange, string>;
  /** Uzun karşılıkları — ekran okuyucu "YBB"yi harf harf okuyor. */
  rangeLongs: Record<CompareRange, string>;
  /** Aralık başına hazır duyuru cümlesi — gerekçesi `announce` prop'unda. */
  rangeAnnounce: Record<CompareRange, string>;
  /** Şeridin sol sütun künyesi. */
  selected: string;
  /** Şeridin günlük değişim sütunu künyesi. */
  dayShort: string;
  /** Şeridin dönem sütunu künyesi; `{range}` kısa adla değişir. */
  periodColumn: string;
  /** `{symbol}` yer tutuculu tam cümle — sözcük sırası dile bağlı. */
  remove: string;
  /** Seri seçilen aralığı tam kapsamadığında sayının altındaki künye. */
  partialPeriod: string;
  chartTitle: string;
  chartHint: string;
  chartReading: string;
  chartMissing: string;
  chartMissingHint: string;
  /** Aralık getirilemedi. */
  rangeFailed: string;
  rangeFailedHint: string;
  retry: string;
  periodChange: string;
};

type StoreEntry = { series: CompareSeries[] } | { failed: true };

type ComparePhase = "ready" | "loading" | "error";

type CompareValue = {
  symbols: string[];
  range: CompareRange;
  setRange: (next: CompareRange) => void;
  /** Düğmeye basılmadan önce isteği başlatır — imleç ya da odak yeter. */
  prefetch: (next: CompareRange) => void;
  series: CompareSeries[];
  phase: ComparePhase;
  retry: () => void;
  locale: Locale;
};

const CompareCtx = createContext<CompareValue | null>(null);

function useCompare(): CompareValue {
  const value = useContext(CompareCtx);
  if (!value) {
    throw new Error("CompareProvider ağacının dışında kullanıldı");
  }
  return value;
}

/**
 * Sağlayıcı YOKSA null döner — `CompareAdd` hem boş ekranda (sağlayıcısız)
 * hem şeritte (sağlayıcı içinde) çiziliyor ve ikisinde de çalışmak zorunda.
 */
export function useCompareOptional(): CompareValue | null {
  return useContext(CompareCtx);
}

export function CompareProvider({
  symbols,
  initialRange,
  initialSeries,
  locale,
  announce,
  children,
}: {
  symbols: string[];
  initialRange: CompareRange;
  initialSeries: CompareSeries[];
  locale: Locale;
  /**
   * Aralık başına HAZIR duyuru cümlesi.
   *
   * Kalıp ve tek bir dizge yetmiyordu: `{range}` yerine elde yalnızca ham
   * anahtar (`"1M"`) var ve ekran okuyucu "Aralık bir M olarak değiştirildi"
   * diyordu. Uzun ad sözlükte (`chart.rangeLabels`) ve sözlük sunucuda
   * çözülüyor, o yüzden cümleler hazır geliyor.
   */
  announce: Record<CompareRange, string>;
  children: React.ReactNode;
}) {
  const symbolKey = symbols.join(",");

  /**
   * BAŞLANGIÇ ARALIĞI ADRESTEN, prop'tan DEĞİL.
   *
   * Sığ güncellemenin bedeli: `replaceState` yalnızca adresi tazeliyor, o
   * adres için sunucudan RSC yükü çekilmiyor. Geçmiş girdisinde duran ağaç
   * hâlâ ÖNCEKİ aralığın sunucu çizimi ve istemci yönlendirici önbelleği onu
   * saklıyor. Ölçüldü: 5Y seç → menüden başka bir ekrana git → geri tuşu.
   * Adres `?aralik=5Y` diyor ama denetimde 6A seçili, şerit "6A Getirisi"
   * yazıyor ve sayılar 6A'nın. Okuyucu hiçbir şey yapmadan F5'e basınca
   * ekran kendiliğinden 5Y'ye atlıyordu.
   *
   * Adres bu ekranda tek doğru kaynak; prop yalnızca sunucu çiziminde
   * geçerli. Sunucuda `window` yok, orada prop okunuyor ve ikisi zaten
   * aynı — hidrasyonda ayrışma olmuyor. Ayrışan tek hâl önbellekten geri
   * dönüş ve orada doğru olan adres.
   */
  const [range, setRangeState] = useState<CompareRange>(() => {
    if (typeof window === "undefined") return initialRange;
    const adres = new URLSearchParams(window.location.search).get("aralik");
    return isCompareRange(adres) ? adres : DEFAULT_COMPARE_RANGE;
  });
  const [store, setStore] = useState<Record<string, StoreEntry>>(() => ({
    [`${symbolKey}:${initialRange}`]: { series: initialSeries },
  }));
  const [spoken, setSpoken] = useState<string | null>(null);

  /**
   * İSTENMİŞ ANAHTARLAR. Önbellek `store`da ama "yolda olan" bilgisi orada
   * değil: bu küme olmadan aynı aralık için hem ön yükleme hem effect ayrı
   * birer istek açabilirdi.
   *
   * AÇILIŞ ARALIĞI TOHUMLANIYOR ve bu bir hata düzeltmesi: ilk seriler
   * sunucudan gelip doğrudan store'a yazılıyor, yani hiç `load`tan
   * geçmiyorlar. Tohumlanmadığında 6A→1A→6A yolu elindeki veriyi bir kez
   * daha istiyordu.
   *
   * `useRef` değil `useState`: ref'in `current` alanı çizim sırasında
   * okunamıyor (react-hooks/refs) ve tembel `useState` başlatıcısı da bir
   * kez koşup aynı kararlı nesneyi veriyor.
   */
  const [requested] = useState(
    () => new Set<string>([`${symbolKey}:${initialRange}`]),
  );

  const load = useCallback(
    (key: string, next: CompareRange, sessiz = false) => {
      if (requested.has(key)) return;
      requested.add(key);

      /* İSTEK İPTAL EDİLMİYOR ve buna gerek yok: her yanıt KENDİ anahtarına
         yazılıyor, yani geç gelen bir yanıt hiçbir zaman yanlış aralığın
         yerine geçmiyor. Kalıp `PriceChart` ile aynı. */
      fetch(
        `/api/karsilastir?semboller=${encodeURIComponent(symbolKey)}&aralik=${next}`,
      )
        .then((res) => res.json() as Promise<CompareBarsResponse>)
        .then((data) => {
          if (data.ok) {
            setStore((prev) =>
              prev[key] ? prev : { ...prev, [key]: { series: data.series } },
            );
            return;
          }
          basarisiz(key, sessiz);
        })
        .catch(() => basarisiz(key, sessiz));

      /* BAŞARISIZLIK ÖNBELLEĞİ ZEHİRLEMİYOR.
         Hata da bir girdi olarak yazılıyordu ve anahtar `requested` içinde
         kalıyordu: okuyucunun ÜZERİNDEN GEÇTİĞİ bir aralık o an ağ tökezlediği
         için düşerse, sonradan o aralığa basıldığında ekran hazır hata
         paneline atlıyor ve yeni bir istek hiç gitmiyordu. Tek çıkış "Tekrar
         Dene"ydi — oysa kullanıcı o aralığı hiç seçmemişti.
         Artık anahtar her hâlde serbest bırakılıyor (sonraki seçim yeniden
         dener) ve hata girdisi YALNIZCA okuyucunun seçtiği aralık için
         yazılıyor; ön yüklemenin sessiz düşüşü ekranda hiçbir iz bırakmıyor. */
      function basarisiz(anahtar: string, sessizMi: boolean) {
        requested.delete(anahtar);
        if (sessizMi) return;
        setStore((prev) =>
          prev[anahtar] ? prev : { ...prev, [anahtar]: { failed: true } },
        );
      }
    },
    [requested, symbolKey],
  );

  const key = `${symbolKey}:${range}`;
  const entry = store[key];

  useEffect(() => {
    if (!entry) load(key, range);
  }, [entry, key, range, load]);

  const phase: ComparePhase = !entry
    ? "loading"
    : "failed" in entry
      ? "error"
      : "ready";
  const series = entry && !("failed" in entry) ? entry.series : NO_SERIES;

  const setRange = useCallback(
    (next: CompareRange) => {
      setRangeState(next);
      load(`${symbolKey}:${next}`, next);

      /* SIĞ GÜNCELLEME — `router.replace` DEĞİL. `router.replace` sunucu
         bileşenini yeniden çalıştırır ve bu bileşenin varlık sebebi tam
         olarak onu ETMEMEK. Next 14.1'den beri `history.replaceState` App
         Router'a bağlı: adres ve `useSearchParams` güncelleniyor, RSC yükü
         hiç istenmiyor, kaydırma konumu bozulmuyor.

         `pushState` değil `replaceState`: aralık bir gezinme değil. Altı
         düğmeye basan okuyucu geri tuşuna altı kez basmak zorunda kalmasın.

         Virgül HAM kalıyor — `URLSearchParams` onu %2C yapıyor ve aynı
         içerik iki ayrı adreste yaşıyordu; gerekçesi `lib/compare.ts`te. */
      const url = new URL(window.location.href);
      if (next === DEFAULT_COMPARE_RANGE) url.searchParams.delete("aralik");
      else url.searchParams.set("aralik", next);
      const search = url.search.replace(/%2C/g, ",");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${search}${url.hash}`,
      );

      setSpoken(announce[next]);
    },
    [announce, load, symbolKey],
  );

  const prefetch = useCallback(
    (next: CompareRange) => load(`${symbolKey}:${next}`, next, true),
    [load, symbolKey],
  );

  const retry = useCallback(() => {
    requested.delete(key);
    setStore((prev) => {
      const sonraki = { ...prev };
      delete sonraki[key];
      return sonraki;
    });
  }, [key, requested]);

  const value = useMemo<CompareValue>(
    () => ({ symbols, range, setRange, prefetch, series, phase, retry, locale }),
    [symbols, range, setRange, prefetch, series, phase, retry, locale],
  );

  return (
    <CompareCtx.Provider value={value}>
      {children}
      {/* Aralık değişimi GÖRÜLMEYEN okuyucuya da söyleniyor: sayfanın
          ortasındaki yüzdeler sessizce yenileniyordu. */}
      <p role="status" aria-live="polite" className="sr-only">
        {spoken}
      </p>
    </CompareCtx.Provider>
  );
}

/* --------------------------------------------------------------------------
   Aralık denetimi — sayfa başlığının sağında

   BAĞLANTI OLARAK KALIYOR, düğme olmuyor. Adres gerçek: JavaScript
   çalışmadığında tıklama sunucu gezinmesine düşüyor ve ekran aynı sonucu
   veriyor; "yeni sekmede aç" ve bağlantı kopyalama da çalışmaya devam
   ediyor. JavaScript varsa tıklama yakalanıp sığ yola çevriliyor.

   `data-shallow`: `RouteProgress` belgeyi YAKALAMA evresinde dinliyor, yani
   `preventDefault` çağrılmadan önce çubuğu yakıyor. Bu öznitelik ona
   "burada gezinme yok" diyor.
   -------------------------------------------------------------------------- */

export function CompareRangeControl({ labels }: { labels: CompareLabels }) {
  const { symbols, range, setRange, prefetch } = useCompare();

  /* GEZİNME SÜRERKEN DENETİM KAPALI.
     Sığ güncelleme (`history.replaceState`) Next'in yönlendiricisinde O
     SIRADA UÇUŞTA OLAN bir gezinmeyi iptal ediyor — sessizce, geri
     dönmemek üzere. Şeritten bir sembol çıkarıp yanıt inmeden aralığa basan
     okuyucu, çarpı tıklamasının hiç olmamış gibi yok olduğunu görüyordu;
     ölçüldü, gezinme on altı saniye sonra bile tamamlanmadı.
     Pencere birkaç yüz milisaniye ve o sırada üstte gezinme çubuğu zaten
     dönüyor: denetim beklemeyi görünür kılıyor, tıklamayı yutmuyor.
     Gerekçenin tamamı `components/layout/RouteProgress.tsx`te. */
  const gezinmede = useRouteNavigating();

  /* ÖN YÜKLEME BEKLEMEYE BAĞLI. Altı düğme bitişik bir rayın içinde: fareyi
     ray boyunca bir kez gezdirmek `pointerenter`i beş kez tetikliyor ve beş
     ayrı isteğe (dolayısıyla beş Alpaca gidişine) dönüşüyordu. Klavyeyle
     denetimi geçmek de aynı — sekme tuşu altı düğmeye sırayla odaklanmak
     zorunda. Sayaç her yeni imleç/odak olayında sıfırlanıyor, yani yalnızca
     okuyucunun ÜZERİNDE DURDUĞU aralık isteniyor. */
  const bekleyen = useRef<number | null>(null);
  const onYukle = (next: CompareRange) => {
    if (bekleyen.current !== null) window.clearTimeout(bekleyen.current);
    bekleyen.current = window.setTimeout(() => {
      bekleyen.current = null;
      prefetch(next);
    }, PREFETCH_DELAY_MS);
  };
  useEffect(
    () => () => {
      if (bekleyen.current !== null) window.clearTimeout(bekleyen.current);
    },
    [],
  );

  return (
    <div
      className={cn(
        "scroll-x-hint -mx-1 max-w-full px-1 transition-opacity",
        gezinmede && "pointer-events-none opacity-50",
      )}
      aria-busy={gezinmede || undefined}
    >
      <Segment label={labels.rangeLabel}>
        {COMPARE_RANGES.map((key) => (
          <SegmentItem
            key={key}
            href={compareHref(symbols, key)}
            active={range === key}
            label={labels.rangeLongs[key]}
            prefetch={false}
            shallow
            disabled={gezinmede}
            onPointerEnter={() => onYukle(key)}
            onFocus={() => onYukle(key)}
            onClick={(event) => {
              /* Değiştirici tuşlar tarayıcıya bırakılıyor — "yeni sekmede
                 aç" bu denetimin hâlâ gerçek bir bağlantı olmasından
                 geliyor. */
              if (
                event.defaultPrevented ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              if (gezinmede) return;
              setRange(key);
            }}
          >
            {labels.ranges[key]}
          </SegmentItem>
        ))}
      </Segment>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Sembol şeridi

   Bir çip yığınıydı: logo, sembol, çarpı. Sonra şirket adı ve renk anahtarı
   eklendi. Şimdi eksik olan tek şey vardı — ARALIĞIN SÜRDÜĞÜ SAYI. Ekranın
   en üstündeki denetim aralığı değiştiriyor, ama seçili sembollerin yanında
   duran tek yüzde GÜNLÜK değişimdi ve o aralıkla ilgisiz: okuyucu 1A'dan
   1Y'ye geçiyor, şeritte hiçbir şey kıpırdamıyordu.

   Sütunun başlığı ARALIĞIN ADINI taşıyor ("6A Getirisi") — sayının hangi
   pencereye ait olduğu sayının kendi üstünde yazıyor, ekranın başka bir
   köşesindeki düğmede değil.

   GÜNLÜK DEĞİŞİM DAR EKRANDA ŞERİTTEN İNİYOR. 360 pikselde şeride kalan
   yatay alan 292 piksel: iki sayı sütunu ve şirket adı aynı anda sığmıyor,
   ad 77 piksele düşüyor ve "NVIDIA Corp" bile kırpılıyordu. Günlük değişim
   kaybolmuyor — hemen altındaki tablonun "Günlük Değişim" satırında duruyor
   ve o satır aralıktan bağımsız. Geniş ekranda yer var, orada ikisi de
   şeritte.
   -------------------------------------------------------------------------- */

export type CompareStripRow = {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  changePct: number | null;
};

export function CompareStrip({
  rows,
  labels,
  children,
}: {
  rows: CompareStripRow[];
  labels: CompareLabels;
  /** Ekleme çipi / dolu künyesi — sunucudan geliyor. */
  children?: React.ReactNode;
}) {
  const { symbols, range, series, phase, locale } = useCompare();

  return (
    <Panel>
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-2 sm:px-5">
        <span className="plate min-w-0 flex-1 text-nano">{labels.selected}</span>
        <span className="plate hidden w-[72px] shrink-0 text-right text-nano sm:block">
          {labels.dayShort}
        </span>
        <span className="plate w-[86px] shrink-0 text-right text-nano text-primary sm:w-[104px]">
          {labels.periodColumn.replace("{range}", labels.ranges[range])}
        </span>
        {/* Çarpı sütununun genişliği — başlık sayılarla aynı hizada dursun.
            Düğme 44px dokunma hedefi ama negatif margin ile 24px yer
            kaplıyor (geniş ekranda 20px). */}
        <span aria-hidden className="w-6 shrink-0 sm:w-5" />
      </div>

      <ul className="divide-y divide-line-soft">
        {rows.map((row) => {
          const pct = periodChangePct(
            series.find((entry) => entry.symbol === row.symbol),
          );
          /* KISA SERİ KENDİ DÖNEMİNİ SÖYLER — ŞERİTTE DE.
             Bu künye tabloda zaten vardı ve sayı şeride taşınırken
             kopyalanmamıştı: sütun başlığı "5Y Getirisi" derken altındaki
             kalın "−%14,90" aslında on haftalık bir getiriydi ve ekranın en
             büyük puntosu yanlış olanı söylüyordu. Uyarı sayının yanında
             durmak zorunda; gerekçesi `lib/compare.ts` → coverageNote. */
          const kapsam = coverageNote(series, row.symbol, locale);
          return (
            <li
              key={row.symbol}
              className="flex flex-col gap-1 px-4 py-2.5 sm:px-5"
            >
            <div className="flex items-center gap-3">
              {/* Renk sembolden eşleniyor, dizinin sırasından değil: seri
                  barı gelmeyen sembolü eliyor ve indise bakan bir eşleme
                  bütün renkleri kaydırıyordu. */}
              <span
                aria-hidden
                className="h-5 w-[3px] shrink-0 rounded-full"
                style={{ background: seriesColorOf(symbols, row.symbol) }}
              />
              <LogoTile
                symbol={row.symbol}
                logoUrl={row.logoUrl}
                size="sm"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/hisse/${row.symbol}`}
                  className="tap-44 numeral w-fit text-base font-bold leading-tight text-strong transition-colors hover:text-primary"
                >
                  {row.symbol}
                </Link>
                {row.name && (
                  <span className="truncate text-tiny leading-tight text-muted">
                    {row.name}
                  </span>
                )}
              </span>

              <span className="hidden w-[72px] shrink-0 justify-end sm:flex">
                {row.changePct !== null ? (
                  <ChangePill
                    changePct={row.changePct}
                    locale={locale}
                    size="sm"
                  />
                ) : (
                  <span className="numeral text-tiny text-muted">—</span>
                )}
              </span>

              <span className="flex w-[86px] shrink-0 justify-end sm:w-[104px]">
                {phase === "loading" ? (
                  <Skeleton className="h-4 w-14 rounded-full" />
                ) : pct === null ? (
                  <span className="numeral text-base text-muted">—</span>
                ) : (
                  <span
                    className={cn(
                      "numeral text-base font-bold",
                      directionText(directionOf(pct)),
                    )}
                  >
                    {formatPercent(pct, locale)}
                  </span>
                )}
              </span>

              {/* Dokunma hedefi 44px; görsel daire aynı, negatif margin
                  satır yüksekliğini değiştirmiyor. Adres CANLI aralığı
                  taşıyor — sunucudan gelen sabit bir bağlantı, aralık
                  istemcide değiştikten sonra eski kalırdı. */}
              <Link
                href={compareHref(
                  symbols.filter((entry) => entry !== row.symbol),
                  range,
                )}
                /* Sözcük sırası DİLE BAĞLI: birleştirme Türkçede çalışıyor
                   ("NVDA Listeden Çıkar") ama İngilizcede "NVDA Remove From
                   List" çıkıyordu. Kalıp sözlükte, yer tutucuyla. */
                aria-label={labels.remove.replace("{symbol}", row.symbol)}
                className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-down-wash hover:text-down focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus) sm:-m-1.5 sm:size-8"
              >
                <X weight="bold" size={12} />
              </Link>
              </div>
              {phase === "ready" && kapsam && (
                /* Satırın ALTINDA, tam genişlikte: sayı sütunu 86 piksel ve
                   iki tarihlik bir künye orada üç satıra kırılıyordu. */
                <p className="numeral pl-[41px] text-nano leading-tight text-muted">
                  {labels.partialPeriod} · {kapsam}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {children}
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Normalize grafik paneli

   PANEL HER HÂLDE BASILIYOR. Bir zamanlar `series.length > 0` koşulu paneli
   tümüyle yutuyordu: sağlayıcı bar döndürmediğinde ekranda grafiğin yerinde
   hiçbir şey yoktu ve okuyucu "bu ekranda grafik yok mu" diye soruyordu.

   Yükleme İSKELETLE anlatılıyor, eski aralığın eğrisi soluklaştırılarak
   değil: soluk da olsa ekranda duran şey BAŞKA bir dönemin eğrisi olurdu ve
   üstündeki denetim yeni aralığı seçili gösteriyordu. Kap `min-h` ile
   yerinde duruyor, sayfa zıplamıyor.
   -------------------------------------------------------------------------- */

export function CompareChartPanel({ labels }: { labels: CompareLabels }) {
  const { symbols, series, phase, retry, locale } = useCompare();

  return (
    <Panel className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
        {labels.chartTitle}
      </h2>
      {/* İpucu grafiğin ÜSTÜNDE: "hepsi neden sıfırdan başlıyor" sorusu
          doğmadan cevaplanıyor. */}
      <p className="text-tiny leading-relaxed text-muted">{labels.chartHint}</p>

      <div className="relative min-h-[240px]" aria-busy={phase === "loading"}>
        {phase === "loading" && (
          <div
            aria-hidden
            className="skeleton absolute inset-0 rounded-(--radius-md)"
          />
        )}
        {phase === "error" && (
          /* BAŞARISIZLIK DUYURULUYOR. Aralık değişimi `role="status"` ile
             söyleniyordu ama istek düştüğünde ekran okuyucu yalnızca
             "Aralık Son 1 Yıl olarak değiştirildi" duyurusunu alıyor, sonra
             şeritte ve tabloda tire buluyordu — başarısızlık hiçbir yerde
             konuşmuyordu (WCAG 4.1.3). Depodaki hata kalıbı `role="alert"`:
             `AuthForm`, `DeleteAccount`, `WatchlistBoard` üçü de böyle. */
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 text-center"
          >
            <p className="text-sm text-body">{labels.rangeFailed}</p>
            <p className="max-w-sm text-xs text-muted">
              {labels.rangeFailedHint}
            </p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-3.5 text-small font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-9"
            >
              {labels.retry}
            </button>
          </div>
        )}
        <div className={cn(phase !== "ready" && "invisible")}>
          {series.length > 0 ? (
            <CompareChart
              series={series}
              order={symbols}
              title={labels.chartTitle}
              locale={locale}
              readingLabel={labels.chartReading}
            />
          ) : (
            <DataError
              message={labels.chartMissing}
              hint={labels.chartMissingHint}
            />
          )}
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Tablodaki "Dönem Getirisi" satırı

   Tablonun geri kalanı SUNUCUDA çiziliyor ve orada kalıyor: fiyat, F/K,
   temettü, beta, 52 hafta bandı, sektör — hiçbiri aralıkla değişmiyor.
   Yalnızca bu satır aralığa bağlı, o yüzden yalnızca bu satır istemci.

   Etiket de aralığı SÖYLÜYOR. "Dönem Getirisi" tek başına hangi dönem
   olduğunu söylemiyordu; altındaki künye seçili aralığın uzun adını taşıyor
   ve denetimle birlikte değişiyor.
   -------------------------------------------------------------------------- */

export function ComparePeriodLabel({ labels }: { labels: CompareLabels }) {
  const { range } = useCompare();
  return (
    <>
      {labels.periodChange}
      <span className="block text-nano leading-tight text-muted">
        {labels.rangeLongs[range]}
      </span>
    </>
  );
}

export function ComparePeriodValue({ symbol }: { symbol: string }) {
  const { series, phase, locale } = useCompare();

  if (phase === "loading") {
    return <Skeleton className="ml-auto h-3.5 w-16 rounded-full" />;
  }

  const pct = periodChangePct(
    series.find((entry) => entry.symbol === symbol),
  );
  if (pct === null) return <>—</>;

  const kapsam = coverageNote(series, symbol, locale);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn("numeral font-semibold", directionText(directionOf(pct)))}
      >
        {formatPercent(pct, locale)}
      </span>
      {kapsam && <span className="numeral text-nano text-muted">{kapsam}</span>}
    </div>
  );
}
