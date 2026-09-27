/* Glossary — Options (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_OPSIYON: GlossaryTexts<"opsiyon"> = {
  "opsiyon": {
    term: "Option",
    definition:
      "An option is a contract that gives its holder the right, but not the obligation, to buy or sell an asset at a set price until (or on) a set date. The buyer pays a premium for that right; the seller collects the premium and must fulfil the contract if the option is exercised. In the US a standard stock option contract covers 100 shares.",
    match: ["options contract", "option contract"],
  },
  "alim-opsiyonu": {
    term: "Call Option",
    definition:
      "A call option gives its holder the right to buy a stock at the strike price until expiration. Its value rises as the stock climbs above the strike; if the stock is below the strike at expiration it expires worthless, and the buyer's loss is limited to the premium paid. The breakeven point is the strike plus the premium.",
    example:
      "You buy a $100 strike call for a $3 premium ($300 per contract). If the stock is at $110 at expiration, the call is worth $10, a net gain of $7 per share or $700 per contract. If the stock stays below $100, you lose the full $300.",
    match: ["call option"],
  },
  "satim-opsiyonu": {
    term: "Put Option",
    definition:
      "A put option gives its holder the right to sell a stock at the strike price until expiration. Its value rises as the stock falls below the strike, which is why puts are also used to protect shares you already own against a decline. The buyer's loss is limited to the premium paid, and the breakeven point is the strike minus the premium.",
    example:
      "You buy a $100 strike put for a $4 premium. If the stock is at $90 at expiration, the put is worth $10, a net gain of $6 per share. Breakeven is $96.",
    match: ["put option"],
  },
  "kullanim-fiyati": {
    term: "Strike Price",
    definition:
      "The strike price is the fixed price at which the option holder can buy (with a call) or sell (with a put) the stock. It is set in the contract and does not change over the option's life. For the same stock and expiration, options trade at many different strikes.",
    example:
      "If you hold a $50 strike call and the stock rises to $60, you can exercise and buy the shares at $50; the option's intrinsic value is $10 per share.",
    match: ["strike price", "exercise price"],
  },
  "vade-sonu": {
    term: "Expiration Date",
    definition:
      "The expiration date is when an option stops being valid; after it, the right can no longer be exercised. In the US, standard monthly stock options expire on the third Friday of the month, and weekly and shorter-dated options also exist. Stock options are American-style and can be exercised at any time before expiration, while European-style options such as S&P 500 index options can be exercised only at expiration.",
    match: ["options expiration", "option expiration"],
  },
  "opsiyon-primi": {
    term: "Option Premium",
    definition:
      "The option premium is the option's market price: what the buyer pays and the seller receives. It has two parts: intrinsic value, what the option would be worth if exercised now, and time value, which depends on the time remaining and expected volatility. Prices are quoted per share; multiply by 100 for the cost of a standard contract.",
    example:
      "With the stock at $105, a $100 strike call priced at $7 has $5 of intrinsic value and $2 of time value. One contract costs $700.",
    match: ["option premium", "options premium"],
  },
  "parada": {
    term: "Moneyness (ITM, ATM, OTM)",
    definition:
      "Moneyness describes where an option's strike sits relative to the stock price. A call is in the money (ITM) when the stock is above the strike, out of the money (OTM) when it is below, and at the money (ATM) when the two are roughly equal; for a put, in and out are reversed. An out-of-the-money option's premium consists entirely of time value.",
    example:
      "With the stock at $100, a $90 strike call is in the money (intrinsic value $10), a $110 call is out of the money and a $100 call is at the money. At the same prices, a $110 put is in the money.",
    match: ["in the money", "out of the money", "in-the-money", "out-of-the-money"],
  },
  "delta": {
    term: "Delta",
    definition:
      "Delta shows roughly how much an option's premium changes when the stock moves $1. It ranges from 0 to 1 for calls and from 0 to -1 for puts, and at-the-money options have a delta of around 0.5. As a rough rule of thumb, it is also read as an approximate probability that the option finishes in the money.",
    example:
      "For a call with a delta of 0.40, a $1 rise in the stock lifts the premium by about $0.40, or about $40 for a 100-share contract.",
    match: ["option delta", "options delta"],
  },
  "theta": {
    term: "Theta",
    definition:
      "Theta shows how much an option's premium erodes from the passage of one day, with everything else held constant. It is negative for the option buyer: time value shrinks a little each day, and that decay accelerates as expiration nears, especially for at-the-money options. For the option seller, the same decay works in their favour.",
    example:
      "An option with a theta of -0.05 loses about 5 cents a day, or about $5 per 100-share contract, if the stock price and volatility stay unchanged.",
    match: ["option theta", "time decay"],
  },
  "ortuk-oynaklik": {
    term: "Implied Volatility",
    definition:
      "Implied volatility is backed out of option prices and shows how much volatility the market expects in a stock over the coming period, quoted as an annualized percentage. As options get more expensive, implied volatility rises. It usually climbs ahead of uncertain events such as earnings and often drops quickly once the event has passed.",
    match: ["implied volatility"],
  },
  "beklenen-hareket": {
    term: "Expected Move",
    definition:
      "The expected move is the approximate price range that option prices imply for a stock through a given date. In practice it is most often estimated by adding the premiums of the nearest-dated at-the-money call and put (the straddle price). It says nothing about direction, only size, and the actual move can land inside or outside that range.",
    example:
      "With the stock at $100, if the $100 call and $100 put expiring just after earnings cost $4 each, the total is $8, meaning the market is pricing a move of roughly 8%.",
    match: ["expected move", "implied move"],
  },
  "straddle": {
    term: "Straddle",
    definition:
      "A straddle is buying a call and a put on the same stock with the same strike and the same expiration. The outcome depends on the size of the move, not its direction: it profits if the stock moves in either direction by more than the total premium paid. If the stock stays put, both options lose time value, and in the worst case the entire premium is lost.",
    example:
      "With the stock at $100, you buy the $100 call for $4 and the $100 put for $4, a total cost of $8 per share. To profit at expiration, the stock needs to be below $92 or above $108.",
    match: ["long straddle", "straddle"],
  },
  "ortulu-alim": {
    term: "Covered Call",
    definition:
      "A covered call means selling one call option for every 100 shares you own. You collect the premium as extra income; in exchange, if the stock rises above the strike, you give up the gains beyond that point because the shares can be called away at the strike. The downside risk largely remains, softened only by the premium received.",
    example:
      "With the stock at $100, you sell a $110 strike call for a $2 premium. If the stock is at $120 at expiration, your shares go at $110, and your total gain is capped at $12 per share ($10 of price gain plus the $2 premium).",
    match: ["covered call"],
  },
  "vix": {
    term: "VIX (Fear Index)",
    definition:
      "The VIX is an index calculated by Cboe from S&P 500 option prices that shows the volatility the market expects over the next 30 days, as an annualized percentage. It stays low when markets are calm and jumps during sharp sell-offs and uncertain periods, which is why it is called the fear index. It cannot be bought directly, and VIX futures and the funds built on them can behave quite differently from the index itself.",
    example:
      "A VIX of 16 means the market is pricing about 16% annualized volatility for the S&P 500, which works out to a one-month standard deviation of roughly 4.6% (16 divided by the square root of 12).",
    match: ["VIX", "fear index", "fear gauge"],
  },
};
