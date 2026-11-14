# Bilanço Analizi — göreve özgü ek kurallar

- Paragraf bütünlüğü kuralı `summary` ve `analysis` paragraflarında uygulanır; `strengths`, `risks`, `upcoming` ve `takeaways` maddeleri TEK cümledir.
- `ceo_quote.quote` markdown işlemez: yıldız ve Türkçe karşılık yazılmaz; İngilizce kayıtta alıntı tamamen İngilizcedir.
- Metin alanlarında yalnızca `[metin](/adres)` ve `**kalın**` tanınır.
- Başlık büyük harf kuralı: bağlaçlar (ve, ile, için, de/da) başta değilse küçük; kısaltmalar aynen (EPS, HBK, FAVÖK, Mr $, Mn $). Türkçe büyük harf: i → İ, ı → I. summary, analysis, strengths, risks, upcoming, takeaways CÜMLEDİR: normal yazım.
- Türkçe kayıtta segment ve iş birimi adları Türkçe yazılır; şirketin İngilizce etiketleri kullanılmaz.
- `sources[].label` kaydın dilindedir: Türkçe kayıtta "<Şirket> 4Ç FY26 Bülteni", İngilizce kayıtta "<Company> Q4 FY26 Press Release". İngilizce kayıtta "Bülteni", "Kazanç Çağrısı", "4Ç" kalmaz (denetimde İngilizce raporda Türkçe etiket çıktı). `ceo_quote.title` son eki de dile göre: "· Kazanç Çağrısı" / "· Earnings Call", "· Basın Bülteni" / "· Press Release". Adres iki kayıtta aynıdır.
- Beklenti terimi: düzyazıda "piyasa beklentisi", kartta ve künyede kısaca "Beklenti"; "Konsensüs" hiçbir alanda yazılmaz. İngilizce kayıtta "estimate" / "consensus estimate".
- `highlights`, `revenue_footer` ve `guidance_footer` etiket ve notları iki dilde de Title Case ve cümle değildir; sonuna nokta konmaz.
