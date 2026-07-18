# API contract

All endpoints are versioned under `/api/v1`.

- Admin: `/api/v1/admin`
- Merchant: `/api/v1/merchant`
- Driver: `/api/v1/driver`
- Public: `/api/v1/public`
- Device/provider tracking: `/api/v1/tracking`

Successful responses use `{ success, message, data, meta? }`. Errors use `{ success: false, message, error: { code, requestId, details? } }`. Mutating authenticated endpoints accept an `Idempotency-Key` header. Tracking ingestion requires `x-wolan-event-id`, `x-wolan-timestamp`, and an HMAC-SHA256 `x-wolan-signature` over `<timestamp>.<raw-body>`.
