/* Glossary — Earnings Season (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_BILANCO: GlossaryTexts<"bilanco"> = {
  "bilanco-sezonu": {
    term: "Earnings Season",
    definition:
      "Earnings season is the stretch of a few weeks in which public companies report the results of the quarter that just ended, one after another. In the US it starts a few weeks after each quarter ends, usually with the big banks, and most S&P 500 companies report within roughly the following six weeks. Companies mostly release results before the open or after the close, so the sharpest price moves tend to happen outside regular hours and at the next open. Over the season, individual results are also read as clues about sectors and the broader economy.",
    match: ["earnings season"],
  },
  "mali-ceyrek": {
    term: "Fiscal Quarter",
    definition:
      "A fiscal quarter is one of the three-month blocks of a company's fiscal year, referred to as Q1, Q2, Q3 and Q4. For a company whose fiscal year matches the calendar year, the first quarter runs from January through March. For a company whose fiscal year ends in a different month, quarter names do not line up with calendar quarters. So before comparing two companies' \"third quarter\" results, check which months each one covers.",
    match: ["fiscal quarter"],
  },
  "mali-yil": {
    term: "Fiscal Year",
    definition:
      "A fiscal year is the twelve-month period a company uses for its annual financial reporting. For many companies it matches the calendar year, but some end it in a different month to fit their business cycle. A fiscal year is usually named after the calendar year in which it ends, which can put fiscal year labels ahead of the calendar.",
    example:
      "For a company whose fiscal year ends in late September, fiscal 2026 runs from October 2025 through September 2026. What that company calls \"the first quarter of 2026\" is October through December 2025.",
    match: ["fiscal year"],
  },
  "konsensus": {
    term: "Consensus Estimate",
    definition:
      "The consensus estimate is the average or median of forecasts that analysts covering a company make for items such as earnings per share and revenue. Data providers collect and publish these forecasts, and the figure can differ slightly by source. On earnings day results are compared with this number: the stock reacts not to the result in absolute terms but to where it lands against expectations. When expectations are already high, even a good result can count as a disappointment.",
    match: ["consensus estimate", "consensus expectation", "analyst consensus", "Wall Street consensus"],
  },
  "eps-surprizi": {
    term: "Earnings Surprise",
    definition:
      "An earnings surprise is how far reported earnings per share land from the consensus estimate, usually stated as a percentage. A result above consensus is called a beat, one below it a miss. Historically most companies beat, so a small beat may not surprise the market at all. The price reaction depends not just on this number but on revenue, margins and guidance too; stocks that beat and still fall are common.",
    example:
      "If consensus EPS was $2.00 and the company reports $2.10, the surprise is (2.10 - 2.00) / 2.00 = 5%.",
    match: ["earnings surprise", "EPS surprise", "earnings beat", "earnings miss"],
  },
  "rehberlik": {
    term: "Guidance",
    definition:
      "Guidance is management's own forecast for the coming quarter or fiscal year for items such as revenue, earnings or margins, usually given as a range. It is not legally required and not every company provides it. Markets compare guidance with the consensus estimate: even after a strong quarter, the stock can fall if guidance comes in below expectations. Raising or cutting guidance often moves the price more than the results themselves.",
    match: ["earnings guidance", "revenue guidance", "full-year guidance", "company guidance"],
  },
  "bilanco-toplantisi": {
    term: "Earnings Call",
    definition:
      "An earnings call is a conference call or webcast that management holds shortly after releasing results, open to analysts and investors. It usually starts with prepared remarks from management and continues with questions from analysts. The reasons behind the numbers, the rationale for guidance and management's tone come out here. The stock can change direction during the call, after the results themselves are already out.",
    match: ["earnings call", "earnings conference call"],
  },
  "yillik-bazda": {
    term: "Year over Year (YoY)",
    definition:
      "Year over year compares a period's figure with the same period a year earlier. For quarterly results, this quarter is compared with the same quarter last year. Because each season is compared with itself, seasonal effects, such as holiday shopping lifting the fourth quarter every year, largely cancel out.",
    example:
      "If revenue was $100 million in last year's third quarter and $120 million in this year's third quarter, revenue grew 20% year over year.",
    match: ["year over year", "year-over-year", "YoY"],
  },
  "ceyreklik-bazda": {
    term: "Quarter over Quarter (QoQ)",
    definition:
      "Quarter over quarter compares a quarter's figure with the quarter immediately before it. It shows recent momentum faster than a year-over-year comparison. But it is exposed to seasonal effects: for a retailer whose fourth quarter is strong every year, a drop in the first quarter need not mean business is deteriorating.",
    example:
      "If revenue was $110 million in the second quarter and $120 million in the third, the quarter-over-quarter increase is about 9.1%.",
    match: ["quarter over quarter", "quarter-over-quarter", "QoQ"],
  },
  "form-10-q": {
    term: "Form 10-Q",
    definition:
      "The 10-Q is the quarterly report US public companies file with the SEC for the first three quarters of their fiscal year; the fourth quarter is covered in the annual 10-K. It contains the financial statements, management's discussion and analysis, and material changes in risks. The statements are reviewed by the independent auditor but not fully audited. Depending on the company's size it is due within 40 or 45 days of quarter-end, and anyone can read it on the SEC's EDGAR system.",
    match: ["Form 10-Q", "10-Q"],
  },
  "form-10-k": {
    term: "Form 10-K",
    definition:
      "The 10-K is the annual report US public companies file with the SEC and the most comprehensive official document about a company. It includes audited financial statements, a description of the business, risk factors and management's discussion and analysis. Depending on the company's size it is due within 60 to 90 days of fiscal year-end. Non-US companies that qualify as foreign private issuers generally file a Form 20-F instead.",
    match: ["Form 10-K", "10-K"],
  },
  "form-8-k": {
    term: "Form 8-K",
    definition:
      "The 8-K is a current report a company files with the SEC when a significant event occurs that investors should know about. Events such as a change in senior management, an acquisition or a bankruptcy filing fall under it, and most must be reported within four business days. Companies also usually furnish their quarterly earnings releases to the SEC on an 8-K, so on earnings day the first official filing is often an 8-K rather than the 10-Q.",
    match: ["Form 8-K", "8-K"],
  },
  "hak-dusum-tarihi": {
    term: "Ex-Dividend Date",
    definition:
      "The ex-dividend date is the first trading day on which a buyer of the stock is not entitled to an announced dividend. Since US settlement moved to T+1 in May 2024, for regular cash dividends the ex-dividend date falls on the same business day as the record date. To receive the dividend you must buy the stock no later than the trading day before the ex-dividend date. On the ex-dividend date, all else equal, the stock usually starts trading from a reference price lower by about the dividend amount.",
    example:
      "If a $1 per-share dividend has been declared and the stock closed at $100 the day before the ex-date, the reference price on the ex-date is about $99. Ignoring taxes, the total value for an investor who receives the dividend does not change.",
    match: ["ex-dividend date", "ex-dividend", "ex-date"],
  },
  "kayit-tarihi": {
    term: "Record Date",
    definition:
      "The record date is the date a company uses to determine which shareholders receive a dividend: everyone on the company's books as a shareholder that day gets paid. The board sets it when declaring the dividend, and payment usually follows days or weeks later. With T+1 settlement in the US, buying on the record date itself is too late because the trade settles the next business day, so for investors the date that matters is the ex-dividend date.",
    match: ["record date", "date of record"],
  },
};
