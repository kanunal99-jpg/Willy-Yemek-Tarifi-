# Yemek Tarifi Asistanı

Malzeme yazarak, fotoğraf çekerek veya rastgele alkolsüz içecek isteyerek
AI destekli 5 tarif öneren bir web uygulaması. Convex (veritabanı + backend)
ve TanStack Start (React) ile yazıldı.

## ⚠️ Önemli: AI çağrısı adaptasyonu gerekiyor

Bu proje **Macaly** platformunda geliştirildi. `convex/macaly.ts` içindeki
`callMacalyJson()` fonksiyonu Macaly'nin kendi AI proxy servisini çağırıyordu
ve sadece Macaly ortamında çalışan özel environment değişkenleri kullanıyordu
(`MACALY_API_TOKEN`, `MACALY_BASE_URL`, `MACALY_CHAT_ID`).

Bu kodu Macaly dışında (kendi Convex hesabınızda) çalıştırmak için,
`convex/recipes.ts` ve `convex/drinks.ts` dosyalarındaki `callMacalyJson(...)`
çağrılarını **doğrudan Anthropic API'sine** yapılan bir çağrıyla değiştirmeniz
gerekiyor. Örnek:

```ts
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  }),
})
const data = await response.json()
const text = data.content?.[0]?.text
```

Görsel (fotoğraf) analizi için `messages` içine `image` bloğu eklemeniz
gerekir — Anthropic API dokümantasyonuna bakın:
https://docs.claude.com/en/api/messages

Bir Anthropic API anahtarını https://console.anthropic.com adresinden
alabilirsiniz. Anahtarı Convex'te ortam değişkeni olarak ayarlayın:

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

## Kurulum

```bash
npm install
npx convex dev   # kendi Convex projenizi bağlar / oluşturur
```

`npx convex dev` ilk çalıştığında sizi tarayıcıdan Convex hesabınıza
yönlendirir ve `.env.local` dosyasına `VITE_CONVEX_URL` gibi değerleri
otomatik yazar.

Ardından ayrı bir terminalde:

```bash
npm run dev
```

Uygulama http://localhost:3000 adresinde açılır.

## Özellikler

- Malzeme yazarak veya fotoğraf çekerek tarif önerisi
- Fotoğraftan tespit edilen malzemeleri düzenleme
- Diyet filtreleri (şeker hastası dostu, düşük kalorili, vejetaryen, glutensiz)
- Kalıcı olarak kaçınılacak malzemeler (alerji vb.)
- Favori tarifler
- Geçmiş
- Alışveriş listesi
- Porsiyon ayarlama (malzeme miktarları otomatik ölçeklenir)
- Adım adım pişirme modu (ekran kapanmaz)
- Sesli malzeme girişi (Web Speech API, Chrome/Android'de çalışır)
- Alkolsüz içecek tarifi üretimi (malzemeye göre veya rastgele)

## Klasör yapısı

```
convex/           Backend: veritabanı şeması, AI çağrıları, CRUD işlemleri
src/routes/        Sayfalar (TanStack Router dosya tabanlı routing)
src/components/ui  shadcn/ui bileşenleri (bu export'ta dahil değil, aşağı bakın)
```

## shadcn/ui bileşenlerini geri yükleme

Bu export, uygulamanın kendi kodunu (convex/ ve src/routes, vb.) içerir
ama `src/components/ui/*` altındaki standart shadcn/ui bileşenlerini
içermez (button, input, dialog, sheet, tabs, card, checkbox, badge, label,
spinner). Bunları kurmak için:

```bash
npx shadcn@latest init
npx shadcn@latest add button input dialog sheet tabs card checkbox badge label
```

`spinner` bileşeni shadcn'in resmi listesinde yoksa, basit bir
`<Loader2 className="animate-spin" />` (lucide-react) ile değiştirebilirsiniz.
