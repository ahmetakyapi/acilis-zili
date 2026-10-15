/**
 * Topluluk yazısı ŞABLONLARI (15 Ekim) — editörün boş sayfasını dolduran
 * hazır iskeletler. Düz modül ("use client" değil): editör (istemci) ve
 * /topluluk'taki "Şablonla Başla" bağlantıları (sunucu) aynı listeyi okur.
 *
 * Her şablon iki işi birden yapar: yazının kurgusunu önerir (tez → kanıt →
 * risk) ve ::: blok dilini ÖRNEKLE öğretir — okuyucu sözdizimini belgeden
 * değil, çalışan bir yazıdan görür. Gövdeler kayıt şemasının alt sınırını
 * (200 karakter) aşar; köşeli parantezli yerler doldurulmak için.
 *
 * Sayılar ÖRNEK ve öyle işaretli: şablon gerçek bir veri iddiası taşımaz.
 */

export type PostTemplateKey = "tez" | "bilanco" | "karsilastirma" | "makro";

type Content = { title: string; dek: string; symbols: string; body: string };

/** Kartın adı ve tek cümlesi arayüz metni: sözlükte (`community.templates`). */
export type PostTemplate = {
  key: PostTemplateKey;
  content: { tr: Content; en: Content };
};

export const POST_TEMPLATES: readonly PostTemplate[] = [
  {
    key: "tez",
    content: {
      tr: {
        title: "[Şirket] Neden İzleme Listemde",
        dek: "Tek cümlede tez: [şirketin] önümüzdeki dönemde [neyin] lehine işleyeceğini düşünüyorum.",
        symbols: "NVDA",
        body: `## Tez

Bu yazıda $NVDA için neden ilgi duyduğumu üç başlıkta anlatıyorum. İlk paragrafta okuyucuya tek cümlelik özeti ver; ayrıntı aşağıda.

::: sayilar Rakamlarla (örnek)
%62 | Veri merkezi gelir büyümesi
%75 | Brüt marj
:::

## Kanıt

- Birinci gözlem: [ne gördün]
- İkinci gözlem: [hangi veri bunu destekliyor]

::: grafik NVDA | 6M | Son altı ay
:::

## Riskler

::: dikkat Neyi Yanlış Anlıyor Olabilirim
**Değerleme:** fiyat beklentinin önünde koşuyor olabilir.
**Rekabet:** [rakip] payı aşındırabilir.
:::

::: ozet Sonuç
Tezi neyin bozacağını yaz: hangi veri gelirse fikrini değiştirirsin?
:::`,
      },
      en: {
        title: "Why [Company] Is on My Watchlist",
        dek: "The thesis in one sentence: I think [company] stands to benefit from [what] in the coming quarters.",
        symbols: "NVDA",
        body: `## Thesis

In this post I explain in three parts why $NVDA has my attention. Give the reader the one-sentence summary first; details follow below.

::: sayilar By the Numbers (example)
62% | Data center revenue growth
75% | Gross margin
:::

## Evidence

- First observation: [what you saw]
- Second observation: [which data supports it]

::: grafik NVDA | 6M | The last six months
:::

## Risks

::: dikkat What I Might Be Getting Wrong
**Valuation:** the price may be running ahead of expectations.
**Competition:** [rival] could erode share.
:::

::: ozet Bottom Line
Write what would break the thesis: which data would change your mind?
:::`,
      },
    },
  },
  {
    key: "bilanco",
    content: {
      tr: {
        title: "[Şirket] [Çeyrek] Bilançosu: Beklenti ve Gerçekleşen",
        dek: "Çeyreğin en önemli sayısı ve piyasanın ona tepkisi tek cümlede.",
        symbols: "AAPL",
        body: `Bilanço açıklandı; bu notta beklentiyle gerçekleşeni ve şirketin verdiği yönlendirmeyi kıyaslıyorum.

::: bar Beklenti ve Gerçekleşen (örnek, Mr $)
Beklenti | 94,5
Gerçekleşen | 96,1
:::

## Öne Çıkanlar

- Gelir: [beklentinin üstünde/altında]
- Kâr marjı: [ne oldu]
- Yönlendirme: [şirket gelecek çeyrek için ne dedi]

::: oncesi Hisse Fiyatı (örnek)
212 $ | Açıklama öncesi
224 $ | Ertesi gün
:::

::: tanim Terim
**Yönlendirme:** şirketin gelecek dönem için verdiği resmî tahmin aralığı.
:::

## Benim Okumam

Sayının kendisinden çok piyasanın neye tepki verdiğini yaz.`,
      },
      en: {
        title: "[Company] [Quarter] Earnings: Expected vs. Reported",
        dek: "The quarter's most important number and how the market reacted, in one sentence.",
        symbols: "AAPL",
        body: `Earnings are out; in this note I compare expectations with results and the guidance the company gave.

::: bar Expected vs. Reported (example, $B)
Expected | 94.5
Reported | 96.1
:::

## Highlights

- Revenue: [above/below expectations]
- Margin: [what happened]
- Guidance: [what the company said for next quarter]

::: oncesi Share Price (example)
$212 | Before the report
$224 | Next day
:::

::: tanim Term
**Guidance:** the official range a company gives for the coming period.
:::

## My Read

Write less about the number itself and more about what the market reacted to.`,
      },
    },
  },
  {
    key: "karsilastirma",
    content: {
      tr: {
        title: "[A] mı [B] mi? Aynı Pazarın İki Yolu",
        dek: "İki şirket aynı talebe farklı modellerle oynuyor; farkı üç ölçüde gösteriyorum.",
        symbols: "AMD, INTC",
        body: `$AMD ve $INTC aynı pazarda farklı stratejilerle yarışıyor. Bu yazıda farkı sayılarla gösteriyorum.

::: pay Pazar Payı (örnek)
AMD | 34
INTC | 58
Diğer | 8
:::

## Büyüme

::: bar Yıllık Gelir Büyümesi (örnek, %)
AMD | 18
INTC | -2
:::

## Kârlılık ve Bilanço

- [A]: [marj, borç, nakit]
- [B]: [marj, borç, nakit]

::: ornek Hesap
**Adım 1:** iki şirketin F/K oranını yaz.
**Adım 2:** büyümeyle böl, büyümeye göre ucuz olanı göster.
:::

::: ozet Hangisi Kime Uygun
Risk iştahına göre iki farklı profil tarif et; "al" deme, gerekçe ver.
:::`,
      },
      en: {
        title: "[A] or [B]? Two Roads in the Same Market",
        dek: "Two companies play the same demand with different models; I show the gap across three measures.",
        symbols: "AMD, INTC",
        body: `$AMD and $INTC compete in the same market with different strategies. In this post I show the gap with numbers.

::: pay Market Share (example)
AMD | 34
INTC | 58
Other | 8
:::

## Growth

::: bar Annual Revenue Growth (example, %)
AMD | 18
INTC | -2
:::

## Profitability and Balance Sheet

- [A]: [margin, debt, cash]
- [B]: [margin, debt, cash]

::: ornek Worked Example
**Step 1:** write down both companies' P/E.
**Step 2:** divide by growth and show which is cheaper for its growth.
:::

::: ozet Who Each One Suits
Describe two profiles by risk appetite; don't say "buy", give reasons.
:::`,
      },
    },
  },
  {
    key: "makro",
    content: {
      tr: {
        title: "[Veri/Karar] Piyasaya Nasıl Yansır?",
        dek: "Tek bir makro gelişmenin faizden hisselere uzanan yolunu adım adım çiziyorum.",
        symbols: "SPY",
        body: `Bu yazıda [veri ya da karar] gibi bir gelişmenin piyasaya hangi yoldan geçtiğini zincir olarak anlatıyorum.

::: akis Aktarım Zinciri
Enflasyon verisi | Beklenenden yüksek
Faiz beklentisi | Yukarı kayar
Tahvil getirisi | Yükselir
Büyüme hisseleri | Baskı altında
:::

::: zaman Kronoloji (örnek)
10 Eylül | Veri açıklandı
17 Eylül | Fed kararı
18 Eylül | Piyasa tepkisi
:::

## Neden Önemli

[Bu zincirin hangi halkası bu sefer farklı işleyebilir?]

::: dikkat Unutma
Tek bir veri trend değildir; bir sonraki açıklamayla teyit et.
:::`,
      },
      en: {
        title: "How Does [Data/Decision] Reach the Market?",
        dek: "I trace the path of one macro development from rates to stocks, step by step.",
        symbols: "SPY",
        body: `In this post I lay out, as a chain, how a development like [data or decision] travels to the market.

::: akis Transmission Chain
Inflation print | Hotter than expected
Rate expectations | Shift higher
Treasury yields | Rise
Growth stocks | Come under pressure
:::

::: zaman Timeline (example)
September 10 | Data released
September 17 | Fed decision
September 18 | Market reaction
:::

## Why It Matters

[Which link in this chain might work differently this time?]

::: dikkat Remember
One print is not a trend; confirm it with the next release.
:::`,
      },
    },
  },
];

export function findPostTemplate(value: unknown): PostTemplate | null {
  return POST_TEMPLATES.find((template) => template.key === value) ?? null;
}

