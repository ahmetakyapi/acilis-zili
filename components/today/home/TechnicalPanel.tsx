import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { getHolidays, getStatus, getSymbolNames } from "@/lib/data";
import { todayEt } from "@/lib/market-hours";
import { TechnicalPulse } from "@/components/technical/TechnicalPulse";
import {
  TECHNICAL_SYMBOLS,
  editionClock,
  editionTime,
  newestEdition,
  nextEdition,
  pendingSymbols,
  slotLabel,
} from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateCompact } from "@/lib/utils";
import { indexSnapshot } from "@/components/today/home/index-snapshot";

/* ==========================================================================
   Teknik görünüm
   ========================================================================== */

/**
 * Teknik analiz paneli — yan kolonda (gerekçe ve ölçüm yerleşim yorumunda).
 * Pano boşsa hiç basılmıyor; başlığı panelin kendisi taşıyor, görüş
 * dağılımının iç başlığı ve süzgeç bağlantısı burada yok (`variant="panel"`).
 */
export async function TechnicalPanel({ locale, t }: { locale: Locale; t: Dictionary }) {
  /* OKUMALAR BİRLİKTE BAŞLIYOR. Pano, tatiller, künye ve kotasyon paketi
     sırayla bekleniyordu ve hiçbiri panoya bağlı değil: panel sayfanın en
     son çözülen sınırıydı ve akışın sonunu tutuyordu (üretimde on sıcak
     koşunun onunda en son, 288–381 ms; soğuk önbellekte 809 ms, akış sonu
     841). Pano boşsa kaybolan tek şey önbellekli bir künye sorgusu. */
  const [board, holidays, meta, snapshot] = await Promise.all([
    getTechnicalBoard(),
    getHolidays(),
    getSymbolNames([...TECHNICAL_SYMBOLS]),
    getStatus().then(async (status) => ({ status, pack: (await indexSnapshot(status)).result })),
  ]);
  if (board.length === 0) return null;
  const next = nextEdition(new Date(), holidays);
  /* Bekleyenler panelde de sayılıyor: iki ekran aynı listeyi anlatıyor ve
     biri on iki, öteki on beş deseydi okuyucu hangisine inanacağını
     bilemezdi. Künye `TECHNICAL_SYMBOLS`in tamamı için isteniyor — logolar
     bekleyen satırda da basılıyor. */
  const pending = pendingSymbols(board.map(({ row }) => row.symbol));
  /* BALONUN CANLI FİYATI HAREKET PANELİNİN PAKETİNDEN. `indexSnapshot`
     aynı istekte `DayMovers` tarafından zaten bekleniyor; `getQuotes`
     istek içinde `cache()`li, anahtarı sıralı sembol dizesi ve `status`
     de `cache()`li `getStatus`in aynı nesnesi — yani burada sağlayıcıya
     yeni bir tur gitmiyor ve MU'nun yüzdesi iki panelde aynı sayı.
     `getQuotes(TECHNICAL_SYMBOLS)` BİLEREK ÇAĞRILMIYOR: yeni bir anahtar,
     yeni bir tur ve hareket paneliyle çelişebilecek ikinci bir kaynak
     olurdu. Endekste olmayan semboller (BE, ONDS gibi) fotoğraftaki
     fiyata ve "Analiz Anında" etiketine düşüyor.
     BEDELİ BİR GECİKME BAĞI: panel artık büyük evren paketini bekliyor.
     Ücretsiz olması `DayMovers`ın aynı istekte, aynı `status` nesnesiyle
     çizilmesine bağlı; o panel kalkar ya da başka bir durum nesnesiyle
     çağrılırsa bu satır büyük çekimi TEK BAŞINA başlatır (okuma yukarıda,
     öteki okumalarla birlikte). */
  const latest = newestEdition(board);
  return (
    <Panel className="min-w-0">
      {/* Başlık tam boy (26 Eylül): plaka başlıkta "küçük kalmış" bulundu;
          panel artık bir halka taşıyor ve Mercek bloğu gibi görsel bir blok. */}
      <PanelHeader
        title={t.technical.title}
        tone="title"
        action={<PanelLink href="/teknik">{t.common.showAll}</PanelLink>}
      />
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
        {latest && (
          <p className="text-tiny text-muted">
            {t.technical.latestEdition} ·{" "}
            <span className="font-semibold text-body">
              {slotLabel(latest.slot, t)} · {formatEtDateCompact(latest.sessionDate, locale)} ·{" "}
              <span className="numeral">{editionTime(latest.sessionDate, latest.slot, locale)}</span>
            </span>
          </p>
        )}
        {/* Sıradaki yayın — panel de aynı soruyu cevaplıyor: elindeki görüş
            ne kadar süre geçerli. Gerekçesi `nextEdition` üzerinde. */}
        {next && (
          <p className="text-tiny text-muted">
            {t.technical.nextEdition} ·{" "}
            <span className="font-semibold text-body">
              {slotLabel(next.slot, t)} ·{" "}
              <span className="numeral">{editionClock(next.at, locale)}</span>
              {todayEt(next.at) !== todayEt() && (
                <> · {formatEtDateCompact(todayEt(next.at), locale)}</>
              )}
            </span>
          </p>
        )}
        <TechnicalPulse
          locale={locale}
          board={board}
          pending={pending}
          meta={meta}
          quotes={snapshot}
          t={t}
          variant="panel"
        />
      </div>
    </Panel>
  );
}
