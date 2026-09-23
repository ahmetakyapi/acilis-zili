"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  CaretDown,
  CaretLeft,
  ClockCounterClockwise,
  Eye,
  FloppyDisk,
} from "@phosphor-icons/react/dist/ssr";
import type { EditorState, StoryRevision } from "@/app/actions/content";
import { HealthMark, adminInput } from "@/components/admin/AdminUI";
import { Segment, SegmentItem, buttonClass } from "@/components/ui/primitives";
import { adminStamp } from "@/lib/admin-format";
import { TR_ZONE, formatInZone } from "@/lib/session-clock";
import { cn } from "@/lib/utils";

/**
 * Panelin iki editörünün (mercek yazısı ve bülten) ortak parçaları.
 *
 * NEDEN AYRI DOSYA: iki editör aynı iskeleti taşıyor — başlık, alan
 * sarmalayıcısı, önizleme paneli, sürüm geçmişi, yapışkan eylem şeridi.
 * İkisi ayrı yazılsaydı her düzeltme iki yerde yapılmak zorunda kalır ve
 * ikisi er geç birbirinden ayrı düşerdi; farkları GERÇEK olan yerler
 * (hangi alanlar var, metin hangi çiziciyle önizleniyor) editörlerin
 * kendisinde kalıyor.
 */

const sayi = (n: number) => n.toLocaleString("tr-TR");

/* --------------------------------------------------------------------------
   Girdi
   -------------------------------------------------------------------------- */

/**
 * Editör alanlarının görünümü — yönetimin ortak girdi malzemesi
 * (`adminInput`), editörün ölçüsüyle.
 *
 * KENARLIK 3:1 (23 Eylül denetimi). Kutular panelle aynı zemindeydi ve
 * saç teli kenarlık panele karşı 1,22:1 (koyu 1,37) ölçüldü. Editörde
 * kutunun sınırı bilginin kendisi — başlık ile giriş cümlesi alt alta iki
 * büyük metin ve nerede birinin bitip ötekinin başladığı yalnızca kenardan
 * okunuyor. 3:1 kenarlık bir dönem yalnızca burada, `adminInput`in üstüne
 * yazılıydı ve paneldeki öteki kutular (arama, tarih seçicileri) 1,4:1'de
 * kalıyordu; değer artık `adminInput`in kendisinde, ölçümüyle birlikte.
 */
export const girdi = cn(adminInput, "w-full py-2.5");

/**
 * Alan: etiket, kutu, altında ipucu ya da hata ve sağda sayaç.
 *
 * ETİKET YALNIZCA ADI SARIYOR. Kutu bir dönem `<label>`in içindeydi ve
 * erişilebilir adı "Başlık Sayfanın H1'i ve listedeki kart başlığı 71 / 160"
 * oluyordu: ipucu, sayaç ve hata adın parçasıydı. Ad artık yalnızca ad;
 * ipucu ve hata `aria-describedby` ile bağlı, hata varken kutu
 * `aria-invalid`.
 */
export function Alan({
  label,
  hint,
  hata,
  sayac,
  children,
}: {
  label: string;
  hint?: ReactNode;
  hata?: string;
  sayac?: ReactNode;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactNode;
}) {
  const id = useId();
  const notId = `${id}-not`;
  const not = hata ?? hint;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="w-fit text-small font-semibold text-strong">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": not ? notId : undefined,
        "aria-invalid": hata ? true : undefined,
      })}
      {(not || sayac) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          {/* Hata varsa ipucunun YERİNE geçiyor: ikisi alt alta durunca
              hangisinin okunacağı belirsizdi ve hata gri bir cümlenin
              altında kayboluyordu. */}
          <span
            id={notId}
            className={cn("text-tiny", hata ? "font-semibold text-down" : "text-muted")}
          >
            {not}
          </span>
          {sayac}
        </div>
      )}
    </div>
  );
}

/** Tavanın bu oranı aşılınca sayaç uyarıya geçer. */
const SAYAC_YAKIN = 0.9;

/**
 * Uzunluk sayacı — "71 / 160", "6.181 / 40.000 Karakter".
 *
 * SINIR EKRANDA (23 Eylül denetimi). Mercek gövdesi "6.181 Karakter"
 * yazıyordu, 200–40.000 aralığı hiçbir yerde görünmüyordu; giriş cümlesinin
 * (400) sayacı hiç yoktu. Sınır şemada ve aşan metin kaydedilmiyor — bunu
 * Kaydet'e basınca öğrenmek, yazılmış metni yeniden kısaltmak demekti.
 *
 * TAVAN YAKINSA UYARIYOR, ORANLA. Bülten sayacı "son 500 karakter"de
 * uyarıyordu; aynı eşik 160 karakterlik başlıkta hiç anlam taşımaz. Artık
 * tavanın %90'ı: bültende son 800, başlıkta son 16 karakter. Taban da
 * söyleniyor: 200'ün altındaki gövde kaydedilmiyor.
 */
export function Sayac({
  n,
  tavan,
  taban,
  birim,
  ek,
}: {
  n: number;
  tavan: number;
  taban?: number;
  birim?: string;
  /** Sayacın arkasına eklenen künye — "5 Dakikalık Okuma". */
  ek?: string;
}) {
  const asti = n > tavan;
  const eksik = taban !== undefined && n < taban;
  const yakin = !asti && n >= tavan * SAYAC_YAKIN;
  return (
    <span
      className={cn(
        "numeral ml-auto shrink-0 text-tiny",
        asti || eksik
          ? "font-semibold text-down"
          : yakin
            ? "font-semibold text-body"
            : "text-muted",
      )}
    >
      {sayi(n)} / {sayi(tavan)}
      {birim ? ` ${birim}` : ""}
      {eksik ? ` · En Az ${sayi(taban)}` : ""}
      {ek ? ` · ${ek}` : ""}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Kendiliğinden büyüyen kutu
   -------------------------------------------------------------------------- */

const buyumeDestekli = () =>
  typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

/**
 * `field-sizing: content`in yedeği. Chrome kutuyu içeriğine göre kendisi
 * büyütüyor; Safari ve Firefox o özelliği tanımıyor ve kutu `rows` boyunda
 * kalıp İÇİNDE kayıyordu — telefonda sayfa kaydırmasının içinde ikinci bir
 * kaydırma, tam da giderilmek istenen tuzak. Destek varsa hiçbir şey
 * yapmıyor.
 */
export function useKendiligindenBuyu(
  ref: RefObject<HTMLTextAreaElement | null>,
  deger: string,
  etkin = true,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || buyumeDestekli()) return;
    el.style.height = "";
    if (!etkin) return;
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [ref, deger, etkin]);
}

const GENIS = "(min-width: 1024px)";
function genisAbone(bildir: () => void) {
  const mq = window.matchMedia(GENIS);
  mq.addEventListener("change", bildir);
  return () => mq.removeEventListener("change", bildir);
}

/** `lg` ve üstü — önizleme ile gövde yan yana. */
export function useGenisEkran(): boolean {
  return useSyncExternalStore(
    genisAbone,
    () => window.matchMedia(GENIS).matches,
    () => false,
  );
}

/**
 * Tek satırlık metin, SARARAK büyüyen kutuda — başlık ve manşet.
 *
 * `<input>` DEĞİL (23 Eylül denetimi). Başlık 160 karakter olabiliyor ve
 * tek satırlık kutu kendi içeriğini kırpıyordu: 1440'ta "…Nasdaq Rek",
 * 390'da metnin %46'sı görünmüyordu. Sayfanın H1'i ve kart başlığı olan
 * alanın tamamı görünmeli. Satır sonu yazılamıyor (Enter yutuluyor,
 * yapıştırılan satır sonu boşluğa dönüyor): başlık tek satır bir veri.
 */
export function TekSatir({
  value,
  onValue,
  className,
  ...rest
}: Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "rows"> & {
  value: string;
  onValue: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useKendiligindenBuyu(ref, value);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      enterKeyHint="done"
      onChange={(event) => onValue(event.target.value.replace(/\s*\n+\s*/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      className={cn(girdi, "field-sizing-content resize-none", className)}
      {...rest}
    />
  );
}

/* --------------------------------------------------------------------------
   Başlık
   -------------------------------------------------------------------------- */

/**
 * Editörün kapağı — sitenin `PageHeader`ı, künyesi bir BAĞLANTI.
 *
 * İKİ SATIR VE TEKRAR VARDI (23 Eylül denetimi). Üstte ayrı bir "Yazılara
 * Dön" satırı, altında yazının başlığını tekrarlayan bir `h2` — ve hemen
 * altında aynı başlık bu kez kutunun içinde. 1440'ta gövde 782. pikselde
 * başlıyordu, 390'da ilk ekranın dışındaydı. Şimdi dönüş bağlantısı künye,
 * başlık KAYDIN ADI ("Mercek Yazısı · 22 Eyl 2026" — düzenlenirken
 * değişmeyen kimlik), sağda tek denetim: dil.
 *
 * ELDEN KURULUYOR, sınıflar `PageHeader`ın kendisi: künyenin bağlantı
 * olması gerekiyor ve `PageHeader.eyebrow` düz metin alıyor. Emsal: takvim
 * kapağı kendi künyesini aynı `.page-eyebrow` ile basıyor. Görünüş sınıflarda
 * (globals.css → `.page-masthead`), yani kapak siteyle birlikte değişir.
 */
export function EditorBasligi({
  geri,
  tur,
  baslik,
  aciklama,
  eylem,
}: {
  /** Listenin adresi — künyedeki dönüş bağlantısı. */
  geri: string;
  tur: string;
  baslik: string;
  aciklama: string;
  eylem?: ReactNode;
}) {
  return (
    <header
      data-embedded="false"
      className="page-heading page-masthead flex flex-wrap items-start justify-between gap-4"
    >
      <div className="page-heading-copy min-w-0" data-has-eyebrow="true">
        <p className="page-eyebrow">
          <Link
            href={geri}
            className="tap-44 inline-flex items-center gap-1 transition-colors hover:text-primary-hover"
          >
            <CaretLeft weight="bold" size={11} aria-hidden />
            Yazılar · {tur}
          </Link>
        </p>
        <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em] sm:text-display">
          {baslik}
        </h1>
        <p className="mt-[7px] max-w-3xl text-sm leading-relaxed text-body">
          {aciklama}
        </p>
      </div>
      {eylem}
    </header>
  );
}

/**
 * TR | EN — kaydın öteki diline geçiş.
 *
 * İKİ EDİTÖR, İKİ YER VARDI: mercekte başlığın sağında, bültende alttaki
 * eylem şeridinde Kaydet'in yanında (23 Eylül denetimi). Artık ikisinde de
 * kapağın tek denetimi. Olmayan dil GÖRÜNÜR ama sönük ("EN Yok"): bir dönem
 * bağlantı hiç çizilmiyordu ve çevirinin eksik olduğu ancak aranınca
 * anlaşılıyordu; var olmayan kayda giden bir bağlantı da 404'e götürürdü.
 */
export function DilAnahtari({
  dil,
  tr,
  en,
}: {
  dil: string;
  /** O dildeki kaydın editör adresi; kayıt yoksa `null`. */
  tr: string | null;
  en: string | null;
}) {
  const oge = (kod: "tr" | "en", adres: string | null, ad: string) =>
    adres ? (
      <SegmentItem key={kod} href={adres} active={dil === kod} current="page" label={ad}>
        {kod === "tr" ? "TR" : "EN"}
      </SegmentItem>
    ) : (
      /* Bağlantı `aria-disabled` ve odak sırasının dışında; sönme ve
         tıklanamazlık çağıranda (SegmentItem'ın sözleşmesi). */
      <span key={kod} className="pointer-events-none inline-flex opacity-55">
        <SegmentItem href="#" active={false} disabled label={`${ad} kaydı yok`}>
          {kod === "tr" ? "TR Yok" : "EN Yok"}
        </SegmentItem>
      </span>
    );
  return (
    <Segment label="Kaydın Dili">
      {oge("tr", tr, "Türkçe")}
      {oge("en", en, "İngilizce")}
    </Segment>
  );
}

/* --------------------------------------------------------------------------
   Önizleme
   -------------------------------------------------------------------------- */

/** Yazmayı bırakınca çizime kadar beklenen süre. */
const ONIZLEME_BEKLEME_MS = 700;

export type OnizlemeDurumu = "guncel" | "degisti" | "ciziliyor" | "hata";

/**
 * Önizleme durumu — çizim SUNUCUDA yapılıyor, bu kanca yalnızca ne zaman
 * istendiğini yönetiyor.
 *
 * KENDİLİĞİNDEN TAZELENİYOR ama her tuş vuruşunda değil: çizim sunucuya
 * gidiyor ve yazarken saniyede birkaç tur atmak hem gereksiz hem de yazının
 * ortasında sürekli kıpırdayan bir panel demek. 700 ms sessizlik bekleniyor —
 * yazar durduğunda önizleme yetişiyor, yazarken ekran sabit kalıyor.
 *
 * İLK ÇİZİM SUNUCUDAN, SAYFAYLA BİRLİKTE (23 Eylül denetimi). Önizleme
 * açılışta boştu ve ilk çizim bir POST ile geliyordu: bölge 256 pikselden
 * 804'e sıçrıyor, o arada durum düğmesi hiçbir şey çizilmemişken "Güncel"
 * yazıyordu. Sayfa artık aynı eylemi sunucuda çağırıp sonucu `ilk` diye
 * veriyor.
 *
 * SON ÇİZİM SAKLANIYOR, SİLİNMİYOR. "Yüklendiği Hâle Dön" önizlemeyi
 * sıfırlıyordu ve bölge 804'ten 256 piksele çöküp yeniden büyüyordu. Metin
 * sayfanın açıldığı metne dönünce sunucunun çizimi zaten elde; kaydetmeden
 * sonra da aynısı — yeni taslakla gelen çizim doğrudan gösteriliyor.
 *
 * HATA YUTULMUYOR. Eylem düşerse geçiş bir hata fırlatıyor ve React onu en
 * yakın hata sınırına taşıyor: editör, yazılmış ama kaydedilmemiş metinle
 * birlikte panelin hata ekranına düşerdi. Durum "Çizilemedi" oluyor ve
 * yenileme düğmesi çıkıyor.
 *
 * `ciz` SABİT OLMALI (server action referansı ya da `useCallback`): her
 * çizimde yeni bir işlev gelirse etki her render'da yeniden kurulur ve
 * zamanlayıcı hiç dolmaz.
 */
export function useOnizleme(
  body: string,
  ciz: (metin: string) => Promise<ReactNode>,
  ilk: { metin: string; cizim: ReactNode },
) {
  const [goster, setGoster] = useState(ilk);
  const [hata, setHata] = useState(false);
  const [ciziliyor, startCizim] = useTransition();
  const sonIstek = useRef(0);

  /* Metin sunucunun çizdiği metinse o çizim kazanır — ilk açılış, geri
     dönüş ve kaydetme sonrası. Koşullu, yani bir kez işleyip duruyor. */
  if (body === ilk.metin && goster !== ilk) setGoster(ilk);

  const cizdir = useCallback(
    (metin: string) => {
      const no = ++sonIstek.current;
      startCizim(async () => {
        try {
          const cizim = await ciz(metin);
          /* Daha yeni bir istek yola çıktıysa bu cevap eskidir. */
          if (no !== sonIstek.current) return;
          startCizim(() => {
            setGoster({ metin, cizim });
            setHata(false);
          });
        } catch {
          if (no === sonIstek.current) startCizim(() => setHata(true));
        }
      });
    },
    [ciz],
  );

  useEffect(() => {
    if (body === goster.metin) return;
    const zamanlayici = window.setTimeout(() => cizdir(body), ONIZLEME_BEKLEME_MS);
    return () => window.clearTimeout(zamanlayici);
  }, [body, goster.metin, cizdir]);

  const durum: OnizlemeDurumu = ciziliyor
    ? "ciziliyor"
    : hata
      ? "hata"
      : body === goster.metin
        ? "guncel"
        : "degisti";

  return {
    preview: goster.cizim,
    /** Ekrandaki çizimin metni — imleç takibi bunun DOM'unda arıyor. */
    cizilen: goster.metin,
    durum,
    yenile: () => cizdir(body),
  };
}

const DURUM_ADI: Record<OnizlemeDurumu, string> = {
  guncel: "Güncel",
  degisti: "Değişiklik Var",
  ciziliyor: "Çiziliyor…",
  hata: "Çizilemedi",
};

/** Önizlemedeki en üst başlığın anahatta indiği kademe — "Önizleme" h3'ünün bir altı. */
const ONIZLEME_BASLIK_KADEMESI = 4;

/**
 * Önizlemenin başlıklarını sayfanın ANAHATINDA bir kademe altına indirir.
 *
 * ÇİZİM KENDİ ANAHATINI TAŞIYORDU (23 Eylül denetimi). Önizleme yayındaki
 * sayfanın kendisi ve orada bölümler `h2`: editörde "Önizleme" `h3`ünün
 * ALTINDA dört `h2` duruyordu, başlıklarla gezen ekran okuyucu için yazının
 * ara başlıkları editörün "Türkçe Metin" bölümüyle aynı kademedeydi
 * (ölçüldü: H1 kayıt, H2 Türkçe Metin, H3 Gövde, H3 Önizleme, H2 ×4).
 * Çizimin etiketleri DEĞİŞMİYOR — görünüş etikete bağlı ve önizleme
 * yayındaki çizimin aynısı kalmalı; yalnızca `aria-level` yazılıyor. En üst
 * başlık 4'e iniyor, altındakiler aradaki farkı koruyor: mercekte h2 → 4,
 * h3 → 5; bültende h3 → 4.
 */
function basliklariIndir(kap: HTMLElement) {
  const basliklar = [...kap.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")];
  if (basliklar.length === 0) return;
  const kademe = (el: HTMLElement) => Number(el.tagName.slice(1));
  const enUst = Math.min(...basliklar.map(kademe));
  for (const el of basliklar) {
    const yeni = String(Math.min(6, kademe(el) - enUst + ONIZLEME_BASLIK_KADEMESI));
    if (el.getAttribute("aria-level") !== yeni) el.setAttribute("aria-level", yeni);
  }
}

/**
 * Önizleme paneli.
 *
 * ZEMİN SAYFANIN ZEMİNİ (23 Eylül denetimi). Bölge `bg-surface-solid`
 * idi: koyu temada rgb(40,45,53), yayındaki /mercek sayfası rgb(7,13,22) —
 * "Genel Özet" kutusu sayfada zeminden YÜKSEK, önizlemede ise zeminden
 * ALÇAK duruyordu, ton derinliği ters dönüyordu. Açık temada beyaz kutu
 * beyaz zeminde yalnızca kenarından okunuyordu. Önizleme yayındaki çizimin
 * kendisi (`content-preview.tsx`), zemini de sayfanınki. Köşe panel köşesi:
 * 14 piksellik bölgenin içindeki özet kutusu 16 pikseldi, iç köşe dıştakinden
 * yuvarlaktı.
 *
 * DURUM TEK SATIR, SABİT YÜKSEKLİKTE (23 Eylül denetimi). İlk tuş vuruşunda
 * kenarlıklı bir uyarı kutusu beliriyor, her çizimde kayboluyordu: bölge her
 * yazma duraklamasında 46 piksel inip çıkıyordu. "Bir uyarı için yeni kutu
 * açılmaz" (CLAUDE.md). Durum artık başlığın satırında bir sözcük
 * (`role="status"`), yenileme düğmesi yalnızca çizim eskiyken; satırın
 * yüksekliği düğme olsa da olmasa da aynı. "Güncel" bir dönem sönük, basılamaz
 * bir düğmeydi (%50 opaklık, 2,01:1): bir durum, düğme değil.
 *
 * GENİŞ EKRANDA YAPIŞKAN VE KENDİ İÇİNDE KAYIYOR; DAR EKRANDA SAYFANIN
 * PARÇASI. `lg` altında önizleme gövdeyle AYNI YUVAYI paylaşıyor ("Yaz |
 * Önizle"); orada iç kaydırma yok, çünkü telefonda kutunun içinde kayan bir
 * kutu parmağın altında sayfayı değil kutuyu kaydırıyordu (390'da gövde
 * 729, önizleme 535 piksellik iki tuzak, ölçüldü). Alt kenar, daha
 * aşağısı varken soluyor: renk perdesi — altındaki zemin biliniyor, sayfanın
 * zemini.
 */
export function OnizlemePaneli({
  id,
  preview,
  durum,
  yenile,
  lang,
  bolgeRef,
  dipnot,
  className,
}: {
  id: string;
  preview: ReactNode;
  durum: OnizlemeDurumu;
  yenile: () => void;
  lang: string;
  bolgeRef: RefObject<HTMLElement | null>;
  /** Kutunun altındaki künye — gövdenin ipucu satırıyla aynı hatta biter. */
  dipnot: string;
  className?: string;
}) {
  const baslikId = useId();
  const [dipteMi, setDipteMi] = useState(true);

  useEffect(() => {
    const el = bolgeRef.current;
    if (!el) return;
    const olc = () => setDipteMi(el.scrollHeight - el.clientHeight - el.scrollTop <= 1);
    olc();
    basliklariIndir(el);
    el.addEventListener("scroll", olc, { passive: true });
    const boy = new ResizeObserver(olc);
    boy.observe(el);
    /* Çizim değişince kutu aynı boyda kalıp içi uzuyor — ResizeObserver
       ateşlenmiyor (ScrollEdges'teki gerekçe). Yeni çizimin başlıkları da
       burada indiriliyor; gözlemci yalnızca düğüm ekleniş ve çıkışını
       dinliyor, yani eklenen öznitelik onu yeniden tetiklemiyor. */
    const icerik = new MutationObserver(() => {
      olc();
      basliklariIndir(el);
    });
    icerik.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", olc);
      boy.disconnect();
      icerik.disconnect();
    };
  }, [bolgeRef]);

  return (
    <section
      id={id}
      aria-labelledby={baslikId}
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-9">
        <h3 id={baslikId} className="text-small font-semibold text-strong">
          Önizleme
        </h3>
        <div className="flex items-center gap-2.5">
          <p
            data-preview-status
            role="status"
            className={cn(
              "text-small",
              durum === "hata" ? "font-semibold text-down" : durum === "degisti" ? "text-body" : "text-muted",
            )}
          >
            {DURUM_ADI[durum]}
          </p>
          {(durum === "degisti" || durum === "hata") && (
            /* Düğme bir GEREKLİLİK değil, bir kısayol: önizleme
               kendiliğinden tazeleniyor, bu yalnızca beklemeden görmek
               isteyene. */
            <button
              type="button"
              onClick={yenile}
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              <Eye weight="duotone" size={14} aria-hidden />
              Şimdi Yenile
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-64 overflow-hidden rounded-(--radius-panel) border border-line bg-page lg:min-h-0 lg:flex-1">
        {/* KAP KLAVYEYLE ODAKLANABİLİR: kaydırılabilir bir bölge klavyeyle
            gezen okuyucu için de kaydırılabilir olmalı (WCAG 2.1.1). Dili
            kaydın dili — İngilizce taslak `lang="tr"` altında Türkçe
            sesletiliyordu. */}
        <article
          ref={bolgeRef as RefObject<HTMLElement>}
          data-editor-preview
          tabIndex={0}
          lang={lang}
          aria-label="Önizleme"
          aria-busy={durum === "ciziliyor"}
          className="p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--line-focus) sm:p-5 lg:absolute lg:inset-0 lg:overflow-y-auto lg:overscroll-contain"
        >
          {preview}
        </article>
        <span
          aria-hidden
          data-acik={!dipteMi}
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-10 bg-linear-to-b from-transparent to-page opacity-0 transition-opacity data-[acik=true]:opacity-100 lg:block"
        />
      </div>
      <p className="text-tiny text-muted">{dipnot}</p>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Önizleme imleci izler
   -------------------------------------------------------------------------- */

const tirnak = (s: string) =>
  s
    .replace(/[   ]/g, " ")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");

/** Satırın biçim işaretlerinden arınmış hâli — çizimde görünen metin. */
function arin(satir: string): string {
  return satir
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    /* Vurgu işaretleri: yıldızın hepsi, alt çizginin yalnızca sözcük
       sınırındakisi (adreslerin içindeki alt çizgi metnin kendisi). Yazının
       künyesi tek yıldızla italik ("*Künye: …*") ve yıldız kalınca iğne
       çizimde hiç bulunmuyordu. */
    .replace(/\*+|`/g, "")
    .replace(/(^|\s)_+|_+(?=\s|$)/g, "$1");
}

/** İğne olacak kadar uzun parça: baştan en çok ~40 karakter, sözcük sınırında. */
function kirp(parca: string): string | null {
  const t = parca.replace(/\s+/g, " ").trim();
  if (t.length < 4) return null;
  if (t.length <= 40) return t;
  const kes = t.slice(0, 40);
  const bosluk = kes.lastIndexOf(" ");
  return bosluk > 20 ? kes.slice(0, bosluk) : kes;
}

/**
 * Bir satırın çizimde aranacak iğneleri — en güvenilirden başlayarak.
 * `**Etiket:** metin` satırı çizimde iki ayrı hücre (terim ve metin), yani
 * satırın tamamı hiçbir öğede bir arada geçmiyor; önce etiketten sonrası
 * deneniyor. `|` ile bölünmüş satırda en uzun parça.
 */
function igneler(satir: string): string[] {
  let s = satir.trim();
  if (!s) return [];
  if (s.startsWith(":::")) {
    /* Blok başı: adı at, başlığını ara. Kapanış `:::` boş kalır. */
    s = s.slice(3).trim().split(/\s+/).slice(1).join(" ");
    if (!s) return [];
  }
  const adaylar: string[] = [];
  const etiketli = s.match(/^\*\*[^*]+\*\*\s*(.+)$/);
  if (etiketli) adaylar.push(arin(etiketli[1]));
  const temiz = arin(s);
  const parcalar = temiz.split("|").map((p) => p.trim()).filter(Boolean);
  const enUzun = [...parcalar].sort((a, b) => b.length - a.length)[0];
  if (enUzun) adaylar.push(enUzun);
  if (parcalar[0] && parcalar[0] !== enUzun) adaylar.push(parcalar[0]);
  return adaylar.map(kirp).filter((x): x is string => x !== null);
}

/**
 * İmlecin çapası: imlecin olduğu satırdan (boşsa yukarı doğru) aranacak
 * iğneler ve iğnenin o satırdan önce kaç kez geçtiği.
 */
function imlecCapasi(metin: string, konum: number) {
  let bas = metin.lastIndexOf("\n", Math.max(0, konum - 1)) + 1;
  if (konum === 0) bas = 0;
  for (let deneme = 0; deneme < 12; deneme++) {
    const son = metin.indexOf("\n", bas);
    const satir = metin.slice(bas, son === -1 ? undefined : son);
    const adaylar = igneler(satir);
    if (adaylar.length > 0) {
      const once = tirnak(arin(metin.slice(0, bas)));
      return adaylar.map((igne) => {
        const aranan = tirnak(igne);
        let sira = 0;
        for (let i = once.indexOf(aranan); i !== -1; i = once.indexOf(aranan, i + 1)) sira++;
        return { igne: aranan, sira };
      });
    }
    if (bas === 0) break;
    bas = metin.lastIndexOf("\n", bas - 2) + 1;
  }
  return [];
}

/** Çizimde iğneyi taşıyan EN İÇTEKİ öğe — aynı metin birkaç kez geçiyorsa sırası. */
function capaBul(kap: HTMLElement, capalar: { igne: string; sira: number }[]) {
  const ogeler = [...kap.querySelectorAll<HTMLElement>("*")].filter(
    (el) => !(el instanceof SVGElement),
  );
  const metinler = new Map(ogeler.map((el) => [el, tirnak(el.textContent ?? "")]));
  for (const { igne, sira } of capalar) {
    const tutan = ogeler.filter((el) => metinler.get(el)?.includes(igne));
    const enIc = tutan.filter(
      (el) => !tutan.some((baska) => baska !== el && el.contains(baska)),
    );
    const hedef = enIc[Math.min(sira, enIc.length - 1)];
    if (hedef) {
      /* Blok kabı kutudan kısaysa onu göster: bir tablonun tek hücresine
         değil, tablonun kendisine inilsin. */
      const blok = hedef.closest<HTMLElement>("[data-block]");
      return blok && kap.contains(blok) && blok.offsetHeight < kap.clientHeight
        ? blok
        : hedef;
    }
  }
  return null;
}

/** Kabın içinde, gerekiyorsa, en az kaydırmayla göster — sayfa kıpırdamaz. */
function yakinaKaydir(kap: HTMLElement, hedef: HTMLElement) {
  const PAY = 24;
  const k = kap.getBoundingClientRect();
  const h = hedef.getBoundingClientRect();
  let fark = 0;
  if (h.top < k.top + PAY) fark = h.top - k.top - PAY;
  else if (h.bottom > k.bottom - PAY)
    fark = Math.min(h.bottom - k.bottom + PAY, h.top - k.top - PAY);
  if (Math.abs(fark) < 2) return;
  const sakin = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  kap.scrollBy({ top: fark, behavior: sakin ? "auto" : "smooth" });
}

/** İmleç takibinin nefesi — her tuşta değil, imleç durunca. */
const TAKIP_MS = 120;

/**
 * Önizleme İMLECİ İZLİYOR (23 Eylül denetimi). 6.232 piksellik çizim 804
 * piksellik kutuda duruyordu ve yazının sonundaki künye paragrafını yazan
 * yazar önizlemede hâlâ en baştaki "Genel Özet"i görüyordu.
 *
 * EŞLEME METİNLE, BLOK SAYARAK DEĞİL. İmlecin blok sırasını bulmak için
 * `ArticleBody`nin ayrıştırıcısını panele indirmek (yorumu ~30KB diyor) ya
 * da onun ikinci bir kopyasını yazmak gerekirdi — iki yorum er geç ayrı
 * düşer. Onun yerine imlecin satırındaki metin çizimde aranıyor; biçim
 * işaretleri atılıyor, aynı metin kaç kez geçtiyse o sıradaki öğe seçiliyor.
 * Bülten çiziciyle de aynen çalışıyor.
 *
 * Yalnızca önizleme KENDİ İÇİNDE kayarken (geniş ekran): dar ekranda
 * önizleme ayrı bir görünüm ve kendi kaydırması yok.
 */
export function useOnizlemeTakibi(
  govde: RefObject<HTMLTextAreaElement | null>,
  bolge: RefObject<HTMLElement | null>,
) {
  const zaman = useRef(0);
  useEffect(() => () => window.clearTimeout(zaman.current), []);
  return useCallback(() => {
    window.clearTimeout(zaman.current);
    zaman.current = window.setTimeout(() => {
      const el = govde.current;
      const kap = bolge.current;
      if (!el || !kap) return;
      if (kap.scrollHeight <= kap.clientHeight + 1) return;
      const hedef = capaBul(kap, imlecCapasi(el.value, el.selectionStart));
      if (hedef) yakinaKaydir(kap, hedef);
    }, TAKIP_MS);
  }, [govde, bolge]);
}

/**
 * Dar ekranda "Önizle"ye geçerken imlecin bloğunu bulur — pencere o bloğa
 * kayıyor, yazar yazdığı yeri görüyor.
 */
export function imlecinBlogu(
  govde: HTMLTextAreaElement | null,
  bolge: HTMLElement | null,
): HTMLElement | null {
  if (!govde || !bolge) return null;
  return capaBul(bolge, imlecCapasi(govde.value, govde.selectionStart));
}

/* --------------------------------------------------------------------------
   Blok ekleme
   -------------------------------------------------------------------------- */

/**
 * Gövde kutusunda imlecin SON bilinen yeri — kutu hiç odaklanmadıysa `null`.
 * Odak bir çipe geçince seçim kutuda kalıyor ama "hiç odaklanmadı" ile
 * "başa tıkladı" arasındaki farkı yalnızca bu tutuyor: odaklanmamış bir
 * kutunun `selectionStart`ı 0 ve çip bloğu yazının EN BAŞINA yazıyordu.
 */
export function useImlec() {
  const konum = useRef<number | null>(null);
  const kaydet = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      konum.current = event.currentTarget.selectionStart;
    },
    [],
  );
  return { konum, kaydet };
}

/**
 * Örnek bloğu imlecin yerine YERLİ yazma komutuyla yazar.
 *
 * DENETİMLİ DEĞERİ BAŞTAN YAZMAK KAYDIRMAYI SIFIRLIYORDU (23 Eylül
 * denetimi). Ölçüldü: imleç 794'te, kutu 300'de kaymışken bir çip kutuyu
 * 2.773'e (en dibe) atıyordu — Chrome değerin tamamı değişince imleci ve
 * kaydırmayı sona taşıyor. Geri al (Cmd+Z) da çalışmıyordu. `insertText`
 * komutu yazarın kendi yazması gibi: kaydırma yerinde, geri alma yığınında,
 * `input` olayı React'in `onChange`ini tetikliyor. Komut yoksa
 * `setRangeText` + elle `input` olayı.
 *
 * Kutu hiç odaklanmadıysa blok SONA yazılıyor ve yazma komutu imleci
 * gösterdiği için eklenen blok görünür kalıyor.
 *
 * İKİ KİP. Mercek bloğu (`blok`) kendi paragrafı — önünde ve arkasında boş
 * satır. Bülten kalıbı (`satir`) bir SATIR: bültenin biçimlendiricisi satır
 * satır okuyor ve bir maddenin önüne boş satır koymak listeyi ikiye bölerdi.
 */
export function blokYaz(
  el: HTMLTextAreaElement,
  ornek: string,
  konum: number | null,
  kip: "blok" | "satir" = "blok",
) {
  const deger = el.value;
  const nokta = Math.min(konum ?? deger.length, deger.length);
  const once = deger.slice(0, nokta);
  const sonra = deger.slice(nokta);
  const bas =
    kip === "satir"
      ? nokta === 0 || once.endsWith("\n")
        ? ""
        : "\n"
      : nokta === 0 || once.endsWith("\n\n")
        ? ""
        : once.endsWith("\n")
          ? "\n"
          : "\n\n";
  const son =
    kip === "satir"
      ? sonra.startsWith("\n")
        ? ""
        : "\n"
      : sonra.length === 0
        ? "\n"
        : sonra.startsWith("\n\n")
          ? ""
          : sonra.startsWith("\n")
            ? "\n"
            : "\n\n";
  const metin = bas + ornek + son;

  el.focus({ preventScroll: true });
  el.setSelectionRange(nokta, nokta);
  const yerli = document.execCommand("insertText", false, metin);
  if (!yerli) {
    const ust = el.scrollTop;
    el.setRangeText(metin, nokta, nokta, "end");
    el.scrollTop = ust;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  imleciGoster(el);
}

/** Yazı kutusunun dizilimini belirleyen biçemler — ayna bunları kopyalıyor. */
const AYNA_BICEMLERI = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "textIndent",
] as const;

/** Yapışkan sekme bandının dibi (44 + 1) ve nefes — `EDITOR_OLCULERI` ile aynı sayı. */
const BANT_ALTI = 61;
/** İmleç kenara yapışmasın: görünür alanın içinde bırakılan pay. */
const IMLEC_PAYI = 24;

/**
 * İmlecin satırını görünür kılar — kutunun içinde de, pencerede de.
 *
 * YAZMA KOMUTU GÖSTERMİYORDU (ölçüldü). Kutu hiç odaklanmamışken sona
 * eklenen blok kutunun dibinde, görünmeyen yerde kalıyordu: 1440'ta kutu
 * 0'da duruyor (kaydırma boyu 3.079), 390'da kendiliğinden büyüyen kutunun
 * dibi pencerenin 7.800 piksel altında. İmlecin yüksekliği bir AYNADA
 * ölçülüyor — kutuyla aynı genişlik, punto ve kaydırmayla dizilmiş gizli
 * bir kutu; imleçten önceki metin ve bir işaret.
 */
function imleciGoster(el: HTMLTextAreaElement) {
  const bicem = window.getComputedStyle(el);
  const ayna = document.createElement("div");
  for (const ad of AYNA_BICEMLERI) ayna.style[ad] = bicem[ad];
  ayna.style.position = "absolute";
  ayna.style.visibility = "hidden";
  ayna.style.top = "0";
  ayna.style.left = "-9999px";
  ayna.style.whiteSpace = "pre-wrap";
  ayna.style.overflowWrap = "break-word";
  ayna.textContent = el.value.slice(0, el.selectionEnd);
  const isaret = document.createElement("span");
  isaret.textContent = "​";
  ayna.appendChild(isaret);
  document.body.appendChild(ayna);
  const satirUstu = isaret.offsetTop;
  const satirBoyu = isaret.offsetHeight;
  ayna.remove();

  /* Kutu kendi içinde kayıyorsa (geniş ekran) önce orada. */
  if (el.scrollHeight > el.clientHeight + 1) {
    const ust = el.scrollTop;
    if (satirUstu < ust + IMLEC_PAYI || satirUstu + satirBoyu > ust + el.clientHeight - IMLEC_PAYI) {
      el.scrollTop = Math.max(0, satirUstu - el.clientHeight / 3);
    }
  }

  /* Sonra pencerede: bandın altı ile eylem şeridinin üstü arası. */
  const kutu = el.getBoundingClientRect();
  const y = kutu.top + satirUstu - el.scrollTop;
  const serit = el.form?.querySelector<HTMLElement>("[data-eylem-seridi]");
  const alt = window.innerHeight - (serit?.offsetHeight ?? 0) - IMLEC_PAYI;
  const ust = BANT_ALTI + IMLEC_PAYI;
  if (y < ust || y + satirBoyu > alt) {
    window.scrollBy({ top: y - (ust + (alt - ust) / 3) });
  }
}

/* --------------------------------------------------------------------------
   Çıkış koruması
   -------------------------------------------------------------------------- */

const CIKIS_SORUSU =
  "Kaydedilmemiş değişiklikler var. Sayfadan çıkarsan kaybolacaklar; yine de çıkılsın mı?";

/**
 * Kaydedilmemiş metni koruyan iki kapı ve ölü önizleme.
 *
 * HİÇBİR ÇIKIŞ SORMUYORDU (23 Eylül denetimi). Sekmeler, dönüş bağlantısı,
 * dil geçişi ve önizlemenin içindeki dokuz bağlantı (/hisse/SCHW …)
 * düzenlenmiş metni sessizce bırakıp gidiyordu. Sayfa içi çıkışta
 * `window.confirm` — emsal `WatchlistBoard`un silme sorusu; sekme kapatma ve
 * yenilemede tarayıcının kendi sorusu (`beforeunload`).
 *
 * DİNLEYİCİ PENCEREDE, YAKALAMA EVRESİNDE. `RouteProgress` tıklamayı
 * BELGEDE yakalıyor ve `defaultPrevented`e bakıyor; React'in kendi
 * `onClickCapture`ı ondan SONRA koşuyor, yani iptal edilen bir gezinmede
 * ilerleme çubuğu yanıp on saniye dönerdi. Pencere belgeden önce geliyor.
 *
 * ÖNİZLEMEDEKİ BAĞLANTILAR ÖLÜ: önizleme bir çizim, gezinme yüzeyi değil.
 * Kirli olsun olmasın tıklama orada bitiyor.
 *
 * GERİ TUŞU ÜÇÜNCÜ KAPI — Navigation API ile. Listeden editöre yumuşak
 * gezinmeyle gelindiği için geri tuşu aynı belgede bir geçiş: ne tıklama
 * ne `beforeunload` onu görüyor ve düzenlenmiş metin sessizce gidiyordu.
 * App Router'ın bir engelleme kancası yok; `popstate`e yetişip adresi
 * `pushState` ile geri koymak Next'in kendi geçmiş kaydıyla yarışıyor
 * (onun dinleyicisi de koşuyor, ağacı geri yüklüyor) ve kullanıcı
 * etkinliği olmadan eklenen kaydı Chrome geri tuşunda zaten atlıyor. Yerine
 * `navigation`ın `navigate` olayı: geçiş BAŞLAMADAN soruluyor, iptal
 * edilince ne adres ne Next'in ağacı değişiyor (önizlemede ölçüldü, Chrome
 * 153: `traverse`, `cancelable: true`, adres editörde kaldı, metin kirli).
 * İki sınırı bilerek kabul ediliyor: (1) tarayıcı bir iptalden sonra
 * yeniden etkileşim bekliyor — ardı ardına ikinci geri basış iptal
 * edilemez; (2) Navigation API'si olmayan tarayıcıda geri tuşu korumasız
 * kalıyor, öteki iki kapı yerinde. Belgeler arası geri gidişte
 * (`cancelable: false`) soru `beforeunload`un.
 */
export function useCikisKorumasi(kirli: boolean) {
  useEffect(() => {
    const tikla = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.closest("[data-editor-preview]")) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!kirli) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const hedef = anchor.getAttribute("target");
      if (hedef && hedef !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (window.confirm(CIKIS_SORUSU)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const ayrilma = (event: BeforeUnloadEvent) => {
      if (!kirli) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const gecis = (event: Event) => {
      if (!kirli || !event.cancelable) return;
      if ((event as GecisOlayi).navigationType !== "traverse") return;
      if (window.confirm(CIKIS_SORUSU)) return;
      event.preventDefault();
    };
    const gezinme = (window as Window & { navigation?: EventTarget }).navigation;
    window.addEventListener("click", tikla, { capture: true });
    window.addEventListener("beforeunload", ayrilma);
    gezinme?.addEventListener("navigate", gecis);
    return () => {
      window.removeEventListener("click", tikla, { capture: true });
      window.removeEventListener("beforeunload", ayrilma);
      gezinme?.removeEventListener("navigate", gecis);
    };
  }, [kirli]);
}

/**
 * Navigation API'nin `navigate` olayından kullanılan tek alan — TypeScript'in
 * DOM kitaplığında (5.9) `NavigateEvent` henüz yok. Bağlantı ve form
 * gezinmeleri (`push`, `replace`) tıklama kapısından geçiyor; burada
 * yalnızca geri/ileri (`traverse`) soruluyor.
 */
type GecisOlayi = Event & { navigationType?: "push" | "replace" | "reload" | "traverse" };

/**
 * Geri yüklemeden sonra sayfayı tazeler.
 *
 * GERİ YÜKLEME FORMU TAZELEMİYORDU. Sunucu eylemi kaydı eski hâline
 * çeviriyor ama editör hâlâ ekrandaki ESKİ taslağı tutuyordu; yenilemeden
 * Kaydet'e basan biri geri yüklemeyi sessizce geri alıyordu — iki tıkla veri
 * kaybı. Eylem artık editörün kendi yolunu da tazeliyor ve cevap yeni ağacı
 * taşıyor (app/actions/content.ts → `mercegiTazele`); bu kanca onun
 * emniyeti: bedeli nadir bir işte bir tur, kaçırmanın bedeli veri. Yeni
 * taslağı editör karşılıyor — sayfa `key`i bir dönem bu işi yapıyordu ve
 * "Geri yüklendi"yi de siliyordu (gerekçe StoryEditor'da).
 */
export function useGeriYuklemeTazele(geri: EditorState) {
  const router = useRouter();
  useEffect(() => {
    if (geri.ok && geri.savedAt) router.refresh();
  }, [geri.ok, geri.savedAt, router]);
}

/* --------------------------------------------------------------------------
   Sürüm geçmişi
   -------------------------------------------------------------------------- */

/**
 * Sürüm geçmişi.
 *
 * SATIR SÜRÜMÜN KENDİ ANIYLA TARİHLENİYOR (23 Eylül denetimi). Satır
 * `replacedAt` ile ve "Panelden Yazıldı / Rutin Yazdı" diye basılıyordu —
 * ikisi de ÜZERİNE YAZMANIN bilgisi (şema: "bu fotoğrafın üzerine kimin
 * yazdığı"). Rutinin yazıp panelin düzelttiği bir sürüm "Panelden Yazıldı"
 * ve düzeltmenin saatiyle görünüyordu. Şimdi: "22 Eyl 16:18 Sürümü" ve olay
 * ayrıca, "Panelde Değiştirildi Bugün 11:42".
 *
 * GEÇMİŞ YOKSA DÜĞME YOK. Sıfır sürümle de açılıp boş bir cümleye çıkan bir
 * düğme vardı; erişilebilir adı "Sürüm Geçmişi0" okunuyordu. Boşken düz bir
 * başlık ve "Henüz Yok".
 *
 * GERİ YÜKLEME FORM GÖNDERMİYOR. Satırların düğmesi bir dönem formun
 * ikinci `submit`iydi; artık düz bir düğme ve eylemi editör çağırıyor —
 * örtük gönderim (bir alanda Enter) formun İLK `submit` düğmesine gidiyor ve
 * o düğme bir geri yükleme olmamalı.
 */
export function SurumGecmisi({
  revisions,
  geriYukle,
  geriYukleniyor,
  not,
}: {
  revisions: StoryRevision[];
  geriYukle: (id: string) => void;
  geriYukleniyor: boolean;
  /** Kaydetmenin geçmişe ne yaptığını anlatan cümle. */
  not: string;
}) {
  const [acik, setAcik] = useState(false);
  const listeId = useId();
  const n = revisions.length;

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-5">
      {n === 0 ? (
        <h3 className="flex min-h-9 items-center gap-2 text-small font-semibold text-strong">
          <ClockCounterClockwise weight="duotone" size={16} aria-hidden className="text-muted" />
          <span>
            Sürüm Geçmişi <span className="font-normal text-muted">· Henüz Yok</span>
          </span>
        </h3>
      ) : (
        <h3>
          <button
            type="button"
            onClick={() => setAcik((a) => !a)}
            aria-expanded={acik}
            aria-controls={listeId}
            className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-strong transition-colors hover:text-primary sm:min-h-9"
          >
            <ClockCounterClockwise weight="duotone" size={16} aria-hidden />
            Sürüm Geçmişi
            <span
              aria-hidden
              className="numeral rounded-full bg-surface-elevated px-2 py-0.5 text-tiny font-bold text-muted"
            >
              {n}
            </span>
            <span className="sr-only">({n} sürüm)</span>
            <CaretDown
              size={12}
              weight="bold"
              aria-hidden
              className={cn("transition-transform", acik && "rotate-180")}
            />
          </button>
        </h3>
      )}
      <p className="max-w-3xl text-small leading-relaxed text-muted">{not}</p>

      {n > 0 && (
        <ul id={listeId} hidden={!acik} className="mt-1 flex flex-col divide-y divide-line-soft">
          {/* Satırlar yalnızca açıkken çiziliyor: damgalar "Bugün/Dün"
              göreli ve okuyucunun saatiyle hesaplanıyor. */}
          {acik &&
            revisions.map((rev) => (
              <li
                key={rev.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-base text-strong">{rev.title}</span>
                  <span className="numeral block text-tiny text-muted">
                    {rev.versionAt
                      ? `${adminStamp(new Date(rev.versionAt))} Sürümü`
                      : "Tarihsiz Sürüm"}{" "}
                    · {sayi(rev.length)} Karakter ·{" "}
                    {rev.replacedBy === "admin"
                      ? "Panelde Değiştirildi"
                      : "Rutin Yeniden Yazdı"}{" "}
                    {adminStamp(new Date(rev.replacedAt))}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => geriYukle(rev.id)}
                  disabled={geriYukleniyor}
                  className={buttonClass({ variant: "ghost", size: "sm", className: "shrink-0" })}
                >
                  <ArrowCounterClockwise weight="bold" size={13} aria-hidden />
                  Bu Hâle Dön
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Eylem şeridi
   -------------------------------------------------------------------------- */

export type Gorunum = "yaz" | "onizle";

/**
 * Kaydetmenin durumu — iki eylemden (kaydet, geri yükle) en son biteni
 * konuşuyor.
 */
export function kayitDurumu({
  kayit,
  geri,
  kaydediliyor,
  geriYukleniyor,
  kirli,
}: {
  kayit: EditorState;
  geri: EditorState;
  kaydediliyor: boolean;
  geriYukleniyor: boolean;
  kirli: boolean;
}): { metin: string; ton: "down" | "warn" | "ok" | "idle" } {
  if (kaydediliyor) return { metin: "Kaydediliyor…", ton: "idle" };
  if (geriYukleniyor) return { metin: "Geri Yükleniyor…", ton: "idle" };
  const son = (kayit.at ?? "") >= (geri.at ?? "") ? kayit : geri;
  if (son.error) return { metin: son.error, ton: "down" };
  if (kirli) return { metin: "Kaydedilmemiş Değişiklik", ton: "warn" };
  if (son.ok && son.savedAt) {
    const saat = formatInZone(new Date(son.savedAt), TR_ZONE);
    return { metin: `${son === geri ? "Geri Yüklendi" : "Kaydedildi"} · ${saat}`, ton: "ok" };
  }
  /* Boş yuva yok: telefonda durum kendi satırında ve boş bir satır, şeridin
     üstünde nedeni görünmeyen bir boşluktu. Söylenecek bir şey yoksa
     söylenen şu: kaydedilecek bir şey yok. */
  return { metin: "Değişiklik Yok", ton: "idle" };
}

/**
 * Yazma ile önizleme arasında geçiş — dar ekranda ikisi AYNI YUVADA.
 * Görünüş sitenin `Segment`inin (ray + hap); öğeler bağlantı değil düğme,
 * çünkü bir gezinme değil bir görünüm seçimi (`role="tab"`).
 */
function YazOnizle({
  deger,
  degistir,
  yazId,
  onizleId,
}: {
  deger: Gorunum;
  degistir: (deger: Gorunum) => void;
  yazId: string;
  onizleId: string;
}) {
  const secenekler: { k: Gorunum; ad: string; hedef: string }[] = [
    { k: "yaz", ad: "Yaz", hedef: yazId },
    { k: "onizle", ad: "Önizle", hedef: onizleId },
  ];
  return (
    <div
      role="tablist"
      aria-label="Gövde Görünümü"
      className="inline-flex shrink-0 gap-0.5 rounded-full bg-surface-elevated p-[3px] text-small"
    >
      {secenekler.map(({ k, ad, hedef }) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={deger === k}
          aria-controls={hedef}
          tabIndex={deger === k ? 0 : -1}
          onClick={() => degistir(k)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const oteki = k === "yaz" ? "onizle" : "yaz";
            degistir(oteki);
            (event.currentTarget.parentElement?.querySelector(
              `[aria-controls="${oteki === "yaz" ? yazId : onizleId}"]`,
            ) as HTMLButtonElement | null)?.focus();
          }}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-[7px] transition-colors sm:min-h-8",
            deger === k ? "bg-primary font-semibold text-on-primary" : "text-body hover:text-strong",
          )}
        >
          {ad}
        </button>
      ))}
    </div>
  );
}

/**
 * Yapışkan eylem şeridi — Kaydet, durum, yayındaki hâl.
 *
 * KAYDET İLK EKRANDA DEĞİLDİ (23 Eylül denetimi): 1440×900'de 1.773,
 * 390'da 2.576 pikseldeydi ve kaydetmenin sonucu formun TEPESİNDE bir
 * şeritte yazıyordu — düğmeyle aynı ekranda hiç görünmüyordu. Şerit artık
 * panelin dibine yapışık ve her kaydırmada görünür; sonuç düğmenin
 * yanında, tek bir durum yuvasında (`role="status"`): "Kaydedilmemiş
 * Değişiklik", "Kaydedildi · 11:42" ya da hatanın cümlesi.
 *
 * ZEMİN PANELİN KENDİ YÜZEYİ, OPAK. Altından geçen metin görünmesin;
 * `bg-page` olsaydı panelin ortasında bir delik gibi okunurdu. Şerit
 * panelin iç dolgusunu aşıp kenardan kenara uzanıyor, çizgisi saç teli.
 *
 * TELEFONDA "YAZ | ÖNİZLE" BURADA: gövdenin başında dursaydı yedi bin
 * piksellik bir metnin ortasından önizlemeye bakmak için başa dönmek
 * gerekirdi. Durum telefonda kendi satırında, düğmeler altında.
 */
export function EylemSeridi({
  kaydediliyor,
  durum,
  canliAdres,
  gorunum,
  gorunumDegistir,
  yazId,
  onizleId,
}: {
  kaydediliyor: boolean;
  durum: ReturnType<typeof kayitDurumu>;
  canliAdres: string;
  gorunum: Gorunum;
  gorunumDegistir: (deger: Gorunum) => void;
  yazId: string;
  onizleId: string;
}) {
  return (
    <div data-eylem-seridi className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-6 rounded-b-[calc(var(--radius-panel)-1px)] border-t border-line bg-(--premium-surface) px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:-mx-6 sm:-mb-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p
          role="status"
          className={cn(
            "order-first flex min-h-[1lh] basis-full items-start gap-2 text-small sm:order-none sm:min-w-0 sm:flex-1 sm:basis-0",
            durum.ton === "down"
              ? "font-semibold text-down"
              : durum.ton === "idle"
                ? "text-muted"
                : "text-body",
          )}
        >
          {durum.ton !== "down" && (
            <HealthMark tone={durum.ton === "warn" ? "warn" : durum.ton === "ok" ? "ok" : "idle"} />
          )}
          {durum.metin}
        </p>
        <button
          type="submit"
          disabled={kaydediliyor}
          className={buttonClass({ className: "sm:order-first" })}
        >
          <FloppyDisk weight="duotone" size={17} aria-hidden />
          {kaydediliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <a
          href={canliAdres}
          target="_blank"
          rel="noopener"
          className={buttonClass({ variant: "ghost", className: "max-sm:w-11 max-sm:px-0" })}
        >
          <ArrowSquareOut weight="duotone" size={16} aria-hidden />
          <span className="max-sm:sr-only">Yayındaki Hâli</span>
        </a>
        <span className="ml-auto lg:hidden">
          <YazOnizle
            deger={gorunum}
            degistir={gorunumDegistir}
            yazId={yazId}
            onizleId={onizleId}
          />
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Yerleşim ölçüleri
   -------------------------------------------------------------------------- */

/**
 * Bölünmüş görünümün ölçüleri — geniş ekranda gövde ve önizleme AYNI
 * BOYDA, bandın altından şeridin üstüne kadar.
 *
 * Yapışkan sekme bandı 44 piksel ve alt çizgisi 1; nefes 16 (globals.css
 * `data-admin-shell` kaydırma payı aynı bandı sayıyor). Şerit tek satırda:
 * üst dolgu 12 + düğme 40 + çizgi 1 + alt dolgu (güvenli alan ya da 12).
 * Taban 34rem: kısa pencerede kutular çökmesin, sayfa kaysın.
 */
export const EDITOR_OLCULERI = {
  "--editor-ust": "calc(env(safe-area-inset-top) + 61px)",
  "--editor-alt": "calc(max(env(safe-area-inset-bottom), 12px) + 53px)",
  "--editor-bolum":
    "max(34rem, calc(100dvh - var(--editor-ust) - var(--editor-alt) - 16px))",
} as React.CSSProperties;
