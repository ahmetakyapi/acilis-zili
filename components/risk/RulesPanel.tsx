import { deleteRiskRule, toggleRiskRule } from "@/app/(app)/risk/actions";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import { day, fill, type Loc } from "@/lib/risk/format";
import { describeRule, evaluateRule, type ConditionLabels, type MarketFacts, type PositionFacts } from "@/lib/risk/rules";
import type { StoredAlert, StoredRule } from "@/lib/risk/store";
import { RuleBuilder } from "./RuleBuilder";
import styles from "./RiskDesk.module.css";

/**
 * Kurallar ve son uyarılar (25 Ekim). "Şu An Tetikli" bugünün masasıyla
 * sayfada değerlendirilir (cron'un yazdığı `active` ile aynı kural,
 * aynı ölçüler); bildirim yalnız cron'dan gider. Silme ve duraklatma düz
 * form: JavaScript kapalıyken de çalışır.
 */

type T = Dictionary["riskDesk"];

export function RulesPanel({
  rules,
  alerts,
  market,
  positions,
  t,
  locale,
}: {
  rules: { ok: true; rules: StoredRule[] } | { ok: false };
  alerts: { ok: true; alerts: StoredAlert[] } | { ok: false };
  market: MarketFacts;
  positions: readonly PositionFacts[];
  t: T;
  locale: Loc;
}) {
  const labels = t.conditions as ConditionLabels;
  const describe = (rule: Pick<StoredRule, "conditions" | "symbol">) => describeRule(rule, labels, { and: t.rules.and, all: t.rules.allPositions }, locale);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Panel>
        <PanelHeader title={t.rules.title} />
        <div className={styles.panelBody}>
          <p className={styles.ruleMeta}>{t.rules.hint}</p>
          {!rules.ok ? (
            <p className={styles.explain}>{t.rules.unavailable}</p>
          ) : (
            <>
              {rules.rules.length === 0 ? (
                <p className={styles.explain}>{t.rules.empty}</p>
              ) : (
                <ul className={`${styles.rules} mt-2`}>
                  {rules.rules.map((rule) => {
                    const outcome = rule.enabled ? evaluateRule(rule, market, positions) : null;
                    return (
                      <li key={rule.id} className={styles.rule}>
                        <div className={styles.ruleText}>
                          <span className={styles.tag} data-tag={rule.tone}>
                            {rule.label}
                          </span>
                          <span className={styles.ruleConds}>{describe(rule)}</span>
                          <span className={styles.ruleMeta}>
                            <span className={styles.state} data-on={outcome?.triggered ? "" : undefined}>
                              {!rule.enabled
                                ? t.rules.paused
                                : outcome?.triggered
                                  ? `${t.rules.activeNow}${outcome.symbols.length ? ` · ${outcome.symbols.join(", ")}` : ""}`
                                  : t.rules.idle}
                            </span>
                            {rule.lastSession && ` · ${fill(t.rules.lastSession, { date: day(rule.lastSession, locale) })}`}
                          </span>
                        </div>
                        <div className={styles.ruleActions}>
                          <form action={toggleRiskRule}>
                            <input type="hidden" name="id" value={rule.id} />
                            <input type="hidden" name="enabled" value={rule.enabled ? "0" : "1"} />
                            <button type="submit">{rule.enabled ? t.rules.pause : t.rules.resume}</button>
                          </form>
                          <form action={deleteRiskRule}>
                            <input type="hidden" name="id" value={rule.id} />
                            <button type="submit" aria-label={`${t.rules.delete}: ${rule.label}`}>
                              {t.rules.delete}
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <RuleBuilder t={t} />
            </>
          )}
          <p className={styles.foot}>{t.rules.pushNote}</p>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title={t.rules.alertsTitle} />
        <div className={styles.panelBody}>
          {!alerts.ok ? (
            <p className={styles.explain}>{t.rules.unavailable}</p>
          ) : alerts.alerts.length === 0 ? (
            <p className={styles.explain}>{t.rules.alertsEmpty}</p>
          ) : (
            <ul className={styles.alerts}>
              {alerts.alerts.map((alert) => (
                <li key={alert.id} className={styles.alert}>
                  <span className={styles.tag} data-tag={alert.tone}>
                    {alert.label}
                  </span>
                  <span className={styles.alertText}>{alert.message}</span>
                  <span className={styles.ruleMeta}>{day(alert.session, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
