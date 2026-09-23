"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import {
  restoreStoryRevision,
  saveStoryFromAdmin,
  type EditorState,
  type StoryRevision,
} from "@/app/actions/content";
import { previewStoryBody } from "@/app/actions/content-preview";
/* ÖNİZLEMENİN STİLİ BU ROTADA YÜKLENİYOR. Sunucu eylemi `ArticleBody`yi
   editoryal sınıfla döndürüyor ama eylemden dönen JSX yanında stil
   getirmiyor: Next CSS'i yalnızca layout/page ağacındaki içe aktarmalardan
   bağlıyor. Modül burada içe aktarılmayınca sınıfın arkasında kural
   yoktu ve önizleme rehber görünümüne düşüyordu (üretim manifestinde
   editör sayfasının `entryCSSFiles`i editoryal parçayı içermiyordu).
   Aşağıdaki `data-` başvurusu içe aktarmanın ağaçtan atılmasını önlüyor. */
import editorial from "@/components/article/ArticleEditorial.module.css";
import {
  Alan,
  EDITOR_OLCULERI,
  EylemSeridi,
  OnizlemePaneli,
  Sayac,
  SurumGecmisi,
  TekSatir,
  blokYaz,
  girdi,
  imlecinBlogu,
  kayitDurumu,
  useCikisKorumasi,
  useGenisEkran,
  useImlec,
  useKendiligindenBuyu,
  useOnizleme,
  useOnizlemeTakibi,
  type Gorunum,
} from "@/components/admin/editor-parts";
import { cn } from "@/lib/utils";

/**
 * Mercek yazısı editörü.
 *
 * ÖNİZLEME SUNUCUDAN GELİYOR ve kendiliğinden tazeleniyor: taslak metin bir
 * sunucu eylemine gidiyor, eylem `ArticleBody`yi SUNUCUDA çizip JSX
 * döndürüyor; istemciye yalnızca çizilmiş yük iniyor. Gerekçesi
 * `content-preview.tsx`te: markdown çözümleyicisini panele indirmek ~30KB ve
 * ikinci bir çizici yazmak iki farklı markdown yorumu demekti. Böylece
 * önizleme, yayındaki çizimin KENDİSİ — bir `:::` bloğu burada nasıl
 * görünüyorsa sitede de öyle. Tazeleme ölçüsü `useOnizleme` içinde.
 *
 * SLUG DÜZENLENMİYOR. Panelin işi var olan yazıyı düzeltmek; yeni yazı
 * rutinin işi. Slug'ı serbest bırakmak yanlışlıkla ikinci bir kayıt açmanın
 * en kolay yolu olurdu — alan gizli ve salt okunur olarak gösteriliyor.
 *
 * BÜTÜN ALANLAR DENETİMLİ (23 Eylül denetimi). Yalnızca gövde denetimliydi;
 * başlık, giriş, tarih, semboller ve kaynaklar `defaultValue` taşıyordu ve
 * React 19 bir form eylemi hata DÖNDÜRÜP bittiğinde denetimsiz alanları
 * sıfırlıyor: kaynağa bozuk bir adres yazıp başlığı düzelten yazar, hata
 * mesajıyla birlikte başlığın ESKİ hâlini görüyordu — düzeltme gitmiş, hata
 * artık var olmayan bir satırı gösteriyor. Alanlar tek bir durumda; gönderim
 * de formun kendiliğinden sıfırlamasına girmesin diye `onSubmit`ten
 * (`preventDefault` + geçiş içinde eylem).
 *
 * EDİTÖR KAYITTAN SONRA YERİNDE KALIYOR. Sayfa editörü bir dönem kaydın
 * damgasıyla anahtarlıyordu (`key={updatedAt}`): kaydetme damgayı
 * ilerletiyor, eylemin tazelediği sayfa yeni anahtarla geliyor ve editör
 * sıfırdan kuruluyordu — `useActionState` de onunla birlikte, yani
 * "Kaydedildi" ve "Geri yüklendi" ekrana HİÇ ulaşmıyordu. Anahtar kalktı;
 * sunucudan yeni taslak gelince alanları yenileyen, render içinde koşan bir
 * karşılaştırma (`taban`) aynı işi durumu silmeden yapıyor.
 */

export type StoryDraft = {
  slug: string;
  locale: string;
  title: string;
  dek: string;
  bodyMd: string;
  eventDate: string;
  symbols: string[];
  sources: { label: string; url?: string }[];
  readMinutes: number;
  updatedAt: string | null;
};

const BOS: EditorState = {};

/** Şemadaki sınırlar (lib/content-write.ts → `storyInputSchema`). */
const SINIR = { title: 160, dek: 400, bodyMin: 200, bodyMax: 40000 } as const;

/** Okuma hızı — `readingMinutes` ile aynı sayı (dakikada 160 sözcük). */
const DAKIKADA_SOZCUK = 160;

/**
 * `:::` blok ailesi — yazının görsel dili metinden çiziliyor, yani bu
 * kısayollar süs değil, editörün asıl işi. Sözdizimi
 * `docs/claude-rutinler.md` § 3'te; yeni blok eklenirse ORASI da güncellenir.
 *
 * ÇİP BİR AD TAŞIYOR, SÖZDİZİMİ İKİNCİL (23 Eylül denetimi). Çipler
 * "sayilar, akis, oncesi" gibi ASCII sözdizimi adlarıydı — düğme metninde
 * Title Case kuralını kıran, bülten editörünün "Bölüm Başlığı" çipleriyle
 * de tutmayan bir dil. Ad Türkçe ve Title Case, sözdizimi yanında mono.
 *
 * ÖRNEK DİLE GÖRE. İngilizce editörde de Türkçe örnek ("Rakamlarla",
 * "Toplam tutar") basılıyordu. Blok adı ikisinde de aynı (sözdizimi
 * çevrilmez, § 8); yanındaki başlık ve satırlar kaydın dilinde.
 *
 * SATIRLAR BELGEDEKİ SÖZDİZİMİYLE. Örnekler "- " ile başlıyordu ve
 * ayrıştırıcı o tireyi atmıyor: "sayilar" çipinin bastığı rakam "- 4,2 Mr $"
 * diye, "pay" çipininki "- Şirket" diye çiziliyordu. Belge tiresiz yazıyor.
 */
const BLOKLAR = [
  {
    ad: "sayilar",
    etiket: "Sayılar",
    tr: "::: sayilar Rakamlarla\n4,2 Mr $ | Toplam tutar\n:::",
    en: "::: sayilar By the Numbers\n$4.2B | Total amount\n:::",
  },
  {
    ad: "bar",
    etiket: "Çubuk",
    tr: "::: bar Karşılaştırma\nEtiket | 58,4\n:::",
    en: "::: bar Comparison\nLabel | 58.4\n:::",
  },
  {
    ad: "pay",
    etiket: "Pay",
    tr: "::: pay Pazar Payı\nŞirket | 42\nDiğerleri | 58\n:::",
    en: "::: pay Market Share\nCompany | 42\nOthers | 58\n:::",
  },
  {
    ad: "akis",
    etiket: "Akış",
    tr: "::: akis Zincir\nAdım | Oyuncu\n:::",
    en: "::: akis Chain\nStep | Player\n:::",
  },
  /* `oncesi` LİSTEDE YOKTU ve çizicide vardı. Sonuç sessizdi: blok
     ArticleBody'de çiziliyor, rutin promptunda (§ 3) anlatılıyor ama
     panelden EKLENEMİYORDU — çip basmadığı için editördeki kimse onun
     varlığını bilmiyordu. CLAUDE.md'nin "dört yeri birden güncelle"
     kuralının tam olarak uyardığı hâl; o yer buydu.
     Sözdizimi TAM İKİ SATIR: önce ve sonra. */
  {
    ad: "oncesi",
    etiket: "Önce ve Sonra",
    tr: "::: oncesi Piyasa Değeri\n52,5 Mr $ | 12 Haziran\n19 Mr $ | 29 Temmuz\n:::",
    en: "::: oncesi Market Value\n$52.5B | June 12\n$19B | July 29\n:::",
  },
  {
    ad: "zaman",
    etiket: "Kronoloji",
    tr: "::: zaman Kronoloji\n12 Ağustos | Olay\n:::",
    en: "::: zaman Timeline\nAugust 12 | Event\n:::",
  },
  {
    ad: "grafik",
    etiket: "Grafik",
    tr: "::: grafik NVDA | 3M | Nvidia, bugünden geriye üç ay\n:::",
    en: "::: grafik NVDA | 3M | Nvidia, three months back from today\n:::",
  },
  {
    ad: "ornek",
    etiket: "Örnek",
    tr: "::: ornek Hesap\n**Adım:** açıklama\n:::",
    en: "::: ornek Worked Example\n**Step:** explanation\n:::",
  },
  {
    ad: "dikkat",
    etiket: "Dikkat",
    tr: "::: dikkat Uyarı\nMetin\n:::",
    en: "::: dikkat Caution\nText\n:::",
  },
  {
    ad: "ozet",
    etiket: "Özet",
    tr: "::: ozet Ders\nMetin\n:::",
    en: "::: ozet Takeaway\nText\n:::",
  },
  {
    ad: "tanim",
    etiket: "Tanım",
    tr: "::: tanim Terim\n**Terim:** açıklama\n:::",
    en: "::: tanim Term\n**Term:** definition\n:::",
  },
] as const;

type Alanlar = {
  title: string;
  dek: string;
  body: string;
  eventDate: string;
  symbols: string;
  sources: string;
};

function alanlarOf(draft: StoryDraft): Alanlar {
  return {
    title: draft.title,
    dek: draft.dek,
    body: draft.bodyMd,
    eventDate: draft.eventDate,
    symbols: draft.symbols.join(", "),
    sources: draft.sources
      .map((s) => (s.url ? `${s.label} | ${s.url}` : s.label))
      .join("\n"),
  };
}

/**
 * Kaydedilince SUNUCUNUN yazacağı hâl — kirlilik bununla ölçülüyor.
 * Sunucu metinleri kırpıyor, sembolleri büyütüyor, boş kaynak satırlarını
 * atıyor (app/actions/content.ts → `toInput`, lib/content-write.ts);
 * sonuna bir boşluk eklenmiş başlık "kaydedilmemiş değişiklik" değildir.
 */
function kayitHali(a: Alanlar): string {
  return JSON.stringify([
    a.title.trim(),
    a.dek.trim(),
    a.body.trim(),
    a.eventDate,
    a.symbols
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((s) => s.toUpperCase()),
    a.sources
      .split("\n")
      .map((satir) => satir.trim())
      .filter(Boolean)
      .map((satir) => satir.split("|").map((p) => p.trim()).slice(0, 2).filter(Boolean).join(" | ")),
  ]);
}

export function StoryEditor({
  draft,
  revisions,
  ilkOnizleme,
  canliAdres,
}: {
  draft: StoryDraft;
  revisions: StoryRevision[];
  /** Sayfanın sunucuda çizdiği ilk önizleme — gövdenin kayıttaki hâli. */
  ilkOnizleme: ReactNode;
  /** Yayındaki sayfanın adresi, kaydın dilinde (`/en/mercek/…`). */
  canliAdres: string;
}) {
  const [kayit, kaydet, kaydediliyor] = useActionState(saveStoryFromAdmin, BOS);
  const [geri, geriYukleEylemi, geriYukleniyor] = useActionState(
    restoreStoryRevision,
    BOS,
  );

  const [alanlar, setAlanlar] = useState(() => alanlarOf(draft));
  const ata = <K extends keyof Alanlar>(k: K, v: Alanlar[K]) =>
    setAlanlar((a) => ({ ...a, [k]: v }));

  /* Sunucudan YENİ taslak geldiyse (kaydetme, geri yükleme) alanlar onunla
     yenilenir. Render içinde ve koşullu: React bunu aynı geçişte işleyip
     etkisiz ikinci bir çizimle bitiriyor. */
  const imza = JSON.stringify([draft.updatedAt, alanlarOf(draft)]);
  const [taban, setTaban] = useState(imza);
  if (imza !== taban) {
    setTaban(imza);
    setAlanlar(alanlarOf(draft));
  }

  const kirli = kayitHali(alanlar) !== kayitHali(alanlarOf(draft));
  useCikisKorumasi(kirli);

  const govdeRef = useRef<HTMLTextAreaElement>(null);
  const bolgeRef = useRef<HTMLElement>(null);
  const kaynakRef = useRef<HTMLTextAreaElement>(null);
  const girisRef = useRef<HTMLTextAreaElement>(null);
  const imlec = useImlec();
  const genis = useGenisEkran();
  useKendiligindenBuyu(govdeRef, alanlar.body, !genis);
  useKendiligindenBuyu(kaynakRef, alanlar.sources);
  useKendiligindenBuyu(girisRef, alanlar.dek);

  const ciz = useCallback(
    (metin: string) => previewStoryBody(metin, draft.locale),
    [draft.locale],
  );
  const ilk = useMemo(
    () => ({ metin: draft.bodyMd, cizim: ilkOnizleme }),
    [draft.bodyMd, ilkOnizleme],
  );
  const onizleme = useOnizleme(alanlar.body, ciz, ilk);
  const takip = useOnizlemeTakibi(govdeRef, bolgeRef);
  useEffect(() => takip(), [onizleme.cizilen, takip]);

  const [gorunum, setGorunum] = useState<Gorunum>("yaz");
  const yazKonumu = useRef(0);
  const gorunumDegistir = (yeni: Gorunum) => {
    if (yeni === gorunum) return;
    if (yeni === "onizle") yazKonumu.current = window.scrollY;
    setGorunum(yeni);
    /* Dar ekranda görünüm değişince pencere yazarın YERİNE iniyor:
       önizlemede imlecin bloğuna, yazmaya dönünce bırakılan yere. */
    requestAnimationFrame(() => {
      if (yeni === "yaz") {
        window.scrollTo({ top: yazKonumu.current });
        return;
      }
      const blok = imlecinBlogu(govdeRef.current, bolgeRef.current);
      const hedef = blok ?? bolgeRef.current;
      if (!hedef) return;
      const ust = hedef.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, ust - window.innerHeight / 3) });
    });
  };

  const sifirla = () => setAlanlar(alanlarOf(draft));

  const geriYukle = (id: string) => {
    if (kirli && !window.confirm("Kaydedilmemiş değişiklikler silinecek. Bu sürüm geri yüklensin mi?")) {
      return;
    }
    const fd = new FormData();
    fd.set("revisionId", id);
    startTransition(() => geriYukleEylemi(fd));
  };

  const govdeId = useId();
  const onizlemeId = useId();
  const govdeBaslikId = useId();
  const kunyeBaslikId = useId();
  const lang = draft.locale;
  const hata = kayit.at && kayit.at >= (geri.at ?? "") ? kayit.fieldErrors : undefined;
  const karakter = alanlar.body.trim().length;
  const dakika = Math.max(
    1,
    Math.round(alanlar.body.trim().split(/\s+/).length / DAKIKADA_SOZCUK),
  );

  return (
    <form
      data-preview-style={editorial.prose}
      style={EDITOR_OLCULERI}
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        startTransition(() => kaydet(fd));
      }}
      className="flex flex-col"
    >
      <input type="hidden" name="slug" value={draft.slug} />
      <input type="hidden" name="locale" value={draft.locale} />

      <div className="grid gap-x-6 gap-y-6 lg:grid-cols-2">
        {/* SIRA İŞE GÖRE: başlık, giriş, sonra GÖVDE. Gövde bir dönem beş
            alanın altındaydı ve editörün asıl işi olduğu hâlde ekranın
            dışında başlıyordu. Başlık ve giriş iki sütunu da kaplıyor:
            altlarında gövde ile önizleme AYNI SATIRDA başlıyor. */}
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Alan
            label="Başlık"
            hata={hata?.title}
            hint="Sayfanın H1'i ve listedeki kart başlığı."
            sayac={<Sayac n={alanlar.title.trim().length} tavan={SINIR.title} />}
          >
            {(p) => (
              <TekSatir
                {...p}
                name="title"
                lang={lang}
                value={alanlar.title}
                onValue={(v) => ata("title", v)}
                maxLength={SINIR.title}
                required
                className="text-lead font-semibold leading-snug"
              />
            )}
          </Alan>

          <Alan
            label="Giriş Cümlesi"
            hata={hata?.dek}
            hint="Başlığın altındaki tek cümle; listede de bu görünüyor."
            sayac={<Sayac n={alanlar.dek.trim().length} tavan={SINIR.dek} />}
          >
            {(p) => (
              <textarea
                {...p}
                ref={girisRef}
                name="dek"
                lang={lang}
                value={alanlar.dek}
                onChange={(event) => ata("dek", event.target.value)}
                rows={2}
                maxLength={SINIR.dek}
                required
                className={cn(girdi, "field-sizing-content resize-none leading-relaxed")}
              />
            )}
          </Alan>
        </div>

        {/* ================= Gövde ================= */}
        <section
          id={govdeId}
          aria-labelledby={govdeBaslikId}
          className={cn(
            "flex min-w-0 flex-col gap-2 lg:h-(--editor-bolum)",
            gorunum === "onizle" && "max-lg:hidden",
          )}
        >
          {/* SATIR SABİT BOYDA (23 Eylül denetimi). "Yüklendiği Hâle Dön"
              ilk tuş vuruşunda çiziliyor ve 18 piksellik satırı 32'ye
              çıkarıyordu: yazılan kutu 14 piksel aşağı kayıyordu. */}
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 sm:min-h-9">
            <h3 id={govdeBaslikId} className="text-small font-semibold text-strong">
              Gövde
            </h3>
            {/* Yalnızca değişiklik varken: hiçbir şey değişmemişken duran bir
                "geri al" düğmesi, ne yapacağı belirsiz bir düğmedir. BÜTÜN
                alanları sayfanın açıldığı hâle döndürüyor, yalnızca gövdeyi
                değil. */}
            {kirli && (
              <button
                type="button"
                onClick={sifirla}
                className="tap-44 inline-flex min-h-8 items-center gap-1.5 text-tiny font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                <ArrowCounterClockwise weight="bold" size={13} aria-hidden />
                Yüklendiği Hâle Dön
              </button>
            )}
          </div>

          {/* BLOK ÇUBUĞU SARIYOR, KAYMIYOR. Kayan şeritte son çipler
              sağdan kırpılıyordu ve kırpılmış bir düğme, var olmayan bir
              düğmedir. Telefonda 44 piksel: çipler 32'ydi. */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Blok Ekle">
            {BLOKLAR.map((blok) => (
              <button
                key={blok.ad}
                type="button"
                onClick={() => {
                  if (!govdeRef.current) return;
                  blokYaz(govdeRef.current, lang === "en" ? blok.en : blok.tr, imlec.konum.current);
                }}
                title={`::: ${blok.ad} bloğu ekle`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-small font-semibold text-body transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary sm:min-h-8 sm:px-2.5"
              >
                {blok.etiket}
                <code className="font-mono text-nano font-normal text-muted">{blok.ad}</code>
              </button>
            ))}
          </div>

          <textarea
            ref={govdeRef}
            name="body_md"
            lang={lang}
            aria-labelledby={govdeBaslikId}
            aria-describedby={`${govdeId}-not`}
            aria-invalid={hata?.body_md ? true : undefined}
            value={alanlar.body}
            onChange={(event) => ata("body", event.target.value)}
            onSelect={(event) => {
              imlec.kaydet(event);
              takip();
            }}
            onBlur={imlec.kaydet}
            spellCheck={false}
            className={cn(
              girdi,
              "min-h-64 resize-none font-mono text-small leading-[1.7] tracking-[0] field-sizing-content",
              "lg:min-h-0 lg:flex-1 lg:field-sizing-fixed",
            )}
          />

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span
              id={`${govdeId}-not`}
              className={cn("text-tiny", hata?.body_md ? "font-semibold text-down" : "text-muted")}
            >
              {hata?.body_md ?? (
                <>
                  Markdown; çipler <code className="font-mono">:::</code> bloğu ekler
                </>
              )}
            </span>
            <Sayac
              n={karakter}
              tavan={SINIR.bodyMax}
              taban={SINIR.bodyMin}
              birim="Karakter"
              ek={`${dakika} Dakikalık Okuma`}
            />
          </div>
        </section>

        {/* ================= Önizleme ================= */}
        <OnizlemePaneli
          id={onizlemeId}
          preview={onizleme.preview}
          durum={onizleme.durum}
          yenile={onizleme.yenile}
          lang={lang}
          bolgeRef={bolgeRef}
          dipnot="Yayındaki Çizimin Aynısı · Grafikler Yer Tutucu"
          className={cn(
            "lg:sticky lg:top-(--editor-ust) lg:row-span-2 lg:h-(--editor-bolum) lg:self-start",
            gorunum === "yaz" && "max-lg:hidden",
          )}
        />

        {/* ================= Künye ================= */}
        {/* KÜNYE KUTU DEĞİL, BÖLÜM (23 Eylül denetimi). Kenarlıklı, tonlu bir
            kutuydu: panelin içinde kutu, kutunun içinde kutular — üç kat.
            Derinlik tondan kuruluyor; bölüm bir saç teli ve bir başlık. */}
        <section
          aria-labelledby={kunyeBaslikId}
          className="flex min-w-0 flex-col gap-4 border-t border-line pt-5 lg:col-start-1"
        >
          <h3 id={kunyeBaslikId} className="text-small font-semibold text-strong">
            Künye
          </h3>
          <Alan
            label="Olay Tarihi"
            hata={hata?.event_date}
            hint="Olayın yaşandığı gün (ET); yazı arşivde bu güne düşer."
          >
            {(p) => (
              <input
                {...p}
                type="date"
                name="event_date"
                required
                value={alanlar.eventDate}
                onChange={(event) => ata("eventDate", event.target.value)}
                className={cn(girdi, "numeral sm:max-w-60")}
              />
            )}
          </Alan>
          {/* SEMBOLLER TAM SATIR (23 Eylül denetimi). Yarım satırda yedi
              sembolün sonuncusu (JPM) kutunun dışında kalıyordu. */}
          <Alan
            label="Semboller"
            hata={hata?.symbols}
            hint="Virgülle ayır: NVDA, MU"
          >
            {(p) => (
              <input
                {...p}
                name="symbols"
                value={alanlar.symbols}
                onChange={(event) => ata("symbols", event.target.value)}
                autoCapitalize="characters"
                className={cn(girdi, "numeral")}
              />
            )}
          </Alan>
          <Alan
            label="Kaynaklar"
            hata={hata?.sources}
            hint="Her satıra bir kaynak: Etiket | https://adres"
          >
            {(p) => (
              <textarea
                {...p}
                ref={kaynakRef}
                name="sources"
                value={alanlar.sources}
                onChange={(event) => ata("sources", event.target.value)}
                rows={3}
                spellCheck={false}
                className={cn(
                  girdi,
                  "min-h-24 resize-none font-mono text-small leading-relaxed field-sizing-content",
                )}
              />
            )}
          </Alan>
        </section>
      </div>

      <div className="mt-6">
        <SurumGecmisi
          revisions={revisions}
          geriYukle={geriYukle}
          geriYukleniyor={geriYukleniyor}
          not="Kaydetmek yayındaki metnin üzerine yazar; önceki hâli burada saklanır ve geri yüklenebilir."
        />
      </div>

      <EylemSeridi
        kaydediliyor={kaydediliyor}
        durum={kayitDurumu({ kayit, geri, kaydediliyor, geriYukleniyor, kirli })}
        canliAdres={canliAdres}
        gorunum={gorunum}
        gorunumDegistir={gorunumDegistir}
        yazId={govdeId}
        onizleId={onizlemeId}
      />
    </form>
  );
}
