/* Glossary — Macro & the Fed (English). Structure lives in `../meta.ts`. */
import type { GlossaryTexts } from "../meta";

export const EN_MAKRO: GlossaryTexts<"makro"> = {
  "tufe": {
    term: "Consumer Price Index (CPI)",
    definition:
      "The CPI tracks the change in the price of a basket of goods and services bought by households. In the US it is published monthly by the Bureau of Labor Statistics (BLS), and markets focus on the month-over-month and year-over-year changes. Shelter carries the largest weight in the basket. A hotter-than-expected CPI is usually read as a reason for the Fed to keep rates higher for longer, which can move both bond yields and stocks.",
    example:
      "If the basket cost $100 a year ago and costs $103 this month, annual CPI inflation is 3%. If it cost $102.70 last month, the monthly increase is about 0.3%.",
    match: ["CPI", "consumer price index", "consumer prices"],
  },
  "cekirdek-enflasyon": {
    term: "Core Inflation",
    definition:
      "Core inflation is inflation measured after removing food and energy, whose prices swing sharply and often temporarily. Both CPI and PCE are published in a core version. A jump in oil prices can move headline inflation a lot in a single month, while the core measure better shows how broadly price increases have spread through the economy. That is why markets trying to anticipate the Fed usually pay more attention to the core figure than to the headline.",
    match: ["core inflation", "core CPI", "core PCE"],
  },
  "pce": {
    term: "Personal Consumption Expenditures Price Index (PCE)",
    definition:
      "The PCE price index, published monthly by the Bureau of Economic Analysis (BEA), measures price changes across consumer spending. The Fed's 2% inflation target is defined in terms of PCE, not CPI. PCE has broader coverage (it includes, for example, health care paid by employers on households' behalf), gives less weight to housing, and better captures consumers switching from goods that got pricier to cheaper ones. Because of these differences PCE inflation usually runs a little below CPI inflation.",
    match: ["PCE", "personal consumption expenditures"],
  },
  "ufe": {
    term: "Producer Price Index (PPI)",
    definition:
      "The PPI measures the average change in the prices that domestic producers receive for the goods and services they sell. In the US it is published monthly by the BLS. Because higher production costs can eventually pass through to consumers, PPI is watched as a possible lead for CPI, although that pass-through is neither automatic nor steady. Turkey's statistics office publishes a domestic equivalent, Yİ-ÜFE, which is also used in Turkish tax calculations.",
    match: ["PPI", "producer price index", "producer prices"],
  },
  "fomc": {
    term: "Federal Open Market Committee (FOMC)",
    definition:
      "The FOMC is the Fed committee that sets interest rate policy. It has twelve voting members: the seven members of the Fed's Board of Governors, the president of the New York Fed, and four of the other eleven regional Fed presidents, who rotate. It holds eight scheduled meetings a year; the statement is released at 2:00 p.m. New York time, followed by a press conference with the Fed Chair. Minutes come out about three weeks after each meeting.",
    match: ["FOMC", "federal open market committee"],
  },
  "politika-faizi": {
    term: "Policy Rate (Federal Funds Rate)",
    definition:
      "The federal funds rate is the rate banks charge each other to lend reserves held at the Fed overnight, and the FOMC sets a target range for it a quarter of a percentage point wide. It anchors borrowing costs across the economy, from credit cards to mortgages. When the Fed raises it, borrowing gets more expensive and the economy is pushed to slow; cutting it does the opposite. Stock valuations respond too, because future profits are discounted back to today at a higher or lower rate.",
    match: ["federal funds rate", "fed funds rate", "fed funds", "policy rate"],
  },
  "nokta-grafigi": {
    term: "Dot Plot",
    definition:
      "The dot plot shows, as one dot per FOMC participant, where each thinks the policy rate should be at the end of each of the next few years and over the longer run. It is published four times a year (March, June, September and December) with the Summary of Economic Projections. Markets focus mostly on the median dot. The dots are individual projections, not a commitment, and they can shift at the next release as the data change.",
    match: ["dot plot"],
  },
  "sahin": {
    term: "Hawk",
    definition:
      "A hawk is a central banker, or a stance, that puts fighting inflation first and leans toward keeping rates high or raising them. When a Fed official's speech or a policy statement comes across as more hawkish than expected, markets read it as rates staying higher for longer. Short-term Treasury yields and the dollar are usually the quickest to react to that reading.",
    match: ["hawkish", "policy hawk"],
  },
  "guvercin": {
    term: "Dove",
    definition:
      "A dove is a central banker, or a stance, that puts growth and employment first and leans toward cutting rates or keeping them low. A more dovish decision or speech than expected is read by markets as a sign that rate cuts are closer. Hawk and dove are not fixed identities: the same official can sound closer to one side and later to the other as the data change.",
    match: ["dovish", "policy dove"],
  },
  "baz-puan": {
    term: "Basis Point",
    definition:
      "A basis point is one hundredth of a percentage point: 100 basis points equal 1 percentage point. It is used to describe changes in rates and yields without ambiguity. \"Rates rose 1%\" could mean one percentage point or a 1% relative increase; basis points remove that doubt.",
    example:
      "If the Fed raises rates by 25 basis points, the bottom of the target range goes from 4.00% to 4.25%. If the 10-year Treasury yield moves from 4.10% to 4.35%, it has risen 25 basis points.",
    match: ["basis point"],
  },
  "hazine-tahvili": {
    term: "US Treasury Securities",
    definition:
      "Treasuries are the debt securities the US Treasury issues to borrow money. Those maturing in up to a year are called bills, those of 2 to 10 years notes, and the 20 and 30-year ones bonds. A bond's price and its yield move in opposite directions: when the price falls, the yield rises. The 10-year Treasury yield is a reference point for many calculations, from mortgage rates to stock valuations.",
    example:
      "If you buy a bond with a $1,000 face value that pays $40 a year for $1,000, your yield is 4%. If its market price drops to $950, the same $40 is a current yield of about 4.2% for a new buyer.",
    match: ["Treasuries", "Treasury bond", "Treasury bonds", "Treasury yield", "Treasury yields", "10-year Treasury"],
  },
  "reel-faiz": {
    term: "Real Interest Rate",
    definition:
      "The real interest rate is the nominal rate minus inflation, the return measured in actual purchasing power. It is roughly the nominal rate minus expected inflation. In the US, the market's measure of real rates is the yield on inflation-protected Treasuries (TIPS). Rising real rates weigh especially on the valuations of growth companies that expect most of their profits far in the future.",
    example:
      "If a bond yields 5% and inflation is 3%, the real yield is about 2%. With 6% inflation, the same bond would lose about 1% in real terms.",
    match: ["real interest rate", "real yield", "real rate"],
  },
  "getiri-egrisi": {
    term: "Yield Curve",
    definition:
      "The yield curve lines up the yields of bonds from the same issuer (usually the US Treasury) from the shortest maturity to the longest. Normally it slopes upward, because investors want more yield for tying up money longer. The short end is shaped mostly by expectations for the Fed's policy rate, the long end by expectations for growth, inflation and risk. The slope is usually measured as the gap between the 10-year yield and the 2-year or 3-month yield.",
    match: ["yield curve"],
  },
  "ters-getiri-egrisi": {
    term: "Inverted Yield Curve",
    definition:
      "An inverted yield curve is when short-term yields rise above long-term ones; the most watched measures are the 10-year minus 2-year and 10-year minus 3-month spreads. It is read as the market expecting future rate cuts, that is, an economic slowdown. Historically it has come before most US recessions, but the lag has ranged from months to years and there have been inversions that were not followed by a recession. It is a warning sign, not a timetable.",
    match: ["inverted yield curve", "yield curve inversion"],
  },
  "niceliksel-gevseme": {
    term: "Quantitative Easing (QE)",
    definition:
      "Quantitative easing is a central bank buying large amounts of bonds with newly created reserves; the Fed's purchases have been mainly Treasuries and mortgage-backed securities. The aim is to push long-term rates down and ease financial conditions even when the policy rate is near zero. The purchases expand the central bank's balance sheet. Markets generally read QE as a supportive backdrop for risk assets.",
    match: ["quantitative easing", "QE"],
  },
  "niceliksel-sikilasma": {
    term: "Quantitative Tightening (QT)",
    definition:
      "Quantitative tightening is a central bank shrinking its balance sheet. The Fed has generally done this not by selling bonds but by letting some maturing securities roll off without reinvesting them, up to a monthly cap. Because it reduces demand for bonds, it can put upward pressure on long-term rates. It is watched as a second tightening tool working in the background of rate decisions.",
    match: ["quantitative tightening", "QT"],
  },
  "tarim-disi-istihdam": {
    term: "Nonfarm Payrolls (NFP)",
    definition:
      "Nonfarm payrolls is the number of paid jobs the US economy added or lost in a month, excluding farm workers, private household employees and the self-employed. It is part of the BLS monthly jobs report, usually released on the first Friday of the month at 8:30 a.m. New York time. The figure is revised over the following two months, so a single month's number can change noticeably later. Markets compare it with expectations and also look at wage growth in the same report.",
    match: ["nonfarm payroll", "non-farm payroll", "NFP"],
  },
  "issizlik-orani": {
    term: "Unemployment Rate",
    definition:
      "The unemployment rate is the share of the labor force that has no job, is available to work and has actively looked for work in the past four weeks. In the US it comes from the household survey in the BLS monthly jobs report. Someone who stops looking leaves the labor force, which can push the rate down, so it should be read alongside the labor force participation rate. Because maximum employment is one of the Fed's two mandates, this rate feeds directly into rate expectations.",
    match: ["unemployment rate"],
  },
  "sahm-kurali": {
    term: "Sahm Rule",
    definition:
      "Named after economist Claudia Sahm, the Sahm rule is a recession indicator. It triggers when the three-month average of the unemployment rate rises 0.5 percentage points or more above its lowest three-month average of the previous 12 months. Historically it has flagged the start of recessions at an early stage. It is an observed regularity, not a law of economics, and it can mislead when, for example, labor supply changes quickly.",
    example:
      "If the three-month average unemployment rate hit a low of 3.6% during the past year and now stands at 4.1%, the gap is 0.5 points and the rule has triggered.",
    match: ["sahm rule"],
  },
  "jolts": {
    term: "Job Openings and Labor Turnover Survey (JOLTS)",
    definition:
      "JOLTS is a monthly BLS survey measuring job openings, hires and separations in the US, with quits and layoffs reported separately. It runs about a month behind the nonfarm payrolls report. The ratio of job openings to unemployed people shows how tight the labor market is. Rising quits are read as workers feeling confident they can find a new job easily.",
    match: ["JOLTS", "job openings"],
  },
  "issizlik-basvurulari": {
    term: "Weekly Jobless Claims",
    definition:
      "Initial jobless claims count the people filing for unemployment insurance for the first time in a given week in the US. The Labor Department publishes them every Thursday at 8:30 a.m. New York time, which makes them the most frequently updated labor market indicator. Because the weekly number is noisy around holidays and weather events, the four-week average is often used instead. The same report also shows continuing claims, the number of people still receiving benefits.",
    match: ["jobless claims", "initial claims", "unemployment claims"],
  },
  "gsyh": {
    term: "Gross Domestic Product (GDP)",
    definition:
      "GDP is the value of all final goods and services produced in a country over a period, the basic measure of the size of an economy. In the US, the BEA first releases quarterly GDP as an advance estimate and revises it twice in the following months. The US reports growth seasonally adjusted and annualized: the quarter-over-quarter change is converted to what it would be over a year if that pace held for four quarters. It should not be compared directly with growth figures that countries such as Turkey report on a year-over-year basis.",
    example:
      "If the economy grew 0.5% from one quarter to the next, the US reports it annualized as roughly 2%.",
    match: ["GDP", "gross domestic product"],
  },
  "resesyon": {
    term: "Recession",
    definition:
      "A recession is a significant decline in economic activity that is spread across the economy and lasts more than a few months. In the US, the official start and end dates are set by the National Bureau of Economic Research (NBER), often announced months after the fact. \"Two consecutive quarters of falling GDP\" is a popular rule of thumb but not the official definition; the NBER looks at employment, income, production and other indicators together.",
    match: ["recession"],
  },
  "pmi": {
    term: "Purchasing Managers' Index (PMI)",
    definition:
      "A PMI is an index built from a monthly survey that asks company purchasing managers about orders, output, employment and prices. A reading above 50 means activity expanded compared with the previous month, below 50 that it contracted. In the US the most watched are the manufacturing and services PMIs from ISM and S&P Global. Because they come out right after the month ends, they give an early read on the economy before official data arrive.",
    match: ["PMI", "purchasing managers' index", "purchasing managers index"],
  },
  "perakende-satislar": {
    term: "Retail Sales",
    definition:
      "Retail sales is a monthly Census Bureau report on total sales at US retail and food service businesses. It is closely watched because consumer spending is the largest part of the US economy. The figure is not adjusted for inflation, so rising sales during a period of rising prices may not mean more goods were sold. The \"control group\", which strips out volatile items such as autos, gasoline and building materials, is followed separately because it feeds more directly into GDP.",
    match: ["retail sales"],
  },
  "dolar-endeksi": {
    term: "US Dollar Index (DXY)",
    definition:
      "The dollar index measures the US dollar against six major currencies: the euro, Japanese yen, British pound, Canadian dollar, Swedish krona and Swiss franc. The euro makes up more than half of the weighting, so the index largely reflects the dollar's move against the euro. The Turkish lira is not in the basket, so a falling dollar index does not mean USD/TRY will fall. A strong dollar can hurt the dollar-reported results of US companies that earn a large share of revenue abroad.",
    match: ["dollar index", "DXY"],
  },
};
