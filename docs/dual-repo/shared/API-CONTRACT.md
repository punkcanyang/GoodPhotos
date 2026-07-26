# GoodPhotos API 契約（MVP v1）

## 1. 通用規範
- Base URL：`https://api.goodphotos.app`
- Content-Type：`application/json`
- Auth：`Authorization: Bearer <access_token>`
- 冪等鍵：寫入型 API 必帶 `Idempotency-Key`

## 2. 使用者方案與點數

### GET `/v1/me/entitlements`
用途：查詢目前方案與可用權限。

回應範例：
```json
{
  "plan": "pro_monthly",
  "planStatus": "active",
  "features": {
    "advanced_profiles": true,
    "bulk_export": true,
    "official_runtime": true
  },
  "periodEndAt": "2026-05-21T00:00:00Z"
}
```

### GET `/v1/me/wallet`
用途：查詢點數錢包。

回應範例：
```json
{
  "balance": 1280,
  "currency": "credits",
  "updatedAt": "2026-04-21T08:00:00Z"
}
```

## 3. 點數扣款流程

### POST `/v1/usage/authorize`
用途：預扣點數。

請求範例：
```json
{
  "operationId": "op_01HSX...",
  "mode": "official_runtime",
  "feature": "image_evaluation_batch",
  "estimate": {
    "images": 20,
    "provider": "openai",
    "model": "gpt-5.4"
  }
}
```

回應範例：
```json
{
  "authorizationId": "auth_01HSY...",
  "reservedCredits": 140,
  "balanceAfterReserve": 1140
}
```

### POST `/v1/usage/settle`
用途：依實際用量結算（多退少補）。

請求範例：
```json
{
  "authorizationId": "auth_01HSY...",
  "finalUsage": {
    "images": 20,
    "inputTokens": 9000,
    "outputTokens": 1200
  }
}
```

回應範例：
```json
{
  "settlementId": "stl_01HSZ...",
  "finalCostCredits": 132,
  "refundCredits": 8,
  "balanceAfterSettle": 1148
}
```

## 4. 訂閱與儲值

### POST `/v1/billing/checkout/session`
用途：建立訂閱或儲值 checkout。

請求範例：
```json
{
  "type": "subscription",
  "priceId": "price_pro_monthly"
}
```

回應範例：
```json
{
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

## 5. 錯誤碼（最小集合）
- `AUTH_REQUIRED`
- `PLAN_REQUIRED`
- `INSUFFICIENT_CREDITS`
- `IDEMPOTENCY_CONFLICT`
- `RATE_LIMITED`
- `INVALID_REQUEST`
- `INTERNAL_ERROR`

錯誤回應範例：
```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Not enough credits to authorize this operation."
  }
}
```

## 6. 重試規則
- 若 client timeout，可用同一個 `Idempotency-Key` 重送。
- 後端需回傳同一語意結果，不得重複扣款。

## 7. 版本策略
- v1 期間：新增欄位只能向後相容（不得移除既有欄位）。
- 破壞性變更另開 v2 route（`/v2/...`）。
