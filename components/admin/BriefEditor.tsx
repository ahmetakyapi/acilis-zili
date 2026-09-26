"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import {
  restoreBriefRevision,
  saveBriefFromAdmin,
  type EditorState,
  type StoryRevision,
} from "@/app/actions/content";
import { previewBriefBody } from "@/app/actions/content-preview";
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
  useGeriYuklemeTazele,
  useImlec,
  useKendiligindenBuyu,
  useOnizleme,
  useOnizlemeTakibi,
  type Gorunum,
} from "@/components/admin/editor-parts";
import { cn } from "@/lib/utils";

/**
 * Bülten editörü.
 *
 * MERCEKTEN AYRI BİR EDİTÖR, çünkü yazdığı şey ayrı: bülten `BriefBody`nin
 * mini biçimlendiricisiyle çiziliyor — tam markdown değil, `## Başlık`,
 * `- Madde` ve `**kalın**`tan ibaret bir alt küme, üstelik maddeleri
 * 01/02/03 diye numaralıyor. Mercek editörünün `:::` blok çubuğunu buraya
 * koymak, sitede hiç çizilmeyecek bir sözdizimi öneriyor olurdu.
 *
 * KİMLİK ÜÇ ALANDA VE DÜZENLENMİYOR: tarih, dil, dönem. Üçü birlikte kaydın
 * benzersiz anahtarı; serbest bırakmak bir düzeltmenin yanlışlıkla BAŞKA bir
 * günün bültenini ezmesinin en kolay yolu olurdu. Yeni bülten yazmak da
 * rutinin işi — panel var olanı düzeltiyor.
 *
 * Ortak iskelet (başlık, önizleme paneli, sürüm geçmişi, eylem şeridi)
 * `editor-parts.tsx`te; alanların denetimli olması ve editörün kayıttan
 * sonra yerinde kalmasının gerekçesi mercek editöründe yazılı.
 *
 * TABAN DAMGA DEĞİL, İÇERİK. Mercekte kaydın damgası her yazmada ilerliyor;
 * bültende `generatedAt` panel düzeltmesinde artık ilerlemiyor
 * (lib/content-write.ts → `saveBrief`). Damgaya bakan bir karşılaştırma
 * geri yüklemeden sonra eski metinde kalır ve Kaydet geri yüklemeyi silerdi;
 * karşılaştırma bu yüzden manşet ve gövdenin kendisine bakıyor.
 */

export type BriefDraft = {
  date: string;
  locale: string;
  period: "daily" | "weekly";
  headline: string;
  bodyMd: string;
  generatedBy: string;
  generatedAt: string;
};

const BOS: EditorState = {};

/** Şemadaki sınırlar (lib/content-write.ts → `briefInputSchema`). */
const SINIR = { headline: 200, body: 8000 } as const;

/**
 * Bültenin YAZIM KISAYOLLARI — `BriefBody`nin tanıdığı üç kalıp.
 *
 * Dördüncüsü yok ve olmamalı: biçimlendirici bu üçünü tanıyor, gerisini düz
 * paragraf sayıyor. Buraya tanınmayan bir kalıp koymak, editörde çalışıyor
 * görünüp sitede düz metne dönen bir kısayol demekti. Örnek kaydın dilinde;
 * yanında sözdizimi, mercek çipleriyle aynı dil.
 */
const KALIPLAR = [
  { ad: "Bölüm Başlığı", sozdizimi: "##", tr: "## Başlık", en: "## Heading" },
  { ad: "Madde", sozdizimi: "-", tr: "- Madde metni", en: "- Item text" },
  {
    ad: "Kalın Giriş",
    sozdizimi: "**…:**",
    tr: "**Kalın giriş:** devamı",
    en: "**Bold lead:** continued",
  },
] as const;

export function BriefEditor({
  draft,
  revisions,
  ilkOnizleme,
  canliAdres,
}: {
  draft: BriefDraft;
  revisions: StoryRevision[];
  /** Sayfanın sunucuda çizdiği ilk önizleme — gövdenin kayıttaki hâli. */
  ilkOnizleme: ReactNode;
  /** Yayındaki bülten sayfası, kaydın dilinde (`/en/bulten/2026-09-24`). */
  canliAdres: string;
}) {
  const [kayit, kaydet, kaydediliyor] = useActionState(saveBriefFromAdmin, BOS);
  const [geri, geriYukleEylemi, geriYukleniyor] = useActionState(
    restoreBriefRevision,
    BOS,
  );

  const [headline, setHeadline] = useState(draft.headline);
  const [body, setBody] = useState(draft.bodyMd);

  /* Sunucudan yeni taslak geldiyse (kaydetme, geri yükleme) alanlar onunla
     yenilenir — gerekçe dosya başında. */
  const imza = JSON.stringify([draft.generatedAt, draft.headline, draft.bodyMd]);
  const [taban, setTaban] = useState(imza);
  if (imza !== taban) {
    setTaban(imza);
    setHeadline(draft.headline);
    setBody(draft.bodyMd);
  }

  /* Kirlilik kaydedilince yazılacak hâlle ölçülüyor: şema iki metni de
     kırpıyor. */
  const kirli =
    headline.trim() !== draft.headline.trim() || body.trim() !== draft.bodyMd.trim();
  useCikisKorumasi(kirli);
  useGeriYuklemeTazele(geri);

  const govdeRef = useRef<HTMLTextAreaElement>(null);
  const bolgeRef = useRef<HTMLElement>(null);
  const imlec = useImlec();
  const genis = useGenisEkran();
  useKendiligindenBuyu(govdeRef, body, !genis);

  /* Server action referansı sabit — `useOnizleme` bunu şart koşuyor. */
  const ilk = useMemo(
    () => ({ metin: draft.bodyMd, cizim: ilkOnizleme }),
    [draft.bodyMd, ilkOnizleme],
  );
  const onizleme = useOnizleme(body, previewBriefBody, ilk);
  const takip = useOnizlemeTakibi(govdeRef, bolgeRef);
  useEffect(() => takip(), [onizleme.cizilen, takip]);

  const [gorunum, setGorunum] = useState<Gorunum>("yaz");
  const yazKonumu = useRef(0);
  const gorunumDegistir = (yeni: Gorunum) => {
    if (yeni === gorunum) return;
    if (yeni === "onizle") yazKonumu.current = window.scrollY;
    setGorunum(yeni);
    requestAnimationFrame(() => {
      if (yeni === "yaz") {
        window.scrollTo({ top: yazKonumu.current });
        return;
      }
      const hedef = imlecinBlogu(govdeRef.current, bolgeRef.current) ?? bolgeRef.current;
      if (!hedef) return;
      const ust = hedef.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, ust - window.innerHeight / 3) });
    });
  };

  const sifirla = () => {
    setHeadline(draft.headline);
    setBody(draft.bodyMd);
  };

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
  const lang = draft.locale;
  const hata = kayit.at && kayit.at >= (geri.at ?? "") ? kayit.fieldErrors : undefined;
  const maddeSayisi = body
    .split("\n")
    .filter((satir) => satir.trim().startsWith("- ")).length;

  return (
    <form
      style={EDITOR_OLCULERI}
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        startTransition(() => kaydet(fd));
      }}
      className="flex flex-col"
    >
      <input type="hidden" name="date" value={draft.date} />
      <input type="hidden" name="locale" value={draft.locale} />
      <input type="hidden" name="period" value={draft.period} />

      <div className="grid gap-x-6 gap-y-6 lg:grid-cols-2">
        <div className="min-w-0 lg:col-span-2">
          <Alan
            label="Manşet"
            hata={hata?.headline}
            hint="Bülten sayfasının başlığı; ana sayfadaki özet kartında da bu görünüyor."
            sayac={<Sayac n={headline.trim().length} tavan={SINIR.headline} />}
          >
            {(p) => (
              <TekSatir
                {...p}
                name="headline"
                lang={lang}
                value={headline}
                onValue={setHeadline}
                maxLength={SINIR.headline}
                required
                className="text-lead font-semibold leading-snug"
              />
            )}
          </Alan>
        </div>

        {/* GÖVDE ÖNİZLEMENİN BOYUNDA (23 Eylül denetimi). Sabit 24 satırlık
            kutu 1440'ta sol sütunun dibinde 138 piksel boşluk bırakıyordu;
            satırın boyunu 804 piksellik önizleme belirliyordu. Geniş ekranda
            iki kutu artık aynı ölçüden (`--editor-bolum`) boylanıyor. */}
        <section
          id={govdeId}
          aria-labelledby={govdeBaslikId}
          className={cn(
            "flex min-w-0 flex-col gap-2 lg:h-(--editor-bolum)",
            gorunum === "onizle" && "max-lg:hidden",
          )}
        >
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 sm:min-h-9">
            <h3 id={govdeBaslikId} className="text-small font-semibold text-strong">
              Gövde
            </h3>
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

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kalıp Ekle">
            {KALIPLAR.map((kalip) => (
              <button
                key={kalip.ad}
                type="button"
                onClick={() => {
                  if (!govdeRef.current) return;
                  blokYaz(
                    govdeRef.current,
                    lang === "en" ? kalip.en : kalip.tr,
                    imlec.konum.current,
                    "satir",
                  );
                }}
                title={lang === "en" ? kalip.en : kalip.tr}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-small font-semibold text-body transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary sm:min-h-8 sm:px-2.5"
              >
                {kalip.ad}
                <code className="font-mono text-nano font-normal text-muted">
                  {kalip.sozdizimi}
                </code>
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
            value={body}
            onChange={(event) => setBody(event.target.value)}
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
              {/* İPUCU TEK SATIRA SIĞMALI: iki satıra kırılınca gövde kutusu
                  önizlemenin kutusundan 20 piksel önce bitiyordu (1024'te
                  sütun 451 piksel; eski cümle 304 + sayaç 162 + ara 12).
                  Kısa cümle 234 piksel; kutular 1024–1440 arası aynı
                  hatta bitiyor. */}
              {hata?.body_md ?? "Boş satır paragraf ayırır; maddeler numaralanır."}
            </span>
            <Sayac
              n={body.trim().length}
              tavan={SINIR.body}
              birim="Karakter"
              ek={`${maddeSayisi.toLocaleString("tr-TR")} Madde`}
            />
          </div>
        </section>

        <OnizlemePaneli
          id={onizlemeId}
          preview={onizleme.preview}
          durum={onizleme.durum}
          yenile={onizleme.yenile}
          lang={lang}
          bolgeRef={bolgeRef}
          dipnot="Bülten Sayfasındaki Çizimin Aynısı"
          kunye={{ baslik: headline }}
          className={cn(
            "lg:sticky lg:top-(--editor-ust) lg:h-(--editor-bolum) lg:self-start",
            gorunum === "yaz" && "max-lg:hidden",
          )}
        />
      </div>

      <div className="mt-6">
        <SurumGecmisi
          revisions={revisions}
          geriYukle={geriYukle}
          geriYukleniyor={geriYukleniyor}
          not="Kaydetmek yayındaki metnin üzerine yazar; önceki hâli burada saklanır ve geri yüklenebilir. Yazar künyesi değişmez, panel düzeltmesi başlıkta ayrıca yazılır."
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
