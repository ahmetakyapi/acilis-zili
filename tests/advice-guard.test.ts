import test from "node:test";
import assert from "node:assert/strict";

import { adviceMatches, isAdviceFree } from "../lib/advice-guard";

test("Türkçe yönlendirme kalıpları yakalanır", () => {
  for (const text of [
    "Sağlık sektörüne ağırlık eklemelisin.",
    "Bu yüzden NVDA'yı azaltmalısınız.",
    "Portföyünü çeşitlendirmelisin.",
    "XLV almayı düşünebilirsin.",
    "Ben olsam öneririm: biraz finans.",
    "Tavsiye ederim ki yoğunlaşmayı azalt.",
    "Bir miktar sağlık hissesi satın alın.",
    "Bu düşüş iyi bir alım fırsatı.",
    "Teknoloji payı azaltılmalı.",
    "AMD'yi %15 civarına indirmeni öneririm.",
    "Boşalan kaynağı dört boşluğa dağıt: Finans, Sağlık.",
    "Dolar bazlı performansı esas al.",
    /* 25 Ekim incelemesi: ilk sürümün geçirdiği biçimler. */
    "Sağlık sektörüne ağırlık eklemeniz gerekir.",
    "Biraz finans hissesi almanız mantıklı olur.",
    "Yoğunlaşmayı azaltmak lazım.",
    "XLV'yi portföyüne ekleyebilirsin.",
    "NVDA ağırlığını azaltabilirsiniz.",
    "Bir sağlık fonunu düşünebilirsin.",
    "Bu durumda çeşitlendirme önerilir.",
    "Sağlık fonu portföye eklenebilir.",
    "XLV'yi eklemenizi öneririz.",
  ]) {
    assert.ok(adviceMatches(text, "tr").length > 0, text);
  }
});

test("İngilizce yönlendirme kalıpları yakalanır", () => {
  for (const text of [
    "You should consider adding health care exposure.",
    "I recommend trimming NVDA.",
    "Investors might want to diversify into financials.",
    "Consider buying a sector fund.",
    "This is a good opportunity.",
    /* Hukuki çizgisi olmayan bir sistem metniyle canlı Claude'un yazdığı
       cümleler (24 Ekim): ilk sürüm denetimi bunlardan geçiyordu. */
    "Concretely, I would buy the Health Care Select Sector SPDR Fund (XLV) as the core diversifier.",
    "Then add JPMorgan Chase (JPM) for Financials.",
    "Fund these by trimming AMD toward 15 to 20% rather than adding new money.",
    "You could add a health care fund here.",
    "It may be worth adding some financials.",
    "Rebalancing is recommended at this level.",
  ]) {
    assert.ok(adviceMatches(text, "en").length > 0, text);
  }
});

test("gözlem ve genel mekanizma cümleleri geçer", () => {
  for (const text of [
    "Teknoloji ağırlığın %71,2 ile S&P 500'deki %33,0 payın çok üstünde.",
    "Birlikte hareket eden pozisyonlar çeşitlendirmenin etkisini zayıflatır; NVDA ile AMD'nin korelasyonu 0,82.",
    "Sağlık ve finans portföyünde yok; bu sektörler endeksin yaklaşık dörtte birini oluşturuyor.",
    "Doların liraya karşı değer kazanması lira getirisini yukarı taşıdı.",
    "Bu ölçüler bugünkü ağırlıklarla geçen yıla bakıyor; gerçek geçmişin bu değil.",
    "Alım satım kararı senin; burada yalnızca ölçüleri görüyorsun.",
    /* Yanlış pozitif sınaması: ek çekimli gözlem cümleleri geçmeli. */
    "Bu ölçüyü bir yıllık pencere olarak değerlendirebilirsin.",
    "Şirketlerin borç almaları faiz yükünü artırdı.",
    "Almanya'daki talep düşüşü sanayi hisselerini etkiledi.",
    "Senaryo panelinde fon eklemenin ölçüleri nasıl değiştirdiğini görebilirsin.",
    "Teknoloji hisselerinin toplamı portföyün yarısını aşıyor.",
  ]) {
    assert.ok(isAdviceFree(text, "tr"), text);
  }
  assert.ok(isAdviceFree("Your largest position carries 32.5% of the portfolio; adding uncorrelated assets usually lowers volatility.", "en"));
  assert.ok(isAdviceFree("Positions that move together can add risk; you can see this in the correlation list.", "en"));
});
