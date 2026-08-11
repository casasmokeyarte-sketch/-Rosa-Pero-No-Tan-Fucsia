# Bold Wallet Webhook

Private Supabase Edge Function that settles customer Wallet top-ups only after a
verified Bold webhook notification.

## Security rules

- Verifies `x-bold-signature` using HMAC-SHA256 over the Base64 raw body.
- Requires the configured Bold merchant ID.
- Matches the event reference, amount and COP currency with a pending top-up intent.
- Uses database idempotency to prevent duplicate credits during retries.
- Stores a minimal audit record and does not store raw cardholder or payer data.
- Processes approved voids as ledger reversals. If automatic reversal cannot be
  completed, the wallet is blocked and the event is marked for manual review.

## Required Supabase secrets

- `BOLD_WEBHOOK_SECRET`
- `BOLD_MERCHANT_ID`

Supabase already supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Deploy `bold-wallet-webhook` with legacy JWT verification disabled. A browser
redirect or `postMessage` must never credit the Wallet.

## Included files

- `supabase/migrations/202608110001_bold_wallet_webhook.sql`
- `supabase/functions/bold-wallet-webhook/index.ts`
- `supabase/functions/bold-wallet-webhook/.env.example`
- `supabase/config.toml`
- `verify_bold_wallet_webhook.sql`

Apply the migration first, configure the two secrets without exposing their
values, deploy the function, and then run the verification query.
