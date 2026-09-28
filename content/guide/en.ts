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

The **volume** row on the stock page is the crudest liquidity gauge, and it is the total across every exchange (the consolidated tape). For a while it showed a single exchange's volume (IEX), which was somewhere between 2% and 8% of the real figure — and because that share differs from stock to stock, ranking companies by volume gave the wrong order too. Prices on screen are delayed 15 minutes; to watch the spread live you need your broker's book.`,
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

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (Bessembinder 2018, SPIVA). */
  "endeks-fonu-mu-tek-hisse-mi": {
    title: "Index Fund or Single Stock?",
    dek: "Not two answers to the same question: one buys the market, the other buys a company, and the risks come from different places.",
    bodyMd: `The question "which stock should I buy?" usually skips the question before it: do you want to pick one company, or carry the whole market? They are not the small and large versions of the same job. Where the return comes from, where the risk comes from and what can mislead you are different in each.

::: tanim Terms in This Article
**Index Fund:** A fund that copies an index by its rules. In the US it usually trades as an ETF.
**Company-Specific Risk:** Risks that hit only that company: a product that flops, a lawsuit, a management mistake.
**Market Risk:** Risks that move all stocks together: rates, recessions, general fear.
:::

## The Average Stock Is Not Average

The stock market's long-run return is not spread evenly across stocks. The distribution is skewed: a large number of ordinary or poor outcomes is balanced by a very small number of enormous winners.

::: sayilar The Numbers Behind the Picking Problem
~4% | Share of stocks that produced all of the US market's net wealth creation, 1926-2016
>50% | Share of stocks over the same period that returned less than one-month Treasury bills over their lifetime
~90% | Share of US large-cap active funds trailing the S&P 500 over fifteen-year windows
:::

The first two lines come from the same study, and read together they say this: a single randomly chosen stock has less than an even chance of matching the market average. An index holds those few big winners **by definition**; it never has to know which ones they will be. The third line shows that professionals find the job hard too.

::: ornek Five Stocks, One Winner
Put equal money into five stocks. Four end the period down 20%, one ends up 300%.
The portfolio holding all five: (4 × −20 + 300) ÷ 5 = **+44%**.
Someone who picks just one of the five at random finishes at **−20%** four times out of five.
The average return is the same in both cases. What changes is the distribution of outcomes: a single-stock picker doesn't live the average, they live their own luck.
:::

## A Single Stock Carries Two Risks

When you buy one stock you carry both market risk and company-specific risk. The second can be diversified almost to zero with [diversification](/rehber/cesitlendirme); the first cannot.

The consequence matters: the market does not pay extra for a risk you could have diversified away. Holding a single stock means taking more risk, but the **expected** return does not rise automatically in exchange. For it to rise, the pick has to actually be right.

## Side by Side

| Topic | Index Fund | Single Stock |
|---|---|---|
| **The Bet** | On the market as a whole | On that company beating the market |
| **Cost** | Annual expense ratio, usually low | No expense ratio, but research time |
| **Bad Scenario** | Falling with the market | A company-specific collapse, down to zero |
| **Monitoring Load** | Low | Earnings every quarter, news, guidance |
| **How You Get It Wrong** | Timing | Timing and selection |

## When a Single Stock Makes Sense

Buying a single stock is a legitimate choice; you just need to know you are making a claim. That claim is usually defensible under three conditions:

1. **You have a view on the company**, and it differs from what the market has priced in. "Good company" is not a view; good companies are already priced expensively. More: [P/E and the Valuation Ratios](/rehber/degerleme)
2. **You have the time to follow it.** Reading earnings, tracking guidance changes and noticing when the thesis breaks all take continuity.
3. **The position size is limited.** One company collapsing doesn't take your portfolio somewhere you can't carry. More: [Risk Management](/rehber/risk-yonetimi)

Some investors think in two layers for this reason: most of the portfolio in a broad index, a small part in companies they hold a view on. That is not a recommendation, just a frame that accepts the two tools do different jobs.

::: dikkat An Index Fund Is Risky Too
An index fund reduces company-specific risk, not market risk. The S&P 500 fell by more than half from its peak in 2008-2009, and everyone holding the fund lived through that drop one for one. And in a cap-weighted index the largest few companies carry a large share of the index; "500 companies" is less spread out than it sounds. More: [What Is an Index?](/rehber/endeks)
:::

::: ozet Summary
An index fund collects the market's return without having to answer "which company will win." A single stock claims to have an answer to that question. Both are legitimate; trouble starts when you are right about a theme and pick the wrong company, or forget that what you hold is a claim.
:::

## Where You'll See It on This Site

On the [Compare](/karsilastir) screen you can draw a stock on the same scale as SPY or QQQ: what the pick added or took away relative to the index reads off a single chart. ETF pages show a fund fact box instead of company metrics.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (SEC kararları, izahnameler). */
  "kripto-etf": {
    title: "Crypto ETFs: What Do Spot Bitcoin and Ether Funds Hold?",
    dek: "Real bitcoin inside an exchange-traded fund: what it costs you comes from the structure of the package as much as what it earns.",
    bodyMd: `Until January 2024 there was no ETF on a US exchange that held bitcoin itself. There were funds holding futures contracts, and over-the-counter trusts whose prices often drifted far from the assets inside. With the SEC's approval, funds holding **actual bitcoin** began trading on exchanges for the first time; six months later the same came for ether. This article explains what these funds are, not whether to buy them.

::: tanim Spot Crypto ETF
A fund that holds the crypto asset itself (bitcoin or ether) and whose shares trade on US exchanges like a stock. The asset is held by a custodian, mostly in wallets not connected to the internet.
:::

::: zaman Regulatory Timeline
October 2021 | The first **futures-based** bitcoin ETF starts trading. It holds bitcoin futures contracts, not bitcoin.
January 10, 2024 | The SEC approves spot bitcoin ETFs; trading begins the next day.
July 23, 2024 | Spot ether ETFs begin trading.
July 29, 2025 | The SEC allows fund shares to be created and redeemed directly in crypto rather than cash.
:::

## What's Inside, and How the Price Forms

Each fund share represents a set amount of bitcoin. The share count changes as large broker-dealers (authorized participants) bring assets to create new shares or hand shares back to take assets out. This mechanism keeps the fund's price close to the value of the bitcoin inside: if the gap widens, arbitrageurs step in.

The fund's net asset value (NAV) is struck each day against a **reference price** calculated at a set time, not against a single crypto exchange's price. More: [What Is an ETF?](/rehber/etf)

## Where the Tracking Gap Comes From

A fund's return never equals bitcoin's return exactly. Three things open the gap:

- **Expense ratio.** The annual management fee is deducted in small daily slices from the bitcoin inside the fund. At launch most of the new funds sat around 0.2-0.25% a year; the oldest fund, converted from a trust, started at 1.5%. Fees can change; the current rate is on each fund's own page.
- **Trading hours.** Bitcoin trades seven days a week, around the clock; the fund trades only during US hours. A weekend move shows up in the fund as a single gap at Monday's open.
- **Spread and premium/discount.** Fund shares can change hands slightly above or below NAV. More: [Liquidity and the Spread](/rehber/spread-likidite)

::: ornek The Math of a Flat Year
Bitcoin ends a year where it started. A fund with a 0.25% expense ratio closes the same period about **0.25% behind**, because the fee deducted every day has shrunk the amount of bitcoin in the fund.
In a fund with a 1.5% expense ratio, the same gap is 1.5%. Over ten years, compounded, that becomes a gap of **about 14%**.
:::

## Three Routes, Three Structures

| Topic | Crypto Directly | Spot ETF | Futures ETF |
|---|---|---|---|
| **What You Hold** | The asset itself | A fund share | A share in a fund holding futures |
| **Keys** | With you or the platform | With the custodian | None; the asset is never held |
| **Trading Hours** | Any time | US session | US session |
| **Extra Cost** | Platform and withdrawal fees | Expense ratio | Expense ratio + roll cost |
| **Can You Withdraw It** | Yes | No, you can only sell | No |

Futures-based funds carry one more cost beyond the last row: each month expiring contracts are swapped for later ones, and later contracts are usually more expensive. That "roll cost" does not exist in a spot fund.

## The Limits the Structure Brings

Spot crypto funds are registered in the US as **trusts**, not under the 1940 Act that governs classic investment funds. In practice, some investor protections specific to investment funds (board structure, portfolio rules) don't apply in the same way. What the fund does is written in its prospectus, and that is the one document worth reading.

As a fund shareholder you have no claim on the bitcoin itself: you can sell your shares on the exchange, but you can't withdraw the bitcoin inside to your own wallet.

::: dikkat The Wrapper Doesn't Change the Volatility
Putting bitcoin inside an ETF doesn't make it less volatile. Bitcoin lost roughly two thirds of its value from the start to the end of 2022; a spot fund existing that year would have lived the same drop one for one. Trading on an exchange makes the product look familiar, not its risk. More: [What Is Volatility?](/rehber/volatilite)
:::

::: ozet Summary
A spot crypto ETF is a package that carries a crypto asset into a brokerage account. It removes the custody, key and platform problems; in exchange come the expense ratio, session hours and the fact that you can never take the asset into your own hands. The volatility it carries as is.
:::

*This article is based on SEC decisions and fund prospectuses; expense ratios can change at the fund sponsors' discretion.*`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (SEC ADR ve SPAC bültenleri). */
  "adr-spac": {
    title: "What Are ADRs and SPACs?",
    dek: "Companies that trade on US exchanges without being American, and companies that go public before they have a business.",
    bodyMd: `Not every ticker on a US exchange stands for a company incorporated and operating in the US. Two structures sit outside that rule, and each carries its own risks: **ADRs**, which represent shares of foreign companies, and **SPACs**, which have no business on the day they go public.

## ADRs: A Receipt for a Share Traded Elsewhere

::: tanim ADR (American Depositary Receipt)
A dollar-denominated certificate that trades on a US exchange and represents shares of a foreign company traded in its home country. The shares themselves sit with a depositary bank; in the US, the receipt representing them is what trades.
:::

The mechanism is simple: a US depositary bank buys shares on the company's home exchange, holds them with a local custodian and issues ADRs against them in the US. Each ADR represents a set number of local shares, and that ratio doesn't have to be one to one.

::: ornek Ratio and Price
One TSMC ADR in the US represents **5 ordinary shares** traded in Taiwan. So the ADR's price is roughly:
Taiwan share price × 5 ÷ the Taiwan dollar per US dollar rate.
If the gap widens, brokers convert between shares and ADRs to close it. In countries where conversion is restricted, an ADR can trade at a lasting premium or discount.
:::

### Three Levels

| Level | Where It Trades | Can It Raise Capital | Reporting |
|---|---|---|---|
| **Level I** | Over the counter (OTC) | No | Lightest |
| **Level II** | NYSE or Nasdaq | No | Annual report to the SEC |
| **Level III** | NYSE or Nasdaq | Yes, a US offering | Most extensive |

Foreign companies file an annual **20-F** and periodic **6-K** reports instead of 10-Ks and 10-Qs. Many don't publish quarterly reports at all, reporting semiannually or under their home country's rules. More: [How to Read a 10-K and 10-Q](/rehber/10k-10q)

### The Hidden Layers of an ADR

- **Currency risk is built in.** The ADR trades in dollars, but the company's earnings and its local share price are in its own currency. If the local share holds steady while the local currency falls against the dollar, the ADR falls. More: [Currency Risk](/rehber/kur-riski)
- **Dividend tax is withheld by another country.** Tax on an ADR's dividend is withheld by the company's home country, not the US; the rate described under W-8BEN doesn't apply there.
- **There is a depositary fee.** The depositary bank may charge a custody fee of a few cents per ADR a year, usually deducted from dividends or collected through the broker.

## SPACs: Money First, Company Later

::: tanim SPAC (Special Purpose Acquisition Company)
A shell company with no business of its own that raises money in an IPO and uses it, within a set period, to merge with a private company. When the merger closes, the target company has entered the stock market by this route.
:::

::: akis The Path of a SPAC
IPO | Usually $10 per unit, cash into a trust account
Search | Usually 18-24 months
Deal Announcement | The target and its valuation are disclosed
Vote and Redemption | Shareholders stay or take their money back
After the Merger | The target trades under its own ticker
:::

The money raised sits in a trust account, usually in short-term US Treasury bills. The shareholder's most important right is the **redemption right**: if they don't like the target, they can hand their shares back at the vote for the amount in the trust (about $10 a unit plus accrued interest). If the deadline passes without a deal, the money is returned to shareholders.

## The Sponsor's Stake: The Arithmetic of Dilution

The sponsor that sets up the SPAC buys **founder shares** before the IPO for a very small sum; these are usually about one fifth of total shares after the offering. The higher the redemption rate, the heavier those shares weigh.

::: ornek A $100 Million SPAC
The IPO sells 10 million shares at $10: $100 million in trust. The sponsor holds 2.5 million founder shares. Total: 12.5 million shares.
At the merger vote, **80%** of public shares are redeemed. $20 million stays in trust, with 2 million public shares outstanding; the sponsor's 2.5 million shares stay where they are.
Trust cash per remaining share across the 4.5 million shares: 20 ÷ 4.5 ≈ **$4.4**. If the merged company starts trading at $10, the target company itself has to close that gap.
:::

Redemption rates often ran very high after 2021, and many companies fell far below the SPAC's $10 starting point after merging. With rules effective in mid-2024, the SEC raised disclosure requirements on sponsor interests, dilution and projections in SPAC mergers, bringing oversight closer to that of a traditional [IPO](/rehber/halka-arz).

::: dikkat Selling Pressure After the Merger
Founder shares and the shares of investors who provide extra financing alongside the merger are often locked up for a set period. When that period ends, supply can jump at once. For a company that came through a SPAC, knowing that calendar matters as much as knowing the lockup after a regular IPO.
:::

::: ozet Summary
An ADR carries a foreign share in dollars and brings currency risk, another country's tax and a depositary fee with it. A SPAC raises the money first and finds the company later; the redemption right protects the shareholder, while the sponsor's founder shares dilute those who stay as redemptions rise. In both, reading the price without knowing the structure behind the ticker leaves you short.
:::

## Where You'll See It on This Site

On an ADR's page, price and market value are in dollars; the move on the company's home exchange and the currency effect are both reflected in those numbers. Upcoming IPOs are listed on the [Calendar](/takvim) screen.`,
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
  "teknik-gorusler": {
    title: "Technical Views: What BUY, HOLD and SELL Mean",
    dek: "A view is not an order; it is a plan with a zone, a point of giving up and a sequence.",
    bodyMd: `Every card on the technical analysis screen starts with one word: BUY, HOLD or SELL. One word reads like an order ("buy it all now", "sell it all now"), but that is not what it means. The word summarises the plan beneath it, and the plan always answers three questions: **where to buy, where to sell, where to give up.**

::: tanim Technical View
A summary of whether the trend, support and resistance and momentum on the daily chart give a reason for a new purchase today. It is not a price forecast but a conditional plan: "if price is in this zone, this; if it falls below that level, that".
:::

## Three Views in One Table

| View | What the Chart Says | What the Edition Contains |
|---|---|---|
| BUY | Trend up, price above the 50-day average, an entry zone on a support | Entry zone, stop, 1–3 targets |
| HOLD | Mixed picture, or a sound trend with price far from the zone | A zone if any, supports and resistances |
| SELL | Trend down, price below the 50 and 200-day averages | Levels to sell into on a rally (resistances), support |

## BUY: A Plan to Buy in a Zone

BUY does not mean "buy now at any price". The plan gives an **entry zone**, a range rather than a single price. If price is above the zone, the plan does not chase it and waits for a pullback. If price falls under the stop, the plan is void.

The first target is at least 1.5 times the risk away, measured from the top of the zone to the stop. If the nearest target is closer, the view is not BUY; the reward does not cover the risk.

::: ornek A Hypothetical Plan
Entry zone 96–100, stop 92, targets 112 and 120.
Risk from the top of the zone to the stop: 100 − 92 = **8**.
Reward to the first target: 112 − 100 = **12**. Ratio 1 : 1.5.
:::

### All at Once or in Steps?

Neither breaks the plan; the difference is how the risk is measured.

- **At Once:** Buy anywhere in the zone in one go. The risk is taken at its worst, from the top of the zone to the stop.
- **In Steps:** Spread the purchase across the zone (part at the top, the rest toward the bottom). The average cost falls and the distance to the stop shrinks. The price: if price turns before reaching the bottom, the position stays half-built.

::: ornek One Plan, Two Executions
Capital of $10,000, at most 1% risk per idea: $100.
All at 100: risk of 8 per share, at most **12 shares**.
In steps, 6 shares at 100 and 6 at 96: average cost 98, risk of 6 per share, total risk **$72**.
If price rises without touching 96, you hold 6 shares; risk and reward are both halved.
:::

Whichever route you take, the stop distance sets the size. More: [Risk Management](/rehber/risk-yonetimi)

### If You Already Own It

The position is held and the stop is watched as the point of giving up. Targets are not a single exit but stops for taking profit. A common approach is to sell part at the first target and carry the rest to the next: part of the gain is locked in and the rest still rides the move.

## HOLD: Wait, Don't Sell

HOLD covers two situations: the indicators disagree, or the trend is sound but price is far from the entry zone. The answer is the same in both: no rush to buy, no reason to sell.

- **If You Don't Own It:** If a zone is given, wait for price to reach it and for confirmation: a close that holds in the zone, above-average volume. Without a zone, watch the listed supports and resistances.
- **If You Own It:** HOLD does not mean sell. Watch the stop if one is given, otherwise the nearest support. A break lower can turn the view to SELL.

::: dikkat Waiting for BUY Before Adding
Growing a position in a weakening stock because "it got cheaper" can mean putting more money into a wrong idea. Waiting for the view to turn to BUY before adding ties the decision to the chart recovering, not to the price.
:::

## SELL: No New Buying, Reduce Into Rallies

A SELL view publishes no entry zone and no stop, because the plan is not a buying plan. The levels listed as targets are the **resistances** where a rally could stall.

- **If You Don't Own It:** No new purchase. SELL is not a call to short either. Buying waits for the view to turn to HOLD or BUY, that is, for price to reclaim the averages.
- **If You Own It:** SELL does not mean "sell everything now". The plan sees rallies into resistance as a chance to reduce the position. Exiting can be staged: part at the first resistance, the rest at the next.

::: dikkat If No Rally Comes
The plan also gives a support level. If that support breaks, the decline continues, and waiting for a rally then adds risk. A staged exit is a way to use an opportunity, not a way to ignore a decline.
:::

The screen cannot know how much to sell; your cost, the position's weight in your portfolio and your tax position decide that. For Turkish residents, gains on foreign shares are declared, and the timing of a sale can change the tax. More: [Tax on Foreign Shares](/rehber/yurt-disi-hisse-vergisi)

## Why the View Rarely Changes

The view is reviewed in every edition but changes only on a concrete trigger:

- a moving average breaking or being reclaimed,
- price falling under the stop,
- the entry zone being rebuilt.

A single sharp day does not flip the view. Indicators come from daily closes; the plan is written for readers of the daily chart, not for intraday trading. A view that flipped from edition to edition would be tracking noise, not a plan.

::: ozet One-Line Summary
BUY is a plan to buy in a zone, HOLD is waiting without selling, SELL is no new buying and treating rallies as a chance to reduce; in all three, the stop distance and your own situation decide how much to buy or sell.
:::

This article explains a method. **Not Investment Advice.**`,
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
  "kisa-sikisma": {
    title: "What Is a Short Squeeze?",
    dek: "A stock doubling not because anyone wants it — but because the sellers are forced to buy it back.",
    bodyMd: `Sometimes a stock doubles in two days with no news at all. Nothing changed at the company, earnings are the same, the sector is the same. What drove the price up was not buyers' appetite; it was **sellers' obligation.**

::: tanim Short Squeeze
A chain reaction in a heavily shorted stock that begins with a price rise. Losing shorts must BUY the stock back to close out; that buying pushes the price higher, which forces more shorts to close. The rally manufactures its own fuel.
:::

## The Mechanism

Recall the mechanics from the [long/short article](/rehber/long-short): a short seller borrows the stock, sells it, and **must return it**. The only way to return it is to buy it in the market.

This is what separates shorting from every other position: someone who is long is never forced to sell — they can wait. Someone who is short cannot. Three things force their hand:

1. **Margin call.** If losses eat the collateral, the broker closes the position for them.
2. **Recall of the borrow.** Whoever lent the shares can ask for them back, and the short has no say.
3. **Cost of the borrow.** In a squeezing stock the annualised borrow fee can exceed 100%. Waiting burns money on its own.

## What Makes a Squeeze Possible

Not every falling stock squeezes. The odds rise when three things line up:

| Condition | What to look at | Why it matters |
|---|---|---|
| **Heavy short interest** | Short interest above 20% of the float | Many people will be forced to close |
| **Small float** | Few shares actually available to trade | The same buying moves the price more |
| **Days to cover** | Short interest divided by average daily volume | Everyone cannot exit at once |

The third is the most revealing. If short interest is eight times daily volume, all the shorts closing means eight full days of volume. The door is narrow.

::: ornek How Narrow the Door Is
A stock has a 50 million share float and trades 2 million shares a day. Short interest is 15 million shares — 30% of the float, 7.5 times daily volume.
If the price rises 20%, some shorts hit their collateral limits and start covering. But the exit is 2 million shares wide per day: closing all 15 million takes days of sustained buying pressure.
That buying pressure lifts the price, and the higher price pushes new shorts to their limits. The loop feeds itself.
:::

## A Squeeze Is Not a Valuation

This is the most misleading part: as the price rises, so does the story. "So the company must be good after all" sounds very convincing mid-squeeze. But the cause of the move is not the company — it is **positioning**.

The practical consequence: when the squeeze ends, nothing holds the price up. The forced buyers are done, there are no new buyers, and the price usually returns near where it started. The rise is fast; so is the fall.

::: dikkat "Riding the Squeeze"
Spotting a squeeze in advance and profiting on the long side is theoretically possible and practically very hard, for two reasons:
**Timing.** A heavily shorted stock can sit still for months; the squeeze may come weeks later, or never.
**Volatility.** Intraday swings of 30% are normal in a squeezing name. Set a [stop](/rehber/emir-tipleri) and you get swept out before the squeeze begins; skip it and your position size starts running you.
This is one of the setups with the highest chance of being right and losing money anyway.
:::

## Gamma Squeezes

Sometimes the forced buyer is not the shorts but the **dealers who sold the options.** Heavy call buying in a stock leaves the seller of those calls needing to hold shares to offset the risk — and needing more of them as the price rises. It is the derivatives-side version of the logic in the [options article](/rehber/opsiyonlar).

The two types usually appear together and feed each other. Telling them apart is hard; the outcome is the same either way: a mechanical, temporary, violent rally.

::: ozet In Short
A short squeeze is a positioning story, not a company story. What lifts the price is not that someone wants the stock, but that someone HAS to buy it back. When the obligation ends, so does the fuel. The right question during a squeeze is not "what is this company worth" but **"how many forced buyers are left"** — and nobody outside can know that precisely.
:::

## Where You'll See It Here

If you spot a name up 15-20% on its own in the top gainers on [Markets](/piyasalar) while the rest of the index sits flat, the first hypothesis is positioning, not news. The volume line on a [stock page](/sirketler) helps too: squeezes run at several times average volume, because forced buying is real buying.`,
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

  "13f-nedir": {
    title: "What Is a 13F: How to Read Famous Investors' Portfolios",
    dek: "The filing that shows what Buffett bought is real, but it is three months late and only part of the picture.",
    bodyMd: `Every institution in the US that manages more than $100 million in stocks must report its holdings to the SEC at the end of each quarter. That report is the 13F. Every headline about what Berkshire Hathaway, Pershing Square or Bridgewater "bought" comes from this document.

::: tanim 13F
A mandatory SEC filing listing a large institutional manager's US stock positions at quarter end, with share counts and dollar values. It is filed within 45 days after the quarter ends.
:::

## What It Shows

A 13F line tells you three things: which company, how many shares, and their value at the quarter-end price. Put two consecutive filings from the same manager side by side and the buying and selling appear:

- **New:** a position that was not there last quarter.
- **Added / Trimmed:** a position whose share count changed.
- **Sold Out:** a position that was there last quarter and is gone now.

The comparison uses SHARE COUNTS, not dollar values. If a stock rises 30%, its value rises 30% too; the manager may not have bought a single share.

## What It Doesn't Show

::: dikkat Four Blind Spots
**Delay:** The filing can come up to 45 days after quarter end. You see the June 30 portfolio in mid-August; the manager may have sold everything in between.
**Short Selling:** Short positions are not reported. If a fund hedges one stock by shorting another, you only see the long side.
**Cash and Bonds:** How much of the portfolio sits in cash is invisible.
**Foreign Shares:** Only securities traded in the US are listed.
:::

## Option Lines Can Mislead

Calls and puts appear in a 13F too. But the value on that line is not the premium paid for the option; it is the value of the UNDERLYING shares. A "$10 billion put" headline does not mean the fund paid $10 billion; it is the quarter-end value of the shares the options cover. Opening Bell shows these lines separately from the stock portfolio and leaves them out of the weights.

## Why Copying Is Risky

Buying what a famous investor bought looks like a tempting shortcut. It has three problems:

1. **You are late.** By the time you see it, the trade happened weeks, often months, ago. The price may already have moved.
2. **You don't see the whole.** The position may be part of a hedge or another asset you cannot see.
3. **Their scale is not yours.** A 1% experiment in a portfolio of hundreds of billions could be your entire savings.

A 13F is a source of ideas, not a buy signal. Trying to understand why an investor believes in a company teaches far more than copying what they bought.

## Congressional Disclosures

Members of the US Congress and their spouses must report stock trades above $1,000 within 45 days under the STOCK Act. These reports differ from a 13F in two ways:

| Criterion | 13F | Congressional Report |
|---|---|---|
| Scope | Portfolio at quarter end | Individual trades |
| Amount | Exact value | Range (e.g. $1,000,001 - $5,000,000) |
| Delay | Quarter end + 45 days | Trade + 45 days |

Because the amount is only reported as a range, the true size of a trade is unknown; reading the middle of the range as a single number would be invented precision.

::: ozet Summary
A 13F is a quarter-end snapshot of large managers: real but late and incomplete. On an option line the value belongs to the underlying shares. Congressional reports list individual trades with amount ranges. None of them alone is enough for a buy or sell decision.
:::`,
  },


  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (SEC T+1, street name). */
  "abd-hisse-nasil-alinir": {
    title: "How to Buy US Stocks: Step by Step",
    dek: "The five links lira passes through on its way to becoming a US share, and the mostly invisible price paid at each one.",
    bodyMd: `Buying a US stock from Türkiye looks like pressing a single button, but behind it there are five separate steps: choosing a broker, opening an account, converting money into dollars, placing an order and holding the shares. Each has its own cost and its own decision. This article walks through them in order; it doesn't recommend any particular firm.

::: akis From Lira to Shares
Broker | Domestic or foreign, licensed
Account | Identity checks · W-8BEN
Currency | Lira → dollars, at a spread
Order | Limit or market order
Custody | T+1 settlement, held in the broker's name
:::

## 1. Choose a Broker

There are two routes. The first is the foreign markets service of a broker licensed in Türkiye: you open the account at home, and the firm routes your order through a foreign correspondent broker behind the scenes. The second is opening an account directly with a broker abroad: your money leaves the country, and that firm is your counterparty.

The two differ in cost, protection framework and paperwork. The items that decide which one suits you are in a separate article: [What to Look for in a Broker](/rehber/araci-kurum-secimi)

## 2. Open the Account and Verify Your Identity

Every licensed firm has to verify who you are before opening an account. This is called **KYC** (know your customer): an ID, proof of address, sometimes questions about the source of your income and savings. Most firms also run a suitability test of your investing experience; access to products like options or margin depends on it.

A US stock needs one more form: **W-8BEN**. It declares that you are not a US taxpayer and that you are resident in Türkiye, and it sets the US tax withheld from your dividends. Foreign brokers have you sign it when opening the account; domestic brokers usually ask for the same form on behalf of their correspondent. More: [W-8BEN and 1042-S](/rehber/w-8ben)

## 3. Send the Money and Convert It to Dollars

There are two ways to fund the account: convert to dollars at your bank and send them, or send lira and convert inside the broker. Either way, a currency spread is paid at conversion, and it never shows up on the statement as "commission."

::: ornek The Spread You Pay Twice
Say you convert 100,000 lira into dollars. If the rate you get is 0.5% away from the market mid-rate, **500 lira** disappears at conversion.
Turning the same money back into lira years later costs another 0.5%.
Without the stock moving at all, the round trip costs roughly **1%**. The question to ask when comparing isn't "what's the commission" but "what rate do you convert at."
:::

If you wire money to a broker abroad, add the SWIFT fee and sometimes a cut taken by an intermediary bank. From the moment money leaves lira for dollars, the portfolio also carries a currency bet. More: [Currency Risk](/rehber/kur-riski)

## 4. Place the Order

An order has three parts: the ticker (for example [AAPL](/hisse/AAPL)), the quantity (shares or a dollar amount) and the order type.

- A **market order** fills immediately at the best available price; it doesn't guarantee the price.
- A **limit order** fills only at your price or better; it doesn't guarantee a fill.

The regular session opens at 09:30 New York time; in Türkiye that falls at 16:30 or 17:30 depending on US daylight saving time. Spreads widen in the pre-market and after-hours sessions, and most brokers accept only limit orders there. More: [Order Types](/rehber/emir-tipleri)

## 5. Settlement and Custody

When a trade executes, the shares aren't yours immediately; US settlement is **T+1**, completing the next business day. Before May 28, 2024, it took two business days.

After settlement, the shares are usually registered not in your name but in the broker's. This is called **street name**: the central depository's records show the broker, and the broker's own books show you. Buy through a domestic broker and the chain grows one link longer: you, the domestic broker, the foreign correspondent, the central depository. If one of the firms fails, this chain determines which protection framework applies.

::: dikkat Record Keeping Is the Next Step, Not an Option
For someone resident in Türkiye, gains from selling foreign shares and dividends are subject to declaration. Gains are calculated in lira, at the exchange rates of the purchase and sale dates. Recording each trade's date, quantity, dollar amount and fees from the start turns the March filing into a calculation; not doing so turns it into an archaeological dig. More: [How Gains on Foreign Stocks Are Taxed](/rehber/yurt-disi-hisse-vergisi)
:::

::: tanim Terms in This Article
**Ticker:** The stock's short code on the exchange. AAPL for Apple, NVDA for Nvidia.
**KYC:** A firm's obligation to verify a client's identity and source of funds.
**T+1:** A trade becoming final through settlement one business day after it executes.
**Street Name:** Shares being registered in the broker's name rather than the investor's.
:::

::: ozet Summary
The total cost of a US stock isn't just the commission: currency spread, transfer fees, bid-ask spread and custody fees add up together. Once all five steps are set up correctly, later purchases come down to a single order; set up badly, the same cost is paid again on every purchase.
:::

## Where You'll See It on This Site

Find the company you're looking for through the search box at the top or the [Companies](/sirketler) directory; its page shows the ticker, the price and the state of the session. The countdown on the home page shows the time left to the next open or close.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (SIPC, FINRA, SPK, YTM). */
  "araci-kurum-secimi": {
    title: "What to Look for in a Broker",
    dek: "Commission can be zero; cost never is. A line-by-line way to compare brokers.",
    bodyMd: `Your broker is the only door between you and the exchange. When choosing one, most people look at a single number: commission per trade. But what a broker costs you is the sum of five or six items, and the most visible one is often the smallest. This article names no firms and quotes no fees; fee schedules change often, and the current one lives on the broker's own pricing page and in the contract annex.

## The Cost Items

| Item | Where It Sits | Question to Ask |
|---|---|---|
| **Commission** | On every trade, flat or per share | What do I pay in total on a single $5,000 order? |
| **Custody Fee** | Monthly or yearly, a percentage or flat | What do I pay a year if I never trade? |
| **Currency Spread** | Inside the exchange rate | What rate do you convert at, and how far is it from mid? |
| **Transfer Fees** | Deposits and withdrawals | How many fees are there when I withdraw? |
| **Data and Account Fees** | Real-time data, inactivity | When does my account get charged? |

::: ornek The Math of Zero Commission
A hypothetical investor makes four $2,500 purchases a year, with an average $10,000 in the account.
Commission: **$0**.
A 0.5% currency spread on conversion: 10,000 × 0.5% = **$50**.
A 0.2% annual custody fee: 10,000 × 0.2% = **$20**.
The "commission" line on the statement reads zero; the annual cost is $70. The rates vary from broker to broker; what doesn't vary is that the comparison has to be made on the total.
:::

## Product and Session Access

A cheap broker that doesn't offer what you need isn't cheap. Topics to ask about:

- **Fractional shares.** Can you place dollar-based orders, and on which stocks? More: [Fractional Shares](/rehber/kesirli-hisse)
- **Extended hours.** Is there access to the pre-market and after-hours sessions? Some brokers now offer overnight trading too. Earnings reactions mostly happen in these hours. More: [How to Read an Earnings Day](/rehber/bilanco-gunu-nasil-okunur)
- **Order types.** Do stop and trailing stop orders wait on the server or in the app?
- **ETF access.** Some brokers don't offer US-domiciled ETFs to retail clients because of rules in the country they're regulated in. Ask before opening an account.

## What Investor Protection Protects

In the US, if a SIPC-member broker fails and client assets are missing, SIPC protects up to **$500,000** per customer (of which at most $250,000 in cash). Protection is tied to the **legal entity** where the account is opened: global brokers operate through separate companies in many countries, and an account opened at a non-US entity may not be covered by SIPC.

For brokers licensed in Türkiye, the Investor Compensation Center (Yatırımcı Tazmin Merkezi) plays a similar role, compensating up to a ceiling updated every year if a firm can't meet its obligations. How assets in foreign markets are treated under that scheme is something to ask the broker directly.

::: dikkat Protection Doesn't Protect the Price
Both SIPC and the Investor Compensation Center protect against the **broker failing**, not against a stock falling. If the stock you bought drops 40%, that's a market loss and no protection scheme covers it.
:::

## Domestic Broker vs. Foreign Broker

| Topic | Domestic Broker | Foreign Broker |
|---|---|---|
| **Regulator** | Capital Markets Board of Türkiye (SPK) | The regulator where the firm is registered |
| **Money Transfer** | Domestic, in lira | International wire, SWIFT fee |
| **Custody Chain** | One link longer, via a foreign correspondent | Shorter |
| **Protection Framework** | Investor Compensation Center | SIPC or that country's scheme |
| **Documents** | Turkish statements, sometimes a tax report | English statements, 1042-S |
| **Support** | In Turkish, on Türkiye time | Mostly in English |

There's no right or wrong between them; there's a choice that shifts with the items you weigh most. If you'll work with a foreign firm, verify its license on its own regulator's website (in the US, FINRA's BrokerCheck, for example). The SPK can block access to platforms offering unauthorized investment services in Türkiye; whether a platform that reaches you through ads is authorized to serve Türkiye can be checked against the SPK's lists.

::: ozet Summary
Compare a broker not by its commission but by its **total annual cost**, its access to the products you need, and which legal entity and protection framework your account sits in. Zero commission isn't a price; it's a marketing line.
:::

## Where You'll See It on This Site

This site isn't a broker, you can't place orders here, and it doesn't recommend any firm. When comparing the price in your broker's app with a stock page here, check the page's timestamp: the gap usually comes from delay.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (SEC bülteni, ACATS, OCC). */
  "kesirli-hisse": {
    title: "What Are Fractional Shares?",
    dek: "Owning part of a several-hundred-dollar stock for fifty dollars: how it works, and what's missing compared with a whole share.",
    bodyMd: `If a stock costs $400, a classic order won't let you own a piece of the company for $50. Fractional shares remove that barrier: you enter a **dollar amount** instead of a share count and get part of a share in return. The mechanism is simple, but it doesn't always carry every right a whole share does.

::: tanim Fractional Share
A non-whole portion of a share, like 0.125 or 2.4 shares. Fractional shares don't trade on exchanges; the broker does the splitting and keeps the record on its own books.
:::

## How It Works

The smallest unit on an exchange is a whole share. The broker pools the requests of clients placing fractional orders, buys whole shares in the market or fills them from its own inventory, and allocates the pieces to client accounts on its books.

That has two consequences. First, your fraction has no existence outside the broker: at the central depository the whole share sits in the broker's name, and your piece is the broker's internal record. Second, how and when the order executes depends on the broker: some fill immediately, some in batches during the day, and some allow only market orders for fractions.

::: ornek A Slice of a Share for $50
The stock is $400. A $50 fractional order buys **0.125 shares**.
If the company pays a $2 dividend per share, your account receives $0.25 gross.
If the stock rises 10%, your slice is worth $55.
Economically it behaves exactly like one eighth of a whole share: gains, losses and dividends are proportional.
:::

## What's Missing Compared With a Whole Share

| Topic | Whole Share | Fractional Share |
|---|---|---|
| **Price Moves and Dividends** | Full | Fully proportional |
| **Voting Rights** | Yes | None or proportional, by broker |
| **Transfer to Another Broker** | Transfers | Usually sold and turned to cash |
| **Order Types** | All | Limited at most brokers |
| **Extended Hours** | Depends on broker | Not available at most brokers |
| **Options** | 100 shares per contract | Fractions don't count |

::: dikkat A Transfer Is a Sale
When you move your account to another broker, whole shares can move as they are, but the fractional part is often sold and turned into cash. For someone resident in Türkiye that is a **sale**: if there's a gain, it goes into the tax return. Even a small fraction needs its date, amount and exchange rate on record. More: [How Gains on Foreign Stocks Are Taxed](/rehber/yurt-disi-hisse-vergisi)
:::

## What It's For

A fractional share isn't a return tool; it's a **measuring** tool. It makes a difference in three jobs:

- **Small regular purchases.** For someone investing a fixed amount each month, the indivisibility of the share price disappears; the whole amount goes into the investment and no leftover cash sits on the side. More: [Dollar-Cost Averaging](/rehber/duzenli-alim)
- **Weighting precision.** If you want to build a portfolio in percentages, the whole-share requirement on an expensive stock throws off the target weights. More: [Risk Management](/rehber/risk-yonetimi)
- **Reinvesting dividends.** Small dividend amounts can be put back into the same stock as fractions.

The link to stock splits reads from here too: companies split expensive shares to make them accessible to small investors. As fractional trading spread, that reason weakened, but split decisions are still being made. More: [What Is a Stock?](/rehber/hisse-senedi)

::: ozet Summary
Fractional shares remove the barrier created by an indivisible price; for returns and dividends they behave exactly like whole shares. In exchange, your piece lives on the broker's books: voting, transfers and order flexibility are whatever the broker offers.
:::

## Where You'll See It on This Site

Prices on stock pages are always the price of a **whole share**. Your fractional position is worth that price times your fraction; keep that in mind when comparing with the amount shown in your broker's app.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (ABD-Türkiye anlaşması md. 10
     ve 13, IRS W-8BEN ve 1042-S talimatları, §1446(f), veraset eşiği). */
  "w-8ben": {
    title: "W-8BEN and 1042-S: The US Tax Taken From Your Dividends",
    dek: "A US company's dividend is taxed before it reaches your account; a single form decides how much.",
    bodyMd: `When a US company pays a dividend, a tax is withheld on behalf of the US before the money reaches you. The rate depends on who you are, and the document that tells your broker is the **W-8BEN** form. The document that shows how much was withheld over the year is the **1042-S**. Together they form the first link on the tax side of investing in foreign stocks.

::: tanim Terms in This Article
**W-8BEN:** The IRS form in which an individual not resident in the US declares that they are not a US taxpayer, which country they are resident in, and that they claim tax treaty benefits.
**1042-S:** The annual statement showing the income a withholding agent paid during the year and the tax it withheld.
**Withholding:** Tax taken out by the payer and passed to the government before income is paid to its owner.
:::

## What the Form Says

The W-8BEN is a short form that declares three things: your identity, the country you're resident in, and your claim to treaty benefits. For someone resident in Türkiye, the claim rests on the **dividends article** of the double taxation treaty between the US and Türkiye.

The form isn't sent to the IRS; it goes to the broker. The broker keeps it on file and checks it to decide the withholding rate on each dividend payment.

## The Rate: 20% Instead of 30%

::: oncesi What Reaches Your Account From a $100 Dividend
$70 | No Form, 30% Withheld
$80 | With W-8BEN, 20% Withheld
:::

The US withholds **30%** on dividends paid to a foreigner with no form. The treaty cuts that to **20%** for individuals. Over the years the difference isn't small: the cash reaching your account from the same dividend rises by one seventh.

::: dikkat 20%, Not 15%
Turkish sources often say "the dividend withholding for Türkiye is 15%." Article 10 of the treaty sets 15% only for **companies** holding at least 10% of the voting power of the payer. For an individual buying shares, the rate is 20%. You can confirm the rate your broker applied on the withholding rate line of your 1042-S.
:::

## What the Form Doesn't Cover

**Capital gains.** The US doesn't withhold tax on gains a nonresident foreigner makes from selling shares, and the treaty leaves those gains to the country of residence. So the tax on a sale gain arises **in Türkiye**, not the US. More: [How Gains on Foreign Stocks Are Taxed](/rehber/yurt-disi-hisse-vergisi)

**Some special structures.** Since 2023, 10% of the sale proceeds can be withheld when selling publicly traded partnerships (PTPs). These rules differ from those for stocks and ordinary ETFs; before buying such a product, ask the broker what it withholds.

**ADR dividends.** On dividends from a foreign company's ADR, the tax is withheld by the company's home country; the US rate on the W-8BEN doesn't apply. More: [What Are ADRs and SPACs?](/rehber/adr-spac)

## The Form's Lifespan

A W-8BEN doesn't last forever. It stays valid until the **last day of the third calendar year** after the year it's signed; roughly three to four years. If your address or country of residence changes, a new form is due within thirty days.

::: zaman The Life of a Form
March 10, 2026 | You sign the form; the broker records it.
Each dividend payment | Withholding is applied at 20%.
By March 15, 2027 | The 1042-S for 2026 arrives in your account.
December 31, 2029 | The last day the form is valid. Brokers usually ask for a renewal a few months ahead.
January 1, 2030 | If not renewed, withholding reverts to 30%; some brokers restrict the account.
:::

## What to Do With the 1042-S

The 1042-S shows each type of income for the year on its own line: the income code, the gross amount, the rate applied and the tax withheld. For the Turkish tax return it does two jobs: it documents the **gross** dividend and it shows the tax paid in the US.

::: ornek A $100 Dividend's Path Through Two Countries
The company pays a $100 gross dividend. The US withholds $20; $80 reaches your account.
In Türkiye, if the declaration threshold is exceeded, the dividend is declared on the **$100 gross** amount converted to lira at the payment date's rate, not on the net $80.
The $20 paid in the US can be credited against the tax calculated in Türkiye, as long as it doesn't exceed the Turkish tax on that income.
:::

To claim the credit, the tax paid abroad has to be documented, and Turkish rules can require conditions such as certification by the competent authority. Whether a 1042-S alone will be accepted is worth discussing with a tax adviser before filing.

::: dikkat What the Form Doesn't Solve: Estate Tax
The W-8BEN is only about income tax. The US also applies estate tax to nonresident foreigners' US assets, and US shares count as such assets. A filing obligation arises once US assets exceed **$60,000** in total, and the US has no estate tax treaty with Türkiye. For a large portfolio, this is a separate topic for a specialist.
:::

::: ozet Summary
The W-8BEN is the form that cuts US withholding on dividends from 30% to 20%, and it doesn't renew itself when it expires. The 1042-S is the record of that withholding. Capital gains, meanwhile, are taxed in Türkiye, not the US; the W-8BEN doesn't change that math.
:::

*This article is general information, not tax advice. The rates are based on the 1996 text of the US-Türkiye tax treaty and the IRS form instructions published as of 2026.*`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar ve belirsizlik notu tr.ts'teki aynı yazının üstünde (GVK Mük.
     80, Mük. 81, 86/1-d, 92, 117, 123; 332 Seri No.lu GVGT). */
  "yurt-disi-hisse-vergisi": {
    title: "How Gains on Foreign Stocks Are Taxed in Türkiye",
    dek: "Capital gains and dividends from US stocks for someone resident in Türkiye: how they're calculated and when they're declared.",
    bodyMd: `The tax on gains from a US stock arises not in the US but in Türkiye. For shares on foreign exchanges there is usually no intermediary in Türkiye withholding tax at source either; the calculation and the filing fall to the investor. This article describes the rules in force as of 2026.

::: dikkat General Information, Not Tax Advice
This article summarizes the rules in force as of 2026 in general terms. Laws, communiqués and thresholds can change every year, and your personal situation (other income, residency, how often you trade) can change the outcome. Before filing, confirm the current rules with the Revenue Administration (GİB) or a certified tax adviser.
:::

## How a Capital Gain Is Calculated

A gain from selling foreign shares counts under the Income Tax Law as a **capital gain** (değer artışı kazancı). The math is done in **lira**: what's taxed isn't the dollar gain, but the difference between the purchase converted to lira and the sale converted to lira.

::: akis The Gain in Four Steps
Purchase Cost | Dollar amount × CBRT buying rate on the purchase date
Indexation | Cost is adjusted if the PPI rise is 10% or more
Sale Proceeds | Dollar amount × CBRT buying rate on the sale date
Gain | Sale proceeds − (indexed) cost
:::

**Indexation** is a correction for inflation eroding the cost. If the domestic producer price index (Yİ-ÜFE) rises **10% or more** between the month before the purchase and the month before the sale, the lira cost is raised by that rate. Below 10%, no indexation applies.

::: ornek A Gain Inflated by the Exchange Rate
The figures are hypothetical.
Purchase: $1,000 of stock at a rate of 36 → cost **36,000 TL**.
Sale: $1,200 at a rate of 43 → proceeds **51,600 TL**.
Unindexed gain: 15,600 TL. Yet the dollar gain is only $200, or 8,600 TL at the sale rate. The remaining **7,000 TL** comes from the exchange rate, not the stock.
Had PPI risen 25% in between, the cost would become 36,000 × 1.25 = **45,000 TL**, and the taxable gain drops to 6,600 TL. Indexation removes the part of the currency "gain" that matches inflation.
:::

The mechanism matters: as the lira loses value, even a position with no dollar profit at all can show a gain in lira. Indexation partly offsets that, not fully. More: [Currency Risk](/rehber/kur-riski)

## Declaration: Whatever the Amount

The law sets an annual exemption amount for capital gains, but that exemption **doesn't apply to securities**. The result: gains from selling foreign shares are declared whatever their size.

- The declaration is made on the annual income tax return in **March 1-31** of the year after the gain. A share sold in 2026 is declared in March 2027.
- Tax is calculated on the progressive schedule (brackets from 15% to 40%), together with other declarable income.
- Payment is in two installments: March and July.

::: sayilar Key Numbers Under the 2026 Rules
0 TL | Declaration threshold for capital gains on shares
10% | Minimum PPI rise needed to index the cost
22,000 TL | Declaration threshold for 2026 capital income not taxed at source
March 1-31 | Filing period, in the year after the gain
:::

## What Happens to Losses

Trading losses within the same calendar year are deducted from trading gains of the same year. If you gained 5,000 TL on one stock and lost 3,000 TL on another, 2,000 TL goes into the return.

The limits are clear too: losses can't be deducted from other income such as salary, rent or dividends, and they **don't carry forward** to the next year. A loss not used within the year disappears with it.

## Dividends

Dividends from foreign shares are **income from movable capital** (menkul sermaye iradı) and follow a different rule from capital gains.

1. The dividend is converted to lira at its **gross** amount, at the CBRT buying rate on the day it's received. The amount before the US 20% withholding is what counts. More: [W-8BEN and 1042-S](/rehber/w-8ben)
2. For 2026 income, if total movable and immovable capital income not taxed at source doesn't exceed **22,000 TL**, no return is required for it. If it does, all of it is declared, not just the excess.
3. The half exemption on dividends from Turkish companies doesn't apply to a portfolio investor's foreign dividends.
4. Tax paid in the US can be credited against the tax calculated, provided it's documented and doesn't exceed the Turkish tax on that income.

::: dikkat There Is No Single Exchange Rate Date
Every purchase, every sale and every dividend is converted at its own day's rate. A single calculation at the year-end rate or an average rate gives the wrong result. If you bought the same stock in pieces on different days, you also need a record of which purchase was sold and how its cost is determined.
:::

## Running the Numbers

The site's [tax calculator](/vergi) helps you produce an estimate by entering purchase and sale dates, dollar amounts and rates. Read the result as a preliminary calculation, not a tax return.

::: ozet Summary
Gains on foreign shares are calculated in lira, the exchange rate rise is part of the gain, and when PPI rises past 10% the cost is indexed to remove part of it. There's no declaration threshold on capital gains, and losses only offset gains within the same year. Dividends are subject to a separate threshold on their gross amount. Knowing the rules isn't enough: recording every trade by date is the filing itself.
:::

*This article is based on the relevant articles of the Turkish Income Tax Law, the communiqué setting the 2026 thresholds and GİB rulings. It is general information, not tax advice, and reflects the rules as of 2026; regulations can change.*`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (Vanguard 2012). */
  "duzenli-alim": {
    title: "Dollar-Cost Averaging: What It Does and Doesn't Do",
    dek: "Buying the same amount every month seems to lower your average cost; what it really lowers, and what it never changes.",
    bodyMd: `Setting aside the same amount from each paycheck and putting it into the same fund or stock is the most common method among individual investors. It's called **dollar-cost averaging**, or DCA. Two claims are made about it at once: "it reduces risk" and "it boosts returns." The first is partly true; the second is largely false.

::: tanim Dollar-Cost Averaging (DCA)
Buying with a fixed amount at set intervals, regardless of price. The share count isn't fixed: when the price falls the same amount buys more shares, when it rises, fewer.
:::

## The Mechanism: Fixed Amount, Changing Share Count

The whole math of the method fits in one sentence: a fixed amount buys more shares in cheap months and fewer in expensive ones. So the **average cost** you pay is always below or equal to the simple average of the prices in those months.

::: ornek Four Months, Four Prices
$1,000 invested each month. Prices are $100, $80, $50 and $100 in turn.
Shares bought: 10 + 12.5 + 20 + 10 = **52.5 shares**, for $4,000 in total.
Average cost per share: 4,000 ÷ 52.5 ≈ **$76.2**. The simple average of the prices is $82.5.
At the end of month four the price is back where it started, at $100; the portfolio is worth $5,250, or **+31%**. Someone who bought everything in month one is at breakeven on the same date.
:::

The example shows the method's best case: a price that falls first, then recovers. The method's value lies exactly along that path.

## What It Doesn't Do

**It doesn't raise expected returns.** In a market that rises over the long run, keeping part of your money in cash for months means giving up the return of that waiting period. In a 2012 Vanguard study using US, UK and Australian data, investing a lump sum all at once beat spreading it over twelve months in about **two thirds** of cases.

**It doesn't fix a bad pick.** Buying a stock that keeps falling on a schedule means putting more money into a sinking thing every month. The average cost falls, but if the company isn't recovering, a lower average means nothing. The method makes sense for a broad asset believed to rise over the long run; it doesn't change a company's fate. More: [Index Fund or Single Stock?](/rehber/endeks-fonu-mu-tek-hisse-mi)

**It doesn't prevent losses.** If the market goes sideways or down for ten years, the regular buyer loses too; just more slowly.

| Claim | Reality |
|---|---|
| **"It reduces risk"** | It spreads timing risk; it doesn't reduce market risk |
| **"It boosts returns"** | Not in expectation; in a rising market a lump sum usually leads |
| **"It lets you buy the bottom"** | It doesn't find the bottom; it buys in the bottom month and the peak month alike |
| **"It takes emotion out"** | Yes, that is its real job |

## Its Real Job: Handing the Decision to the Calendar

DCA's real value lies not in the math but in behavior. "Should I go in now, or wait a bit?" is the question investors get wrong most often, and DCA lets you never ask it. Sticking to the plan in a downturn instead of stopping in panic decides the method's entire benefit. More: [Investor Psychology](/rehber/yatirimci-psikolojisi)

For most people DCA isn't even a choice: savings arrive monthly with the paycheck, so investing happens monthly too. The question only really comes up with a lump sum (an inheritance, a bonus, a sale), and the answer is a trade-off between expected return and how much regret you can bear from going in all at once and getting caught by a drop right away.

::: dikkat Planned Buying and Averaging Down Are Not the Same
Dollar-cost averaging is a plan set in advance and independent of price. Adding to a losing position to "bring the cost down" is a decision made in reaction to price, and it raises the position's weight in your portfolio exactly where you were wrong. The two look the same on screen; their logic is opposite. More: [Risk Management](/rehber/risk-yonetimi)
:::

## Two Layers When Buying From Türkiye

Someone buying US stocks regularly from Türkiye is really buying two things on a schedule: dollars and the stock. The monthly conversion also builds an average cost in the exchange rate. The price is the currency spread and fixed fees paid separately on each small purchase. On small amounts a fixed trading fee is proportionally large, so purchase frequency has to be balanced against cost. If the amount is small, [fractional shares](/rehber/kesirli-hisse) make sure all of it gets invested.

::: ozet Summary
Dollar-cost averaging isn't a technique that raises returns; it's a discipline that spreads the risk of making one big decision at the wrong time. It works in a well-chosen broad asset when kept up; it doesn't fix a bad pick, and waiting has a cost in a rising market.
:::

## Where You'll See It on This Site

The long ranges on the [Compare](/karsilastir) screen (such as 5 years) show an asset's path through declines and recoveries; the shape of that path is what decides why regular buying gains value along the way.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (Cboe VIX, Brenner-
     Subrahmanyam yaklaşımı). */
  "beklenen-hareket": {
    title: "What the Options Market Prices: Implied Volatility and the Expected Move",
    dek: "Reading how big a move the market expects before an earnings night, straight from option prices with a single division.",
    bodyMd: `A company reports earnings tonight. How much will the stock move tomorrow? Nobody knows, but the market has already put a price on the question: that price is inside the **options**. This article explains how to read it; it doesn't recommend trading options. For the basic structure of a premium, read [Options](/rehber/opsiyonlar) first.

::: tanim Terms in This Article
**Implied Volatility (IV):** The annual volatility the market expects, solved backward from an option's market price. Historical volatility measures the past; implied volatility is the expectation inside today's price.
**ATM (At the Money):** The option whose strike is closest to the stock's current price.
**Straddle:** Buying a call and a put together at the same expiry and strike. It profits only from the size of the move, regardless of direction.
:::

## The Expected Move in One Division

The price of the ATM straddle gives, in dollars, the size of the move the market expects through expiry. Divide by the stock price and it becomes a percentage:

**Expected move ≈ ATM straddle price ÷ stock price**

::: ornek Earnings Night
The stock is at $200. For the expiry right after earnings, the $200 call is $9 and the put $7.
Straddle: 9 + 7 = **$16**. Expected move: 16 ÷ 200 = **±8%**, so between $184 and $216.
The next day the stock rises 6% to $212. Whatever the direction, the move came in **below** what was priced: the straddle is worth about $12 at expiry, and whoever paid $16 loses.
The headline says "the stock rose"; the options market's reading is "calmer than expected."
:::

This is the most useful yardstick for reading earnings reactions: a 6% move is a big surprise in a stock priced for 3%, and a quiet night in one priced for 12%. More: [How to Read an Earnings Day](/rehber/bilanco-gunu-nasil-okunur)

## From Implied Volatility to the Same Number

The second route is to scale annual implied volatility to the expiry. Volatility grows with the square root of time:

**One standard deviation move ≈ price × IV × √(days ÷ 365)**

The two methods don't give the same number, and that isn't an error. The ATM straddle corresponds to about **0.8** of a one standard deviation move, because the straddle prices the average absolute move, not the standard deviation. In practice the straddle method is more direct: it's computed from prices that actually trade.

::: sayilar Three Numbers Worth Remembering
√12 | The factor that converts annual volatility to a one-month move
0.8 | The ATM straddle's ratio to a one standard deviation move, approximately
68% | The probability of staying within ±1 standard deviation under a normal distribution
:::

The same logic works at the index level. The **VIX** is the 30-day implied volatility derived from S&P 500 options. A VIX of 20 means the market is pricing a one standard deviation move of about 20 ÷ √12 ≈ **±5.8%** in the S&P 500 over the next month. More: [What Is Volatility?](/rehber/volatilite)

## What to Watch When Reading It

- **The expiry must cover the event.** To measure an earnings move, use the first expiry after the announcement. A longer expiry also includes the volatility of days outside the event.
- **Use the mid price.** Option bid-ask spreads can be wide; the midpoint between bid and ask gives a more reliable reading than the last trade.
- **No exact ATM? Use the nearest.** If the stock is at $203, look at both the $200 and $205 strikes.
- **There's no direction.** The straddle prices the size of the move, not its direction. If the market leans one way, it shows in the relative price of puts and calls (the skew), not in the expected move number.

::: dikkat A Price, Not a Probability
Implied volatility isn't a forecast; it's a price, and it carries a **risk premium**: option sellers charge a fee for taking on uncertainty. That's why implied volatility is usually somewhat higher than realized volatility over the long run. The normal distribution assumption also understates extreme moves; "68% chance of staying in this range" is a rough measure, not a guarantee.
:::

::: ozet Summary
The options market prices a move size ahead of every event, and reading it doesn't require buying options: dividing the ATM straddle by the price is enough. To tell whether a move was big or small, measure it not against zero but against **the move that was priced**.
:::

## Where You'll See It on This Site

There's no options chain on this site. The VIX, the ready-made version of the same measure for the market as a whole, is on the [Markets](/piyasalar) screen. Earnings dates are on the [Earnings](/bilancolar) screen, and the move after a report on the stock page.`,
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
  "bilanco-gunu-nasil-okunur": {
    title: "How to Read an Earnings Day",
    dek: "Why a company posting record profit drops 9% — expectations, the gap, and guidance.",
    bodyMd: `A company reports the highest profit in its history and the stock falls 9%. This is the most frequently asked question about earnings days, and the answer fits in one sentence: **price reacts not to the number, but to the number's distance from what was expected.**

The [earnings article](/rehber/bilanco) covers reading the tables themselves. This one covers reading the day — a different job.

::: tanim Consensus
The average of the estimates from analysts covering the company. The share price already carries that expectation before the release. What you paid for was not the information "the company will make money" but **"the company will make this much money."**
:::

## Three Numbers, Three Timeframes

An earnings release actually carries three pieces of information, each looking at a different time:

| | What it tells you | Timeframe |
|---|---|---|
| **Revenue** | How much it sold | Past quarter |
| **Earnings per share (EPS)** | What was left after costs | Past quarter |
| **Guidance** | What the company expects next | **The future** |

Most of the price reaction comes from the third row. The past quarter is, the moment it is published, a known thing; the stock is a price on the future. A company that cuts guidance takes its stock down even after a record quarter.

::: ornek Record Profit, Falling Stock
Expected: $2.40 EPS on $8.1 billion of revenue.
Reported: **$2.55 EPS**, **$8.4 billion** revenue — both above expectations, both company records.
Guidance: $8.0-8.2 billion of revenue next quarter. The market expected $8.7 billion.
Result: the stock falls. The reported quarter was good, but the good was already in the price; what changed was **the information that next quarter will be worse.**
:::

## "Beat" Alone Says Nothing

The phrase "beat expectations" carries no information on its own, because the beat itself is expected. Most companies beat by small margins routinely — that is not a mark of performance but the result of expectation management: guide conservatively, and beating gets easy.

So what matters is the **size** and the **source** of the gap:

- If profit beat but revenue did not, the difference may be cost cutting. Cutting costs is not a sustainable source of growth.
- If profit came from a one-off item (an asset sale, a tax adjustment), it is not operating performance.
- If revenue beat but margins narrowed, the company may be buying growth with discounts.

## Adjusted or GAAP

Companies publish two profit figures: the one calculated under the legal standard (**GAAP**) and the one excluding items the company deems unusual (**adjusted / non-GAAP**). Headlines usually quote the second, because it is higher.

::: dikkat The "One-Off" That Recurs Every Year
Adjusted figures are useful: excluding a genuinely unusual legal settlement is reasonable. The problem is the same item being excluded as "one-off" every single quarter. Stock-based compensation is the classic case — paying employees in shares is a real cost, and it repeats every quarter.
A practical test: if the gap between the two figures has been roughly the same size for several quarters, that item is not unusual.
:::

## The Conference Call

After the numbers, management takes analysts' questions on a call — and the sharpest price move often happens **there**. The reason: the tables describe one quarter, the sentences describe direction. "We're seeing some softening in demand" appears in no table and moves the price more than any number in one.

## Why Volatility Inflates

Option premiums swell before earnings and collapse after. That is the *volatility crush* from the [options article](/rehber/opsiyonlar): when the uncertainty ends, so does its price. In practice this makes earnings night the most volatile night for the stock too — 10% moves are common in [extended-hours](/rehber/borsa-nasil-isler) trading, and those prices form on thin volume.

::: ozet In Short
Read an earnings day with three questions: **What was expected? Where did the gap come from? What did the company say about the future?** The third matters most, because a stock is a price on the future, not the past. A "record profit" headline tells you nothing on its own — it does not tell you whether the record was expected.
:::

## Where You'll See It Here

The earnings side of this site is built on exactly that trio:

- The [earnings calendar](/bilancolar) shows who reports when; where the provider gives no exact minute, the time is written with a "~" and named by its window ("~23:00 · after the close").
- Each entry in the [earnings analyses](/bilancolar/analizler) carries the expected-versus-actual gap and the guidance separately; in the revenue column chart, the final dashed-outline column is a **projection**, not a reported number.
- The "since the report" stamp on an analysis page shows what the price did after the release — as instructive as the numbers themselves.`,
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

  "hisse-geri-alimi": {
    title: "What Is a Share Buyback?",
    dek: "A company buying its own stock — growing your slice without growing the pie.",
    bodyMd: `There are two ways a company returns money to shareholders. The first is a [dividend](/rehber/temettu): cash lands in your account. The second is a buyback: you get nothing directly, and instead the company **buys its own shares in the market and cancels them.**

The second looks odd at first — nothing is handed to you. But because the share count falls, your stake in the company grows. The pie is the same size; your slice is bigger.

::: tanim Share Buyback
A company purchasing its own shares on the exchange. The shares are usually cancelled or held in treasury; either way the count of shares outstanding falls. The shareholder receives no payment; their **proportion** of ownership rises.
:::

## Why EPS Goes Up

Earnings per share is a simple fraction: net income divided by share count. A buyback shrinks the denominator — so EPS rises even if profit does not.

::: ornek Same Profit, Higher EPS
Net income: $1 billion. Shares: 500 million. EPS = **$2.00**.
The company buys back 25 million shares (5% of the count). New count: 475 million.
Profit is unchanged, still $1 billion. New EPS = 1,000 / 475 = **$2.11**.
Headline: "earnings per share up 5.5%". The business grew by exactly nothing.
:::

This is the most abused feature of buybacks. Executive bonuses are frequently tied to EPS targets, and a buyback is the shortest route to hitting one without growing the business. So when [reading earnings](/rehber/bilanco), look past EPS to **net income itself** and to **the trend in share count**: if EPS is rising while net income is flat or falling, that is not growth, it is arithmetic.

## Versus Dividends

| | Dividend | Buyback |
|---|---|---|
| Effect on you | Cash income | A larger stake |
| Tax | At the time of payment | None until you sell |
| Flexibility | Cutting one is a bad signal | Can be paused quietly |
| Price sensitivity | None | **High** |

The last row matters most. A dividend is indifferent to the share price; in a buyback the company is a buyer, and **the price it pays is decisive.** Shares bought cheaply create value for holders; shares bought expensively destroy it. It is the most concrete test of a management team's capital allocation.

::: dikkat Buying at the Top
Companies buy back most when their coffers are fullest — that is, when business is good, which is when the stock is expensive. When a crisis arrives, cash is needed and buybacks are suspended precisely when the stock is cheap.
The result is the corporate version of the classic retail mistake: buy high, stop buying low. Many large companies followed that exact sequence in 2020 and 2022. Before treating a buyback announcement as good news, ask **at what price the shares were bought.**
:::

## An Announcement Is Not a Purchase

Companies announce "a $10 billion buyback programme." That is an **authorisation**, not a commitment: the board grants permission, and the company may use it, partly use it, or spread it over years. Announced amounts and executed amounts diverge routinely.

To see what actually happened, look at the cash flow statement — under financing activities in the [cash flow article](/rehber/nakit-akisi), the "repurchase of common stock" line shows money actually spent that quarter. The announcement is in the headline; the execution is in the table.

## Buybacks That Only Offset Dilution

A common situation in technology companies: the company pays employees in stock, which increases the share count, then buys back shares to offset that increase. From outside it looks like value being returned, but what is really happening is that wages are paid in shares and the bill is settled with a buyback.

The test is simple: **is the share count actually falling?** If it is flat despite billions in buybacks, that programme is not returning value to shareholders — it is concealing dilution.

::: ozet In Short
A buyback is a neutral tool; price decides whether it is good or bad. Read it with three questions: **Did the share count actually fall? At what valuation were the shares bought? Where did the money come from — cash flow or debt?** If all three answer well, a buyback can be more efficient than a dividend. If they don't, it is expensive cosmetics on an EPS chart.
:::

## Where You'll See It Here

This is why the [earnings analyses](/bilancolar/analizler) report EPS and net income side by side: when the two diverge, the share count explains the gap. The P/E calculation in the [valuation](/rehber/degerleme) and [market cap](/rehber/piyasa-degeri) articles is directly affected too — shrink the denominator and the ratio falls without the company changing at all.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (SEC 10-K/10-Q talimatları,
     başvuru süreleri, 8-K Madde 2.02, Regulation G). */
  "10k-10q": {
    title: "How to Read a 10-K and 10-Q",
    dek: "The report a company signs and files with the SEC says what the press release doesn't; which five of the hundred pages matter.",
    bodyMd: `The numbers that hit the news on earnings day come from a **press release**. The company's actual report is a document filed with the SEC a few days or weeks later, often running past a hundred pages: the annual **10-K** and the quarterly **10-Q**. Nobody reads them cover to cover; the parts worth reading are well defined.

::: tanim Terms in This Article
**10-K:** The annual report. It includes independently audited financial statements, a description of the business and the risk factors.
**10-Q:** The report for the first three quarters. Its financial statements aren't audited, only reviewed. There's no separate 10-Q for the fourth quarter; that period sits inside the 10-K.
**EDGAR:** The SEC's database where all official company filings are published for free.
:::

## Finding the Document

Search EDGAR for the company's name or ticker and filter the filing list by form type. The same reports are also on the company's investor relations page. Deadlines depend on the company's size:

| Filer Category | 10-K Deadline | 10-Q Deadline |
|---|---|---|
| **Large Accelerated** (public float above $700 million) | 60 days after year-end | 40 days after quarter-end |
| **Accelerated** ($75-700 million) | 75 days | 40 days |
| **Others** | 90 days | 45 days |

Foreign companies file an annual **20-F** and periodic **6-K** instead. More: [What Are ADRs and SPACs?](/rehber/adr-spac)

## The Reading Order

::: akis Cutting a Hundred Pages to Five
Management's Discussion | Item 7 (Part I, Item 2 in a 10-Q)
Financial Statements | Item 8: income, balance sheet, cash flow
Notes | Segments, debt maturities, revenue recognition
Risk Factors | Item 1A: what changed from last year
:::

**Management's discussion and analysis (MD&A)** is the narrative section of the report: why revenue changed, what squeezed margins, where the cash went. Here management explains the numbers in its own words and writes down the trends it is obliged to disclose.

**The financial statements** are three, and they're read together: the income statement shows profit, the balance sheet assets and liabilities, the cash flow statement the actual money. More: [Earnings Reports: What to Read, How](/rehber/bilanco) and [Cash Flow](/rehber/nakit-akisi)

**The notes** are the least-read and most informative part of the report. Which business line revenue came from (segment reporting), when debts mature, how large stock-based compensation is, and customer concentration are all written here.

**Risk factors** grow longer every year, and most are boilerplate. What's valuable are the newly added or rewritten items: putting two years' text side by side shows what the company now sees as a new risk.

::: ornek What Hides in the Notes
A hypothetical company reports revenue up 20%. The press release credits "strong demand."
The segment note shows something else: all of the growth came from a single business line, and **45% of that line's revenue comes from one customer**.
The same 20% tells two different risk stories. In one, broad demand; in the other, revenue that hinges on a single contract being renewed.
:::

## The Press Release vs. the Report

The release published on earnings night is furnished to the SEC with an **8-K** and carries the numbers the company wants to highlight. Many of them are non-GAAP measures: "adjusted" profit that leaves out stock-based compensation, one-time charges or acquisition costs. The rules require companies to present these alongside their GAAP equivalents and to show the difference.

::: dikkat The Release Isn't the 10-Q
The release is a marketing document. It doesn't have to be wrong, but it is selective. If the gap between adjusted profit and GAAP profit grows every quarter, the expenses the company calls "one-time" are in fact recurring. Tracking that gap takes the reconciliation table in the 10-Q.
:::

## Five Questions for a Quick Read

1. Which segment did revenue grow from, and which did it shrink in?
2. Is operating cash flow above or below net income?
3. How much debt matures in the next two years?
4. What share of revenue is stock-based compensation, and is the share count rising?
5. What was added to the risk factors this year?

::: ozet Summary
The 10-K and 10-Q are the audited or reviewed, signed version of a company's numbers. The release says what happened; the report says why, and at what cost. A 10-Q read through five questions tells you more than an earnings day's headlines.
:::

## Where You'll See It on This Site

The past earnings on stock pages and the analyses on the [Earnings](/bilancolar) screen are fed by the numbers in these reports. If an item in an analysis looks odd, its source is usually in the 10-Q's notes.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (Regulation FD, PSLRA). */
  "konferans-gorusmesi": {
    title: "How to Listen to an Earnings Call",
    dek: "The numbers are in the release; what management thinks of them, and what it avoids saying, is on the call.",
    bodyMd: `Shortly after earnings come out, the company's senior management holds a phone or webcast session with analysts: the **earnings call**. The numbers are already in the release; what makes the call valuable is how management talks about them and what analysts ask.

## Why It's Public

**Regulation FD**, in force in the US since 2000, bars companies from giving material information to some investors before others. The result: the call with analysts is broadcast so that anyone can listen. The live webcast, the replay and usually a written transcript are on the company's investor relations page.

Most companies reporting after the close hold the call the same evening, an hour or two after the New York close. Seen from Türkiye, that usually lands close to midnight; the replay and transcript can be read the next morning.

## The Structure of a Call

::: akis The Order of a Call
Disclaimer | Legal language on forward-looking statements
Prepared Remarks | The CEO covers the business, the CFO the numbers
Guidance | Expectations for next quarter and the year
Q&A | Analysts' questions
:::

The **prepared remarks** are a script written in advance and cleared by lawyers. They matter but hold few surprises. The **Q&A** is unscripted; most of the information comes out there. If you're short on time, going straight to the Q&A is usually the better use of it.

## What to Listen For

**Changes in guidance.** Next-period expectations are read against the guidance given last quarter. Was the low end of the range raised, or the high end cut? The market often reacts to this change rather than to the quarter just reported. More: [How to Read an Earnings Day](/rehber/bilanco-gunu-nasil-okunur)

**The recurring question.** If several analysts ask about the same topic in different words, the market isn't satisfied on that point.

**The unanswered question.** If management dodges a number and moves on with a general sentence, that's information too. Especially if it gave a number on the same topic last quarter and doesn't this time.

**Changes in wording.** Small shifts, like "strong" demand becoming "healthy" demand or "acceleration" becoming "stability," carry meaning in the carefully chosen language of a script.

| What You Hear | What It Can Mean |
|---|---|
| **"Our visibility is limited"** | Management doesn't know either; guidance is wide or cautious |
| **"One-time impacts"** | Ask which impact, and whether it truly won't recur |
| **"We don't break that out"** | If it used to, not doing so now is a signal |
| **"We're in an investment phase"** | Margin pressure will continue; listen for when it ends |

::: ornek The Price of a Cautious Word
A hypothetical company reports a quarter above expectations; the stock rises 4% after hours. On the call, the CFO says customers are being "more cautious" with orders for next quarter and leaves guidance unchanged.
Three analysts come back to that caution during the Q&A. By the time the call ends, the stock has turned from up to **down**. The numbers didn't change; what changed is what they said about the future.
:::

::: dikkat Price Moves During the Call
The call usually happens in the after-hours session, when volume is thin and spreads are wide. Sharp moves in those hours don't always predict the next day's open; part of them is the reaction of algorithms reading headlines in real time. More: [Liquidity and the Spread](/rehber/spread-likidite)
:::

::: ozet Summary
The release says what happened; the call says how management sees it. Focusing on the change in guidance, the topics analysts keep pressing and the places management avoids giving numbers reduces an hour-long recording to a few minutes of information.
:::

## Where You'll See It on This Site

The [Earnings](/bilancolar) screen shows who reports when, before the open or after the close. Analyses of reported quarters are on the [Analyses](/bilancolar/analizler) tab.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (T+1, FINRA 11140). */
  "temettu-takvimi": {
    title: "How to Read a Dividend Calendar",
    dek: "Declaration, ex-dividend, record and payment: the last day you can buy to get the dividend, and why that day isn't an opportunity.",
    bodyMd: `When a company declares a dividend, the announcement lists four dates. Only one of them decides who gets the dividend, and the rule for that date changed in 2024 when the settlement cycle got shorter. What a dividend is and why it isn't free money is covered in [What Is a Dividend?](/rehber/temettu); this article is about the calendar itself.

## Four Dates

| Date | What Happens |
|---|---|
| **Declaration** | The company announces the amount and the schedule |
| **Ex-Dividend** | From this day on, buyers don't receive the dividend |
| **Record** | The company's list of shareholders is fixed as of this day |
| **Payment** | The money is sent to shareholders' accounts |

To receive the dividend you have to be on the shareholder list on the record date. Buying the stock isn't enough to get on the list; the trade has to have **settled**. That's why the ex-dividend date exists: it marks the first purchase date whose settlement won't make it to the record date.

## With T+1, Ex-Dividend and Record Fall on the Same Day

US settlement has been **T+1** since May 28, 2024: a trade becomes final the next business day. As a result, the ex-dividend date is now **the same business day** as the record date. The rule comes down to one sentence:

> To receive the dividend, you must have bought the stock by the business day before the ex-dividend date.

::: zaman A Hypothetical Dividend Calendar
February 2, 2026 | The company declares a $1 per share dividend.
February 12, Thursday | **Last day to buy.** A share bought today settles on February 13; the buyer makes the list.
February 13, Friday | Ex-dividend and record date. Buyers today don't get the dividend; the stock is adjusted by the dividend at the open.
March 5 | Payment date. The gross amount, less US withholding, reaches the account.
:::

The count uses **business days**: weekends and US market holidays don't count. Turkish holidays don't affect it; the US market calendar is what matters.

## What Happens on the Ex-Dividend Morning

On the ex-dividend date the stock opens from a reference price lower by the amount of the dividend. That isn't a selling wave, it's accounting: the cash leaving the company is no longer inside the share price.

::: ornek Buy on the Last Day, Sell the Next
The stock is $100, the dividend $1. You buy on February 12. On the morning of February 13, with nothing else happening in the market, the stock opens at about **$99**.
You now hold a $99 share and a $1 gross dividend receivable; still $100 in total.
For someone resident in Türkiye, the US withholds 20% of the dividend: $0.80 reaches your account. You receive **$0.80** in exchange for a $1 price adjustment, plus a spread and commission paid twice. That's why "dividend capture" isn't a zero-sum trade for a foreign investor; it's a **negative** one.
:::

## The Large Dividend Exception

If the dividend is **25% or more** of the share's value, the rule works differently: the ex-dividend date moves not to the record date but to the business day after the payment date. This exception shows up with extraordinary one-time payouts and is flagged separately in the announcement. In that case, someone selling the stock between the record and payment dates sells the entitlement along with it.

::: dikkat Payment Date Isn't the Day It Hits Your Account
The payment date is the day the company sends the money. If your broker's chain is long (domestic broker, foreign correspondent, custodian), it can take a few business days to show up in your account. For the date and exchange rate to use in your tax calculation, check your broker's statement. More: [How Gains on Foreign Stocks Are Taxed](/rehber/yurt-disi-hisse-vergisi)
:::

::: ozet Summary
The calendar has four dates, but the decision hangs on one: the ex-dividend date. With T+1 it's the same day as the record date, and to get the dividend you must have bought by the business day before. On the ex-dividend morning the stock is adjusted by the dividend, which is why the calendar isn't an opportunity but a mechanism.
:::

## Where You'll See It on This Site

The **Key Metrics** card on the stock page shows the dividend yield. You can confirm a company's dividend schedule and amount from its investor relations announcement or your broker's corporate action notice.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar tr.ts'teki aynı yazının üstünde (Exchange Act md. 16, SOX
     md. 403, Form 4 kodları, Kural 10b5-1 değişiklikleri). */
  "insider-islemleri": {
    title: "Insider Transactions: How to Read a Form 4",
    dek: "Executives' trades in their own company's stock are public; why sales say much less than purchases.",
    bodyMd: `A company's executives can buy and sell their own company's stock; that is legal. What makes it legal is that the trade is disclosed to everyone. In the US that disclosure is called a **Form 4**, and it has to be filed with the SEC within two business days. Headlines like "CEO sells millions of dollars of stock" usually come from this form, and the form itself tells you more than the headline.

::: tanim Terms in This Article
**Insider:** Under US rules, a company's senior officers, board members and anyone owning more than 10% of the company.
**Form 4:** The SEC form in which these people report every change in their holdings within two business days of the trade.
**10b5-1 Plan:** A trading program an executive sets up in advance, at a time when they have no inside information, and can't change afterward.
:::

::: dikkat Legal Trades vs. Illegal Insider Trading
Trades reported on a Form 4 are legal. What's illegal is trading on material information that hasn't been made public. The two get confused because both can be called "insider trading"; this article covers only legal, reported trades.
:::

## Transaction Codes

The most important column on a Form 4 is the transaction code. The same "decrease in shares" says very different things depending on its code.

| Code | Meaning | What It Says |
|---|---|---|
| **P** | Open market or private purchase | The executive bought with their own money; the strongest signal |
| **S** | Open market or private sale | Says little on its own; there can be many reasons |
| **M** | Exercise or conversion of an option or derivative | Part of the pay package |
| **A** | Grant or award from the company | Like salary; not a decision |
| **F** | Shares withheld for tax or exercise price | Automatic; carries no information |
| **G** | Gift | Usually tax planning |
| **X** | Exercise of an in-the-money option | Similar to M |

## Why Sales Are Noisy

A large part of executive pay comes as stock and options. So they have many reasons to sell: paying taxes, buying a house, diversifying their wealth away from a single company, or following a sales plan set up years ago. None of these is a view on the company's future.

Buying, in practice, has just one reason:

> Insiders might sell their shares for any number of reasons, but they buy them for only one: they think the price will rise.

The line is attributed to Peter Lynch, and it sums up the main rule of reading a Form 4: open-market purchases with the insider's own money (**P**) are rare and informative; sales are frequent and mostly noise.

::: ornek The Form Behind a Headline
Headline: "CEO sells $4.8 million of stock." The rows of a hypothetical Form 4:
**M** · 50,000 shares · $20 · Exercise of options granted years ago.
**F** · 18,000 shares · $150 · Shares withheld by the company for the exercise price and taxes.
**S** · 32,000 shares · $151 · A sale; the box on the form is checked: under a **10b5-1 plan**.
Result: the CEO's share count before the transaction didn't change (50,000 − 18,000 − 32,000 = 0). The sale in the headline was an option being turned into cash and its taxes being paid; it was planned in advance.
:::

## Planned Sales

10b5-1 plans are programs an executive sets up when they have no inside information and can't interfere with afterward. Since 2023, officers must wait at least 90 days between adopting a plan and the first trade, and the Form 4 has a box showing whether a trade was made under a plan. A planned sale carries no signal about timing; when the plan was **adopted or cancelled**, however, can.

## Patterns That Can Matter

- **Cluster buying.** Several executives buying in the open market in the same period is a stronger sign than a single purchase.
- **Buying after a drop.** An executive buying with their own money after a sharp decline can show they think the price has fallen too far relative to the inside view.
- **Large sales outside a plan.** Sales without the 10b5-1 box checked, far above the usual size and from several executives, are worth a closer look.

None of these alone is a reason to buy or sell. Executives get things wrong too, and their purchases are often proven right only months or even years later.

::: ozet Summary
A Form 4 makes executives' stock moves public within two business days. The reading rule is in the codes: P is rare and meaningful, S is frequent and usually noise, and M, A and F are the mechanics of pay. Before reading a sales headline, look at the rows of the form.
:::

## Where You'll See It on This Site

This site doesn't list insider transactions. You can find a company's Form 4 filings by searching its name in the SEC's EDGAR database and filtering by form type. A company buying back its own shares is a separate topic: [What Is a Share Buyback?](/rehber/hisse-geri-alimi)`,
  },

  /* ---------------------------------------------------------------------- */
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
  "getiri-egrisi": {
    title: "The Yield Curve and Its Inversion",
    dek: "Short rates above long rates — the market's oldest recession signal, and why it doesn't fire immediately.",
    bodyMd: `In a normal world, tying money up for longer pays more: a 10-year bond yields more than a 2-year. The reason is simple — nobody knows what the next decade holds, and that uncertainty has a price.

Sometimes this reverses. Short-term rates rise above long-term ones. It is the most striking sentence the bond market ever utters, and it has preceded almost every US recession of the last fifty years.

::: tanim Yield Curve
The line drawn through the yields of one borrower's bonds (here, the US Treasury) across maturities. It normally slopes upward: the longer the maturity, the higher the yield. **Inversion** is when short-term yields rise above long-term ones.
:::

## Why It Inverts

The two ends price two different things. The [rates and bonds article](/rehber/faiz-tahvil) covers the mechanics; what matters here is the split:

- **The short end (2 years)** reflects the Fed's policy rate today and in the near future. If rates are being raised to fight inflation, the short end rises.
- **The long end (10 years)** reflects long-run growth and inflation expectations. If the market expects a slowdown, the long end falls.

An inversion is both happening at once: **the Fed is tightening today, and the market expects a slowdown tomorrow.** The curve is saying "this level of tightness cannot be carried for long; eventually rates come down."

::: ornek Reading 2s10s
2-year: 4.90% · 10-year: 4.25%
Spread: 4.25 − 4.90 = **−0.65 points**. The curve is inverted.
The market is saying two things at once: today's rate is high AND the average of the next ten years will be lower than that. Both can only be true if cuts are coming — and cuts usually come when the economy slows.
:::

That spread is called **2s10s** in market shorthand, and it is this article's glyph.

## The Signal's Actual Record

The reputation is earned: the curve has inverted before every US recession since the 1970s. With two caveats.

**The lag is long and variable.** Historically, six to twenty-four months have passed between inversion and the start of a recession. "The curve inverted, so sell" can look wrong for more than a year — and stocks can keep rising throughout.

**The un-inversion is a signal too.** The curve returning to normal (*re-steepening*) often lands just before the recession, because the normalisation usually comes from the short end falling — that is, the Fed starting to cut. A rate cut looks like something to celebrate; it is worth remembering what prompted it.

::: dikkat One Indicator Is Not a Decision
The yield curve is not a forecasting machine but a photograph of expectations: it shows what the market thinks today, not what will happen. The sample is small too — a handful of recessions in fifty years, and each time the claim "this time is different" is both common and occasionally correct.
Practical use: read the curve as **context**, not as an alarm. An inverted curve tells you the price of risk has shifted regime; it does not tell you what to buy or when.
:::

## Which Spread

There is no single "yield curve"; different pairs of maturities give different signals:

| Spread | What it reflects | Character |
|---|---|---|
| **2s10s** | Policy expectations vs growth expectations | The most quoted |
| **3m-10y** | Today's cost of money vs growth | Stronger in academic work |
| **5s30s** | Long-run inflation expectations | Less affected by policy |

Two inverting together strengthens the signal; only one inverting is often technical.

## What It Means for Stocks

An inverted curve is a direct problem for banks: a bank borrows short and lends long, so it lives off the spread. When the spread goes negative, the business model tightens.

For other sectors the effect is indirect, and it is the subject of the [sector rotation](/rehber/sektor-rotasyonu) article: an expected slowdown moves money from cyclical sectors into defensive ones.

::: ozet In Short
An inverted yield curve is the bond market saying today's tightness cannot last. Its record is strong but its timing is poor: one to two years can pass between signal and event. So treat it not as a trading trigger but as background on which regime risk is being priced in.
:::

## Where You'll See It Here

The Treasury yield strip on [Markets](/piyasalar) puts the 2, 5, 10 and 30-year yields side by side — you can read the shape of the curve straight off it: if the short rate is above the long one, the curve is inverted. The data comes from FRED and any publication lag is stated in the stamp. [Macro](/makro) shows how those series have moved over time.`,
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

  /* ---------------------------------------------------------------------- */
  "sektor-rotasyonu": {
    title: "What Is Sector Rotation?",
    dek: "Money changing sectors without leaving the market — and how that tracks the economic cycle.",
    bodyMd: `Some days the index closes flat while something large happens underneath: banks up 3%, technology down 3%. No money left the market; it **moved**. That is sector rotation, and it is where the macro articles connect to a portfolio.

::: tanim Sector Rotation
Investors shifting weight from one sector to another based on the economic cycle or rate expectations. Little happens at the index level; a great deal happens inside it.
:::

## Two Families: Cyclical and Defensive

The whole of rotation rests on one distinction.

**Cyclical sectors** breathe with the economy. When people feel good they buy cars, take holidays, renovate. Banks earn from loan growth and the rate spread. These sectors outrun the index in expansions and fall harder in slowdowns: **industrials, consumer discretionary, financials, energy, materials.**

**Defensive sectors** are less affected by the cycle. Electricity bills get paid in a recession too, medicines are bought, detergent runs out. They beat the index in slowdowns and lag it in booms: **consumer staples, healthcare, utilities, telecom.**

::: ornek One Day, Two Directions
A Fed meeting delivers a more hawkish message than expected: rates stay higher for longer.
In the same session:
Utilities **−2.4%** — heavily indebted, dividend-paying companies compete with bond yields; higher rates dull their appeal.
Banks **+1.8%** — higher rates widen the gap between lending and deposit rates.
Technology **−1.9%** — most of the value sits in profits far in the future; higher rates cut what those profits are worth today.
The index: **−0.3%**. A headline reader calls it a quiet day; underneath there are three separate stories.
:::

## Why Rates Dominate

The last line of that example is the important one. A company is worth its future cash discounted to today. The discount rate is the interest rate.

A company whose profits arrive **soon** (a mature bank, a grocery chain) is barely affected by rate changes. A company whose profits are expected **far out** (a growth name not yet profitable) is affected enormously — distant cash discounted at a high rate is worth far less.

That is why rotation becomes almost mechanical when rate expectations shift. Every signal in the [yield curve](/rehber/getiri-egrisi) and [hawkish/dovish](/rehber/sahin-guvercin) articles shows up here first.

## Four Phases of the Cycle

The classic model is this — a frame, not a rule:

| Phase | Economy | Leadership |
|---|---|---|
| **Early recovery** | Turning up off the bottom, rates low | Financials, consumer discretionary |
| **Expansion** | Fast growth, rates rising | Technology, industrials |
| **Peak / slowdown** | High inflation, rates at their top | Energy, materials |
| **Contraction** | Slowing, rates start coming down | Staples, healthcare, utilities |

::: dikkat Turning a Frame Into a Prophecy
That table summarises historical tendencies; it does not hand you a programme for the future. Three reasons:
**We only know the phase afterwards.** Which phase we are in becomes clear months after it has passed.
**The market prices ahead.** Rotation happens when expectations change, not when the data prints — by the time you see the number, the move has happened.
**Sector labels mislead.** "Technology" today contains both unprofitable software companies and the most cash-rich businesses on earth; the two can react to the same rate headline in opposite directions.
:::

## Seeing Rotation

The most practical sign of rotation is **market breadth**: when the index rises, how many stocks are up? If the index gains 1% while only 35% of its members are green, the rise is coming from a few large names and money is flowing elsewhere underneath.

The second sign is sectors **not moving together**. In a panic everything falls at once (correlations go to 1); in a healthy rotation some rise while others fall.

::: ozet In Short
Sector rotation is the same money changing places inside the market. It shows what the index headline hides. It is not a timing tool — knowing the framework does not tell you to "switch to banks now." Its real value is on the [diversification](/rehber/cesitlendirme) side: it lets you notice which phase your portfolio is betting on. Most portfolios carry a macro bet their owner never consciously placed.
:::

## Where You'll See It Here

Three screens read this subject directly:

- The **market breadth** bar on [Markets](/piyasalar) tells you how many index members are up — the fastest read on rotation.
- The sector filters in the [Companies](/sirketler) directory let you compare the same day sector by sector.
- The rate and inflation series on [Macro](/makro) give you the cause; you see the effect in the market.`,
  },
};
