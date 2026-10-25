import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { BrokerFold } from "@/components/brokers/BrokerFold";
import { formatIsoDate } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import type { Broker } from "@/content/brokers";
import styles from "./Brokers.module.css";

/**
 * Metin ve künye: tabloda olmayan kalemler, tarafsızlık notu.
 *
 * 25 Ekim kompakt tur: "Tabloda Olmayanlar" artık kendi paneli değil,
 * "Ayrıntılar" panelinde katlı bir satır (`BrokerFold`); kapalıyken özeti
 * kalemlerin adları (sözlükten, ayrı metin yazılmadı). Çapa
 * `#tabloda-olmayanlar` aynı.
 *
 * Tarafsızlık notu ve "Yatırım Tavsiyesi Değildir" KATLANMIYOR
 * (`BrokerNeutrality`): panelin dibinde, hairline ile ayrılmış düz paragraf;
 * uyarı için yeni kutu açılmıyor (CLAUDE.md ekran düzeni 6).
 */
export function BrokerNotes({ t, locale }: { t: Dictionary; locale: Locale }) {
  const L = t.brokers;
  const links = [
    { href: "/rehber/araci-kurum-secimi", label: L.guideLink },
    { href: "/rehber/bankadan-araci-kuruma-gecis", label: L.transferLink },
    { href: "/vergi", label: L.taxLink },
  ];
  const terms = new Intl.ListFormat(locale === "en" ? "en" : "tr", { type: "conjunction" }).format(
    L.outside.map((item) => item.term),
  );
  return (
    <BrokerFold
      id="tabloda-olmayanlar"
      title={L.outsideTitle}
      summary={terms}
      meta={t.brokerCards.compact.outsideMeta.replace("{n}", String(L.outside.length))}
    >
      <dl className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
        {L.outside.map((item) => (
          <div key={item.term} className="max-w-3xl">
            <dt className="text-sm font-bold text-strong">{item.term}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-body">{item.body}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-1 flex flex-wrap gap-x-5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.inlineLink}>
              {link.label}
              <ArrowRight weight="bold" size={12} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </BrokerFold>
  );
}

/** Tarafsızlık künyesi — katlanmaz; "Ayrıntılar" panelinin dibinde. */
export function BrokerNeutrality({ t }: { t: Dictionary }) {
  const L = t.brokers;
  return (
    <div className="flex max-w-4xl flex-col gap-1 px-4 py-3.5 text-tiny leading-relaxed text-muted sm:px-5">
      <p>
        <strong className="font-semibold text-body">{L.neutralityTitle}.</strong> {L.neutrality}
      </p>
      <p className="font-semibold text-body">{L.notAdvice}</p>
    </div>
  );
}

/**
 * Kaynak listesi — tablodaki köşeli numaraların çapası.
 *
 * Kurum başına numaralı liste; numara `content/brokers.ts`teki `sources`
 * sırası (`sourceNumbers` aynı sırayı okur). Bağlantı `rel="noreferrer"`:
 * kurumun sayfası okuyucunun nereden geldiğini görmüyor — bu sayfa bir
 * yönlendirme kanalı değil.
 */
export function BrokerSources({
  brokers,
  locale,
  t,
}: {
  brokers: readonly Broker[];
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.brokers;
  const pick = (bi: { tr: string; en: string }) => (locale === "en" ? bi.en : bi.tr);
  /* Belge tarihi bazen gün ("2026-09-11"), bazen ay ("2025-03"), bazen
     sürüm kodu ("KMT-28082026-20"); yalnız gün biçimi tarihe çevriliyor. */
  const docDate = (raw: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(raw) ? formatIsoDate(raw, locale, "long") : raw;

  const sourceCount = brokers.reduce((sum, broker) => sum + Object.keys(broker.sources).length, 0);

  /* 25 Ekim kompakt tur: liste her genişlikte katlı (eskiden yalnız
     telefonda, FoldToggle ile). Kartlardaki kaynak numarası ve "N Kaynak"
     bağlantısı içerideki çapaya gidiyor; katlamayı `RevealFoldAnchor`
     açıyor. */
  return (
    <BrokerFold
      id="kaynaklar"
      title={L.sourcesTitle}
      summary={t.brokerCards.compact.sourcesSummary}
      meta={t.brokerCards.compact.sourcesMeta
        .replace("{count}", String(brokers.length))
        .replace("{n}", String(sourceCount))}
    >
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-body">{L.sourcesLead}</p>
      <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
        {brokers.map((broker) => (
          <section
            key={broker.id}
            id={`kaynaklar-${broker.id}`}
            aria-label={broker.name}
            className="min-w-0 scroll-mt-28"
          >
            <h3 className="text-sm font-bold text-strong">{broker.name}</h3>
            <ol className="mt-1.5 flex flex-col gap-1.5">
              {Object.values(broker.sources).map((source, index) => (
                <li
                  key={source.url}
                  id={`kaynak-${broker.id}-${index + 1}`}
                  className={styles.source}
                >
                  <span className={styles.sourceNo} aria-hidden>
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-small font-semibold text-primary-ink transition-colors hover:text-primary-hover"
                    >
                      {pick(source.title)}
                    </a>
                    <span className="block text-tiny text-muted [overflow-wrap:anywhere]">
                      {new URL(source.url).hostname.replace(/^www\./, "")}
                      {" · "}
                      {L.checkedOn.replace("{date}", formatIsoDate(source.checked, locale, "long"))}
                      {source.docDate && <> · {L.docDate.replace("{date}", docDate(source.docDate))}</>}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </BrokerFold>
  );
}
