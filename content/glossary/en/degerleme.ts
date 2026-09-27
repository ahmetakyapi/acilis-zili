/* Glossary — Valuation & Fundamentals (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_DEGERLEME: GlossaryTexts<"degerleme"> = {
  "fk": {
    term: "Price-to-Earnings Ratio (P/E)",
    definition:
      "The share price divided by earnings per share. It tells you how many dollars the market is paying today for one dollar of annual profit. Computed on the last twelve months of earnings it is the trailing P/E; on analysts' estimates for the coming year it is the forward P/E. A high P/E is not automatically expensive, since the market may be pricing in fast growth, so the ratio is best read against peers in the same sector and against the company's own history.",
    example:
      "A stock at $100 with annual earnings per share of $5 has a P/E of 20. If earnings never changed, it would take 20 years of profit to earn back the price you paid.",
    match: ["P/E", "price-to-earnings", "price/earnings"],
  },
  "pd-dd": {
    term: "Price-to-Book Ratio (P/B)",
    definition:
      "A company's market capitalization divided by its shareholders' equity, or book value. It shows how many times the net assets on the company's books the market is willing to pay. It is most meaningful for businesses whose assets are largely financial, such as banks; for companies whose value sits mostly in brands, intellectual property and people, such as software firms, the ratio naturally runs high.",
    example:
      "A company with a market cap of $50 billion and shareholders' equity of $25 billion has a P/B of 2.",
    match: ["P/B", "price-to-book"],
  },
  "fd-favok": {
    term: "EV/EBITDA",
    definition:
      "Enterprise value divided by annual EBITDA. Unlike the P/E, it takes a company's debt into account, so it lets you compare indebted and debt-free companies on the same scale. A lower multiple suggests the business is priced more cheaply relative to its operating profit, but typical levels differ widely from sector to sector.",
    example:
      "A company with a $100 billion market cap, $30 billion of debt and $10 billion of cash has an enterprise value of $120 billion. With annual EBITDA of $12 billion, its EV/EBITDA is 10.",
    match: ["EV/EBITDA"],
  },
  "peg-orani": {
    term: "PEG Ratio",
    definition:
      "The P/E ratio divided by the expected annual growth rate of earnings per share, expressed in percent. It puts a fast grower's high P/E in the context of its growth. As a rough rule of thumb, a PEG around 1 is read as a fair price for the growth, but the denominator is a forecast, and if the forecast is wrong the ratio misleads.",
    example:
      "A company with a P/E of 30 and expected earnings growth of 15% a year has a PEG of 30 / 15 = 2.",
    match: ["PEG ratio", "PEG"],
  },
  "fiyat-satis-orani": {
    term: "Price-to-Sales Ratio (P/S)",
    definition:
      "Market capitalization divided by annual revenue. It is used for companies that are not yet profitable, or whose profits swing too much for a P/E to be useful. Because it ignores profitability entirely, a low-margin business and a high-margin business cannot be compared on this ratio alone.",
    example:
      "A company with a market cap of $20 billion and annual revenue of $5 billion has a P/S of 4.",
    match: ["P/S", "price-to-sales"],
  },
  "hisse-basi-kar": {
    term: "Earnings per Share (EPS)",
    definition:
      "Net income for the period (after any preferred dividends) divided by the weighted average number of shares outstanding. It shows how much profit falls to a single share and is the denominator of the P/E ratio. It is the most watched number on earnings day: the market compares the reported figure with analysts' expectations.",
    example:
      "A company with net income of $1 billion and an average of 500 million shares outstanding has EPS of $2.",
    match: ["EPS", "earnings per share"],
  },
  "seyreltilmis-hisse-basi-kar": {
    term: "Diluted EPS",
    definition:
      "Earnings per share calculated as if everything that could turn into shares (employee stock options, restricted stock units, convertible bonds) already had. Because the share count is larger, diluted EPS is equal to or lower than basic EPS. US public companies report both figures on the income statement; the wider the gap between them, the greater the potential dilution.",
    example:
      "With net income of $1 billion and 500 million shares outstanding, basic EPS is $2. Add 20 million shares' worth of options and the denominator becomes 520 million, bringing diluted EPS to about $1.92.",
    match: ["diluted EPS", "diluted earnings per share"],
  },
  "gelir": {
    term: "Revenue",
    definition:
      "The total amount a company takes in from its main business, selling goods and services, over a period; it is reported net of returns and discounts, which is why it is also called net sales. It is the first line of the income statement, before any costs are subtracted. Revenue growth reflects demand, while how much of it is left over reflects profitability, and the two are read together.",
    match: ["net sales", "total revenue", "top line"],
  },
  "brut-kar-marji": {
    term: "Gross Margin",
    definition:
      "Gross profit (revenue minus the cost of goods sold) as a percentage of revenue. It shows how much it costs to make the product or deliver the service, and so hints at pricing power. It is naturally high in industries like software and low in industries like retail, so the most meaningful comparison is within the same sector and against the company's own history.",
    example:
      "With revenue of $100 million and cost of goods sold of $60 million, gross profit is $40 million and the gross margin is 40%.",
    match: ["gross margin", "gross profit margin"],
  },
  "faaliyet-kar-marji": {
    term: "Operating Margin",
    definition:
      "Operating income, what remains after operating expenses such as research and development, marketing and general administration are subtracted from gross profit, as a percentage of revenue. Because interest and taxes have not yet been deducted, it shows how efficiently the core business runs. If the margin widens while revenue grows, costs are growing more slowly than sales.",
    example:
      "With revenue of $100 million, gross profit of $40 million and operating expenses of $25 million, operating income is $15 million and the operating margin is 15%.",
    match: ["operating margin"],
  },
  "net-kar-marji": {
    term: "Net Profit Margin",
    definition:
      "Net income, what remains after interest, taxes and every other expense, as a percentage of revenue. It shows how many dollars out of every $100 of sales are left for shareholders. One-time gains or charges can inflate or depress it for a single period, so looking at several quarters together gives a truer picture.",
    example:
      "A company with revenue of $100 million and net income of $10 million has a net profit margin of 10%.",
    match: ["net profit margin", "net margin"],
  },
  "favok": {
    term: "EBITDA",
    definition:
      "Earnings before interest, taxes, depreciation and amortization: net income with interest expense, taxes, and depreciation and amortization added back. Because it strips out differences in debt and taxes, it is widely used to compare companies. It is not a line item defined under US accounting standards (GAAP) and it ignores capital spending entirely, so it is not a substitute for a company's ability to generate cash.",
    example:
      "With net income of $50 million, interest expense of $10 million, taxes of $15 million and depreciation of $25 million, EBITDA is $100 million.",
    match: ["EBITDA"],
  },
  "gaap-disi": {
    term: "Non-GAAP Measures",
    definition:
      "Figures that start from results under US accounting standards (GAAP) and adjust them by removing or adding items the company chooses; adjusted EPS is the most common example. Stock-based compensation, restructuring costs and one-time items are the usual exclusions. The SEC requires companies to present the most directly comparable GAAP figure alongside, with a reconciliation explaining the difference. Analyst estimates are often built on the adjusted numbers, but many of the excluded costs are real costs.",
    match: ["non-GAAP", "adjusted EPS", "adjusted earnings"],
  },
  "isletme-nakit-akisi": {
    term: "Operating Cash Flow",
    definition:
      "The net cash a company's core operations bring in over a period. It starts from net income, adds back non-cash expenses such as depreciation and stock-based compensation, and adjusts for changes in receivables, inventory and payables. A persistent and growing gap between net income and operating cash flow raises questions about the quality of earnings.",
    match: ["operating cash flow", "cash from operations", "cash flow from operations"],
  },
  "serbest-nakit-akisi": {
    term: "Free Cash Flow (FCF)",
    definition:
      "Operating cash flow minus capital expenditures. It is the cash left after the company has spent what it needs to keep the business running and growing, available for dividends, buybacks, debt repayment or acquisitions. Because it is less affected by accounting choices than earnings, it is widely used in valuation.",
    example:
      "A company with operating cash flow of $8 billion and capital expenditures of $3 billion has free cash flow of $5 billion.",
    match: ["free cash flow", "FCF"],
  },
  "sermaye-harcamasi": {
    term: "Capital Expenditure (Capex)",
    definition:
      "Money a company spends on long-lived assets such as factories, equipment or data centers. It appears in the investing section of the cash flow statement; rather than being expensed all at once on the income statement, it is spread over the years as depreciation. Heavy capex can be an investment in future growth, but it reduces free cash flow today.",
    match: ["capital expenditure", "capex"],
  },
  "iskontolu-nakit-akisi": {
    term: "Discounted Cash Flow (DCF)",
    definition:
      "A valuation method that estimates a company's future free cash flows and discounts them back to today at a chosen rate, then adds them up. The core idea is that a dollar today is worth more than a dollar several years from now. A terminal value is added for the years beyond the forecast period. The result is very sensitive to the growth and discount rate assumptions: a small change in an assumption can move the value a great deal.",
    example:
      "$110 received one year from now is worth $100 today at a 10% discount rate (110 / 1.10).",
    match: ["discounted cash flow", "DCF"],
  },
  "ozsermaye-karliligi": {
    term: "Return on Equity (ROE)",
    definition:
      "Net income divided by shareholders' equity, usually the average equity over the period. It shows how much profit the company generates with the capital shareholders have put in and left in the business. Heavy borrowing shrinks equity and can inflate the ratio artificially, so it should be read alongside the debt-to-equity ratio.",
    example:
      "A company with annual net income of $2 billion and average equity of $10 billion has an ROE of 20%.",
    match: ["return on equity", "ROE"],
  },
  "aktif-karliligi": {
    term: "Return on Assets (ROA)",
    definition:
      "Net income divided by total assets. It shows how efficiently the company uses everything it owns, whether financed by equity or by debt. It is naturally low for businesses with a very large asset base, such as banks, so comparisons should stay within the same sector.",
    example:
      "A company with net income of $2 billion and total assets of $40 billion has an ROA of 5%.",
    match: ["return on assets", "ROA"],
  },
  "borc-ozsermaye-orani": {
    term: "Debt-to-Equity Ratio (D/E)",
    definition:
      "A company's debt divided by its shareholders' equity, showing how much of the business is financed with borrowed money. Some sources count only financial debt, others all liabilities, so check that two companies are measured the same way before comparing them. A high ratio magnifies risk when interest rates rise or profits fall. For companies whose equity has turned negative through buybacks, the ratio loses its meaning.",
    example:
      "A company with total debt of $30 billion and equity of $60 billion has a debt-to-equity ratio of 0.5.",
    match: ["debt-to-equity", "D/E"],
  },
  "cari-oran": {
    term: "Current Ratio",
    definition:
      "Current assets (cash, receivables, inventory and other assets expected to turn into cash within a year) divided by current liabilities. It shows whether the company can cover the obligations due over the next year with its short-term assets. A ratio above 1 means short-term liabilities are covered, but what counts as comfortable varies by industry.",
    example:
      "A company with current assets of $15 billion and current liabilities of $10 billion has a current ratio of 1.5.",
    match: ["current ratio"],
  },
  "defter-degeri": {
    term: "Book Value",
    definition:
      "Total assets minus total liabilities, which equals shareholders' equity on the balance sheet. Divided by the number of shares, it gives book value per share. Because assets are mostly recorded at historical cost, book value shows the net worth in the accounting records rather than what the company would fetch in the market.",
    example:
      "A company with $100 billion of assets and $70 billion of liabilities has a book value of $30 billion. With 1 billion shares, book value per share is $30.",
    match: ["book value"],
  },
  "piyasa-degeri": {
    term: "Market Capitalization",
    definition:
      "The share price multiplied by the total number of shares outstanding. It is the price the market puts on the whole company at that moment and changes with every tick of the stock. It is the most common way to rank companies by size, and indexes such as the S&P 500 weight their members by it.",
    example:
      "A company with a $50 share price and 2 billion shares outstanding has a market cap of $100 billion.",
    match: ["market capitalization", "market cap"],
  },
  "firma-degeri": {
    term: "Enterprise Value (EV)",
    definition:
      "Market capitalization plus the company's debt, minus its cash and cash equivalents; some calculations also add preferred stock and minority interests. It approximates what a buyer would have to pay to acquire the whole business, debt included. That is why ratios that compare companies with different debt loads, such as EV/EBITDA, use it instead of market cap.",
    example:
      "A company with a market cap of $100 billion, $30 billion of debt and $10 billion of cash has an enterprise value of $120 billion.",
    match: ["enterprise value"],
  },
  "temettu": {
    term: "Dividend",
    definition:
      "A cash payment a company makes to its shareholders out of its profits. In the US the board of directors declares dividends, and most companies pay them quarterly. To receive a dividend you must buy the stock before the ex-dividend date; on the ex-date the share price usually opens lower by roughly the amount of the dividend.",
    example:
      "A company paying a quarterly dividend of $0.50 per share pays $2 per share a year.",
    match: ["dividend"],
  },
  "temettu-verimi": {
    term: "Dividend Yield",
    definition:
      "The annual dividend per share divided by the share price. It shows what percentage cash return someone buying at today's price would earn from dividends alone. The yield rises as the price falls, so an unusually high yield sometimes signals that the market expects the dividend to be cut.",
    example:
      "A stock trading at $80 that pays $2 a year in dividends has a dividend yield of 2.5%.",
    match: ["dividend yield"],
  },
  "temettu-dagitim-orani": {
    term: "Dividend Payout Ratio",
    definition:
      "Dividends paid as a share of net income. It shows how much of what the company earns goes to shareholders and how much is reinvested in the business. A ratio that stays above 100% for long means the dividend is being funded from accumulated cash or borrowing rather than from earnings, which is why some investors also calculate it against free cash flow.",
    example:
      "A company with EPS of $5 that pays $2 per share in dividends has a payout ratio of 40%.",
    match: ["dividend payout ratio", "payout ratio"],
  },
  "hisse-geri-alimi": {
    term: "Share Buyback",
    definition:
      "A company buying its own shares in the market. With fewer shares outstanding, each remaining share claims a larger slice of profit, so earnings per share rises even if net income stays the same. It is an alternative to dividends for returning cash to shareholders. Announcing a buyback program does not oblige the company to spend the full amount.",
    example:
      "If a company with net income of $1 billion cuts its share count from 500 million to 480 million, EPS rises from $2.00 to about $2.08.",
    match: ["share buyback", "stock buyback", "share repurchase", "buyback"],
  },
  "hisse-seyrelmesi": {
    term: "Share Dilution",
    definition:
      "The shrinking of existing shareholders' ownership stake when a company issues new shares and the share count rises. Stock offerings, shares and options granted to employees, and conversions of convertible debt are the main sources. Because the same profit is split across more shares, earnings per share comes under pressure too.",
    example:
      "If a company with 100 million shares issues 5 million new ones, an investor holding 1 million shares sees their stake fall from 1% to about 0.95%.",
    match: ["share dilution", "shareholder dilution"],
  },
};
