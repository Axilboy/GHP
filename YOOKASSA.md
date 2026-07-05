# YooKassa

Integration type: custom API integration, not CMS/CRM.

Status: active production integration in the app code. Orders create YooKassa payments, return to `/store?order=...`, sync status after return, and unlock access through webhook or return-sync verification.

Environment variables:

```dotenv
PUBLIC_BASE_URL=https://gamehubparty.ru
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_VAT_CODE=1
```

Webhook URL for the YooKassa dashboard:

```text
https://gamehubparty.ru/api/yookassa/webhook
```

Required events:

```text
payment.succeeded
payment.canceled
```
