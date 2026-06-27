# SMS Food Journal

An SMS-based food journaling app. Users text meals to a Twilio number, Claude parses nutrition data, and a daily summary is sent each morning. Stripe handles subscription billing.

## Stack
- **Runtime**: Node.js + TypeScript
- **Server**: Express
- **Database**: PostgreSQL (via `pg`)
- **SMS**: Twilio (inbound webhook + outbound send)
- **AI**: Claude (`claude-sonnet-4-6`) for nutrition parsing
- **Billing**: Stripe (subscriptions + webhooks)
- **Scheduler**: `node-cron` for daily summaries

## Architecture

```
src/
├── index.ts              # Express app entry point
├── db/
│   ├── client.ts         # pg pool
│   └── schema.sql        # Tables: users, meals, subscriptions
├── routes/
│   ├── sms.ts            # POST /webhook/sms  (Twilio)
│   └── stripe.ts         # POST /webhook/stripe
├── services/
│   ├── claude.ts         # Parse meal text → nutrition JSON
│   ├── twilio.ts         # Send SMS helper
│   └── summary.ts        # Build + send daily summary
└── cron/
    └── dailySummary.ts   # node-cron job (8 AM daily)
```

## Key flows

1. **Meal log**: User texts "2 eggs and toast" → Twilio POSTs to `/webhook/sms` → Claude parses nutrition → row inserted into `meals` → confirmation SMS sent back.
2. **Daily summary**: Cron fires at 8 AM → aggregates yesterday's meals → Claude formats summary → SMS sent to each active subscriber.
3. **Billing**: Stripe subscription checkout handled externally; `/webhook/stripe` listens for `customer.subscription.created/deleted` to update `subscriptions` table.

## Environment variables
See `.env.example`.
