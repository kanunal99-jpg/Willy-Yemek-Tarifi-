# Willy-Yemek-Tarifi- — KANITLI TEKNİK DENETİM

**Tarih:** 15.10.2026  
**Kapsam:** GitHub dosya ağacı, seçili kaynak kodları, CI logları, Releases. Bu belge gerçek cihaz uçtan uca testi yerine geçmez.  
**Dosya sayısı (denetim anında):** 26  
**CI gözlemi:** 15.10.2026 Android Debug APK iş akışı 'Setup Node.js' aşamasında başarısız.  
**Anayasa:** [PROJE_ANAYASASI_VE_DUZELTILECEKLER.md](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/blob/main/PROJE_ANAYASASI_VE_DUZELTILECEKLER.md)

## Kanıtlarla Düzeltilmesi Gerekenler

### 1. npm cache kilit dosyasına ihtiyaç duyuyor — P0 (DOĞRULANMIŞ CI BLOKAJI)
- **Dosya/kanıt:** [.github/workflows/android-debug.yml#L20-L30](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/blob/main/.github/workflows/android-debug.yml#L20-L30); [CI koşusu](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/actions/runs/38673149134)
- **Gözlem:** setup-node cache:npm istiyor ancak kökte package-lock.json bulunmuyor; önceki log 'Dependencies lock file is not found' diyor.
- **Somut örnek / etkisi:** APK derlemeye başlamadan Node kurulum aşamasında hata.
- **Düzeltme öncesi kabul kriteri:** Tek paket yöneticisi seç; lock file commit; npm ci ve vite build ile CI tekrar doğrula.
- **Durum:** ARAŞTIRILDI — henüz kaynak kod düzeltmesi veya cihaz testi yapılmadı.

### 2. AI tarif üretimi Macaly özel servisine bağımlı — P0 (README TARAFINDAN ONAYLANMIŞ İŞLEV BAĞIMLILIĞI)
- **Dosya/kanıt:** [README.md#L7-L17](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/blob/main/README.md#L7-L17); [CI koşusu](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/actions/runs/38673149134)
- **Gözlem:** README kendi Convex hesabında `callMacalyJson` kullanımının Macaly dışına uyarlanması gerektiğini açıkça belirtiyor.
- **Somut örnek / etkisi:** Macaly ortamı dışındaki üretimde tarifi resim/metinden oluşturma çağrısı hata verebilir.
- **Düzeltme öncesi kabul kriteri:** Ücretsiz/izinli alternatif, gerçek fallback, açık hata ve görsel analiz doğruluğu; API ücretine kullanıcı onayı gerekir.
- **Durum:** ARAŞTIRILDI — henüz kaynak kod düzeltmesi veya cihaz testi yapılmadı.

### 3. Releases'ta APK görünmüyor — P1 (YAYIN EKSİĞİ)
- **Dosya/kanıt:** [releases](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/releases); [CI koşusu](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/actions/runs/38673149134)
- **Gözlem:** Release koleksiyonu boş; mevcut workflow yalnızca Actions artifact upload içeriyor.
- **Somut örnek / etkisi:** Mobil kullanıcı GitHub Releases üzerinden doğrudan APK bulamıyor.
- **Düzeltme öncesi kabul kriteri:** Android proje klasörü, Gradle, APK checksum, Release upload/indirilebilirlik kanıtı.
- **Durum:** ARAŞTIRILDI — henüz kaynak kod düzeltmesi veya cihaz testi yapılmadı.

### 4. Otomatik tarif doğrulama testleri yok — P2 (TEST AÇIĞI)
- **Dosya/kanıt:** [tree/main](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/tree/main); [CI koşusu](https://github.com/kanunal99-jpg/Willy-Yemek-Tarifi-/actions/runs/38673149134)
- **Gözlem:** Yiyecek tarifi, Convex action, alışveriş listesi ve fotoğraf özellikleri bulunuyor; test dosyası bulunmadı.
- **Somut örnek / etkisi:** Glutensiz filtre, alerjen ve porsiyon dönüştürme hataları CI'dan geçebilir.
- **Düzeltme öncesi kabul kriteri:** Birim/entegrasyon sözleşme testleri; API hata/timeout ve riskli AI tavsiyesine kontrollü yanıt.
- **Durum:** ARAŞTIRILDI — henüz kaynak kod düzeltmesi veya cihaz testi yapılmadı.

## 4 Fazlı Geliştirme ve Doğrulama Kapıları

1. **Faz 1 — Araştır:** Tam modül/dosya ve bağımlılık envanteri, doğrulanmış/farklılaşmış hatalar, etki analizi. **Bu rapor ilk kaynak/CI kanıtıdır; bütün işlevlerin çalıştığını iddia etmez.**
2. **Faz 2 — Düzelt:** Önce P0/P1, en küçük güvenli kod değişimi, gizli anahtar/ücret/erişim izinlerini güvenli yöntemlerle ele al.
3. **Faz 3 — Uygulama ve test:** Unit, integrasyon, UI, offline, yetki reddi, yanlış veri, servis kesintisi, gerçek fallback, CI + Android gerçek cihaz varsa.
4. **Faz 4 — Yayın:** CI yeşil → Android ise SHA-256'lı indirilebilir Release APK → kullanıcı akışları smoke → kanıt linkleri.

## Kapatma Kriteri
Her bulgu için issue veya değişiklik ID'si, önce/sonra kanıtı, ilgili satır, test raporu, CI koşu bağlantısı, release/dağıtım bağlantısı, sonuç tarihi zorunludur. **Yalnızca belgenin eklenmiş olması sorun giderildi anlamına gelmez.**
