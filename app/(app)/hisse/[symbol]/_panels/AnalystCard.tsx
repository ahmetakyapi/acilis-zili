import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import styles from "../stock.module.css";
import { DataError, Panel, PanelHeader } from "@/components/ui/primitives";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getRecommendations } from "@/lib/providers/finnhub";
import { getQuotes } from "@/lib/providers";
import { getLatestTarget, getStatus } from "@/lib/data";
import { analysisHref } from "@/lib/analysis";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { cn, directionOf, directionText, formatEtDateMedium, formatPercent, formatPercentPlain, formatPrice, plural } from "@/lib/utils";

export async function AnalystCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const bos = (
    <Panel className={styles.analystPanel}>
      <PanelHeader title={t.stock.analysts} />
      <DataError message={t.common.noData} />
    </Panel>
  );

  const [result, target, status] = await Promise.all([
    getRecommendations(symbol),
    getLatestTarget(symbol, locale),
    getStatus(),
  ]);
  if (!result.ok) return bos;
  /* Potansiyel CANLI fiyata göre — başlıktaki kotasyonla aynı anahtar
     (`[symbol]`), istek içinde tek tur. Kotasyon yoksa yalnızca hedef. */
  const quote = target ? await getQuotes([symbol], status) : null;
  const price = quote?.ok ? quote.data[symbol.toUpperCase()]?.price ?? null : null;
  const upside = target && price && price > 0 ? ((target.targetPrice - price) / price) * 100 : null;

  const latest = result.data[0];
  const total =
    latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  if (total === 0) return bos;

  const kotasyon = latest.symbol?.toUpperCase();
  const alimTarafi = latest.strongBuy + latest.buy;

  const segments = [
    { label: t.stock.strongBuy, value: latest.strongBuy, cls: "bg-up", color: "var(--up)" },
    { label: t.stock.buy, value: latest.buy, cls: "bg-up/60", color: "color-mix(in srgb, var(--up) 60%, var(--surface-solid))" },
    { label: t.stock.hold, value: latest.hold, cls: "bg-flat", color: "var(--flat)" },
    { label: t.stock.sell, value: latest.sell, cls: "bg-down/60", color: "color-mix(in srgb, var(--down) 60%, var(--surface-solid))" },
    { label: t.stock.strongSell, value: latest.strongSell, cls: "bg-down", color: "var(--down)" },
  ];

  /* KART KOMŞUSUNUN RİTMİNE OTURUYOR.
     Beş etiket iki sütuna diziliyordu ve üç satır tutuyordu; kart, üçlü
     ızgarada yanındaki Anahtar Metrikler (yedi satır) ve Katılım Taraması
     kadar uzuyor ama içeriği o boyun yarısını bile doldurmuyordu — panelin
     alt yarısı boştu. Aynı veri tek sütunda, komşu kartla AYNI satır
     düzeninde (`divide-y divide-line-soft`, `py-2.5`) beş satır tutuyor ve
     boşluk kendiliğinden kapanıyor. Yeni bilgi eklenmedi; eklenen tek şey
     payın yüzdesi, o da çubuğun zaten çizdiği oranın sayısı.

     BURAYA YENİ VERİ EKLENMEZ. Finnhub `/stock/recommendation` dört aylık
     anlık görüntü döndürüyor ve kart yalnızca ilkini çiziyor; kalan üçüyle
     bir trend merdiveni çizmek ilk bakışta boşluğun doğal cevabı gibi
     duruyor. Ölçüldü, değil: üç kart `repeat(auto-fit,minmax(17rem,1fr))`
     ızgarasında AYNI satırda ve satırın boyu EN UZUN karta göre kuruluyor.
     Merdiven (~90px) satırı uzatır ve boşluk komşu kartların altında
     yeniden açılır; bir kartın sorunu üç karta dağıtılmış olur. Aynı
     gerekçe kaynak damgası ve "alım tarafı payı" manşeti için de geçerli.

     AÇIKLAMA METNİ BU YASAĞIN DIŞINDA ve ayrımın ölçüsü net: yeni veri
     satırı UZATIR, açıklama satırı UZATMAZ. Satırın boyunu orta sütun
     kuruyor (ölçüldü: 529 piksel) ve bu kartın içeriği 332'de bitiyordu —
     yani 197 piksel zaten ödenmiş ve boş duruyordu. Paragraf o ödenmiş yere
     iniyor. Sınır da buradan çıkıyor: metin bu boşluktan uzun olmaya
     başlarsa artık dolgu değil, satırı uzatan bir yük olur.

     NEDEN AÇIKLAMA. Dağılım kartın en çok yanlış okunan yeri: "%91 Al
     Yönünde" bir fiyat hedefi, bir zamanlama ya da öncü bir sinyal
     sanılabiliyor. Üçü de değil ve üçünü de söyleyen tek bir paragraf,
     boşluğu doldurmak için uydurulmuş bir metin değil. */
  return (
    /* KART KUTUSUNU DOLDURUYOR. Izgara satırı üç kolonu aynı yüksekliğe
       geriyor ve boyu orta sütun kuruyor (ölçüldü: 529 piksel). Bu kartın
       içeriği 332'de bitiyordu, yani künyenin ALTINDA 197 piksel boş kalıyor
       ve kart yarım kalmış gibi duruyordu. Künye artık kartın dibinde;
       artan yer künye ile satırlar ARASINA gidiyor, künyenin altına değil.
       Tek sütuna düşen dar ekranda gerilme olmadığı için hiçbir şey
       değişmiyor. */
    <Panel className={styles.analystPanel}>
      <PanelHeader
        title={t.stock.analysts}
        action={<UsersThree className={styles.cardIcon} size={19} weight="duotone" aria-hidden />}
        /* ROZET BAŞLIĞIN SAĞINDA. Sayı bir süre dip künyesinde durdu ve
           orada künyenin ilk kelimesiydi: kartın tek cümlelik cevabı, en son
           okunan satırda kalıyordu. Başlığın yanında ilk bakışta okunuyor.
           Yeşil, altındaki çubuğun yeşil kısmının payı olduğu için — rozet
           o oranın sayısı, ayrı bir hüküm değil. Renk tek taşıyıcı da değil:
           yön kelimesi rozetin içinde yazılı. */
        /* Yeni grafik başlığın hemen altında aynı özeti taşıyor;
           rozetin sayısı burada tekrarlanmıyor. */
      />
      <div className={styles.analystBody}>
      <div className={styles.analystOverview}>
      <div className={styles.consensus}>
        <svg viewBox="0 0 120 120" className={styles.consensusRing} aria-hidden>
          <circle cx="60" cy="60" r="47" fill="none" stroke="var(--surface-elevated)" strokeWidth="8" />
          {segments.map((segment, index) => {
            const circumference = 2 * Math.PI * 47;
            const length = segment.value / total * circumference;
            const offset = segments.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total * circumference;
            return segment.value > 0 ? <circle key={segment.label} cx="60" cy="60" r="47" fill="none" stroke={segment.color} strokeWidth="8" strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" /> : null;
          })}
          <circle cx="60" cy="60" r="33" fill="none" stroke="var(--line-soft)" strokeWidth="1" />
        </svg>
        <div className={styles.consensusValue}>
          <strong className="numeral">{formatPercentPlain((alimTarafi / total) * 100, locale, 0)}</strong>
          <span>{t.stock.analystLeaning}</span>
        </div>
      </div>
      {/* Çubuk ARIA'dan gizli: altındaki liste aynı veriyi zaten okunabilir
          hâlde taşıyor, ikisi birden okununca sayılar iki kez geçiyordu.
          Dilim sınırını renk değil boşluk çiziyor — komşu basamaklar aynı
          renk ailesinden ve kontrast ayırmaya yetmiyor. */}
      <dl className={styles.analystDistribution}>
        {segments.map((segment) => (
          <div key={segment.label} className={styles.analystRow}>
            <dt className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-strong">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", segment.cls)}
              />
              {segment.label}
            </dt>
            {/* Sayı sütunu da sabit genişlikte — tek haneli "3" ile iki
                haneli "13" aynı sağ kenardan okunuyor. */}
            <dd className="numeral w-7 shrink-0 text-right text-sm text-body">
              {segment.value}
            </dd>
            {/* Sabit genişlik: yüzdeler sağ kenarda hizalı dursun, sayının
                kaç hane olduğuna göre sağa sola kaymasın. */}
            {/* YÜZDE SÜTUNU DAR EKRANDA YOK. Aynı dağılım bu kartta dört kez
                çizilmiş: rozet, yığılmış çubuk, adet sütunu ve bu yüzde
                sütunu. Yüzde yeni bir şey söylemiyor — çubuğun zaten çizdiği
                oranın sayısı. Varlık sebebi masaüstündeki üç sütunlu ızgarada
                kart boyunu eşitlemekti; mobilde o ızgara yok, paneller alt
                alta. Üstelik üstteki "%94 Al Yönünde" rozetinin bazı FARKLI
                (al tarafının toplam paya oranı) ve yan yana duran altı yüzde
                iki ayrı bazı ayırt edilemez hâle getiriyordu. */}
            {/* ÖLÇEK FARKI YÜZDEYİ SİLİYORDU. Sütun 11 piksel (`text-tiny`)
                ve `text-muted` ile çiziliyordu; hemen solundaki adet sütunu
                ise 14 piksel ve `text-body`. Kontrast zaten AA'yı geçiyordu
                (açık temada 5,57:1, koyuda 5,32:1) — sorun renk değil, üç
                piksellik punto farkının yüzdeyi komşusunun gölgesine
                itmesiydi. 12 piksele ve aynı renk ailesine çekildi; sayının
                altında değil YANINDA duruyor artık. Hâlâ ikincil: adet
                sütunundan iki punto küçük ve ağırlığı yok. */}
            <dd className="numeral w-11 shrink-0 text-right text-small text-body">
              {formatPercentPlain((segment.value / total) * 100, locale, 0)}
            </dd>
          </div>
        ))}
      </dl>
      </div>
      {/* Listenin kapanış çizgisi VE paragrafın ayıracı aynı kural; ikinci
          bir çizgi çekilmiyor. Künye kendi çizgisini koruyor, çünkü o
          açıklamanın devamı değil ayrı bir kayıt (kapsam ve dönem). */}
      {/* KÜNYE AÇIKLAMA SATIRINDA. "55 Analist · Eylül 2026" kartın dibinde
          tek başına bir satır tutuyordu; hemen üstündeki "12 Aylık Tavsiye
          Dağılımı" satırının ortası boştu (23 Eylül, sahibinin isteği). */}
      {/* ORTALAMA HEDEF FİYAT (30 Eylül, sahibinin isteği). "Buraya yeni veri
          eklenmez" kaydının gerekçesi masaüstündeki üçlü ızgarada satırı
          uzatmamaktı; aynı kayıt kartın içinde ~197 piksellik ödenmiş boş
          yer ölçmüştü. Şerit tek satır (+ künye) ve o boşluğa iniyor.
          Sayı canlı değil: en son bilanço analizinin yazıldığı anın hedefi —
          künye analizi ve tarihini söylüyor, analize bağlanıyor. Potansiyel
          yönü renkte ve işarette; bir hüküm değil, hedefle fiyat arasındaki
          fark. */}
      {target && (
        <div className={styles.analystTarget}>
          <div className={styles.analystTargetLine}>
            <span className={styles.analystTargetLabel}>{t.analystTarget.label}</span>
            <strong className="numeral">{formatPrice(target.targetPrice, locale, { currency: true })}</strong>
            {upside !== null && (
              <span className={cn("numeral", styles.analystTargetUpside, directionText(directionOf(upside)))}>
                {formatPercent(upside, locale)}
                <small>{t.analystTarget.upside}</small>
              </span>
            )}
          </div>
          <p className={styles.analystTargetMeta}>
            {target.analystCount ? <>{t.analystTarget.analysts.replace("{n}", String(target.analystCount))} · </> : null}
            <Link href={analysisHref(symbol, target.period)} prefetch={false}>
              {t.analystTarget.from
                .replace("{period}", target.periodLabel)
                .replace("{date}", formatEtDateMedium(target.reportDate, locale))}
            </Link>
          </p>
        </div>
      )}
      <details className={styles.analystExplanation}>
        <summary>
          <span className={styles.analystSummaryLabel}>{t.stock.analystReading}</span>
          <span className={cn("numeral", styles.analystStamp)}>
            {total} {plural(total, t.stock.analystOne, t.stock.analystMany)} ·{" "}
            {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${latest.period}T12:00:00Z`))}
          </span>
          <span aria-hidden className={styles.analystToggle}>+</span>
        </summary>
        <p className={styles.cardNote}>{t.stock.analystsNote}</p>
      </details>
      {/* KÜNYE ÜÇ ŞEYİ SÖYLÜYOR: özet, kapsam, dönem.
          Başta yalnızca ay yazıyordu. Analist sayısı eklendi, çünkü
          dağılımın ağırlığı sayıya bağlı — "3 analistin 2'si Al diyor" ile
          "54 analistin 37'si Al diyor" aynı şey değil. Sonra başa tek bir
          okuma geldi: beş kovayı kafada toplamak okuyucunun işi olmamalı.

          BU SAYI AĞIRLIKLANDIRILMIŞ BİR PUAN DEĞİL, İKİ TOPLAMA. Güçlü Al
          ile Al'ın toplamının paya oranı; çubuğun yeşil kısmının yüzdesi.
          Kasıtlı olarak 1-5 ortalaması ya da 0-100 puan değil: o iki biçim
          "Güçlü Al, Al'dan tam bir basamak yukarıdadır" gibi bizim
          uydurduğumuz bir ağırlıklandırma taşır ve 0-100 olanı sitenin
          KENDİ bilanço analizi puanıyla (AL · 75 rozetleri) karışırdı —
          okuyucu analist konsensüsünü bizim hükmümüz sanardı. */}
      {/* TAVSİYELER BAŞKA BİR KOTASYONA AİT OLABİLİR. Finnhub sorulan
          sembolü değil, karşılık getirdiği kotasyonu yanıtlıyor: TSM
          sorulunca dönen kayıtların sembolü "2330.TW", yani dağılım
          Tayvan'daki payı izleyen analistlerden toplanmış. Sayfanın
          başlığındaki fiyat ise ABD'de işlem gören ADR'nin. İkisi yan yana
          durunca aynı hisseymiş gibi okunuyordu — Anahtar Metrikler'deki
          para birimi notunun (`homeCurrencyNote`) analist tarafındaki eşi.
          `?.` şart: alan bir gün gelmezse uyarı hiç basılmamalı, yanlış
          uyarı uyarısızlıktan kötü. */}
      {kotasyon && kotasyon !== symbol.toUpperCase() && (
        /* Kendi ayraç çizgisi YOK: hemen üstündeki künye zaten bir
           `border-t` taşıyor ve ikisi on piksel arayla iki çizgi olarak
           çiziliyordu. Not o künyenin devamı, ayrı bir bölüm değil. */
        <p className="mt-1.5 text-small leading-relaxed text-muted">
          {t.stock.analystListingNote.replace("{code}", kotasyon)}
        </p>
      )}
      </div>
    </Panel>
  );
}
