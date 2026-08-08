/* ==========================================================================
   Rehber — İngilizce metinler

   `tr.ts` ile aynı anahtar kümesi; tip bunu zorlar. Çeviri birebir değil
   editoryal: sayı biçimi İngilizce yazıma çevrilir (ondalık nokta, $ önde,
   % sonda), seans tablolarında birincil saat New York olur (TR tarafında
   İstanbul olduğu gibi — bkz. lib/session-clock.ts) ve bağlantı metinleri
   İngilizce başlıkları taşır. Slug'lar DEĞİŞMEZ — adresler ortak.
   ========================================================================== */

import type { GuideSlug, GuideText } from "./meta";

export const GUIDE_EN: Record<GuideSlug, GuideText> = {
  /* ==== 1 · Basics ======================================================== */

  /* ---------------------------------------------------------------------- */
  "hisse-senedi": {
    title: "What Is a Stock?",
    dek: "Owning a small piece of a company — and who actually sets the price of that piece.",
    bodyMd: `When you buy a share of Apple, you are not buying a piece of paper. You are buying one of the billions of pieces the company's ownership has been divided into. That piece gives you two things: a claim on your share of any profits the company pays out, and a vote at the shareholder meeting.

::: tanim Stock
A single unit of a company's capital, divided into equal pieces. It makes its holder a part-owner. For listed companies, those pieces change hands on a market open to everyone.
:::

## Who Sets the Price

Nobody. More precisely: the last number a buyer and a seller agreed on. There is no signboard showing the company's "true value"; the price is the point where thousands of simultaneous decisions intersect.

That is why the price is driven by two things at once:

1. **The company itself** — how much it earns, how fast it grows, how much it owes.
2. **The market's mood** — interest rates, fear, which sector is in fashion, money flowing in.

In the short run the second is stronger than the first. In the long run it flips. One of the oldest lines about the market says exactly this:

> In the short run the market is a voting machine; in the long run it is a weighing machine.

## What It Pays You

There are two ways a stock makes you money, and they should not be confused:

| Path | How it happens | Who it suits |
|---|---|---|
| **Capital gains** | You sell for more than you paid | Investors betting on growth |
| **Dividends** | The company pays out profits in cash | Investors who want income |

The sum of the two is called *total return*. More: [What Is a Dividend?](/rehber/temettu)

## What You Own — and What You Don't

**You are:** the owner of a small percentage of the company's assets and future profits.

**You are not:** liable for the company's debts. If a company goes bankrupt, a shareholder loses at most what they put in — nothing more is asked. This is called *limited liability*, and it is the modern corporation's most important invention.

::: dikkat The Order of the Line
When a company fails, creditors are paid first, then bondholders, then preferred shareholders, and common shareholders last. In practice, "last" usually means "nothing." If the stock sits at the top of the return ranking, it sits at the bottom of the bankruptcy ranking — two faces of the same coin.
:::

## Percentage, Not Share Count

The most common beginner mistake: thinking in terms of "should I buy 100 shares or 10?" What matters is not how many shares you buy but **what percentage of your money** you put into that company.

Buying 10 shares of a $50 stock and 1 share of a $500 stock are the same thing: either way you have a $500 position. A price looking "cheap" or "expensive" is a fact about the share count, not about the company's value. More: [What Is Market Cap?](/rehber/piyasa-degeri)

::: ornek Same Company, Two Different Prices
If a company does a stock split, a $900 share becomes $300 overnight, split three ways, and your share count triples. Nothing in your portfolio has changed. The company is the same company. The only thing that changed is that the price looks more accessible to a small investor.
:::

## Where You'll See It on This Site

Every company has its own page — like [NVDA](/hisse/NVDA). Price, day range, market cap, key ratios, past earnings and company news all live there together. The company directory is at [Companies](/sirketler), and the search box at the top finds any symbol.`,
  },

  /* ---------------------------------------------------------------------- */
  "borsa-nasil-isler": {
    title: "How the Stock Market Works",
    dek: "The road your order travels from the moment you tap Buy to the shares landing in your account.",
    bodyMd: `An exchange is not a building; it is a matching engine. Its job is exactly one thing: bringing a buyer and a seller together on a price. Everything else is infrastructure built around that simple task.

::: tanim Exchange
The regulated market where buy and sell orders are collected and matched by price and time priority. The best known in the US are the **NYSE** and **Nasdaq**.
:::

## The Order Book

Every stock has an order book: one side wants to buy, the other wants to sell.

| Side | What it says | Example |
|---|---|---|
| **Bid** | The highest price a buyer will pay | 500 shares at $100.20 |
| **Ask** | The lowest price a seller will take | 300 shares at $100.24 |

The gap between them is the **spread**. The moment a buy order touches the ask side, a trade happens and that number becomes the "last price." The price you see on screen is exactly that: the last executed trade — the past.

## The Queue Rules

Matching follows two rules, both simple:

1. **Price priority** — the better price trades first.
2. **Time priority** — between two orders at the same price, the earlier one trades first.

That is why a "market" order eats through the book starting from the best opposing price and moving up. A large order doesn't fill at one price; it fills across several levels.

## The Institutions in Between

You don't connect to the exchange directly. The chain looks like this:

::: zaman The Journey of an Order
You | Tap "buy" in your broker's app.
Your broker | Checks the order and your balance, then routes it to a market.
Market maker or exchange | The order matches against the other side of the book. This step usually takes a fraction of a second.
Settlement | The trade is recorded and shares and cash change hands. In the US this is **T+1**: the next business day.
:::

::: dikkat Payment for Order Flow
Many commission-free US brokers route orders not to an exchange but to a market maker, and get paid for it. This is called *payment for order flow*. "Zero commission" does not mean "zero cost"; the cost may be hiding inside the spread. More: [Liquidity and the Spread](/rehber/spread-likidite)
:::

## Session Hours

The US market runs in three parts. Istanbul times shift twice a year with US daylight saving; the Istanbul column below is the summer schedule.

| Session | New York | Istanbul (summer) | Character |
|---|---|---|---|
| Pre-market | 4:00 – 9:30 | 11:00 – 16:30 | Thin, jumpy, wide spreads |
| **Regular session** | **9:30 – 16:00** | 16:30 – 23:00 | Nearly all the volume |
| After-hours | 16:00 – 20:00 | 23:00 – 03:00 | Earnings reactions live here |

The two busiest minutes of the day are the open and the close. In the closing auction, index funds settle the day's inflows and outflows — which is why huge volume prints in the final minute.

::: ornek Why Earnings Come After the Close
Most large companies report after the session ends. The point is to let the news be digested while the market is closed, so the conference call doesn't turn into a panic sale. The reaction shows up as a single jump at the next open — it sits on the chart as a "gap."
:::

## Where You'll See It on This Site

The countdown on the home page shows the time to the next open or close. The **Today's Flow** strip lines up economic releases and earnings on one time axis; every time is written in both New York and Istanbul time.`,
  },

  /* ---------------------------------------------------------------------- */
  "endeks": {
    title: "What Is an Index?",
    dek: "Where the number called the S&P 500 comes from — and why it behaves differently from the Dow.",
    bodyMd: `In the sentence "the market rose 1% today," *the market* is an index. An index compresses how a group of stocks moved into a single number. It cannot itself be bought or sold — it is a calculation, not a product.

::: tanim Index
The composite value of a group of stocks chosen by set rules and combined with a specific weighting. The level itself ("6,230 points") is not meaningful; what is meaningful is the **percentage change**.
:::

## The Four Big US Indexes

| Index | What's inside | Weighting | What it tells you |
|---|---|---|---|
| **S&P 500** | The 500 largest US companies | Market cap | The broad US market |
| **Nasdaq 100** | Nasdaq's 100 largest non-financial companies | Market cap | Tech-heavy growth |
| **Dow Jones** | 30 selected companies | **Price** | Historical indicator; narrow |
| **Russell 2000** | 2,000 small companies | Market cap | Small caps, the domestic economy |

## Why Weighting Matters

This is the biggest and least noticed difference between indexes.

In a **market-cap weighted** index, big companies move it a lot and small ones barely at all. In the S&P 500, the largest handful of companies can carry more than a third of the index. "I'm invested in 500 companies" is therefore less diversified than it sounds.

In a **price-weighted** index — and today only the Dow works this way — the company with the higher share price moves it more. Company size is irrelevant. A $500 stock moves it ten times as much as a $50 stock, even if the second company is ten times bigger. The only justification for this method is that 1896 had no calculators.

::: dikkat The Index Can Rise While Stocks Fall
In a market-cap weighted index, a few giants can rise while the other 480 companies fall — and the index still closes green. This is called *narrowing breadth*, and it is often an early sign of a weakening trend.
:::

## How to Invest in an Index

Since the index itself can't be bought, funds that replicate it are used instead:

- **SPY** → S&P 500
- **QQQ** → Nasdaq 100
- **DIA** → Dow Jones
- **IWM** → Russell 2000

These are ETFs. More: [What Is an ETF?](/rehber/etf)

::: ornek Percent, Not Points
QQQ's price is not the Nasdaq 100's point level; it is a fixed fraction of it. DIA trades at roughly one hundredth of the Dow. Levels don't line up; percentage changes match almost exactly. When comparing an index and its fund, always look at the percent.
:::

## Joining and Leaving an Index

Indexes are not static. A company that stops meeting the rules is removed and replaced. News of index inclusion usually lifts a stock — because every fund tracking that index is forced to buy it. This is a purely mechanical wave of buying with no connection to the company's business.

## Where You'll See It on This Site

The home page's side column shows four index cards, each with an intraday chart. The [Markets](/piyasalar) screen puts indexes, sectors and Treasury yields side by side; the **Market Breadth** card shows how many index members are up and how many are down.`,
  },

  /* ---------------------------------------------------------------------- */
  "etf": {
    title: "What Is an ETF?",
    dek: "A fund that trades like a single stock but carries dozens of companies inside.",
    bodyMd: `You cannot "buy" the Nasdaq 100. An index is a calculation, not a product. But you can buy a share of a fund that holds all 100 companies at the right weights. That fund is called **QQQ**, and it is an ETF.

::: tanim ETF (Exchange Traded Fund)
An investment fund that trades on an exchange. It holds a basket of assets inside, and its shares trade all day, exactly like a stock.
:::

## How It Differs From a Classic Mutual Fund

| | Mutual fund | ETF |
|---|---|---|
| Trading | Once a day, at the end-of-day price | All session long, at the live price |
| Price | Net asset value computed after the close | Market price set by supply and demand |
| Expense ratio | Usually higher | Usually very low (0.03–0.20%) |
| Transparency | Holdings disclosed periodically | Holdings mostly disclosed daily |

The most important difference is the expense ratio. The gap between 1% a year and 0.05% a year can eat a quarter of your total return over thirty years of compounding.

## The Kinds

- **Index ETFs:** track an index. SPY (S&P 500), QQQ (Nasdaq 100), DIA (Dow Jones), IWM (Russell 2000).
- **Sector ETFs:** hold a single sector — semiconductors, energy, banks.
- **Country ETFs:** hold one country's stocks. The World Markets card on this site uses them.
- **Bond ETFs:** carry bonds instead of stocks.
- **Commodity ETFs:** gold, oil, silver.

::: dikkat Leveraged and Inverse ETFs
Anything labeled "3x" or "inverse" is a different product. It targets a multiple of the index's **daily** return, not its return over a period. In a sideways but choppy market they decay in both directions. They are not designed to be held for months; the "I'll just wait it out" strategy is mathematically broken in these products.
:::

## Why the Price Doesn't Match the Index

QQQ's price is not the Nasdaq 100's level; it is a fixed fraction of it. DIA trades at roughly one hundredth of the Dow. What matters is not the level but the **percentage change** — and that matches almost one for one.

Country funds add one more layer: the fund is in dollars and trades during US hours. The local index may have closed hours earlier in its own country, and the exchange rate may have moved in between. The direction is usually the same; the percent doesn't match exactly.

::: ornek The Türkiye Example
If the BIST 100 rises 2% in lira while the lira loses 2% against the dollar, TUR (iShares MSCI Turkey) ends the day roughly flat in dollars. The percent you see on screen is not the local index's move — it is the **dollar return**. More: [Currency Risk](/rehber/kur-riski)
:::

## When an ETF, When a Single Stock

Buying a single stock assumes you have a view on that company. Buying an ETF admits you have a view on a theme or a market, but don't know which company will win. Both are legitimate; trouble comes from mixing them up — being right about a theme and picking the wrong company.

## Where You'll See It on This Site

The index cards (Nasdaq 100, S&P 500, Dow Jones, Russell 2000) and the World Markets list are fed by ETF prices. Open an ETF's page and you'll see a **fund fact box** instead of company metrics: what it tracks, who manages it, and a note on how it can drift from the market it follows.`,
  },

  /* ---------------------------------------------------------------------- */
  "volatilite": {
    title: "What Is Volatility?",
    dek: "It measures how much the price swings — not which way it is going.",
    bodyMd: `A stock can finish the month up 2%. The same stock can also finish the month up 2% after first falling 18% and then rising 24%. Same result, very different experience. The name of the difference is **volatility**.

::: tanim Volatility
A measure of how far an asset's price strays from its average over a period. It ignores direction: a 10% rise and a 10% fall contribute equally. What it measures is the **size of the moves** — in other words, uncertainty.
:::

## How It's Calculated

Take the standard deviation of daily returns and annualize it. A rough rule: a stock whose daily moves have a standard deviation of 1% has an annual volatility of about 16% (1% × √252, because a year has roughly 252 trading days).

This number is a measurement, not a forecast. "Annual volatility of 40%" says nothing about whether the stock will rise or fall; it only says the price will roam a wide band during the year.

| Typical annual volatility | What it means |
|---|---|
| 10–15% | Utilities, big food brands. The price sits still for days. |
| 15–20% | The S&P 500's long-run band. An index is calmer than its members. |
| 25–40% | Big tech and semiconductors. One earnings night can move it 10%. |
| 60%+ | Recent IPOs, biotech, speculative names. |

An index being calmer than its members is not a coincidence: some of the companies inside rise while others fall, and the moves partly cancel. That is called diversification, and it is the cheapest way to lower volatility.

## Realized vs. Implied

There are two different numbers, and they get confused:

- **Realized:** computed from past prices. It tells you what happened.
- **Implied:** backed out of option prices. It tells you what the market expects next.

The best known gauge of implied volatility is the **VIX**: derived from S&P 500 options and nicknamed the "fear index." Its long-run average is around 20. A 12–15 band is a calm market, above 30 is tension, above 50 is panic.

::: ornek Earnings Night
Before a company reports, its option prices inflate, because the market expects a big move. Once the numbers are out, the uncertainty vanishes and option prices deflate fast — even if the stock barely moves. This is called *volatility crush*, and it's one of the classic ways to be right and lose money anyway.
:::

## Is Volatility Bad?

No — but it isn't free either. It has two distinct costs:

1. **Psychological:** a high-volatility position can force you to sell along the way, even when you're right.
2. **Mathematical:** volatility eats compound returns. An asset that falls 50% needs to rise 100% to get back to even. Big swings around zero compound to less than small steady steps.

The second point is why, of two assets with the same average return, the calmer one ends up richer over time.

::: dikkat Combined With Leverage
Volatility alone is not a risk; it is a measurement. It turns into risk through leverage: in a position carried on borrowed money, a temporary swing can become a permanent loss through a margin call. See [What Is Leverage?](/rehber/kaldirac)
:::

## Where You'll See It on This Site

- **Day range** (stock page): the distance between the day's low and high — the crudest gauge of daily volatility.
- **52-week high / low:** the width of the yearly band.
- **The intraday chart:** flat line or sawtooth — you can tell at a glance.`,
  },

  /* ---------------------------------------------------------------------- */
  "ayi-boga": {
    title: "Bull and Bear Markets",
    dek: "Two animals, two thresholds, and the story the market tells about itself.",
    bodyMd: `A bull throws you up with its horns; a bear swipes you down with its paw. The origin of the terms really is that simple. The thresholds, though, are numeric — and the market takes them seriously.

::: tanim The Two Thresholds
**Correction:** a pullback of **10%** or more from the last peak.
**Bear market:** a decline of **20%** or more from the last peak.
**Bull market:** a 20% rise off the bear-market low; usually mentioned together with new highs.
:::

There is no mathematical truth in these lines — nobody claims a law of nature separates −19.4% from −20.1%. But because market participants use them as a common language, they have real effects: fund managers report in these terms, headlines are written at these levels, and some institutional risk rules trigger there.

## Their Characters Differ

| | Bull market | Bear market |
|---|---|---|
| Duration | Years (historically much longer) | Months |
| Speed | Slow, gradual | Fast, violent |
| Volatility | Low | High |
| Mood | Indifference, then optimism, then euphoria | Worry, then fear, then capitulation |
| News flow | Good news cheered, bad news ignored | Bad news punished, good news distrusted |

The most durable observation: **markets take the stairs up and the elevator down.** Rallies build through gradual accumulation; declines happen when forced sellers — margin calls, fund outflows, risk limits — all run for the door at once.

::: dikkat The Bear-Market Rally
Bear markets contain sharp 10–20% rallies, and every one of them gets called "the bottom." Historically, most of the sharpest single-day gains happened inside bear markets. One day's direction tells you nothing about the trend.
:::

## Why Naming It Helps

Separating a correction from a bear market makes you ask what actually changed in the portfolio:

- **A correction is usually a price event.** Valuations stretch, some air comes out, the story doesn't change.
- **A bear market is usually a story event.** Earnings expectations fall, the rate regime shifts, faith in a sector's core thesis cracks.

There is no shortcut for telling them apart, but there is a good question: *does whatever caused this decline change how much money companies will earn over the next three years?* If the answer is no, it's probably a correction.

## The Numbers

On a historical scale:

- US bear markets show up on average every few years.
- Bull markets last longer and travel further than bear markets — which is why indexes drift upward over the long run.
- 1929, 2000–2002, 2007–2009 and 2020 are the most cited bears; the first three ran for months to years, while 2020 was the fastest in history, measured in weeks.

## Where You'll See It on This Site

The **Market Breadth** card shows how many index members are up and how many are down. When the index is rising but breadth is narrowing — a handful of stocks carrying the rally — that is often the first sign of a tiring trend, visible here before it shows in the index level.`,
  },

  /* ---------------------------------------------------------------------- */
  "spread-likidite": {
    title: "Liquidity and the Spread",
    dek: "The invisible fee you pay on every trade, even when the commission is zero.",
    bodyMd: `A stock does not have one price. It has two at the same time: one you can buy at, one you can sell at, and they are never the same. The gap between them is the real cost that never shows up on any commission table.

::: tanim Spread and Liquidity
**Spread:** the gap between the best bid and the best ask.
**Liquidity:** how much size can trade without moving the price. In a liquid stock the spread is tight and every level holds plenty of orders.
:::

## Why It Exists

The market maker on the other side takes a risk: they buy the stock from you and hold it until the next buyer shows up. If the price falls in the meantime, they lose. The spread is the fee for that risk.

## How Much It Matters

| Stock type | Typical spread | Round-trip cost on a $10,000 trade |
|---|---|---|
| Very liquid — SPY, AAPL | $0.01 (0.002%) | ~$0.20 |
| Mid cap | 0.05% | ~$5 |
| Small cap, low volume | 0.5% | ~$50 |
| Pre-market / after-hours | 3–10× normal | Highly variable |

The last row is the one most people miss: outside regular hours the spread opens up. Trading an earnings reaction after hours "to be quick" usually means handing part of that reaction straight to the spread.

::: ornek You Pay Both Ways
In a stock quoted 100.00 bid / 100.10 ask, buying at 100.10 and immediately selling at 100.00 loses you 0.1% with the price never moving. Someone who round-trips ten times a day pays a serious monthly sum to the spread alone — even in a flat market.
:::

## How to Read Liquidity

- **Average daily volume.** Millions of shares a day means you won't have a problem.
- **The width of the spread.** A spread wider than a tenth of a percent is a caution sign.
- **Depth of book.** How much size sits at each level.

::: dikkat Liquidity Vanishes Exactly When You Need It
Liquidity is plentiful on calm days and evaporates on panic days. On a morning when everyone wants out at once, buyers step away, the spread gapes, and the assumption "I can always exit at my price" collapses. In small, thinly traded names this is a bigger problem than the decline itself.
:::

## What to Do

1. **Use limit orders, not market orders.** In an illiquid stock a market order fills by eating up the book. More: [Order Types](/rehber/emir-tipleri)
2. **Avoid the first and last minutes of the session.** The spread is widest in those two windows.
3. **Don't trade outside regular hours.** Unless you truly must.
4. **Size positions against volume.** If you alone would be a meaningful share of the daily volume, you are the one who will move the price.

## Where You'll See It on This Site

The **volume** row on the stock page is the crudest liquidity gauge. Prices here come from the IEX feed, so the last price on screen can drift a few cents from the consolidated tape — which is itself another face of the spread.`,
  },

  /* ---------------------------------------------------------------------- */
  "halka-arz": {
    title: "IPOs: How a Company Comes to Market",
    dek: "The day a private company gets a public price tag — and why that day is so volatile.",
    bodyMd: `Every company you see on the exchange was once not there. It was a private company held by founders, employees and a few funds; its shares had no price because there was no market where they traded. An IPO is the process that moves that closed structure onto a market open to everyone.

::: tanim IPO
*Initial Public Offering* — the first sale of a company's shares to the public and the start of exchange trading. From that day on, the company has a price tag that updates every second and an obligation to report every quarter.
:::

## Why Companies Go Public

There are three reasons, and knowing which one dominates changes how you read the deal:

1. **Raising money.** The company issues new shares, and the proceeds go into the company — factories, products, growth.
2. **An exit for early investors.** Funds and founders who invested at the start want to turn shares into cash. In that sale, the money goes to the selling shareholder, not the company.
3. **Turning stock into currency.** A listed share with a live price becomes a means of payment in acquisitions and employee compensation.

This is why the "who is selling" section of the prospectus gets read: an offering that mostly raises new capital and one that mostly cashes out early investors are not the same event.

## The Process: From Filing to the Bell

::: zaman A Typical IPO Timeline
Months ahead | The company picks investment banks and files an **S-1** with the SEC: financials, risks, ownership — all public for the first time.
Weeks ahead | The **roadshow**: management pitches institutional investors. The banks collect demand into a book.
Days ahead | A price range is announced ("$24–27 per share"). Strong demand pushes the range up.
The night before | The final **offer price** is set and shares are allocated to institutional buyers.
Day one | The stock starts trading. The first trade price differs from the offer price — sometimes wildly.
:::

## Two Prices: Offer and Open

On IPO day there are two separate prices, and mixing them up is the most common mistake.

The **offer price** is what institutional buyers paid the night before. The **opening price** is where the first public trade matches the next day. "The stock jumped 35% on day one" usually means: the open printed 35% above the offer price.

::: ornek Whose Money Is the "Pop"
A company prices its IPO at $25; the first trade opens at $34. The headline calls it a success. From the company's side the picture is different: it sold its shares at 25 while the market was willing to pay 34 — the $9 in between is money that never reached the company. A big first-day pop is also a sign the deal was priced too low.
:::

The practical consequence for you: a retail investor almost always buys at the **opening price**, not the offer price. The "35% gain" in the headline belongs to the institutions that got allocations the night before.

## The Lock-Up

Shares not sold in the IPO — founders, employees, early funds — are usually barred from selling for **90 to 180 days**. This is the *lock-up*.

::: dikkat The Day the Lock Opens
When the lock-up expires, the number of shares that can hit the market multiplies overnight. The price often sags into that date — it is on the calendar, not a surprise. If you are taking a position in a recent IPO, don't do it without knowing the lock-up date. It's in the prospectus.
:::

## Other Roads to the Market

| Route | How it works | The difference |
|---|---|---|
| **Classic IPO** | New shares sold through banks | Money reaches the company; banks underwrite |
| **Direct listing** | Existing shares simply start trading | No new money, no offer price |
| **SPAC merger** | Merging with a listed shell company | Fast; scrutiny is weaker than an IPO's |

The third route was fashionable in 2020–2021, and most of that era's SPACs later fell far below their offer prices — the speed and the loose scrutiny were not free.

## Why New Listings Are Riskier

- **Short history.** Five quarters of financials don't earn the trust of five years; nobody has seen how the company behaves in a bad cycle.
- **Information asymmetry.** The seller has known the company for years; the buyer, for weeks. Prices get set by the better-informed side.
- **The IPO window.** Companies choose to list when the market is euphoric — that is, when the buyer is most optimistic. When the seller picks the timing, the price favors the seller.
- **Outside the indexes.** A new listing doesn't join the S&P 500 right away; the mechanical bid from index funds is absent in the early months.

::: ozet Summary
An IPO is not a company's birth; it is a sale, and the seller picks both the time and the price. Day-one headlines belong to the night-before allocations; your price is the opening price. Mechanical events — the lock-up calendar, the first earnings reports, index inclusion — will move the stock for months, independent of the business itself.
:::

## Where You'll See It on This Site

The profile card on a company's page shows the **IPO date** — check it so you don't read a company with five quarters of history with the same confidence as one with thirty years. Newly listed symbols are reachable through search; they won't appear in the index cards, because they aren't in the indexes yet.`,
  },

  /* ==== 2 · Positions & Risk ============================================= */

  /* ---------------------------------------------------------------------- */
  "emir-tipleri": {
    title: "Order Types: Market, Limit and Stop",
    dek: "Which button you press sometimes matters more than what you buy.",
    bodyMd: `Two people buying the same stock at the same moment can end up with different prices, just by using different order types. The order type is the rule that decides **when** and **at what price** your trade happens.

::: tanim The Three Basic Orders
**Market order:** "Buy now, whatever it costs." You don't set the price.
**Limit order:** "Buy at this price or better." You set the price; execution is not guaranteed.
**Stop order:** "If the price reaches this level, act." It is a trigger, not a price.
:::

## The Market Order

It fills instantly, starting from the best opposing price in the book. Its advantage is certainty: **it executes**. Its disadvantage lives in the same place: you don't know at what price.

In a liquid stock the difference is trivial. In an illiquid stock, or in the first seconds after the open, a market order can chew through several levels of the book and fill at a much worse average than you expected. That is called **slippage**.

## The Limit Order

You set a ceiling (when buying) or a floor (when selling). If the price never gets there, the order waits — and expires at day's end or whenever you set it to.

| | Market order | Limit order |
|---|---|---|
| Execution | Guaranteed | Not guaranteed |
| Price | Not guaranteed | Guaranteed |
| When to use | When speed matters more than price | Almost always |
| Its risk | Filling at a bad price | Never filling |

> A practical rule for beginners: unless you have a specific reason not to, **use a limit order**.

::: ornek Two Outcomes at the Same Moment
A thinly traded stock quoted 100.00 bid / 100.40 ask. Send a market order and you fill at 100.40 — or 100.80 if the book is thin. Send a 100.10 limit and you either buy at 100.10 or you don't buy at all. In the second case you lost an opportunity; in the first you lost money. Those two costs are not the same.
:::

## The Stop Order

A stop is a trigger. The moment the price touches your level, the order **activates** and becomes a market order.

- **Stop-loss:** sells your position if the price falls below a set level. It exists to cap the loss.
- **Stop-limit:** on trigger, sends a limit order instead of a market order. It avoids selling at a bad price — at the risk of not selling at all.
- **Trailing stop:** the level rides up with the price but never moves down. Used to protect gains.

::: dikkat A Stop Is Not Insurance
This is the most common misconception. A stop sends a market order when the price *touches* your level — it does not guarantee you'll sell at that level. In a stock that gaps down 20% overnight on bad news, your stop set 5 below yesterday's close fills 20 below, at the open. Stops work against gradual declines; they do not work against gaps.
:::

## Time-in-Force

| Code | Meaning |
|---|---|
| **DAY** | Expires at the end of the day (the default) |
| **GTC** | Good till cancelled |
| **IOC / FOK** | Fill immediately; cancel whatever doesn't fill |

Forgetting an open GTC order is a classic mistake: a buy order placed months ago can quietly execute long after your view of the company has completely changed.

::: ozet Practical Rules
Buy with limit orders and treat urgency as a cost. Set the stop when you open the position, not after it falls. Don't send market orders in the first five or last five minutes of the session — that's where the spread is widest.
:::

## Where You'll See It on This Site

Açılış Zili is not a broker; no orders are placed here and no order book is shown on these screens. The point of this piece is that you can read the screen at your own broker.`,
  },

  /* ---------------------------------------------------------------------- */
  "risk-yonetimi": {
    title: "Risk Management: How Much, When",
    dek: "The one skill that decides not whether you win, but whether you stay in the game.",
    bodyMd: `A beginner asks "what should I buy?" Someone who has survived a long time asks "how much should I buy?" The second question is less exciting, and it determines more of the outcome.

::: tanim Risk Management
Deciding **in advance** how much you will lose if a position goes against you, and sizing the position to match that decision.
:::

## The Math of Asymmetry

Losses are not symmetric. The percentage you lose and the percentage you need to get back to even are not the same number:

::: bar The Rally Needed to Break Even
10% loss | 11%
25% loss | 33%
50% loss | 100%
75% loss | 300%
90% loss | 900%
:::

This table alone explains why risk management is a necessity, not a preference. Keeping small losses small is easier than finding big winners — and contributes more to the result.

## How Position Size Is Calculated

Professionals don't think in "how many shares." They go in this order:

1. **Decide what percent of your capital one idea may cost you.** A common rule: never risk more than **1–2%** of the total on a single idea.
2. **Decide where you'll admit you were wrong.** That is the stop level.
3. **Divide the two.**

::: ornek With Numbers
Your capital is $10,000. You decide to risk at most 1% per trade — $100.
The stock is $50. If it drops below 45, your idea was wrong; the stop is 45.
Risk per share: 50 − 45 = **$5**.
Shares to buy: 100 ÷ 5 = **20 shares**.
The position is 20 × 50 = $1,000 — 10% of your capital. But your risk is not 10%. It is **1%**.
:::

That distinction is critical: position size and risk are not the same thing. Risk is the position size multiplied by the stop distance.

## What Sets the Stop Distance

Not a round number — the stock's own character. Putting a 2% stop on a stock that swings 4% on an average day means "take me out of the market on an ordinary day." A volatile stock needs a wider stop and a smaller position. More: [What Is Volatility?](/rehber/volatilite)

## The Four Common Mistakes

| Mistake | Why It's Wrong |
|---|---|
| Moving the Stop Down After a Drop | Handing the decision to fear. The loss no longer has a limit. |
| Adding to a Losing Position | Putting more money on the wrong idea. The average falls, the risk grows. |
| Closing Winners Early, Losers Late | Small profits, big losses. It runs the table above in reverse. |
| Concentrating in One Idea | One mistake can take half the capital. |

::: dikkat The Two Faces of Averaging Down
"Buy more as it falls" works if you're right about the company's value — and accelerates your ruin if you're wrong. The difference is whether you're adding *because the price fell* or *because your information about the company hasn't changed*. Price alone is not a reason.
:::

## Planning to Lose

A good investor answers three questions before opening a position:

1. If I'm wrong about this idea, how will I know?
2. If I'm wrong, how much do I lose?
3. When that loss happens, will I lose sleep?

If the answer to the third is "yes," the position is too big. That criterion is practical, not mathematical — and it is the most reliable one.

::: ozet The One-Sentence Version
The market decides how much you make; you decide how much you lose. Risk management is that second sentence, turned into practice.
:::`,
  },

  /* ---------------------------------------------------------------------- */
  "cesitlendirme": {
    title: "Diversification: How Many Baskets Are Enough?",
    dek: "Owning ten different stocks is not the same as owning ten different risks.",
    bodyMd: `Everyone knows "don't put all your eggs in one basket." The less known part: you may think you bought ten baskets and have actually loaded them all onto the same truck.

::: tanim Diversification
Spreading a portfolio across assets that move independently of each other, to lower the total swing. The key word is **independent**: what matters is not the count but the connectedness.
:::

## Why It Works

A portfolio's risk is not the average of its holdings' risks — it is **lower**. The reason is simple: on any given day some rise while others fall, and the moves partly cancel out.

This is the closest thing to a free lunch in finance: you lower the swings without giving up expected return.

## But Only If They're Independent

::: ornek Fake Diversification
Your portfolio holds NVDA, AMD, AVGO, MU, TSM and a semiconductor ETF on top. Six symbols, one bet. If expectations about AI demand change, all six fall on the same day, in the same direction, by similar amounts. This portfolio is not diversified — it is merely **fragmented**.
:::

Real diversification happens across different axes:

| Axis | Example |
|---|---|
| **Sector** | Tech + healthcare + energy + utilities |
| **Geography** | US + Europe + emerging markets |
| **Asset class** | Stocks + bonds + cash + gold |
| **Company size** | Large caps + small caps |

The strongest of these is the third: stocks and bonds move together far less than two stocks do.

## How Many Stocks Are Enough

The consistent finding of academic work: most company-specific risk disappears with **20–30 stocks**. Beyond that, the benefit is small and the monitoring burden is large.

::: dikkat Over-Diversification Isn't Free Either
Tracking fifty stocks means truly knowing none of them. No portfolio has fifty good ideas. Too many positions produce nothing but an expensive imitation of the index — at which point buying an index fund directly is cheaper and more honest. See [What Is an ETF?](/rehber/etf)
:::

## Correlation Rises in a Crisis

Diversification's most annoying property: it weakens exactly when you need it most. On panic days, investors sell not what they dislike but what they *can* sell. Assets that normally move independently fall together in the same week.

That doesn't mean diversification fails. It means "I'm diversified, I'm protected from drawdowns" is too optimistic. The protection is weak against short panics and strong against multi-year wrong bets.

## When Concentration Makes Sense

Concentration isn't always a mistake; it can be a conscious choice. But it has three conditions:

1. You genuinely know the company.
2. You've priced the chance of being wrong and sized the position for it.
3. **You are not using leverage.**

The third point is not negotiable. Concentration multiplied by leverage is the classic formula that blows up funds. More: [What Is Leverage?](/rehber/kaldirac)

::: ozet Summary
Diversification is measured by counting independent ideas, not symbols. Don't ask "how many stocks do I own" — ask "how many different things have to go wrong for me to lose."
:::`,
  },

  /* ---------------------------------------------------------------------- */
  "long-short": {
    title: "What Do Long and Short Mean?",
    dek: "Profiting from a rise versus profiting from a fall — and why the two are nothing like mirror images.",
    bodyMd: `The market has two basic directions, and both can make money. But their risks are not reflections of each other, and that asymmetry explains why short positions are so dangerous.

::: tanim Long and Short
**Long:** buying and owning the asset. You profit if the price rises.
**Short:** borrowing an asset you don't own, selling it, then buying it back later to return it. You profit from the difference if the price falls.
:::

## The Mechanics of a Short

1. You borrow 100 shares from your broker.
2. You sell them in the market at $200 — $20,000 lands in your account.
3. The price falls to $150. You buy 100 shares back for $15,000.
4. You return the shares. Your profit is $5,000 (minus borrow fees).

If the price rises to 250 instead, closing the trade costs $25,000 and you lose $5,000.

## The Real Issue: Asymmetry

| | Long | Short |
|---|---|---|
| Maximum loss | What you invested (100%) | **Unlimited** |
| Maximum gain | Unlimited | At most what you sold for (100%) |
| Time | Usually works for you | Works against you (borrow fees, dividends) |
| As it moves against you | The position shrinks, risk falls | The position grows, **risk grows** |

The last row is the critical one. A long that goes against you gets smaller — its weight in the portfolio falls, the damage is capped. A short that goes against you gets **bigger**: as the price rises, the notional value grows, the margin requirement grows, and its weight inflates by itself.

::: dikkat The Short Squeeze
When many investors are short the same stock and it starts rising, they all have to buy back at once to cap their losses. Buying back means **buying** — which fuels the rally, which forces more shorts to cover. This self-feeding loop is a *short squeeze*, and it can multiply a price within days.
:::

## Why Short at All

Shorting isn't always a bet. In professional portfolios it is mostly a **hedge**:

- **Market-neutral:** long the company you like in a sector, short the one you don't — you're now betting only on your selection, not the sector's direction.
- **Portfolio insurance:** shorting the index against a long-term long book cushions a decline.
- **Pair trades:** "long chips, short software." Both legs are parts of one thesis.

::: ornek Both Legs of a Pair Can Bleed
"Long chips, short software" rests on the thesis that AI will squeeze software margins while exploding infrastructure demand. If the thesis holds, both legs pay. If it flips, **both legs lose at once** — chips fall while software rallies. Pair trades are not "less risky"; they just carry a different risk.
:::

## The Short Version

Going long is the default position, and time usually works in its favor: companies grow, the economy grows, indexes drift up over decades. Going short is a bet against the clock; being right isn't enough — you must be right **on schedule**.

For an individual investor the practical takeaway: a short sale is the only ordinary trade whose theoretical loss is unlimited. Before trying it, read the margin mechanics in the [Leverage](/rehber/kaldirac) piece — a short position is, by its nature, a form of leverage.`,
  },

  /* ---------------------------------------------------------------------- */
  "kaldirac": {
    title: "What Is Leverage — and Why You Should Stay Away",
    dek: "Carrying a position on borrowed money. It multiplies gains and losses alike — but what it really takes is your right to decide when to sell.",
    bodyMd: `This piece has a recommendation, and it's more honest to state it upfront: **don't use leverage.**

The other pieces on this site explain a concept neutrally. This one will explain the mechanics neutrally too — and then say something at the end. The reason is that leverage doesn't merely increase risk: it takes the decision out of your hands.

::: dikkat Said at the Start
Leverage is the one tool we **recommend against** having in an individual investor's portfolio. It does not improve your odds of being right; it only makes the same bet bigger and speeds up how fast you can lose it. If you are still learning the market, the answer is not close: don't.
:::

## The Mechanics

You have $10,000 of capital. You borrow $30,000 from your broker and carry $40,000 of stock. Your leverage is 4x.

- The stock rises 10% — you make $4,000, which is 40% of your capital.
- The stock falls 10% — you lose $4,000, again 40% of your capital.

::: tanim Leverage
Carrying a position larger than your own capital using borrowed money. The lender demands collateral — and if the collateral's market value falls below a set ratio, demands it be topped up **immediately**.
:::

So far, the part everyone knows — and it looks symmetric. The real issue comes next.

## What It Really Takes: the Calendar

In an unleveraged position, you decide when to sell. Even if the price halves, you can choose to wait, because you owe no one. It hurts, but the decision stays yours.

In a leveraged position that decision is not yours. When the collateral ratio drops below the threshold, the broker sends a **margin call**. If you can't add money, the position is closed for you — at precisely the worst price, because that's exactly why the call went out.

> You can be right and still go broke. The time it takes to be proven right can be longer than the time you can carry the position.

That sentence is the one-line summary of leverage; the rest of this piece is its unpacking.

## How Much Drawdown Each Multiple Survives

| Leverage | Decline that wipes the capital | Margin call, in practice |
|---|---|---|
| 1x (none) | 100% | Never |
| 2x | 50% | around a 25% decline |
| 4x | 25% | around a 12% decline |
| 10x | 10% | around a 5% decline |

The right column matters more: the call arrives long before the position is wiped out. At 4x, a 12% market decline — an ordinary correction — is enough to take you out of the game.

For scale: 10% corrections in the S&P 500 arrive roughly once a year on average. So 4x leverage means "an ordinary once-a-year event erases me."

## Why You Shouldn't

### 1. Your losses aren't symmetric

A position that falls 50% must rise 100% to break even. Leverage magnifies that asymmetry: capital lost with leverage is not the kind of loss an unleveraged portfolio can recover from. See [Risk Management](/rehber/risk-yonetimi)

### 2. You've sold your right to wait

The long-run investor's greatest advantage is the option to wait. Leverage sells exactly that advantage. What you get in exchange is not more return — just a bigger multiple on the same return.

### 3. Interest quietly eats

Borrowed money isn't free. The annual rate grinds away a little every day, even while the position goes nowhere. For a long-term holder it is a leak running in the background.

### 4. It degrades your decisions

With leverage, intraday swings become terrifying as a percent of your capital. People do not decide well under that pressure. The worst sales, the worst buys and the most expensive panics happen here.

### 5. It endangers the rest of your portfolio

When the margin call comes, the broker can sell not just the troubled position but your other holdings too. One leveraged idea can take your healthy positions down with it.

::: ornek Multiplied by Concentration
Leverage is most dangerous not alone but **multiplied by concentration**. If your top five positions are three quarters of the book and all five express the same theme, you are far less diversified than you think. When the theme gets sold, five positions fall at once, in the same direction.
In July 2026, an AI fund's four-day collapse was exactly this product: a concentrated portfolio carried at four times leverage. The manager's thesis was never proven wrong — he just ran out of time. [The full story](/mercek/leopold-aschenbrenner-96-saat)
:::

## The Invisible Kinds

Everyone thinks leverage means "a margin account." It doesn't. Leverage comes in many forms, and some never show up labeled as leverage:

- **Options:** a small premium buys exposure to a much larger notional.
- **Futures:** the margin is a small fraction of the contract size.
- **Leveraged ETFs:** the leverage is inside the product, invisible in your account.
- **Short selling:** carrying borrowed shares is itself a form of leverage.
- **The company's own debt:** a leveraged company's stock is inherently more leveraged than a debt-free one's.

The last point escapes most people: you can be running a highly leveraged portfolio without ever touching margin.

## If You'll Use It Anyway

We don't recommend it. But if the decision is yours, at minimum be able to answer three questions comfortably:

1. If this position falls 30%, can I still carry it?
2. If I can't, who decides the sale — me, or the collateral ratio?
3. Will the other positions in my portfolio fall at the same time?

If you can't answer all three clearly, the leverage is too much. And even if you can, remember: plenty of professionals answered all three correctly and lost anyway.

::: ozet The Lesson
Leverage separates the owner of an investment from the owner of its calendar. It doesn't grow your return, only multiplies it — and in exchange it raises the speed of loss and the odds that the decision is taken from you. Staying in the market for the long run is worth more than winning any single year — leverage trades exactly those two against each other.
:::`,
  },

  /* ---------------------------------------------------------------------- */
  "opsiyonlar": {
    title: "Options: Calls, Puts and the Anatomy of a Premium",
    dek: "A way to trade direction without owning the stock — and why the clock inside the premium always runs against the buyer.",
    bodyMd: `An option buys something different from a stock: not the stock itself, but the **right** to buy or sell it at a set price. That one-sentence difference produces an entirely different mathematics of risk — and this piece exists to show that math, not to recommend using it.

::: tanim Option
The right to buy or sell a stock at a set price (the **strike**) until a set date. A **call** is the right to buy; a **put** is the right to sell. The right doesn't have to be used; if it expires unused, the premium paid is gone. In the US, one contract represents 100 shares.
:::

## The Four Seats

Every option trade has two sides, which makes four possible positions:

| | Call | Put |
|---|---|---|
| **Buyer** | Bets on a rise; loss capped at the premium | Bets on a fall; loss capped at the premium |
| **Seller** | Collects the premium; loss on a rally is **unlimited** | Collects the premium; loss on a crash is huge |

The asymmetry the table describes: the buyer's loss is capped but likely; the seller's gain is capped but likely. The two sides are trading different things — the buyer pays a small, certain cost for a large, low-probability payoff.

## The Two Parts of the Premium

An option's price is called the **premium**, and it has two components:

**Intrinsic value** — what the right would be worth if exercised today. With the stock at $110, a $100 call has $10 of intrinsic value.

**Time value** — everything else. It is the price of the *possibility* that the stock moves your way before expiry.

::: ornek Taking a Premium Apart
The stock is at $110. A one-month call struck at $100 trades for $13.
Intrinsic value: 110 − 100 = **$10**.
Time value: 13 − 10 = **$3**.
If the stock sits frozen at 110 for the month, the option is worth $10 at expiry: intrinsic value survives, time value **melts to zero**. The stock never fell — and you lost 23%.
:::

## Time Decay

Time value shrinks every day, and the shrinking accelerates as expiry approaches. This is *theta*. In practice it means: an option buyer is betting not only on direction but **against the calendar**. Being right isn't enough; you must be right before expiry, faster than the time value melts.

Options expiring the same day (*0DTE*) are the extreme of this decay: within hours they either multiply or go to zero. In recent years most of the volume has migrated to these contracts — the financial product that most resembles a lottery ticket.

## The Volatility Premium

The main input that sets the size of time value is the volatility the market expects from the stock — **implied volatility**. If the market expects big moves, premiums inflate; if it expects calm, they deflate. More: [What Is Volatility?](/rehber/volatilite)

::: dikkat The Earnings-Night Trap
Before earnings, option premiums inflate because everyone expects a big move. Once the report is out, uncertainty ends and the inflation deflates — your option can lose value even when the stock moves in your direction. This is the *volatility crush*: the classic way to call the direction correctly and lose money anyway.
:::

## This Is Leverage

The appeal of options is big exposure for small money: a $3 premium exposes you to the movement of a $100 stock. That is leverage by definition — even though it never appears labeled "leverage" in your account. Every warning in the [leverage piece](/rehber/kaldirac) applies here, with one difference: in a margin account the loss arrives as a margin call; in options it arrives as the premium burning to **zero**. For buyers, a 100% loss is not a tail scenario — it is a common outcome.

## The Seller's Side

Collecting premium looks like steady income: most months, options expire worthless and the seller keeps the money. The problem is the distribution — gains are small and frequent, losses are rare and enormous. Selling uncovered calls carries the same unlimited-loss profile as a [short position](/rehber/long-short). In these strategies, "it made money every month for years" usually means "that month hasn't arrived yet."

::: ozet Summary
An option premium buys three things at once: direction, time and volatility. A stock buyer only has to be right about direction; an option buyer has to be right about all three. That makes options not "stocks for less money" but a different and harder bet — something to study out of curiosity long before it ever touches the portfolio.
:::

## Where You'll See It on This Site

There is no options chain on this site, and nothing can be traded here. But one output of the options market is on screen every day: the **VIX fear index** is derived from S&P 500 option prices and reads out the volatility the market expects over the next 30 days. You'll find it on the [Markets](/piyasalar) screen.`,
  },

  /* ---------------------------------------------------------------------- */
  "hedge": {
    title: "Hedging: What Protection Costs",
    dek: "Reducing risk without selling the position — and why every hedge sends an invoice.",
    bodyMd: `Hedging is not a prediction. It is an admission that you cannot make one.

If you know a position is going to fall, the answer is simple: sell it. Hedging is for the person who says "I don't know what happens next, but I want to cap what that uncertainty can cost me." The resemblance to insurance is not a metaphor — the logic is identical, and so is the bill.

::: tanim Hedge
A SECOND position opened to offset the loss on an existing one. The goal is not profit; it is capping the size of the loss in advance. A hedge that works loses money in the scenario where your portfolio wins — if it doesn't, it probably isn't a hedge but a second bet.
:::

## Why Not Just Sell?

Selling is always the simplest protection and usually the right answer. The cases where hedging beats it are narrow:

- **You don't want out of the position.** You believe the long-term thesis, but there's an earnings report, an election or a Fed meeting in the next three weeks.
- **Selling triggers tax.** Sitting on a large gain, selling pulls the tax event into today.
- **Getting back in is hard.** In a thinly traded name, exiting and re-entering means paying the [spread](/rehber/spread-likidite) twice.
- **Part of the risk bothers you, not all of it.** You like the company but think the whole sector is overheated.

If none of these apply, the answer is probably not a hedge but a **smaller position**. Trimming costs nothing; a hedge never costs nothing.

## Four Methods

| Method | What it protects | Cost | Upside |
|---|---|---|---|
| **Protective put** | Everything below a chosen price | Premium, paid upfront | Intact |
| **Covered call** | Small declines, partially | Premium income, negative cost | **Capped** |
| **Index short / inverse ETF** | Broad market risk | Financing + tracking drift | Reduced by the index |
| **Trimming the position** | Everything, proportionally | None | Reduced proportionally |

What the four rows say: there is no free protection. You pay upfront (put), you pay in upside (covered call), you pay in carry (short), or you pay in exposure (trimming).

## The Protective Put: Insurance With a Price Tag

This is the purest hedge. You keep the stock and buy a put that places a floor under it. The premium mechanics from the [options article](/rehber/opsiyonlar) apply unchanged.

::: ornek Three Months of Insurance
100 shares at $200. Position value: **$20,000**.
A three-month put struck at $180 costs $9 per share → **$900 premium**.

Stock falls to $140: the position loses $6,000, the put gains ~$4,000. Net loss $2,900 including premium — it would have been $6,000 unhedged.
Stock stays at $200: the put expires worthless, $900 gone. You lost **4.5%** with the stock unchanged.
Stock rises to $240: you gain $4,000 and hand $900 to the insurance. Net $3,100.
:::

Those three lines are the whole of hedging: **what you gain in the bad case is what you pay in the good and the flat case.** Renew the insurance every year and never get the crash, and a 4-5% annual drag eats a meaningful share of your return.

## Covered Call: Half a Hedge

You sell a call against stock you own and pocket the premium. That premium absorbs small declines. In exchange you have sold your upside: above the strike, your gain stops.

This is less a hedge than a **swap of outcomes** — you give up the large upside scenario for a small, certain income. Against a sharp fall it offers almost nothing: $3 of premium is no consolation in a stock that drops 40%.

## Hedging With an Index, and the Ratio Problem

To neutralise the market risk of a whole portfolio rather than single names, you hedge on the index side: [short](/rehber/long-short) an index ETF, or buy index puts.

That raises a sizing question. If your portfolio is $100,000, a $100,000 index short is not the right answer — your portfolio may be more or less volatile than the index. That sensitivity is called **beta**: a portfolio with a beta of 1.3 falls about 13% when the index falls 10%, so the hedge needs to be $130,000.

::: dikkat Basis Risk
What you are hedging and what you hedge it with are not the same thing. Hedge a semiconductor-heavy portfolio with the S&P 500, and semis can fall 15% while the S&P sits flat: the portfolio loses, the hedge earns nothing. This is **basis risk**, and it is the most commonly overlooked flaw in a hedge. The less the instrument resembles what it protects, the more theoretical the protection.
:::

## The Quiet Problem With Inverse ETFs

ETFs that rise when an index falls — inverse products, especially the 2x and 3x leveraged ones — look practical for hedging. The problem: they target the **daily** return and reset every day. In a volatile but directionless market, the inverse ETF loses value even when the index ends up exactly where it started.

The result: reasonable for an event a few days out, poor for protection carried for months. Over a long horizon the calendar works against the product.

## Three Costs That Never Go Away

1. **Premium or carry.** Put premium, financing on a short, an ETF's expense ratio. If the bad scenario never arrives, that money is simply gone.
2. **Forfeited upside.** Explicit in a covered call, premium-sized in a put, one-for-one in a short.
3. **Attention.** A hedge is a position: it has an expiry, a ratio and a renewal. A forgotten hedge stops protecting and becomes a standalone losing bet.

::: dikkat Over-Hedging
A portfolio stacking more than two overlapping protections is no longer hedged — it is **directionless**. Hedge every line item and the expected return, after costs, is below cash. At that point the answer is not more hedging but smaller positions and more cash, which gets you the same result for free.
:::

## Companies Hedge Too

This is the kind of hedging you will meet most often on screen. An American company earning half its revenue in euros uses forwards against an adverse move in the exchange rate. Airlines hedge fuel, food companies hedge wheat, miners hedge output.

Two consequences for reading a report:

- Hedging softens a bad quarter but **softens a good one too.** When the currency moves in the company's favour, it does not capture all of that gain.
- The hedge itself creates lines in the income statement. Items like "foreign exchange gain" or "loss on derivatives" can be mistaken for operating performance. This is one reason for the adjusted/GAAP distinction in the [earnings article](/rehber/bilanco).

::: ozet In Short
Hedging means giving up expected return in order to cap a loss. The right question is not "how do I hedge this" but **"if I can't carry this risk, why am I carrying it in this size."** The answer is usually to trim — free, simple, and it needs no maintenance. Hedging makes sense only when exiting has a real cost and the risk you're protecting against has a DATE on it: an earnings report, a meeting, an election.
:::

## Where You'll See It Here

No options or derivatives are traded on this site. But the traces of hedging show up in a few places:

- The **VIX fear index** on [Markets](/piyasalar) is the price of protection: when it rises, the market is willing to pay more for insurance.
- Lines in the [earnings analyses](/bilancolar/analizler) that mention currency or commodity effects are the result of a company's own hedging decisions.
- The dated events on [Calendar](/takvim) are what sets an institution's hedging schedule — protection is put on and taken off around these dates.`,
  },

  /* ---------------------------------------------------------------------- */
  "yatirimci-psikolojisi": {
    title: "Investor Psychology: The Most Expensive Mistakes",
    dek: "The weakest link in your portfolio is usually not a stock but a habit.",
    bodyMd: `The shared observation of people who last a long time in markets: most losses come not from missing information but from behavior. An investor applying the same strategy with discipline makes more difference than finding a better strategy.

What follows are documented behavioral patterns, and they share one property: they feel perfectly reasonable while you're living them.

## Loss Aversion

::: tanim Loss Aversion
The pain of a loss is roughly twice as strong as the pleasure of an equal gain. The result: instead of accepting a loss, you postpone it.
:::

In practice it looks like this: you sell the winning position early "to lock in profit" and hold the losing one because "it will come back." You end up throwing away what works and collecting what doesn't.

The antidote is a rule: when you open the position, decide where you will be wrong. The decision gets made while the loss is still not an emotional object.

## Herding and FOMO

The moment everyone starts talking about a stock is the moment the stock carries the most news — not the most future return. Where the crowd is thickest is usually where the price has already digested the idea.

::: dikkat Don't Buy Because It Went Up
The feeling of "missing out" is not a buy thesis. A good thesis is about the company: what it earns, what it grows, what it's priced at. The chart being steep answers none of those questions.
:::

## Anchoring

The price you paid becomes a reference point in your mind. But the market doesn't know your cost basis, and doesn't care.

"I'll sell when it gets back to my cost" ties the decision not to the company's value today but to an accident of your own history. The right question is: *would I buy this stock today, at this price, from scratch?* If the answer is no, your cost basis is not a reason to hold.

## Confirmation Seeking

Once you've settled on an idea, your brain hunts for supporting evidence and discounts the contradicting kind. The moment you're least critical of your biggest position is exactly the moment you should be most critical.

A simple counter-drug: when opening a position, write down the answer to *what development would prove me wrong.* Reasons written after the fact always acquit their author.

## Overconfidence

Two or three good calls produce the feeling of "I've figured this out." In markets, that feeling is usually paid for through position size — and the first wrong call multiplied by the bigger position erases the sum of the earlier right ones.

::: ornek Trading Frequency and Returns
One of the most replicated findings in behavioral finance: among individual investors, **those who trade more earn systematically less** than those who trade less. The reason isn't complicated — every trade costs spread and commission, and frequent trading multiplies the cost without improving the decisions.
:::

## Recency Bias

Whatever happened in the last three months feels like what will happen in the next three. That is why people are most optimistic at the top and most pessimistic at the bottom — precisely when they should be doing the opposite.

## What Actually Works

| Problem | Countermeasure |
|---|---|
| Emotional selling | Set the stop and the target when opening the position |
| FOMO | Write the buy thesis in one sentence; a chart is not a thesis |
| Anchoring | Ask "would I buy it today, from scratch?" |
| Overconfidence | Rule-bound position sizing, hard per-stock cap |
| Overtrading | Measure the quality of ideas, not the number of trades |

::: ozet Summary
Most of what you need to know about the market can be learned in months. What you need to know about yourself takes years and is learned expensively. Written rules are the only known way to shrink the tuition of that second education.
:::`,
  },

  /* ==== 3 · Reading a Company ============================================ */

  /* ---------------------------------------------------------------------- */
  "bilanco": {
    title: "Earnings Reports: What to Read, How",
    dek: "The book opens once a quarter — and the market really only reads three lines.",
    bodyMd: `Public companies answer for themselves every three months. The release is commonly called "the earnings report"; technically it is the full set of quarterly results, not just one financial statement.

::: tanim Quarterly Results
The company's disclosure of how much it sold in the quarter (**revenue**), how much profit remained (**net income**) and what that comes to per share (**EPS**). It usually ships with **guidance**: the company's own expectation for the next quarter and the year.
:::

## The Three Lines the Market Reads

**1. Revenue.** Total sales. It is independent of margins and accounting choices, which makes it the hardest number to dress up. Its growth rate is compared with the same quarter a year earlier.

**2. EPS (earnings per share).** Net income divided by the share count — what one share earned in the period.

**3. Guidance.** The company's forecast for what comes next. **On most days this is the one that matters.** A great quarter with weak guidance sells off hard; the reverse happens too.

::: dikkat What "Beat Expectations" Means
Analysts publish a consensus estimate for every quarter. What moves the price is not the absolute number but the **deviation from expectations** (the surprise). A company growing profit 40% can fall — because the market expected 55%. Price reacts not to what happened, but to the gap between what happened and what was expected.
:::

## The Four Possibilities

| Revenue | EPS | Typical reaction |
|---|---|---|
| Beat | Beat | All eyes on guidance |
| Miss | Beat | Bad — the profit may be cost-cutting |
| Beat | Miss | A margin problem — questioned |
| Miss | Miss | Hard selloff |

The second row surprises people: companies that beat on EPS but miss on revenue often get sold. The reason — cost-cutting has a floor, sales growth doesn't.

## When They Report

| Timing | Code | Meaning |
|---|---|---|
| Before the open | BMO (*before market open*) | Pre-session, usually 7:00–9:00 New York |
| After the close | AMC (*after market close*) | Post-session, usually 16:05–16:30 New York |

Most large companies prefer after the close: let the news be digested while the market is shut, hold the call, and let the price form by morning. That is why an earnings reaction usually appears at **the next day's open** — and sits on the intraday chart as a large gap.

::: ornek The Conference Call
About an hour after the numbers, management holds a call with analysts. If the numbers were good but the stock is falling during the call, the cause is almost always spoken guidance: an executive saying "we expect demand to normalize next quarter" tells a story no number in the table told.
:::

## The Three Statements

The full report contains three statements, each answering a different question:

| Statement | The question it answers |
|---|---|
| **Income statement** | What did it earn this period? |
| **Balance sheet** | What does it own and owe today? |
| **Cash flow statement** | How much money actually entered the till? |

The third is the least read and the hardest to dress up. Profit is computed under accounting rules; cash flow is money that actually moved. A company whose profit grows while its cash flow weakens usually gives its first warning right there. More: [Reading Cash Flow](/rehber/nakit-akisi)

## Where You'll See It on This Site

- The **[Earnings](/bilancolar)** screen: a day-by-day calendar tagged before-the-open / after-the-close. Cards show the revenue estimate, the EPS estimate and the company's market cap together — a number means little without knowing the size of the company behind it.
- **Stock page → Past Earnings:** reported EPS next to expected, with the surprise computed.
- **Today's Flow:** companies reporting today, on the same time axis as the economic releases.`,
  },

  /* ---------------------------------------------------------------------- */
  "nakit-akisi": {
    title: "Cash Flow: Reading Behind the Profit",
    dek: "Profit is an opinion, cash is a fact — and the gap between them is the earliest warning sign in the statements.",
    bodyMd: `"The company earned $2 billion this quarter" does not mean $2 billion entered its bank account. Profit is a number **computed** under accounting rules; cash is money **sitting** in the account. The two usually differ, and when the gap widens, the first place to look is the cash flow statement.

::: tanim Cash Flow Statement
The statement that shows the money actually entering and leaving the company in a period, under three headings. It is one of the three statements in the [quarterly report](/rehber/bilanco) — the least read and the hardest to dress up.
:::

## The Three Sections

| Section | The question | Example items |
|---|---|---|
| **Operating** | Does the business generate cash? | Collections, supplier payments, payroll |
| **Investing** | What is the cash spent on? | Plants, equipment, acquisitions |
| **Financing** | Who funds it, who gets paid back? | Borrowing, dividends, buybacks |

A healthy mature company has a familiar pattern: operating positive, investing negative (growth costs money), financing negative (dividends and buybacks flow back to shareholders). Deviating from the pattern is not a crime by itself — but it is a question.

## Why Profit and Cash Diverge

Accounting records revenue when it is **earned**, not when the money is collected. Three classic sources of divergence:

- **Receivables.** The sale was invoiced and the profit booked — but the customer hasn't paid. Profit, no cash.
- **Inventory.** Goods don't hit the expense line until sold. Cash drains while the warehouse fills; profit is untouched.
- **Depreciation.** The factory bought five years ago is expensed piece by piece each year. It lowers this year's profit without a single dollar leaving the till this year.

::: ornek One Quarter, Two Stories
A software company closes the quarter with $500 million in profit. The cash flow statement shows only $80 million of operating cash. Where's the gap? Customers signed three-year contracts, the revenue was booked into this quarter — the collections come over future years. The profit is real, but it is **not this quarter's money**. When growth slows, the same accounting runs in reverse, and the statement turns ugly fast.
:::

## Free Cash Flow

The most used derived measure:

**Free cash flow (FCF) = operating cash − capital expenditures**

In other words: after spending what it takes to keep the machine running, what does the business leave behind? [Dividends](/rehber/temettu), buybacks and debt payments all come out of this money. They do not come out of profit — profit is a calculation; dividends are paid in cash.

That is why serious long-run valuation debates run on FCF rather than P/E: the [valuation ratio's](/rehber/degerleme) denominator can be dressed up; money entering the till is much harder to fake.

## Stock-Based Compensation

::: dikkat SBC: the Real Cost That Isn't Cash
Tech companies pay employees in stock (*stock-based compensation*). On the cash flow statement it gets added back to operating cash — it isn't a cash outflow — which makes free cash flow look prettier than it is. But the cost is real: every new share printed **dilutes** your slice. Don't judge a strong-looking FCF without checking the size of SBC; at some companies it reaches half of FCF.
:::

## Warning Signs

One odd quarter doesn't convict a company; the signs matter as **trends**:

1. **Profit growing, operating cash not.** The classic early signal — a widening gap demands a better explanation every quarter.
2. **Receivables growing faster than sales.** Sales are "made" but the money isn't arriving; the trace of aggressive invoicing.
3. **A "one-off" item every quarter.** One-offs happen once a year. Every quarter means the name is wrong.
4. **Dividends and buybacks funded by debt.** If borrowing rises in the financing section while cash flows out to shareholders, the payout isn't being earned.

::: ozet Summary
Profit is an opinion; cash is a fact. When the two diverge for long, the one telling the truth is usually cash — accounting choices can be argued with, a bank balance cannot. If you're evaluating a company seriously, start with the income statement and finish with the cash flow statement.
:::

## Where You'll See It on This Site

On this site, earnings day shows **EPS and revenue** as estimate versus actual (the [Earnings](/bilancolar) screen and the stock page); the cash flow statement itself is not displayed. The original lives on the company's investor relations page and in its SEC filings (10-Q, 10-K) — this piece's job is that when you open that filing, you know which three lines to read.`,
  },

  /* ---------------------------------------------------------------------- */
  "degerleme": {
    title: "P/E and the Valuation Ratios",
    dek: "You can't tell whether a stock is cheap or expensive by looking at its price.",
    bodyMd: `A $20 stock is not cheaper than a $400 stock. Price alone says nothing; it starts saying something when set against the earnings the company produces.

::: tanim P/E Ratio
The share price divided by earnings per share. It answers: "how many years of the company's current profit am I paying for?" A P/E of 25 means that if today's profit stayed flat, the investment would pay for itself in 25 years.
:::

## Why a Ratio and Not a Price

::: ornek Two Companies
Company A: $20 stock, $0.50 of annual earnings per share → P/E **40**.
Company B: $400 stock, $40 of annual earnings per share → P/E **10**.
On screen, A looks cheap. Per dollar of earnings, B is four times cheaper than A.
:::

## The Main Ratios

| Ratio | Formula | When it's useful |
|---|---|---|
| **P/E** | Price ÷ earnings per share | Profitable, mature companies |
| **Forward P/E** | Price ÷ expected earnings | Growing companies |
| **P/B** | Market cap ÷ book value | Banks, asset-heavy businesses |
| **P/S** | Price ÷ sales | Companies not yet profitable |
| **EV/EBITDA** | Enterprise value ÷ EBITDA | Comparing indebted companies |
| **PEG** | P/E ÷ growth rate | Pricing the growth into the multiple |

The last row is genuinely useful: a company at a P/E of 40 growing 50% a year may not be more expensive than one at a P/E of 15 growing not at all.

## What a High P/E Says

One of two things:

1. The market expects this company's profits to grow fast.
2. The market is too optimistic.

The ratio won't tell you which. Only time does. Valuation therefore produces not a decision but a **question**: *what are the odds that the growth needed to justify this price actually happens?*

::: dikkat A Low P/E Is Not Cheapness
The lowest-P/E stocks are often the riskiest — the price is low because the market expects the profit to fall. When a sector is in structural decline, a falling P/E is normal. This is the *value trap*: the thing that looks cheap isn't cheap because it's mispriced, but because its earnings are melting.
:::

## The Rules of Comparison

A P/E on its own is meaningless. It needs three comparisons to mean anything:

- **Against its own sector.** A software company's P/E doesn't compare to a bank's.
- **Against its own history.** What band has the company traded in over five years?
- **Against its own growth.** Expecting the multiple to hold while growth slows is not realistic.

## Accounting Profit vs. Cash

The P/E's denominator is accounting profit, and accounting profit can differ from money actually entering the till. One-off items — a legal settlement, an asset sale, a restructuring — can inflate a quarter's profit and make the P/E look artificially cheap.

That is why a serious assessment also reads cash flow. A company whose profit grows while free cash flow weakens usually gives its first warning there. More: [Reading Cash Flow](/rehber/nakit-akisi)

::: ozet Summary
A valuation ratio is a shortcut, not an answer. It gets you to the question "what future does this price assume?" Deciding whether that future will arrive is not the ratio's job — it's yours.
:::

## Where You'll See It on This Site

The **Key Metrics** card on the stock page shows P/E, P/B and dividend yield together. On the [Companies](/sirketler) screen you can filter by sector and see the same sector's ratios side by side — which is the only way the comparison means anything.`,
  },

  /* ---------------------------------------------------------------------- */
  "piyasa-degeri": {
    title: "Market Cap, Float and Splits",
    dek: "A company's real size is not the share price — it's the price times the share count.",
    bodyMd: `"This stock is $8, it's so cheap" is an economically empty sentence. What a company costs to buy is not its share price but its **market cap**.

::: tanim Market Cap
Share price × total shares outstanding. The price tag on the entire company.
:::

## Why the Price Misleads

The share count is entirely the company's own choice. Two companies of equal size may have split their capital into 100 million pieces and 10 billion pieces. The first trades at $400, the second at $4 — and they can be exactly the same size.

::: ornek Same Company, Different Label
A company worth $40 billion:
· split into 100 million shares → the stock is $400
· split into 10 billion shares → the stock is $4
Either way it is the same company, earning the same profit, carrying the same debt.
:::

## Size Classes

| Class | Market cap | Character |
|---|---|---|
| Mega cap | Over $200B | Moves the index single-handedly |
| Large cap | $10–200B | The body of the S&P 500 |
| Mid cap | $2–10B | Between growth and maturity |
| Small cap | $300M – $2B | Volatile; Russell 2000 territory |
| Micro cap | Under $300M | Liquidity problems; be careful |

Size is not just a label — it is a risk description: as size shrinks, volatility rises, spreads widen and a single headline moves the price more.

## Float

Not all outstanding shares circulate. What remains outside founders', employees' and locked-up holdings is the **float**.

With a small float, the same size of buying moves the price more. This is the main reason newly listed companies swing so hard in the first months; when the lock-up expires, supply jumps and the price feels the pressure.

## Splits and Reverse Splits

**Split:** the company divides each share into several. A $900 stock split 3-for-1 becomes $300, and your share count triples. Your portfolio value doesn't change.

The goal is psychological, not economic: make the price look accessible, improve liquidity.

**Reverse split:** the share count is reduced and the price rises. Usually done to escape the exchange's minimum-price rule — and it is rarely a good sign.

::: dikkat A Split Creates No Value
"It's going to split, let's buy" is common and has no economic foundation. Cutting a pizza into eight slices instead of four doesn't grow the pizza. The short-lived rallies around splits come from the attention, not the event.
:::

## Enterprise Value

Market cap is the price of the company's equity; it excludes debt. If you were buying the whole company, you would be assuming its debt too.

**Enterprise value = market cap + net debt**

When comparing two indebted companies, enterprise value is more honest than market cap. Of two companies with equal market caps, the indebted one is actually the more expensive.

## Where You'll See It on This Site

Market cap appears in the metrics card on the stock page and on the cards of the [Earnings](/bilancolar) screen. It sits on the earnings card deliberately: "revenue estimate: $2 billion" means nothing until you know whether the company is worth $20 billion or $2 trillion.`,
  },

  /* ---------------------------------------------------------------------- */
  "temettu": {
    title: "What Is a Dividend?",
    dek: "The company sharing its profit with you — and the truth that it isn't free money.",
    bodyMd: `When a company makes a profit, it has two options: put the money back into the business, or hand it to shareholders. The second is called a **dividend**.

::: tanim Dividend
The company distributing part of its profit to shareholders in cash, per share held. In the US it is typically paid quarterly; in Europe usually once or twice a year.
:::

## How Yield Is Calculated

**Dividend yield = annual dividend ÷ share price**

A company with a $100 stock paying $3 a year yields 3%.

::: dikkat A High Yield May Not Be Good News
The formula's denominator is the price. When a stock halves, its yield doubles — without the company doing anything. An unusually high yield usually means the market is saying "this dividend won't survive." This is the *dividend trap*: when the cut arrives, you lose the income and the capital at once.
:::

## The Four Dates

| Date | What happens |
|---|---|
| Declaration | The company announces the amount and the schedule |
| **Ex-dividend** | Buyers from this day on do NOT receive the dividend |
| Record | The shareholder list is frozen |
| Payment | The money lands in accounts |

The critical one is the second. On the morning of the ex-dividend day the stock opens **lower** by the amount being paid. This is not a selloff; it's bookkeeping: a company about to pay out $3 has exactly $3 less in its till.

> A dividend is not free money. It is the company's own equity, moved into your pocket.

Understanding that also explains why "buy the day before the ex-date, sell the day after" doesn't work.

## Who Pays, Who Doesn't

**Payers:** mature, cash-generating companies with limited growth opportunities — utilities, big food and beverage brands, telecom, banks, insurance.

**Non-payers:** growing companies. For a business growing 30% a year, reinvesting the profit is worth more than paying it out. In tech, starting a dividend often reads as a message: "we've matured" — good news to some investors, bad news to others.

::: ornek Buybacks
US companies often share profit through **share buybacks** instead: buying their own stock in the market and retiring it. With fewer shares outstanding, each remaining share's slice grows; EPS rises. Economically it resembles a dividend; its tax treatment differs — and unlike a dividend, it can be quietly paused.
:::

## Total Return

A stock pays you in two components:

1. **Capital gains:** the price rising.
2. **Dividend income:** the cash paid out.

The sum is **total return**. Most index charts show price only; with dividends reinvested, the long-run difference is enormous. Over multi-decade horizons a meaningful share of the S&P 500's total return has come from dividends. "The index rose X% in 20 years" understates what investors actually earned.

## Where You'll See It on This Site

The **Key Metrics** card on the stock page shows the dividend yield. Interpreting it requires the sector: 4% is normal for a utility; the same number at a software company is a question that needs asking.`,
  },

  /* ==== 4 · Macro ======================================================== */

  /* ---------------------------------------------------------------------- */
  "faiz-tahvil": {
    title: "Rates, Bonds and the Yield Curve",
    dek: "The number that moves the stock market most isn't set in the stock market — it's set in bonds.",
    bodyMd: `Most equity investors don't follow the bond market. Yet the single biggest driver of stock prices is formed there: the **risk-free rate**.

::: tanim Bonds and Yield
**Bond:** an IOU. A government or company borrows, pays you interest at set intervals, and returns the principal at maturity.
**Yield:** the annual return you'd earn buying that bond at today's price and holding it to maturity.
:::

## The Inverse Relationship

This is the bond market's most basic and most confusing rule:

> When a bond's price rises, its yield falls. When its price falls, its yield rises.

The reason is simple: the interest the bond pays is fixed. Pay more for that fixed stream and your percentage return shrinks.

So "the 10-year yield rose" actually means "the 10-year bond's price fell" — investors are selling bonds.

## Why Stocks Care

A company's value today is the sum of its future earnings, discounted back to the present. When the discount rate rises, today's value falls.

The effect is not uniform:

| Company type | When rates rise |
|---|---|
| Growth companies with profits far in the future | Hit hardest |
| Mature companies generating cash today | Hit less |
| Banks | Margins can widen; may react the other way |
| Dividend stocks | Pressured — bonds become a competitor |

The last row is the one people skip: if the 10-year Treasury pays 5%, a utility yielding 3% is suddenly less attractive.

## Different Maturities Tell Different Stories

::: sayilar Three Maturities, Three Questions
2yr | What the market thinks the Fed does next
10yr | Long-run growth and inflation expectations
30yr | Very long-run trust; least watched, most meaningful
:::

**The 2-year yield** is almost pure monetary-policy expectation. It is the market's collective bet on the Fed's next two years, and it reacts faster than the Fed's own statements.

**The 10-year yield** is the economy's long-term price. Mortgages, corporate loans — much of the economy is indexed to it.

## The Yield Curve

Plot every maturity's yield as a curve and you normally get an upward slope: locking money up longer is riskier, so it demands more return.

::: dikkat The Inverted Yield Curve
When short-term yields rise above long-term ones, the curve **inverts**. The market is saying: "rates will stay high for now, then the economy will slow and cuts will come." Historically, most US recessions were preceded by an inversion. It is not a prophecy — its timing is measured in quarters, not months, and it has been wrong before.
:::

## Real Yield

Subtract inflation from the nominal rate and what remains is the **real yield** — the number that actually drives asset prices.

Nominal 5% with 4% inflation is a real 1% — money is still cheap. Nominal 3% with 1% inflation is a real 2% — tighter than the first case. The headline number misleads; take the difference.

## Where You'll See It on This Site

- The home page's side column shows **2, 5 and 10-year Treasury yields** with their daily change.
- The bottom ticker rotates the three maturities under "US Treasury."
- The [Markets](/piyasalar) screen has the full series and the yield curve.`,
  },

  /* ---------------------------------------------------------------------- */
  "enflasyon": {
    title: "Inflation Data: CPI, Core and PCE",
    dek: "Why a number published once a month reprices every asset there is.",
    bodyMd: `One of the two most awaited monthly releases in the US market is inflation (the other is jobs). The reason is indirect: inflation determines what the Fed does; the Fed sets rates; rates set everything.

::: tanim The Three Measures
**CPI:** the consumer price index. The price of the basket of goods and services households buy.
**Core CPI:** CPI excluding food and energy.
**PCE:** the personal consumption expenditures price index. The Fed's officially preferred measure.
:::

## Why Food and Energy Get Removed

It feels backwards: food and fuel are what people notice most. But those two items swing with weather and geopolitics. A cold snap or an oil supply cut pushes headline inflation up for a few months, then lets it fall back.

The central bank looks at the **persistent** trend, because a rate decision takes months to reach the economy. Reacting to a temporary spike with a hike would be an error whose effect arrives only after the spike has passed.

## CPI vs. PCE

| | CPI | PCE |
|---|---|---|
| Published by | Bureau of Labor Statistics | Bureau of Economic Analysis |
| Basket | Fixed weights | Includes behavioral shifts |
| Housing weight | Higher | Lower |
| Usually | Prints a bit higher | Prints a bit lower |
| Used by | Media, contracts, wage talks | **The Fed** |

PCE accounts for substitution: when beef gets expensive, people switch to chicken, and PCE reflects it. CPI, with its fixed basket, doesn't see the switch.

The Fed's **2% target** is defined on core PCE. Checking headline CPI and declaring "target missed" is reading the wrong thermometer.

## How to Read a Release

Every release carries four numbers, and the market compares all four:

| Number | Meaning |
|---|---|
| Monthly headline | Versus the previous month |
| Annual headline | Versus the same month last year |
| Monthly core | Ex food and energy, monthly |
| **Annual core** | The single most watched number |

::: dikkat The Base Effect
Annual inflation compares against the same month last year. If that month printed a huge increase, this year's annual rate falls even if nothing happens this month. That is the *base effect* — a meaningful share of "inflation is coming down" headlines is nothing more. The monthly series is the more honest read.
:::

## How the Market Reacts

If inflation comes in **above** expectations:
- Treasury yields rise (the Fed stays tight for longer)
- Growth stocks fall
- The dollar strengthens

Below expectations — the exact reverse.

The size of the reaction scales with the surprise, and the surprise is measured in **decimals**: a 0.1-point miss on annual core can move the index a full percent.

::: ornek Why a Small Miss Moves So Much
The market has priced in an expectation before the release. Price reacts not to the actual value but to the **gap between actual and expected**. That's why "inflation is 3%, still high" doesn't sink the market; if 3% was expected, nothing happens. If 3.2% was expected and 3.0% prints, the market rallies.
:::

## Where You'll See It on This Site

- The [Macro](/makro) screen: CPI, core CPI, core PCE and the policy rate together, with their history.
- The [Calendar](/takvim): release dates with times, the high-impact ones marked with a red dot.
- The **Today's Flow** strip on the home page shows the release time in both New York and Istanbul time.`,
  },

  /* ---------------------------------------------------------------------- */
  "istihdam": {
    title: "The Jobs Data: Payrolls, Unemployment and JOLTS",
    dek: "The single number released on the first Friday of the month is the report card for one of the Fed's two mandates — and sometimes good news is bad news.",
    bodyMd: `The Fed has two mandates written into law: price stability and **maximum employment**. The report card for the first is the [inflation data](/rehber/enflasyon); for the second, it is the jobs report released at 8:30 in the morning New York time on the first Friday of each month. It is one of the month's two most awaited numbers, and it can move markets as hard as inflation does.

::: tanim Nonfarm Payrolls (NFP)
The number of nonfarm jobs the US economy added (or lost) in a month. "Nonfarm" is a historical choice: seasonal farm work distorted the series, so it stays out. The number in the headline "the US economy added 187,000 jobs" is this one.
:::

## One Report, Two Surveys

The jobs report is not a single measurement; it is the union of **two separate surveys** released the same morning — and they sometimes point in opposite directions:

| | Establishment survey | Household survey |
|---|---|---|
| Who gets asked | Employers | Households |
| Its number | **Nonfarm payrolls** | **The unemployment rate** |
| Strength | Large sample, reliable trend | Also sees the self-employed |
| Weakness | Heavily revised later | Noisy month to month |

"Jobs grew but unemployment rose too" is not a contradiction — two different surveys counted two different things. The unemployment rate also depends on **participation**: someone who stops looking for work doesn't count as unemployed, and everyone who starts looking again first registers as "unemployed." A rising unemployment rate is sometimes not deterioration but hope returning.

## The Report's Four Numbers

::: sayilar What the Market Reads
NFP | New jobs that month; the gap versus expectations moves prices
X.X% | The unemployment rate — from the household survey
Hourly earnings | Wage growth: inflation's labor-market side
Participation | The share of working-age people in the labor force
:::

The least famous of the four can be the most critical: **average hourly earnings**. If wages grow fast, services inflation stays alive and the Fed's job isn't done. A strong NFP paired with hot wage growth pushes rate expectations straight up.

## The First Print Is a Draft

::: dikkat Revisions
Every NFP print is revised twice over the following two months, and revisions can run to the hundreds of thousands. A headline the market reacted violently to can quietly become a different number two months later. Once a year the whole series is benchmarked wholesale. Don't build a grand narrative on one month's data; a three-month average is always more honest than a single month's headline.
:::

## When Good News Is Bad News

The strangeness of the jobs number: the market's reaction depends not on the number itself but on **what it means for the Fed** — and that meaning changes with the regime.

::: ornek Same Number, Two Reactions
In a period of strong growth and high inflation, a 300k NFP print **sinks** stocks: it reads as "the economy isn't cooling, rates stay high for longer."
In a period dominated by recession fear, the same 300k print **lifts** stocks: it reads as "earnings won't collapse."
Before interpreting the release, know which regime you're in: is the market afraid of growth this month, or of inflation?
:::

The shortcut gauge for that regime question is the bond market: if the [2-year yield](/rehber/faiz-tahvil) spikes on a strong print, the market is pricing the Fed.

## The Month's Other Jobs Data

NFP doesn't stand alone; a calendar revolves around it:

| Release | When | What it says |
|---|---|---|
| **JOLTS** | Early month, two months lagged | Job openings — the breadth of labor demand |
| **ADP** | Two days before NFP | A private-payrolls estimate; doesn't always match NFP |
| **Weekly claims** | Every Thursday | First-time unemployment filings — freshest, noisiest |

The ratio JOLTS tracks — job openings per unemployed person — shows up regularly in Fed speeches: it is the plainest measure of whether the labor market is loosening.

::: ozet Summary
The jobs report is not one number but two surveys and a wage series; its first print is a draft, and its market meaning depends on the regime. The reading order: did NFP miss or beat, what did wages say, and how did bond yields react. When all three point the same way, the story is real.
:::

## Where You'll See It on This Site

- On the [Calendar](/takvim), the jobs report is marked high-impact alongside CPI; the time is written in both New York and Istanbul time.
- The [Macro](/makro) screen carries the unemployment rate and the payrolls series with their history.
- **Today's Flow** on the home page counts down to the release on the morning itself.`,
  },

  /* ---------------------------------------------------------------------- */
  "sahin-guvercin": {
    title: "Hawks and Doves: Reading the Fed's Language",
    dek: "The rate decision itself is rarely the surprise; the surprise lives in the sentences around it.",
    bodyMd: `The Fed held rates steady on meeting day. The market expected exactly that. The index still fell 1.5% within half an hour. Why?

Because the decision wasn't the news — **the two adjectives the Chair used in the press conference** were.

::: tanim Hawks and Doves
**Hawkish:** hard on inflation. Inclined to keep rates high, or raise them if needed. Priority: price stability.
**Dovish:** focused on growth and employment. Inclined to cut rates and loosen policy.
:::

## Why It Matters So Much

The policy rate is the discount rate every asset is priced against. A company's value today is its future earnings, discounted back; raise the rate and today's value falls. The effect varies:

- **Long-duration growth stocks** (profits ten years out, not today) are hit hardest by hikes.
- **Mature cash-generators** are hit less.
- **Banks** often react the other way: higher rates can widen their margins.

That is why a hawkish meeting changes **the mix inside the index** more than the index itself.

## What Is Said vs. What Is Heard

| Said | Heard |
|---|---|
| "We need to see sustained progress on inflation" | Cuts are far away — hawkish |
| "The risks are now roughly balanced" | A cut may be near — dovish |
| "We will remain data-dependent" | No promises — neutral, but tense |
| "It may be appropriate to hold at this level for some time" | *Higher for longer* — hawkish |
| "Cooling in the labor market has become visible" | The justification is being prepared — dovish |

::: ornek The Dot Plot
Four times a year, Fed officials publish their own rate expectations for the coming years as dots. If the median dot has shifted up since the previous quarter, a hawkish message has been sent before a single sentence is spoken. The number the market reacts to within seconds is often this one.
:::

## How to Read a Meeting Day

1. **14:00 New York — the statement.** The decision plus a short text, compared word by word against the previous one; the changed phrases are the news.
2. **14:30 New York — the press conference.** The Chair speaks. The most volatile half hour is usually here, and the first reaction frequently reverses.
3. **Afterwards,** yields, the dollar and the indexes reprice to the new expectation.

The most common mistake is treating the first five minutes as the verdict. The statement can be hawkish and the press conference dovish; the market turns twice.

::: dikkat The Data Can Outrank the Decision
What the Fed will do is told by the **data** before the Fed tells you. CPI and core PCE releases can move markets more than the decision day itself — because by decision day, the market has already priced it. See [Inflation Data](/rehber/enflasyon)
:::

## Where You'll See It on This Site

- The **[Macro](/makro)** screen: CPI, core CPI, core PCE and the Fed policy rate together.
- The **[Calendar](/takvim):** Fed meetings and inflation releases with their times; high-impact events marked with a red dot.
- **US Treasury yields:** the market's real expectation of the Fed is read here. More: [Rates, Bonds and the Yield Curve](/rehber/faiz-tahvil)`,
  },

  /* ---------------------------------------------------------------------- */
  "kur-riski": {
    title: "Investing in Dollars and Currency Risk",
    dek: "An investor buying US stocks from Türkiye is actually making two bets at once.",
    bodyMd: `When you buy a US stock, you haven't just invested in that company. You have also invested in the **dollar**. Your portfolio's return is the product of those two bets, and they move independently of each other.

::: tanim Currency Risk
The risk that an investment's value changes not through the asset's own price but through the exchange rate between currencies. For someone living in Türkiye, buying a US stock automatically opens a currency position.
:::

## The Two Layers

Two multipliers determine your return:

**Total return ≈ (1 + the stock's dollar return) × (1 + the currency move) − 1**

::: ornek Four Scenarios
Start: $1 = 40 lira, the stock is $100. You invested 4,000 lira.

· Stock +10%, currency flat → 4,400 lira. You made 10%.
· Stock flat, dollar +10% → 4,400 lira. You made 10%.
· Stock +10%, dollar +10% → 4,840 lira. You made **21%**.
· Stock +10%, dollar −10% → 3,960 lira. You **lost 1%**.

The last row matters: you were right about the company and still lost money.
:::

## Which Currency Should You Think In

The answer differs by person, and what decides it is the currency of your spending.

- If all your spending is in lira, your real return is **in lira**. You can gain 8% in dollars and still lose purchasing power in lira.
- If part of it is in foreign currency (tuition, travel, FX debt), measuring in dollars makes sense.

The percentages on screen are always in dollars. If your broker shows you a lira figure, that number has merged the two effects.

::: dikkat In High Inflation, Nominal Returns Mislead
Making 40% in lira in a year when inflation ran 45% is a loss of purchasing power. The question to ask about a return is never "how many lira did I make" but "can I buy more with this money than before."
:::

## Country Funds: the Same Problem, Mirrored

Country ETFs trading in the US (TUR, EWG, EWJ, EWZ) are denominated in dollars, but the stocks inside them trade in local currency. The two layers exist here too — just pointing the other way:

> If the local index rises while the local currency falls, the dollar-denominated fund can end flat or even down.

That is the most important thing to remember when reading the World Markets card: the percent you see is not the local market's move — it is the **dollar return**. More: [What Is an ETF?](/rehber/etf)

## What Drives the Exchange Rate

In the long run, the inflation gap and the real-rate gap between two countries dominate. In the short run, capital flows, geopolitics and risk appetite take over — meaning it is no easier to predict than stock prices.

The practical conclusion: the currency is a serious component of your return, and you have no control over it. What you can control is **how much of your portfolio is in foreign currency**.

::: ozet Summary
Buying foreign stocks is two decisions: which company, and which currency. If you don't make the second one consciously, it can decide the outcome even when you're right about the first.
:::

## Where You'll See It on This Site

All prices and percentages here are in dollars; no currency conversion is applied. The note under the **World Markets** card exists precisely to remind you that the card shows dollar-denominated country funds, not local indexes.`,
  },
};
