# AI Company OS

Bu klasör Turgut Yildirim için 5 ana sistemi tek çatı altında toplar:

1. CEO / Orchestrator
2. Global AI Media System
3. AI Commerce OS
4. NWASB AI
5. AI Developer Team

## Kullanım

Ana giriş noktası `agents/orchestrator.md` dosyasıdır. Kullanıcı kısa bir görev verir; Orchestrator görevi doğru ekibe yönlendirir.

Örnek komutlar:

- `CEO: Bugünün önceliklerini çıkar.`
- `MEDIA: 10 video için üretim paketi hazırla.`
- `COMMERCE: Bu ürünü analiz et.`
- `NWASB: BMW için teklif hazırla.`
- `DEV: Yeni modülü geliştir ve test et.`

## n8n

`n8n/ai-company-router.json` temel yönlendirme workflow taslağıdır. n8n'e import edildikten sonra OpenAI/ChatGPT credential, webhook ve hedef servis bağlantıları eklenir.

## Güvenlik

- API anahtarları repoya yazılmaz.
- `.env` ve credential bilgileri GitHub'a gönderilmez.
- Yayınlama, para harcama, müşteri mesajı gönderme ve veri silme işlemleri insan onayı ister.
