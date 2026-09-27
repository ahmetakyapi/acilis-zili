/* Glossary — Filings & Insiders (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_ICERIDEN: GlossaryTexts<"iceriden"> = {
  "sec": {
    term: "Securities and Exchange Commission (SEC)",
    definition:
      "The federal agency that regulates and oversees US securities markets, created by the Securities Exchange Act of 1934. Public companies file their quarterly and annual reports with the SEC, as do insiders reporting their trades and large investors disclosing their positions. All of these filings are published free to the public in the agency's EDGAR database.",
    match: ["SEC", "Securities and Exchange Commission"],
  },
  "iceriden-islem": {
    term: "Insider Trading",
    definition:
      "Buying and selling of a company's shares by its officers, directors or shareholders who own more than 10% of the stock. These trades are legal in the US and are reported to the SEC on Form 4. Trading on material information that has not been made public is illegal and a different matter. Investors often explain insider sales by ordinary reasons such as taxes, diversification or pre-arranged selling plans, while several executives buying with their own money tends to draw more attention.",
    match: ["insider trading", "insider buying", "insider selling"],
  },
  "form-4": {
    term: "Form 4",
    definition:
      "The form officers, directors and owners of more than 10% of a company's shares use to report changes in their holdings to the SEC. It must be filed within two business days of the transaction. It lists the date, number of shares, price and type of each transaction; code P marks an open-market purchase and S a sale, while stock awards and option exercises have codes of their own.",
    example:
      "If a director buys shares in the open market on a Monday, the Form 4 is due by Wednesday, barring a holiday.",
    match: ["Form 4"],
  },
  "form-13f": {
    term: "Form 13F",
    definition:
      "A quarterly report filed with the SEC by institutional investment managers holding $100 million or more in 13(f) securities, mainly stocks traded on US exchanges. It is due within 45 days after the end of each quarter. It shows long positions only, not short sales, and because it can arrive up to 45 days late, it is a snapshot of the portfolio at quarter end rather than what the fund holds today.",
    match: ["13F", "Form 13F"],
  },
  "form-13d": {
    term: "Schedule 13D",
    definition:
      "The filing an investor makes with the SEC after acquiring more than 5% of a company's voting shares. It states who bought how much, where the money came from and what the investor intends, for example whether they plan to push for changes at the company, and it must be amended when material facts change. Passive investors with no intent to influence the company can, under certain conditions, file the shorter Schedule 13G instead. That is why a 13D is watched as the moment an activist investor steps onto the stage.",
    match: ["Schedule 13D", "13D", "Schedule 13G", "13G"],
  },
  "kilitlenme-suresi": {
    term: "Lock-Up Period",
    definition:
      "The period after an IPO during which executives, employees and pre-IPO investors cannot sell their shares. It is not a legal requirement but a contract with the underwriters, and it most often lasts 180 days. Because the number of shares that can be sold may jump when it ends, the expiration date is watched by the market.",
    match: ["lock-up period", "lockup period", "lock-up expiration"],
  },
  "hisse-bazli-odeme": {
    term: "Stock-Based Compensation (SBC)",
    definition:
      "Paying employees partly in restricted stock units (RSUs) or stock options. Under US accounting standards (GAAP) it is recorded as an expense, but since no cash leaves the company it is added back to net income in the cash flow statement, and many companies exclude it from their adjusted earnings. Its cost reaches shareholders as dilution, which is why companies often try to offset it with buybacks.",
    match: ["stock-based compensation", "share-based compensation", "SBC", "RSU"],
  },
};
