import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { formatIsoDate } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import type { Broker } from "@/content/brokers";
import styles from "./Brokers.module.css";

/**
 * Metin ve künye: tabloda olmayan kalemler, tarafsızlık notu.
 *
 * Tarafsızlık notu ve "Yatırım Tavsiyesi Değildir" panelin İÇİNDE,
 * hairline ile ayrılmış düz paragraf — uyarı için yeni kutu açılmıyor
 * (CLAUDE.md ekran düzeni 6).
 */
export function BrokerNotes({ t }: { t: Dictionary }) {
  const L = t.brokers;
  const links = [
    { href: "/rehber/araci-kurum-secimi", label: L.guideLink },
    { href: "/rehber/bankadan-araci-kuruma-gecis", label: L.transferLink },
    { href: "/vergi", label: L.taxLink },
  ];
  return (
    <Panel id="tabloda-olmayanlar" aria-label={L.outsideTitle}>
      <PanelHeader title={L.outsideTitle} />
      <dl className="flex max-w-3xl flex-col gap-3 px-4 pb-4 sm:px-5">
        {L.outside.map((item) => (
          <div key={item.term}>
            <dt className="text-sm font-bold text-strong">{item.term}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-body">{item.body}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-wrap gap-x-5 px-4 pb-4 sm:px-5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.inlineLink}>
              {link.label}
              <ArrowRight weight="bold" size={12} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-line-soft px-4 py-4 sm:px-5">
        <div className="flex max-w-3xl flex-col gap-1.5 text-tiny leading-relaxed text-muted">
          <p>
            <strong className="font-semibold text-body">{L.neutralityTitle}.</strong> {L.neutrality}
          </p>
          <p className="font-semibold text-body">{L.notAdvice}</p>
        </div>
      </div>
    </Panel>
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

  return (
    <Panel id="kaynaklar" aria-label={L.sourcesTitle}>
      <PanelHeader title={L.sourcesTitle} />
      <p className="max-w-3xl px-4 pb-4 text-sm leading-relaxed text-body sm:px-5">{L.sourcesLead}</p>
      <div className="grid gap-x-8 gap-y-5 px-4 pb-5 sm:px-5 lg:grid-cols-2">
        {brokers.map((broker) => (
          <section key={broker.id} aria-label={broker.name} className="min-w-0">
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
    </Panel>
  );
}
