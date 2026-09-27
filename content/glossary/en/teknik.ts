/* Glossary — Technical Analysis (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_TEKNIK: GlossaryTexts<"teknik"> = {
  "hareketli-ortalama": {
    term: "Moving Average",
    definition:
      "A moving average is the average of the last set number of closing prices; each new day pushes the oldest one out, so the average \"moves\" with the price. It filters out day-to-day noise to show the general direction. The 50-day and 200-day averages are the most watched. Because it is built from past prices it always lags; it shows direction, not the future.",
    example:
      "If the last five closes were $10, $11, $12, $13 and $14, the five-day simple moving average is $12. If the next day closes at $15, the $10 drops out and the average rises to $13.",
    match: ["moving average", "simple moving average", "SMA"],
  },
  "ussel-hareketli-ortalama": {
    term: "Exponential Moving Average (EMA)",
    definition:
      "An EMA is a moving average that gives more weight to recent prices than to older ones. It therefore reacts faster than a simple average when price changes direction, but it is also more easily pulled around by short swings. Each day the new close enters the average with a weight of 2 / (number of periods + 1). Other indicators such as MACD are built on EMAs.",
    example:
      "In a 10-day EMA the new day's weight is 2 / 11, about 18%. If yesterday's EMA was $50 and today's close is $55, the new EMA is about 50 + 0.18 × 5 = $50.90.",
    match: ["exponential moving average", "EMA"],
  },
  "altin-kesisim": {
    term: "Golden Cross",
    definition:
      "A golden cross is when the 50-day moving average crosses above the 200-day moving average. Because the shorter average moves above the longer one, it shows recent prices running above the long-term trend and is conventionally read as strengthening upward momentum. Both averages are built from past prices, so the cross often comes after much of the move has already happened. In a sideways market the averages can cross back and forth and give misleading signals.",
    match: ["golden cross"],
  },
  "olum-kesisimi": {
    term: "Death Cross",
    definition:
      "A death cross is when the 50-day moving average crosses below the 200-day moving average. It is the opposite of a golden cross and is conventionally read as strengthening downward momentum. Despite the dramatic name it is a lagging signal: it often appears after the price has already fallen noticeably, and there are plenty of cases where the price recovered afterward.",
    match: ["death cross"],
  },
  "rsi": {
    term: "Relative Strength Index (RSI)",
    definition:
      "RSI is a momentum indicator that moves between 0 and 100, calculated from the ratio of average gains to average losses over a set period. The default period is 14, and readings above 70 are conventionally called overbought and below 30 oversold. Those thresholds do not predict a reversal; in a strong uptrend RSI can stay above 70 for a long time. When price makes a new high but RSI does not (a divergence), it is read as fading momentum.",
    example:
      "If over 14 days the average gain is $2 and the average loss is $1, the ratio is 2 and RSI = 100 - 100 / (1 + 2), about 66.7.",
    match: ["RSI", "relative strength index"],
  },
  "macd": {
    term: "Moving Average Convergence Divergence (MACD)",
    definition:
      "MACD is a momentum indicator equal to the 12-day exponential moving average minus the 26-day exponential moving average. A 9-day EMA of that difference is the signal line, and the gap between MACD and the signal line is the histogram. MACD crossing above its signal line is conventionally read as momentum turning up, crossing below as turning down. Because it is derived from averages it lags, and in sideways markets it produces frequent misleading crosses.",
    example:
      "If the 12-day EMA is $105 and the 26-day EMA is $102, MACD is 3. With a signal line at 2.5, the histogram shows 0.5.",
    match: ["MACD", "moving average convergence divergence"],
  },
  "asiri-alim": {
    term: "Overbought",
    definition:
      "Overbought describes a price that has risen so fast in a short time that a momentum indicator (most often RSI above 70) has crossed its conventional threshold. It is read as a sign the rally may pause or pull back. It is not a sell signal: in strong trends price can stay overbought for weeks and keep rising.",
    match: ["overbought"],
  },
  "asiri-satim": {
    term: "Oversold",
    definition:
      "Oversold describes a price that has fallen so fast in a short time that a momentum indicator (most often RSI below 30) has dropped under its conventional threshold. It is read as a sign the decline may slow or a relief bounce may come. It is not a buy signal: in sharp sell-offs, especially after bad news, price can stay oversold for a long time.",
    match: ["oversold"],
  },
  "destek-seviyesi": {
    term: "Support Level",
    definition:
      "A support level is a price zone where declines have stopped several times in the past and buyers stepped in. It is more accurate to think of it as a range than a single exact number. Traders watch whether price reacts again as it approaches that zone. When support breaks, meaning price moves clearly below it, the zone conventionally tends to act as resistance afterward; that is a common tendency, not a rule.",
    match: ["support level", "support zone"],
  },
  "direnc-seviyesi": {
    term: "Resistance Level",
    definition:
      "A resistance level is a price zone where rallies have stopped several times in the past and sellers took over. Like support, it is better thought of as a range than one number. When price moves clearly above it, a breakout is said to have happened, and the old resistance conventionally tends to act as support. How much weight a level gets is usually tied to how many times it has been tested and the trading volume at the time.",
    match: ["resistance level", "resistance zone"],
  },
  "pivot-noktasi": {
    term: "Pivot Point",
    definition:
      "A pivot point is a reference level calculated as the average of the previous period's (usually the previous day's) high, low and close. Levels derived from it are used as possible resistance (R1, R2) and support (S1, S2). It is mainly a day trader's tool. The formula is mechanical; whatever significance the levels have comes from many market participants watching the same numbers.",
    example:
      "If yesterday's high was $110, low $100 and close $105, the pivot is (110 + 100 + 105) / 3 = $105. The first resistance is 2 × 105 - 100 = $110 and the first support 2 × 105 - 110 = $100.",
    match: ["pivot point"],
  },
  "trend-cizgisi": {
    term: "Trendline",
    definition:
      "A trendline is a straight line drawn on a chart through successive lows (in an uptrend) or successive highs (in a downtrend). It makes the direction and slope of a trend visible at a glance. The number of times price touches the line is taken as a measure of how reliable it is. Because the choice of points is up to whoever draws it, two analysts can draw different lines on the same chart.",
    match: ["trendline", "trend line"],
  },
  "kirilim": {
    term: "Breakout",
    definition:
      "A breakout is when price moves clearly above a resistance level or below a support level. In the conventional reading, a breakout on above-average trading volume carries more weight. If price pokes past the level briefly and then quickly returns, it is called a false breakout, and these are common. That is why many analysts wait for a close beyond the level.",
    match: ["breakout", "false breakout"],
  },
  "fibonacci-duzeltmesi": {
    term: "Fibonacci Retracement",
    definition:
      "Fibonacci retracements are horizontal levels showing how much of a significant rise or fall price might give back. The ratios used are 23.6%, 38.2%, 61.8% and 78.6%; 50% is not a Fibonacci ratio but is commonly added. There is no proven reason these ratios should affect markets. The levels are watched because many participants look at the same places, and they change depending on which high and low are chosen.",
    example:
      "If a stock rose from $100 to $200, a 38.2% retracement lands at 200 - 38.2 = $161.80, a 50% retracement at $150, and a 61.8% retracement at $138.20.",
    match: ["fibonacci retracement", "fibonacci level"],
  },
  "bollinger-bantlari": {
    term: "Bollinger Bands",
    definition:
      "Bollinger Bands are two bands drawn 2 standard deviations above and below a 20-period moving average of price. They widen as volatility rises and narrow as it falls. A pronounced narrowing (a squeeze) is read as a sign that a sharp move may follow a quiet period, but it does not say in which direction. Price touching the upper band is not on its own a sell signal, nor is touching the lower band on its own a buy signal.",
    match: ["bollinger band"],
  },
  "atr": {
    term: "Average True Range (ATR)",
    definition:
      "ATR is a volatility indicator that measures, in price units, how much a stock typically moves in a period. Each day's true range is the largest of three values: the day's high minus low, the gap between the high and the previous close, and the gap between the low and the previous close. ATR is usually the 14-day average of these values. It says nothing about direction; it is used to size stop distances or positions according to volatility.",
    example:
      "If a $100 stock has an ATR of $3, it typically moves around $3 a day. Someone placing a stop 2 ATRs below would put it at $94.",
    match: ["ATR", "average true range"],
  },
  "vwap": {
    term: "Volume-Weighted Average Price (VWAP)",
    definition:
      "VWAP is the average price of the day's trades weighted by their volume; it starts from scratch at the beginning of each trading day. Institutional investors use it as a benchmark to judge whether they filled large orders at a good average price. Price above VWAP means the stock is trading above the day's volume-weighted average so far; it describes position relative to the day's average, not a forecast.",
    example:
      "If 100 shares traded at $10 and 300 at $12 during the day, VWAP is (1,000 + 3,600) / 400 = $11.50.",
    match: ["VWAP", "volume-weighted average price", "volume weighted average price"],
  },
  "mum-grafigi": {
    term: "Candlestick Chart",
    definition:
      "A candlestick chart shows each period's open, high, low and close as a single \"candle\". The body spans the open and the close, and the thin wicks above and below mark the period's high and low. If the close is above the open the candle is usually drawn green or hollow, if below, red or filled. A single candle sums up the balance between buyers and sellers during that period.",
    match: ["candlestick chart", "candlestick"],
  },
  "fiyat-boslugu": {
    term: "Price Gap",
    definition:
      "A price gap is when price opens entirely above or below the previous period's trading range, leaving an empty space on the chart where no trades happened. On daily charts it usually follows news that arrives while the market is closed, such as earnings released after the close. \"Gaps get filled\" is a common saying but not a rule; some gaps stay open for a long time or never close.",
    match: ["price gap", "gap up", "gap down"],
  },
  "risk-getiri-orani": {
    term: "Risk/Reward Ratio",
    definition:
      "The risk/reward ratio compares the potential loss you accept on a trade with the potential gain you target. The distance from entry to the stop level is the risk, and the distance from entry to the target is the reward. The ratio alone does not tell you whether a trade is good, because it ignores the probability of reaching the target: a 1 to 3 ratio can still lose money if the target is rarely hit.",
    example:
      "If you enter at $100 with a stop at $95 and a target at $115, the risk is $5, the reward $15, and the ratio 1 to 3.",
    match: ["risk/reward ratio", "risk-reward ratio", "reward-to-risk ratio"],
  },
};
