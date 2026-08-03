# WERK ONE Product Intelligence v1

## Amaç

WERK ONE içinde hangi modüllerin ve teknik işlemlerin ne kadar kullanıldığını ölçmek; ürün geliştirme kararlarını gerçek kullanım verisine dayandırmak.

## Gizlilik sınırı

Aşağıdaki veriler merkezi analize gönderilmez:

- müşteri adı veya iletişim bilgileri
- plaka, VIN veya araç içeriği
- fatura, teklif veya belge içeriği
- IBAN, banka veya ödeme bilgileri
- fotoğraf, mesaj, not ve serbest metin

Kaydedilenler yalnızca teknik olay adı, modül adı, anonim oturum kimliği, cihaz tipi, işlem sonucu ve işlem süresidir.

## Dosyalar

- `analytics.js`: anonim teknik olay istemcisi
- `product-intelligence.html`: sadece ürün sahibinin erişebileceği yönetici sayfası
- `supabase/migrations/20260720_product_analytics.sql`: ek tablo, indeks, RLS ve rapor görünümü
- `config.js`: mevcut ayarlar korunarak analiz istemcisini yükleyen küçük ekleme

## Kurulum sırası

1. SQL migration test Supabase projesinde çalıştırılır.
2. RLS test edilir: anonim kullanıcı yalnızca INSERT yapabilmeli; SELECT yapamamalıdır.
3. `turgutaga@me.com` ile giriş yapıldığında Product Intelligence sayfası okunabilmelidir.
4. Başka bir hesapla okuma reddedilmelidir.
5. Mobil ve masaüstünde `page_view` olayları doğrulanmalıdır.
6. Test tamamlanmadan `main` dalına birleştirilmemelidir.

## Önemli

Bu sürüm uygulama kodunu otonom olarak değiştirmez. Yalnızca ölçer ve raporlar. Geliştirme ve canlıya alma kararı her zaman ürün sahibinde kalır.
