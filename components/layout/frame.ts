/**
 * İÇERİK ÇERÇEVESİNİN ENİ — main, masthead, alt bilgi ve alt şerit
 * (`MarketTicker`) AYNI sabitten okur (25 Ekim, geniş ekran desteği).
 * Düz modül, `"use client"` değil: iki istemci bileşeni de buradan alıyor.
 *
 * NEDEN BÜYÜYOR. Çerçeve her genişlikte 1400 pikseldi; 1920'de içerik
 * 1320 piksel kalıyor ve iki yanda 300'er, 2560'ta 620'şer piksel boş
 * zemin duruyordu (ölçüldü, `.tmp-genis.mjs`; sahibi: "büyük monitörde
 * sağdan soldan çok boşluklu"). Şimdi çerçeve görünümle AKICI büyüyor:
 *
 *   clamp(1400px, 100% − 240px, 1920px)
 *
 *  - 1640 ve altı: 1400, yani 1440 ve altındaki her görünüm BİREBİR aynı
 *    (önce/sonra ekran görüntüleriyle doğrulandı).
 *  - 1920: 1680 → içerik 1600 (40'lık kanal), yanlarda 160'ar piksel.
 *  - 2160 ve üstü: 1920 → 2560'ta içerik 1840, yanlarda 360'ar piksel.
 *
 * Kırılımlı (1760'ta 1680'e sıçrayan) bir çerçeve denenmedi: 1759 ile
 * 1760 arasında içerik 280 piksel sıçrardı. Akıcı çerçevede geçiş yok;
 * ızgaraların sütun sayısı ise kendi kırılımlarıyla (2xl = 1536 ve
 * `min-[1800px]`) çerçevenin genişliğine göre açılıyor.
 *
 * Okuma uzunluğu çerçeveyle büyümüyor: paragraflar kendi `max-width`
 * sınırlarını (`64ch`, `--read-inset`, `max-w-prose`) taşıyor.
 */
export const FRAME_MAX = "max-w-[clamp(1400px,calc(100%-240px),1920px)]";

export const CONTENT_FRAME = `mx-auto w-full ${FRAME_MAX}`;
