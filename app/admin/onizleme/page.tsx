import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import {
  AdminEmpty,
  AdminPanel,
  AdminPanelTitle,
  AdminReadStamp,
  adminInput,
} from "@/components/admin/AdminUI";
import { DevicePreview } from "@/components/admin/DevicePreview";
import { FilterChip, PageHeader, Segment, SegmentItem, buttonClass } from "@/components/ui/primitives";
import { getEditableStories, getRecentBriefs } from "@/lib/admin-data";
import { adminDay } from "@/lib/admin-format";
import { briefHref } from "@/lib/brief";
import { getTheme } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import {
  normalizePreviewInput,
  previewDisplayPath,
  previewPathError,
  previewSrc,
  splitPreviewLocale,
  type PreviewLocale,
  type PreviewTheme,
} from "@/lib/preview";

/**
 * Cihaz önizlemesi (31 Ekim) — yayındaki bir sayfanın telefonda ve
 * masaüstünde nasıl göründüğü, yan yana.
 *
 * DURUM ADRESTE: `?yol=/mercek/x&tema=koyu&dil=en`. Seçiciler bağlantı,
 * adres kutusu bir GET formu; geri tuşu ve paylaşılan bağlantı aynı
 * önizlemeyi açıyor (CLAUDE.md: "Adresten okunan durum ADRESTEN başlatılır").
 * Hiçbir şey yazılmıyor — panel ÖLÇER, Yazılar DEĞİŞTİRİR.
 *
 * YAYINDAKİ HÂL, TASLAK DEĞİL: çerçeve sitenin kendi sayfasını açıyor.
 * Kaydedilmemiş metnin önizlemesi editörün kendi "Önizle" bölmesinde.
 *
 * Çerçeve yasağı (`frame-ancestors 'none'`) yalnız `?onizleme=1` isteğinde ve
 * yalnız AYNI KÖKE gevşiyor; tehdit modeli `lib/preview.ts` başında.
 */

export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.preview.title) };

/** Sabit kısa yollar — en çok denetlenen sayfalar. */
const FIXED_PICKS = [
  { path: "/", label: "Ana Sayfa" },
  { path: "/piyasalar", label: "Piyasalar" },
  { path: "/bilancolar", label: "Bilançolar" },
  { path: "/takvim", label: "Takvim" },
  { path: "/mercek", label: "Mercek" },
  { path: "/rehber", label: "Rehber" },
] as const;

/** Veritabanından gelen kısa yol sayısı — son mercek yazıları ve bültenler. */
const RECENT_STORIES = 2;
const RECENT_BRIEFS = 2;

type Pick = { path: string; label: string };

export default async function PreviewPage(props: PageProps<"/admin/onizleme">) {
  await requireAdmin();
  const search = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const raw = normalizePreviewInput(one(search.yol));
  const typed = splitPreviewLocale(raw);
  const path = typed.path;
  const dilParam = one(search.dil);
  /* Yazılan adres `/en/...` ise dil oradan; değilse seçiciden; o da yoksa TR. */
  const locale: PreviewLocale = typed.locale ?? (dilParam === "en" ? "en" : "tr");
  const temaParam = one(search.tema);
  /* Tema seçilmediyse yöneticinin kendi teması — çerçeve gördüğü panelle aynı tonda açılsın. */
  const theme: PreviewTheme =
    temaParam === "koyu" || temaParam === "acik"
      ? temaParam
      : (await getTheme()) === "dark"
        ? "koyu"
        : "acik";
  const error = previewPathError(path);

  const href = (next: Partial<{ path: string; locale: PreviewLocale; theme: PreviewTheme }>) => {
    const params = new URLSearchParams({
      yol: next.path ?? path,
      tema: next.theme ?? theme,
      dil: next.locale ?? locale,
    });
    return `/admin/onizleme?${params.toString()}`;
  };

  const [stories, briefs] = await Promise.all([
    getEditableStories(RECENT_STORIES),
    getRecentBriefs(RECENT_BRIEFS),
  ]);
  /* KISA YOLLAR VAR OLAN KAYITTAN: son mercek yazıları ve son bültenler.
     Okunamazsa yalnız sabit yollar kalır; uydurma bir adres basılmaz. */
  const recent: Pick[] = [
    ...(stories.ok
      ? stories.data.rows.map((s) => ({ path: `/mercek/${s.slug}`, label: `Mercek · ${adminDay(s.eventDate)}` }))
      : []),
    ...(briefs.ok
      ? briefs.data.items.map((b) => ({
          path: briefHref(b.briefDate, b.period === "weekly" ? "weekly" : "daily"),
          label: `${b.period === "weekly" ? "Haftalık Bülten" : "Bülten"} · ${adminDay(b.briefDate)}`,
        }))
      : []),
  ];
  const display = previewDisplayPath(path, locale);
  const host = new URL(SITE_URL).host;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={ADMIN_SECTIONS.preview.title} subtitle={ADMIN_SECTIONS.preview.subtitle} />

      {/* SEÇİM ŞERİDİ — adres, kısa yollar, tema ve dil (Ekran Düzeni 2). */}
      <AdminPanel>
        <AdminPanelTitle hint="Yalnız Sitenin Kendi Yolları · Yönetim ve API Önizlenmez">
          Sayfa Seç
        </AdminPanelTitle>
        <div className="flex flex-col gap-4">
          <form action="/admin/onizleme" method="get" key={`${path}|${locale}`} className="flex flex-wrap items-stretch gap-2">
            <input type="hidden" name="tema" value={theme} />
            <input type="hidden" name="dil" value={locale} />
            {/* Telefonda alan adı öneki gizli: 390'da kutuya ~130 piksel
                kalıyordu ve "Aç" alt satıra düşüyordu. */}
            <label className="flex min-w-0 flex-1 basis-0 items-center">
              <span className="sr-only">Önizlenecek adres</span>
              <span
                aria-hidden
                className="hidden h-11 items-center rounded-l-(--radius-md) border border-r-0 border-muted/75 bg-surface-elevated px-3 text-small font-semibold text-muted sm:flex sm:h-10"
              >
                {host}
              </span>
              <input
                name="yol"
                defaultValue={path}
                placeholder="/mercek/yazi-adresi"
                autoComplete="off"
                spellCheck={false}
                className={`${adminInput} h-11 min-w-0 flex-1 font-mono text-small sm:h-10 sm:rounded-l-none`}
              />
            </label>
            <button type="submit" className={buttonClass({ className: "min-w-20 sm:min-w-24" })}>
              Aç
            </button>
          </form>

          {error && (
            <p role="alert" className="text-small font-semibold text-down">
              {error}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-small font-semibold text-muted">Kısa Yollar</p>
              <div className="flex flex-wrap gap-1.5">
                {[...recent, ...FIXED_PICKS].map((pick) => (
                  <FilterChip key={pick.path} href={href({ path: pick.path })} active={!error && pick.path === path}>
                    {pick.label}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Segment label="Çerçevenin teması">
                <SegmentItem href={href({ theme: "acik" })} active={theme === "acik"}>
                  Açık
                </SegmentItem>
                <SegmentItem href={href({ theme: "koyu" })} active={theme === "koyu"}>
                  Koyu
                </SegmentItem>
              </Segment>
              <Segment label="Çerçevenin dili">
                <SegmentItem href={href({ locale: "tr" })} active={locale === "tr"}>
                  TR
                </SegmentItem>
                <SegmentItem href={href({ locale: "en" })} active={locale === "en"}>
                  EN
                </SegmentItem>
              </Segment>
            </div>
          </div>
        </div>
      </AdminPanel>

      {/* ANA GÖRSEL — iki cihaz (Ekran Düzeni 3). */}
      <AdminPanel>
        <AdminPanelTitle hint={`Telefon 390 × 844 · Masaüstü 1440 × 900 · ${theme === "koyu" ? "Koyu" : "Açık"} Tema · ${locale.toUpperCase()}`}>
          Cihazlar
        </AdminPanelTitle>
        {error ? (
          <AdminEmpty title="Bu adres önizlenemez." hint={error} />
        ) : (
          <DevicePreview
            src={previewSrc(path, { locale, theme })}
            display={display}
            title={`Önizleme: ${display}`}
            host={host}
          />
        )}
        {/* Künyeler panelin içinde, saç teliyle (Ekran Düzeni 6). */}
        <div className="mt-5 flex flex-col gap-1.5 border-t border-line pt-3 text-small leading-relaxed text-muted">
          <p>
            Çerçevede yayındaki hâl açılır; kaydedilmemiş değişiklik için
            editörün kendi önizlemesine bakın. Çerçevede formlar ve dışarı
            yönlendirme kapalı, gezinme site içinde sürer.
          </p>
          <p>
            Yönetici hesabıyla açılan sayfalar trafik ölçümüne girmez.{" "}
            <Link href="/admin/yazilar" className="font-semibold text-primary transition-colors hover:text-primary-hover">
              Yazılara Dön
            </Link>
          </p>
        </div>
      </AdminPanel>

      <AdminReadStamp />
    </div>
  );
}
