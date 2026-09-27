import test from "node:test";
import assert from "node:assert/strict";
import { parseVixCsv, parseTreasuryXml, getDailyMarketSeries } from "../lib/providers/daily-markets";
const xml = (date: string, value: string) => `<entry><d:NEW_DATE>${date}T00:00:00</d:NEW_DATE><d:BC_10YEAR m:type="Edm.Double">${value}</d:BC_10YEAR></entry>`;
test("VIX parses CLOSE, excludes missing, invalid and future dates, and sorts", () => {
  assert.deepEqual(parseVixCsv('DATE,OPEN,CLOSE\n09/25/2026,99,14.87\n09/24/2026,99,15.67\n09/26/2026,99,\n02/30/2026,99,5\n09/29/2026,99,5', '2026-09-28'), [{date:'2026-09-24',value:15.67},{date:'2026-09-25',value:14.87}]);
});
test("Treasury parses correct maturity and rejects missing/non-numeric values", () => {
  assert.deepEqual(parseTreasuryXml(xml('2026-09-25','5.17') + xml('2026-09-24','5.18') + xml('2026-09-28','N/A'), 'DGS10','2026-09-28'), [{date:'2026-09-24',value:5.18},{date:'2026-09-25',value:5.17}]);
  assert.deepEqual(parseTreasuryXml(xml('2026-09-25',''), 'DGS10','2026-09-28'), []);
});
test("selects newer official series, preserves its previous close, and falls back to FRED", async () => {
  const fetchBefore=globalThis.fetch, key=process.env.FRED_API_KEY;
  process.env.FRED_API_KEY='fixture';
  let directFails=false, fredNewer=false;
  globalThis.fetch=async input => {
    if(String(input).includes('cboe.com')) return directFails ? new Response('',{status:503}) : new Response('DATE,OPEN,CLOSE\n01/02/2020,9,14\n01/03/2020,9,15');
    return Response.json({observations:[{date:fredNewer?'2020-01-06':'2020-01-02',value:'18'},{date:'2020-01-01',value:'17'}]});
  };
  try{
    const def={seriesId:'VIXCLS',slug:'vix',units:'lin'};
    let result=await getDailyMarketSeries(def);
    assert.ok(result.ok); assert.equal(result.source,'cboe'); assert.equal(result.data.prevValue,14);
    fredNewer=true;result=await getDailyMarketSeries(def);assert.equal(result.source,'fred');
    directFails=true;result=await getDailyMarketSeries(def);assert.ok(result.ok);assert.equal(result.source,'fred');
    globalThis.fetch=async()=>new Response('',{status:503});assert.equal((await getDailyMarketSeries(def)).ok,false);
  }finally{globalThis.fetch=fetchBefore;if(key===undefined)delete process.env.FRED_API_KEY;else process.env.FRED_API_KEY=key;}
});
test("Treasury joins previous year when first year has too few observations",async()=>{
 const original=globalThis.fetch,key=process.env.FRED_API_KEY;process.env.FRED_API_KEY='fixture';
 const year=new Date().getUTCFullYear(), urls:string[]=[];
 globalThis.fetch=async input=>{const url=String(input);urls.push(url);if(url.includes('stlouisfed'))return new Response('',{status:503});return new Response(xml(`${url.endsWith(String(year))?year:year-1}-01-02`,url.endsWith(String(year))?'5':'4'));};
 try{const r=await getDailyMarketSeries({seriesId:'DGS10',slug:'yield-10y',units:'lin'});assert.ok(r.ok);assert.equal(r.data.latestValue,5);assert.equal(r.data.prevValue,4);assert.ok(urls.some(u=>u.endsWith(String(year-1))));}finally{globalThis.fetch=original;if(key===undefined)delete process.env.FRED_API_KEY;else process.env.FRED_API_KEY=key;}
});
