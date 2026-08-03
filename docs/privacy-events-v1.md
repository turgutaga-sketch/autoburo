# Privacy Event Contract v1

## İzin verilen örnekler

- `page_view`
- `invoice_pdf_created`
- `offer_saved`
- `scanner_started`
- `scanner_completed`
- `scanner_failed`
- `work_order_opened`

İzin verilen metadata örnekleri:

- `success: true|false`
- `duration_ms: number`
- `source: mobile|desktop`
- `format: pdf`

## Yasaklanan içerikler

Event adı veya metadata içinde aşağıdakiler bulunamaz:

- müşteri adı, e-posta, telefon
- adres
- IBAN veya banka
- plaka veya VIN
- fatura numarası veya belge içeriği
- mesaj, not veya serbest metin

Yeni bir olay eklenirken yalnızca teknik kullanım amacıyla gerekli en az veri gönderilmelidir.
