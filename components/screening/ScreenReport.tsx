import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import { SCREEN_CATEGORIES, type Check, type CheckStatus, type ScreenCategory } from "@/lib/screening";
import type { ScreenData } from "@/lib/screening-data";
import { checkSentence, formatCheckValue } from "./format";
import styles from "./Screening.module.css";

type T = Dictionary["screening"];

/** Kategori puanının çubuk rengi — kontrollerle aynı üç ton. */
function scoreStatus(score: number | null): CheckStatus {
  if (score === null) return "na";
  if (score >= 70) return "pass";
  if (score >= 40) return "warn";
  return "fail";
}

/** Bankada sağlık kuralları "veri yok" değil "uygulanmaz" — okuyucu
    eksik bir ölçü değil bilinçli bir atlama görmeli. */
function statusLabel(check: Check, data: ScreenData, t: T): string {
  if (check.status === "na" && check.category === "health" && data.input.financial) return t.status.notApplicable;
  return t.status[check.status];
}

/** Ana görsel: altı kategorinin puanı, ağırlığı ve kaç kuralının ölçüldüğü. */
export function CategoryPanel({ data, t }: { data: ScreenData; t: T }) {
  const gate = data.result.checks.filter((check) => check.category === "gate");
  const failed = gate.filter((check) => check.eliminates);
  const gateStatus: CheckStatus = failed.length ? "fail" : gate.some((c) => c.status === "na") ? "na" : "pass";
  return (
    <Panel>
      <PanelHeader title={t.categoriesTitle} />
      <div className={styles.cats}>
        {data.result.categories.map((entry) => {
          const status = scoreStatus(entry.score);
          return (
            <div key={entry.category} className={styles.cat} data-status={status}>
              <span className={styles.catName}>{t.categories[entry.category]}</span>
              <span className={styles.catScore} data-empty={entry.score === null}>
                {entry.score === null ? t.status.na : Math.round(entry.score)}
              </span>
              <span className={styles.catMeta}>
                {t.weight.replace("{n}", String(entry.weight))} ·{" "}
                {t.measured.replace("{m}", String(entry.measured)).replace("{n}", String(entry.total))}
              </span>
              <span className={styles.track} aria-hidden="true">
                {entry.score !== null && <span style={{ width: `${Math.max(entry.score, 2)}%` }} />}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.gate} data-status={gateStatus}>
        <b>
          {t.categories.gate} · {t.status[gateStatus]}
        </b>
        <span>
          {failed.length
            ? failed.map((check) => t.checks[check.id].name).join(", ")
            : t.categoryWhy.gate}
        </span>
      </p>
    </Panel>
  );
}

/** Ölçü ızgarası: her kural, eşiği, ölçüsü ve durumu. */
export function ChecksPanel({ data, locale, t }: { data: ScreenData; locale: string; t: T }) {
  const groups = SCREEN_CATEGORIES.map((category) => ({
    category,
    checks: data.result.checks.filter((check) => check.category === category),
  })).filter((group) => group.checks.length > 0);
  return (
    <Panel>
      <PanelHeader title={t.checksTitle} meta={t.coverage.replace("{n}", String(data.result.coverage))} />
      <div className={styles.colHead} aria-hidden="true">
        <span>{t.colRule}</span>
        <span>{t.colValue}</span>
        <span>{t.colStatus}</span>
      </div>
      {groups.map((group) => (
        <CheckGroup key={group.category} category={group.category} checks={group.checks} data={data} locale={locale} t={t} />
      ))}
    </Panel>
  );
}

function CheckGroup({
  category,
  checks,
  data,
  locale,
  t,
}: {
  category: ScreenCategory;
  checks: Check[];
  data: ScreenData;
  locale: string;
  t: T;
}) {
  const measured = checks.filter((check) => check.status !== "na").length;
  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h3>{t.categories[category]}</h3>
        <span>{t.measured.replace("{m}", String(measured)).replace("{n}", String(checks.length))}</span>
      </div>
      <ul className={styles.rows}>
        {checks.map((check) => {
          const value = formatCheckValue(check, locale, t, "cell");
          return (
            <li key={check.id} className={styles.row} data-status={check.status}>
              <span className={styles.rowName}>{t.checks[check.id].name}</span>
              <span className={styles.rowRule}>{t.checks[check.id].rule}</span>
              <span className={styles.rowValue} data-empty={value === null}>
                {value ?? "—"}
              </span>
              <span className={styles.rowStatus}>
                <span className={styles.status}>{statusLabel(check, data, t)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Metin: güçlü ve zayıf yanlar, kural cümleleriyle. */
export function SidesPanel({ data, locale, t }: { data: ScreenData; locale: string; t: T }) {
  const byId = new Map(data.result.checks.map((check) => [check.id, check]));
  const pros = data.result.pros.map((id) => byId.get(id)!);
  const cons = data.result.cons.map((id) => byId.get(id)!);
  return (
    <Panel>
      <div className={styles.sides}>
        <section className={styles.side}>
          <h2>{t.prosTitle}</h2>
          {pros.length ? (
            <ul className={styles.points}>
              {pros.map((check) => (
                <li key={check.id} data-status="pass">
                  <CheckCircle size={18} weight="fill" aria-hidden="true" />
                  <span>{checkSentence(check, locale, t, "pro")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.none}>{t.noneLabel}</p>
          )}
        </section>
        <section className={styles.side}>
          <h2>{t.consTitle}</h2>
          {cons.length ? (
            <ul className={styles.points}>
              {cons.map((check) => (
                <li key={check.id} data-status={check.status}>
                  {check.status === "fail" ? (
                    <XCircle size={18} weight="fill" aria-hidden="true" />
                  ) : (
                    <WarningCircle size={18} weight="fill" aria-hidden="true" />
                  )}
                  <span>{checkSentence(check, locale, t, "con")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.none}>{t.noneLabel}</p>
          )}
        </section>
      </div>
    </Panel>
  );
}

/**
 * Sıradaki adımlar, okuyucunun kendi kontrolleri ve künyeler. Künyeler
 * panelin İÇİNDE, hairline ile ayrılmış düz paragraflar (ekran düzeni
 * kuralı 6) — yöntem, kaynaklar, banka notu ve tavsiye uyarısı için ayrı
 * kutular açılmıyor.
 */
export function NextPanel({ data, locale, t }: { data: ScreenData; locale: string; t: T }) {
  const pe = data.input.forwardPE;
  const peText =
    pe !== null
      ? new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 1 }).format(pe)
      : "";
  return (
    <Panel>
      <PanelHeader title={t.nextTitle} />
      <ol className={styles.steps}>
        {data.result.suggestions.map((id) => (
          <li key={id}>
            {t.suggestions[id]
              .replace("{days}", String(data.input.earningsInDays ?? ""))
              .replace("{pe}", peText)}
          </li>
        ))}
      </ol>
      <PanelHeader title={t.manualTitle} />
      <ol className={styles.steps}>
        {t.manual.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <div className={styles.notes}>
        {data.input.financial && <p>{t.financialNote}</p>}
        <p>{t.methodNote}</p>
        <p>{t.sourcesNote}</p>
        <p>
          <strong>{t.notAdvice}</strong>
        </p>
      </div>
    </Panel>
  );
}
