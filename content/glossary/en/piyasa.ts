/* Glossary — Market Mechanics (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_PIYASA: GlossaryTexts<"piyasa"> = {
  "alis-satis-fiyati": {
    term: "Bid and Ask",
    definition:
      "The bid is the highest price buyers are currently willing to pay for a stock; the ask is the lowest price sellers are currently willing to accept. The last price on your screen is simply where the previous trade happened. A market order to buy usually fills near the ask, and a market order to sell usually fills near the bid.",
    example:
      "If the bid is $99.98 and the ask is $100.02, a market buy pays about $100.02, while someone selling right away receives about $99.98.",
    match: ["bid price", "ask price", "bid and ask"],
  },
  "spread": {
    term: "Bid-Ask Spread",
    definition:
      "The bid-ask spread is the gap between the ask and the bid. If you buy and immediately sell, you lose that gap, so the spread is a hidden cost of trading. It is often just a cent or two in heavily traded large caps and widens in thinly traded stocks, in pre-market trading and after hours.",
    example:
      "With a bid of $49.90 and an ask of $50.10, the spread is 20 cents. Buying 100 shares and selling them straight back costs about $20 even if the price never moves.",
    match: ["bid-ask spread", "bid/ask spread", "bid and ask spread"],
  },
  "likidite": {
    term: "Liquidity",
    definition:
      "Liquidity is how quickly and easily an asset can be bought or sold without moving its price much. A liquid stock has many buyers and sellers at any moment, a tight spread, and large orders barely shift the price. In an illiquid stock it is harder to trade at the price you want, and even small orders can move the price noticeably.",
    match: ["liquidity"],
  },
  "piyasa-yapici": {
    term: "Market Maker",
    definition:
      "A market maker is a firm that continuously quotes both a bid and an ask for a stock and stands ready to trade on either side. Much of its income comes from the difference between those two prices, and in return it supplies liquidity. On the NYSE each stock has an assigned designated market maker, while on Nasdaq several market makers compete in the same stock.",
    match: ["market maker"],
  },
  "islem-hacmi": {
    term: "Trading Volume",
    definition:
      "Trading volume is the number of shares that change hands over a period, usually reported per day. On its own it says little; it is read against the stock's own average. A price move on volume well above average reflects the decisions of more participants than a move on light volume.",
    example:
      "If a stock normally trades 2 million shares a day and trades 8 million on earnings day, volume ran at four times its average.",
    match: ["trading volume"],
  },
  "on-seans": {
    term: "Pre-Market Trading",
    definition:
      "Pre-market trading is trading in US stocks before the regular session opens. At many brokers it runs from 4:00 a.m. to the 9:30 a.m. open, New York time, though hours vary by broker. Fewer participants mean lower liquidity and wider spreads, and many brokers accept only limit orders. Overnight news and earnings released before the open show up here first, but a pre-market price does not guarantee where the stock will open.",
    match: ["pre-market", "premarket"],
  },
  "kapanis-sonrasi": {
    term: "After-Hours Trading",
    definition:
      "After-hours trading is buying and selling after the regular session closes at 4:00 p.m. New York time, typically until 8:00 p.m. Many companies report earnings in exactly this window, so sharp moves are common. As in the pre-market, liquidity is thin, spreads are wide, and prices do not reliably predict the next day's open.",
    match: ["after-hours trading", "after-hours session"],
  },
  "devre-kesici": {
    term: "Circuit Breaker",
    definition:
      "A circuit breaker is a rule that temporarily halts trading during a sharp decline. US market-wide circuit breakers track the S&P 500's drop from the previous close: a 7% or 13% decline halts trading for 15 minutes (these two levels do not halt trading at or after 3:25 p.m. New York time), and a 20% decline closes trading for the rest of the day. Individual stocks also have a separate mechanism that briefly pauses trading in that stock after an extreme move over a short period.",
    match: ["circuit breaker"],
  },
  "araci-kurum": {
    term: "Brokerage",
    definition:
      "A brokerage is the firm that routes your orders to exchanges or other trading venues and holds the shares and cash in your account. Investors in Turkey reach US stocks either through a domestic brokerage's international service or by opening an account directly with a foreign broker. Brokerages differ in commissions, currency conversion costs, custody fees and the order types they offer.",
    match: ["brokerage", "broker-dealer"],
  },
  "t-1-takas": {
    term: "T+1 Settlement",
    definition:
      "T+1 means a stock trade settles, with shares and cash formally changing hands, one business day after the trade date. The US stock market moved from T+2 to T+1 in May 2024. The practical consequence for dividends: to receive one, you need to have bought the stock by the close of the business day before the ex-dividend date.",
    example:
      "Shares sold on a Tuesday settle on Wednesday, and your broker can treat that cash as settled from then on.",
    match: ["T+1"],
  },
  "kesirli-hisse": {
    term: "Fractional Share",
    definition:
      "A fractional share is ownership of part of a share rather than a whole one. The exchange does not offer this, your broker does: it holds whole shares and records your slice in your account. It makes it easier to buy expensive stocks with small amounts, but at some brokers fractional shares cannot be transferred to another broker and order types may be limited.",
    example:
      "With the stock at $400, $100 buys 0.25 shares; if the stock rises 10%, your slice is worth $110.",
    match: ["fractional share"],
  },
  "piyasa-emri": {
    term: "Market Order",
    definition:
      "A market order is an instruction to buy or sell immediately at the best price available, without naming a price. It is almost certain to execute, but the price is not guaranteed. In fast-moving or thinly traded stocks, or in the pre-market, it can fill noticeably away from the price you saw on screen.",
    match: ["market order"],
  },
  "limit-emir": {
    term: "Limit Order",
    definition:
      "A limit order sets the highest price you will pay when buying or the lowest price you will accept when selling. It executes only at that price or better, and if the market never gets there it may not execute at all. In short, it guarantees the price, not the fill.",
    example:
      "With the stock at $52, a limit buy at $50 waits until the price reaches $50 or lower.",
    match: ["limit order"],
  },
  "stop-emir": {
    term: "Stop Order",
    definition:
      "A stop order waits until the stock trades at a price you set and then becomes a market order; it is mostly used on the sell side to limit losses. Because it turns into a market order, a fill at the stop price is not guaranteed. A stop-limit order becomes a limit order instead when triggered: it caps the price but may not fill.",
    example:
      "You own a $50 stock with a stop sell at $45. If bad news hits overnight and the stock opens at $40, the order triggers but fills near $40, not $45.",
    match: ["stop order", "stop-loss order", "stop-loss"],
  },
  "aciga-satis": {
    term: "Short Selling",
    definition:
      "Short selling means borrowing shares you do not own from your broker, selling them, and later buying them back to return; it is done in the expectation that the price will fall. If the price falls, the difference is your gain; if it rises, it is your loss, and because there is no ceiling on how high a price can go, the potential loss is theoretically unlimited. It requires a margin account, you pay a borrow fee, and any dividends paid while the position is open go to the lender at your expense.",
    example:
      "Short at $100 and buy back at $80, and you make $20 per share before costs. If the stock instead rises to $130, buying back costs you $30 per share.",
    match: ["short selling", "short sale", "short position"],
  },
  "kisa-sikisma": {
    term: "Short Squeeze",
    definition:
      "A short squeeze happens when a heavily shorted stock rises and short sellers are forced to buy shares back to cut their losses, and that buying pushes the price even higher. Short interest as a percentage of the float, and days to cover (short interest divided by average daily volume), are the usual gauges of the risk. In the US, short interest data is published twice a month, so it is never real time.",
    match: ["short squeeze"],
  },
  "marj-hesabi": {
    term: "Margin Account",
    definition:
      "A margin account lets you borrow from your broker against the securities in your account, and you pay interest on the loan. In the US you can generally borrow up to half of a purchase at the outset, and your equity in the account must stay above a maintenance level (at least 25% under the rules, and brokers often require more). If it falls below that, the broker issues a margin call for more collateral, and if you do not meet it, it can sell your positions for you.",
    match: ["margin account", "margin call", "buying on margin"],
  },
  "kaldirac": {
    term: "Leverage",
    definition:
      "Leverage is using borrowed money or derivatives to hold a position larger than your own capital. It magnifies gains and losses alike: with 2x leverage, a 10% price move becomes roughly a 20% move on your own money, and the interest on the loan is an extra cost. Applied to companies, it describes how much of the business is financed with debt.",
    example:
      "You put in $10,000, borrow another $10,000 and buy $20,000 of stock. If the stock falls 25%, the position is worth $15,000, the loan is still $10,000, and your stake has halved to $5,000.",
    match: ["financial leverage", "leveraged"],
  },
  "halka-arz": {
    term: "Initial Public Offering (IPO)",
    definition:
      "An IPO is the first time a company offers its shares for sale to the public on a stock exchange. The price is set by the underwriting investment banks based on demand collected from institutional investors, and from the first trading day the stock trades freely. Early trading can be volatile, and the end of the lock-up period that restricts existing holders from selling can weigh on the price.",
    match: ["IPO", "initial public offering"],
  },
  "spac": {
    term: "Special Purpose Acquisition Company (SPAC)",
    definition:
      "A SPAC is a company with no operating business that raises money in an IPO in order to merge with a private company within a set time. The money sits in a trust account until a deal closes, and if no deal happens in time it is returned to investors. The merger takes the target public without a traditional IPO, while the cheap shares granted to the sponsors can dilute other shareholders.",
    match: ["SPAC", "blank-check company"],
  },
  "adr": {
    term: "American Depositary Receipt (ADR)",
    definition:
      "An ADR is a certificate that represents shares of a non-US company and trades in the US in dollars; a US depositary bank holds the underlying shares and issues ADRs against them. One ADR need not equal one share: the ratio can be several shares or a fraction of one. Dividends are converted into dollars, withholding tax in the company's home country and depositary fees may apply, and the ADR's dollar price also moves with that country's exchange rate.",
    match: ["ADR", "American depositary receipt"],
  },
  "halka-aciklik": {
    term: "Free Float",
    definition:
      "Free float is the part of a company's shares that can trade freely in the market; shares held by executives, founders, strategic holders or under selling restrictions are excluded. Indexes such as the S&P 500 weight companies by this floating share count. Stocks with a small float have limited supply and can be more volatile.",
    match: ["free float", "public float"],
  },
  "hisse-bolunmesi": {
    term: "Stock Split",
    definition:
      "A stock split divides each existing share into several shares. The share count rises and the per-share price falls by the same ratio; the company's market value and the total value of your holding do not change. Charts and historical earnings per share are adjusted backward for the split.",
    example:
      "In a 4-for-1 split, 10 shares at $400 become 40 shares at $100; the total is still $4,000.",
    match: ["stock split"],
  },
  "ters-bolunme": {
    term: "Reverse Stock Split",
    definition:
      "A reverse stock split combines several shares into one. The share count falls, the price rises by the same ratio, and the total value does not change. It is often used by companies whose price has fallen sharply, to meet the exchange's $1 minimum price requirement, which is why the market frequently reads it as a sign of weakness.",
    example:
      "In a 1-for-10 reverse split, 1,000 shares at $0.80 become 100 shares at $8; the total is still $800.",
    match: ["reverse stock split", "reverse split"],
  },
  "endeks": {
    term: "Stock Index",
    definition:
      "A stock index tracks the combined price movement of a defined group of stocks as a single number. The S&P 500 weights roughly 500 large US companies by float-adjusted market value; the Dow Jones Industrial Average weights 30 stocks by price; the Nasdaq-100 covers the 100 largest non-financial companies listed on Nasdaq. You cannot buy an index itself; you invest in it through funds that track it.",
    match: ["stock index", "stock market index"],
  },
  "etf": {
    term: "Exchange-Traded Fund (ETF)",
    definition:
      "An ETF is an investment fund that trades on an exchange throughout the day like a single stock. Most track an index and give you dozens or hundreds of stocks in a single trade. The fund deducts a small annual percentage of assets as its expense ratio, and leveraged and inverse ETFs, which target a daily return, can drift well away from their index over longer periods.",
    match: ["ETF", "exchange-traded fund"],
  },
  "cesitlendirme": {
    term: "Diversification",
    definition:
      "Diversification means spreading money across many assets that do not move together, so that one company's or sector's bad run hurts the portfolio less. It greatly reduces company-specific risk but does not remove the risk that hits the whole market at once. Ten stocks in one sector diversify far less than ten stocks across different sectors.",
    match: ["portfolio diversification", "diversified portfolio"],
  },
  "volatilite": {
    term: "Volatility",
    definition:
      "Volatility measures how sharply and often a price swings; it is usually calculated as the standard deviation of returns and quoted as an annualized percentage. Historical volatility comes from past prices, while implied volatility is backed out of option prices. High volatility says nothing about direction, only about the size of moves.",
    example:
      "For a stock with 20% annualized volatility, a typical daily move is about 1.3% (20 divided by the square root of roughly 252 trading days in a year).",
    match: ["volatility"],
  },
  "beta": {
    term: "Beta",
    definition:
      "Beta is a coefficient that shows how much a stock has moved relative to the overall market, usually the S&P 500. A beta of 1 means it has moved in line with the market on average, above 1 more sharply, below 1 more calmly. It is calculated from past returns, changes from period to period, and does not capture moves driven by the company's own news.",
    example:
      "A stock with a beta of 1.5 has tended to fall about 3% on average when the market fell 2%.",
    match: ["beta coefficient"],
  },
  "boga-piyasasi": {
    term: "Bull Market",
    definition:
      "A bull market is a prolonged period of rising prices. There is no official definition; in common usage, an index rising 20% or more from its most recent low is called a bull market. Corrections can occur within a bull market.",
    match: ["bull market"],
  },
  "ayi-piyasasi": {
    term: "Bear Market",
    definition:
      "A bear market is a prolonged, deep decline in prices. There is no official definition; in common usage, an index falling 20% or more from its most recent peak is called a bear market. It often comes with recession fears, but not every bear market is accompanied by a recession.",
    match: ["bear market"],
  },
  "duzeltme": {
    term: "Market Correction",
    definition:
      "A correction is the common term for a decline of 10% to 20% from a recent peak in an index or stock. It is not an official definition. A decline beyond 20% is usually called a bear market.",
    example:
      "An index falling from 5,000 to 4,400 has dropped 12%, which in common usage is a correction.",
    match: ["market correction"],
  },
};
