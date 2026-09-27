/* Glossary — Tax & Turkey (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_VERGI: GlossaryTexts<"vergi"> = {
  "w-8ben": {
    term: "Form W-8BEN",
    definition:
      "An IRS form that individuals who are not US tax residents fill in and give to their broker. A Turkish resident who provides it can claim benefits under the US-Turkey tax treaty, which lowers withholding on portfolio dividends from the default 30% to 20%. The form is generally valid until the end of the third calendar year after the year it is signed, and must be replaced sooner if your address or tax residency changes. Rates and thresholds can change; check with a tax adviser.",
    example:
      "On a gross US dividend of $100, a valid W-8BEN means $20 is withheld and $80 reaches your account. Without the form, $30 is withheld and $70 is left.",
    match: ["W-8BEN"],
  },
  "form-1042-s": {
    term: "Form 1042-S",
    definition:
      "An annual statement a broker or other payer sends to foreign persons who received US-source income. It shows the gross income paid during the year, such as dividends, the withholding rate applied and the amount of US tax withheld. It is sent by March 15 each year. In the Turkish tax return it serves as evidence of the tax already paid abroad. Rates and thresholds can change; check with a tax adviser.",
    match: ["1042-S", "Form 1042-S"],
  },
  "stopaj": {
    term: "Withholding Tax",
    definition:
      "Tax taken out by the payer at the moment income is paid and passed on to the tax authority, so the investor receives the net amount. With US stocks it is withheld from dividends: for a Turkish resident who has filed a W-8BEN the rate on portfolio dividends is 20%, and 30% without the form. The US generally does not withhold tax on stock sale gains of investors who are not US residents. Rates and thresholds can change; check with a tax adviser.",
    example:
      "If you own 100 shares of a company paying a $1 dividend per share, with a W-8BEN $20 is withheld and $80 reaches your account.",
    match: ["withholding tax", "dividend withholding"],
  },
  "cifte-vergilendirmeyi-onleme": {
    term: "Double Taxation Treaty",
    definition:
      "An agreement between two countries to prevent the same income from being fully taxed twice; it sets which country may tax which income and at what rate. The US-Turkey treaty caps US withholding on a Turkish resident's portfolio dividends at 20%. The tax withheld in the US can be credited against the tax computed in the Turkish return, up to the Turkish tax attributable to that income. Rates and thresholds can change; check with a tax adviser.",
    match: ["double taxation treaty", "double tax treaty", "tax treaty", "double taxation"],
  },
  "beyanname": {
    term: "Turkish Income Tax Return",
    definition:
      "The annual return in which income earned in Turkey's tax year, the calendar year, is reported to the tax authority in March of the following year. Gains from selling foreign stocks and foreign dividends may have to be included, depending on amounts and conditions. Tax withheld abroad can be documented and credited in the return within limits; Form 1042-S is one such document. Rates and thresholds can change; check with a tax adviser.",
    match: ["Turkish tax return", "Turkish income tax return"],
  },
  "deger-artis-kazanci": {
    term: "Capital Gain (Değer Artış Kazancı)",
    definition:
      "The Turkish tax term for gains from disposing of assets such as securities. For a stock listed abroad, the gain is calculated in Turkish lira: the sale price is converted at the exchange rate on the sale date, the purchase price at the rate on the purchase date, and the difference is the gain. That means a rise in the exchange rate can create a lira gain even when you made nothing in dollar terms. Rates and thresholds can change; check with a tax adviser.",
    example:
      "You bought 10 shares at $100 when the rate was 30 lira (cost 30,000 lira) and sold them at $120 when it was 35 lira (proceeds 42,000 lira). The dollar gain is $200; the lira gain before indexation is 12,000 lira.",
    match: ["değer artış kazancı"],
  },
  "yi-ufe-endekslemesi": {
    term: "Yİ-ÜFE Indexation",
    definition:
      "Raising the purchase cost for inflation when a Turkish capital gain is calculated. If the domestic producer price index (Yİ-ÜFE) rose by at least 10% from the month before the purchase to the month before the sale, the cost is increased by that rate and only the remaining gain is taxable. If the rise is below 10%, no indexation applies. Rates and thresholds can change; check with a tax adviser.",
    example:
      "Say your lira cost is 30,000 and your sale proceeds are 42,000 lira. If Yİ-ÜFE rose 25% over the period, the indexed cost is 37,500 lira and the taxable gain is 4,500 lira. If the index rose only 8%, the cost stays at 30,000 lira.",
    match: ["Yİ-ÜFE indexation", "cost indexation"],
  },
  "kur-farki": {
    term: "Currency Effect",
    definition:
      "The change in the lira value of a foreign-currency asset caused only by a move in the exchange rate. A US stock that does not move at all in dollars shows a lira gain as the dollar strengthens against the lira, and a loss when it weakens. Because Turkish tax on foreign stock sales is calculated in lira, this effect also flows into the taxable gain. Rates and thresholds can change; check with a tax adviser.",
    example:
      "Say a $100 stock is still $100 a year later. If the exchange rate went from 30 to 35 lira over that time, the holding's lira value rose from 3,000 to 3,500.",
    match: ["currency effect", "exchange rate gain"],
  },
};
