/**
 * Şirket kartının anahtarı — öğenin `data-cc` değeri ve kaydın adı.
 *
 * BU DOSYA `"use client"` DEĞİL ve olmamalı: anahtar hem sunucu
 * bileşenlerinde (öğeye öznitelik basılırken) hem istemci kartında (kayıt
 * aranırken) hesaplanıyor. `"use client"` bir modülden dışa aktarılan
 * değer sunucuya gerçek fonksiyon olarak gelmiyor, bir istemci referansına
 * dönüşüyor (CLAUDE.md "İstemci ile sunucu sınırı").
 *
 * `set` aynı sembolün aynı sayfada iki farklı kartı olduğunda (teknik
 * dağılımda görüş hapı ve yayın damgası taşıyan kart, düz şirket kartı)
 * ikisini ayırıyor; öğe önce kendi anahtarını, bulamazsa düz sembolü arıyor.
 */
export function cardKey(symbol: string, set?: string): string {
  return set ? `${set}:${symbol}` : symbol;
}
