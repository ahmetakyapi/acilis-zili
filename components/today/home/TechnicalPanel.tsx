import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { getHolidays, getSymbolNames } from "@/lib/data";
import { todayEt } from "@/lib/market-hours";
import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import {
  TECHNICAL_SYMBOLS,
  editionClock,
  editionTime,
  newestEdition,
  nextEdition,
  pendingSymbols,
  slotLabel,
  stanceChangeLabel,
  technicalHref,
} from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateCompact } from "@/lib/utils";
import styles from "./TechnicalPanel.module.css";

const VERDICTS: readonly VerdictKey[] = ["buy", "hold", "sell"];

/* ==========================================================================
   Teknik görünüm
   ========================================================================== */

/**
 * Teknik analiz paneli — yan kolonda (gerekçe ve ölçüm yerleşim yorumunda).
 * Pano boşsa hiç basılmıyor. 14 Kasım'dan beri dağılımı dizin sayfasının
 * bileşeni (`TechnicalPulse variant="panel"`) değil bu dosyadaki
 * `TechnicalPanelView` çiziyor; veri aynı pano.
 */
export async function TechnicalPanel({ locale, t }: { locale: Locale; t: Dictionary }) {
  /* OKUMALAR BİRLİKTE BAŞLIYOR. Pano, tatiller, künye ve kotasyon paketi
     sırayla bekleniyordu ve hiçbiri panoya bağlı değil: panel sayfanın en
     son çözülen sınırıydı ve akışın sonunu tutuyordu (üretimde on sıcak
     koşunun onunda en son, 288–381 ms; soğuk önbellekte 809 ms, akış sonu
     841). Pano boşsa kaybolan tek şey önbellekli bir künye sorgusu. */
  const [board, holidays, meta] = await Promise.all([
    getTechnicalBoard(),
    getHolidays(),
    getSymbolNames([...TECHNICAL_SYMBOLS]),
  ]);
  if (board.length === 0) return null;
  const next = nextEdition(new Date(), holidays);
  /* Bekleyenler panelde de sayılıyor: iki ekran aynı listeyi anlatıyor ve
     biri on iki, öteki on beş deseydi okuyucu hangisine inanacağını
     bilemezdi. Künye `TECHNICAL_SYMBOLS`in tamamı için isteniyor (bekleyenler
     14 Kasım'dan beri logosuz tek künye satırı; adlar erişilebilir etikette). */
  const pending = pendingSymbols(board.map(({ row }) => row.symbol));
  /* PANEL ARTIK KOTASYON PAKETİNİ BEKLEMİYOR (14 Kasım, görsel tur).
     Logoların açtığı şirket balonu canlı fiyatı hareket panelinin
     paketinden okuyordu (`indexSnapshot`) ve panel o büyük çekime bağlıydı.
     Yeni düzen (aşağıda, `TechnicalPanelView`) balonu taşımıyor: hücre
     doğrudan hissenin analizine gider, fiyat orada. Panel üç yerel
     okumayla çözülüyor. */
  const latest = newestEdition(board);
  return (
    <TechnicalPanelView
      locale={locale}
      t={t}
      groups={VERDICTS.map((verdict) => ({
        verdict,
        items: board
          .filter(({ row }) => verdictOf(row.stance) === verdict)
          .map(({ row, previousStance }) => ({
            symbol: row.symbol,
            name: meta[row.symbol]?.name ?? row.symbol,
            logoUrl: meta[row.symbol]?.logoUrl ?? null,
            changed: stanceChangeLabel(verdict, previousStance, t),
          })),
      }))}
      pending={pending.map((symbol) => ({
        symbol,
        name: meta[symbol]?.name ?? symbol,
        logoUrl: meta[symbol]?.logoUrl ?? null,
        changed: null,
      }))}
      latest={
        latest
          ? `${slotLabel(latest.slot, t)} · ${formatEtDateCompact(latest.sessionDate, locale)} · ${editionTime(latest.sessionDate, latest.slot, locale)}`
          : null
      }
      next={
        next
          ? `${slotLabel(next.slot, t)} · ${editionClock(next.at, locale)}${todayEt(next.at) !== todayEt() ? ` · ${formatEtDateCompact(todayEt(next.at), locale)}` : ""}`
          : null
      }
    />
  );
}

type PanelItem = { symbol: string; name: string; logoUrl: string | null; changed: string | null };

/**
 * Teknik panelin saf görünümü — veri `TechnicalPanel`de (`olcum` skill'i).
 *
 * KÜME = SAYI + ŞERİT + ADLI LOGOLAR (14 Kasım, görsel tur). Panel bir halka
 * ("16 Takipte"), yanında iki satır lejant ve altında iki sıra ADSIZ logo
 * karosu taşıyordu (canlı, 1440: 411 piksel): halka ile lejant aynı payı iki
 * kez söylüyor, karolar ise hangi hissenin hangi görüşte olduğunu ancak
 * logoyu tanıyana söylüyordu. Şimdi üç kat, yukarıdan aşağı:
 *   1. ÜÇ SAYI: AL / TUT / SAT — panelin en büyük puntosu (28/700) en
 *      anlamlı değerde; boş görüş de yerinde ("AL 0", soluk).
 *   2. TEK KALIN ŞERİT (12 piksel): üç görüşün ve bekleyenlerin payı; sayı
 *      sütunlarıyla aynı sırada, renk yalnız görüşten.
 *   3. GÖRÜŞ KÜMELERİ: hap + hisse sayısı, altında logo + SEMBOL hücreleri.
 *      Görüşü bu yayında değişen hissenin sembolü altında "Sata Döndü"
 *      yazısı (eldeki `previousStance`; yeni veri yok). Bekleyenler tek
 *      künye satırı.
 * Hücrenin tamamı analize giden bağlantı, 52 × 56 piksel (dokunma hedefi
 * ≥ 44; eski karo 35 × 35'ti). Şirket balonu (`CompanyCards`) kalktı:
 * balon fiyatı ve görüşü ikinci kez yazıyordu, hücre zaten analize gidiyor.
 * Çizim: şerit dilimleri `bar-fill` + `data-draw` ile soldan bir kez dolar.
 * Ölçüm TechnicalPanel.module.css başında.
 */
export function TechnicalPanelView({
  locale,
  t,
  groups,
  pending,
  latest,
  next,
}: {
  locale: Locale;
  t: Dictionary;
  groups: readonly { verdict: VerdictKey; items: readonly PanelItem[] }[];
  pending: readonly PanelItem[];
  latest: string | null;
  next: string | null;
}) {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0) + pending.length;
  const share = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { style: "percent", maximumFractionDigits: 0 });
  const stockCount = (n: number) => (n === 1 ? t.technical.stockCountOne : t.technical.stockCount).replace("{n}", String(n));
  const cells = (items: readonly PanelItem[], label: string) => (
    /* SÜTUN SAYISI SUNUCUDA, SATIRLAR DENGELİ: rayda satıra en çok 6 hücre
       sığar; 7 hisse 6 + 1 değil 4 + 3, 9 hisse 5 + 4 dizilir (sarkan tek
       logo yok). Altı ve azı sola yaslı tek satır. Geniş kapta (tablet)
       ızgara kendi sığdırır (CSS). */
    <ul className={styles.cells} style={{ "--cols": items.length <= 6 ? 6 : Math.ceil(items.length / Math.ceil(items.length / 6)) } as CSSProperties}>
      {items.map((item) => (
        <li key={item.symbol}>
          <Link
            href={technicalHref(item.symbol)}
            prefetch={false}
            className={styles.cell}
            aria-label={`${item.symbol} · ${item.name} · ${item.changed ?? label}`}
          >
            <LogoTile symbol={item.symbol} logoUrl={item.logoUrl} size="sm" />
            <b>{item.symbol}</b>
            {item.changed && <small>{item.changed}</small>}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title={t.technical.title}
        tone="title"
        action={<PanelLink href="/teknik-analiz">{t.common.showAll}</PanelLink>}
      />
      <div className={styles.body}>
        {/* ÜÇ SAYI + ŞERİT: "kaç hisse hangi görüşte" tek bakışta. */}
        <div className={styles.tally} role="img" aria-label={`${t.technical.distribution}: ${groups.map((group) => `${verdictLabel(group.verdict, t)} ${group.items.length}`).join(", ")}`}>
          <dl className={styles.counts} aria-hidden="true">
            {groups.map((group) => (
              <div key={group.verdict} data-verdict={group.verdict} data-empty={group.items.length === 0 || undefined}>
                <dt>{verdictLabel(group.verdict, t)}</dt>
                <dd className="numeral">
                  {group.items.length}
                  {group.items.length > 0 && total > 0 && <small>{share.format(group.items.length / total)}</small>}
                </dd>
              </div>
            ))}
          </dl>
          <span className={styles.strip} data-draw aria-hidden="true">
            {groups.map((group, index) =>
              group.items.length > 0 ? (
                <i key={group.verdict} className="bar-fill" data-verdict={group.verdict} style={{ flexGrow: group.items.length, "--i": index } as CSSProperties} />
              ) : null,
            )}
            {pending.length > 0 && <i className="bar-fill" data-verdict="pending" style={{ flexGrow: pending.length, "--i": 3 } as CSSProperties} />}
          </span>
        </div>

        {groups.filter((group) => group.items.length > 0).map((group) => (
          <section key={group.verdict} className={styles.group} aria-label={`${verdictLabel(group.verdict, t)} · ${stockCount(group.items.length)}`}>
            <p className={styles.groupHead}>
              <VerdictPill verdict={group.verdict} label={verdictLabel(group.verdict, t)} size="sm" />
              <span className="numeral">{stockCount(group.items.length)}</span>
            </p>
            {cells(group.items, verdictLabel(group.verdict, t))}
          </section>
        ))}
        {/* BEKLEYENLER TEK SATIR: bir görüş değil bir eksik; logo ızgarası
            yerine künye satırı (yayın yok, hücre gidecek analiz bulamaz).
            Dağılım şeridinde nötr dilim olarak sayılı. */}
        {pending.length > 0 && (
          <p className={styles.pending}>
            <span className={styles.pendingTag}>{t.technical.pendingLabel}</span>
            <span className={styles.pendingSymbols}>{pending.map((item) => item.symbol).join(" · ")}</span>
          </p>
        )}

        {/* Yayın künyesi panelin dibinde, hairline ile ayrık düz satırlar
            (`.claude/rules/arayuz.md` → ekran sırası: künye metinden sonra).
            "Sıradaki Yayın": elindeki görüş ne kadar süre geçerli
            (gerekçe `nextEdition`). */}
        {(latest || next) && (
          <dl className={styles.editions}>
            {latest && (
              <div>
                <dt>{t.technical.latestEdition}</dt>
                <dd className="numeral">{latest}</dd>
              </div>
            )}
            {next && (
              <div>
                <dt>{t.technical.nextEdition}</dt>
                <dd className="numeral">{next}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </Panel>
  );
}
