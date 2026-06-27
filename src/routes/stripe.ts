import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../db/client';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe signature verification failed:', err);
    res.status(400).send('Bad signature');
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await db.query(
          `UPDATE subscriptions SET status = 'canceled', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          await db.query(
            `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
             WHERE stripe_subscription_id = $1`,
            [subId]
          );
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).send('Internal error');
  }
});

async function upsertSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Determine plan from price ID
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'basic';

  // Get phone from checkout session metadata if available
  const { rows: sessionRows } = await db.query<{ id: string }>(
    `SELECT u.id FROM users u
     JOIN subscriptions s ON s.user_id = u.id
     WHERE s.stripe_customer_id = $1
     LIMIT 1`,
    [customerId]
  );

  if (sessionRows.length === 0) {
    // Try to find user by phone stored in subscription metadata
    const phone = sub.metadata?.phone;
    const userIdQuery = phone
      ? `(SELECT id FROM users WHERE phone = $6 LIMIT 1)`
      : `NULL`;

    await db.query(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
       VALUES (${userIdQuery}, $1, $2, $3, $4, $5)
       ON CONFLICT (stripe_subscription_id) DO UPDATE
         SET plan = EXCLUDED.plan,
             status = EXCLUDED.status,
             current_period_end = EXCLUDED.current_period_end,
             updated_at = NOW()`,
      phone
        ? [customerId, sub.id, plan, sub.status, new Date(sub.current_period_end * 1000), phone]
        : [customerId, sub.id, plan, sub.status, new Date(sub.current_period_end * 1000)]
    );
  } else {
    await db.query(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stripe_subscription_id) DO UPDATE
         SET plan = EXCLUDED.plan,
             status = EXCLUDED.status,
             current_period_end = EXCLUDED.current_period_end,
             updated_at = NOW()`,
      [sessionRows[0].id, customerId, sub.id, plan, sub.status, new Date(sub.current_period_end * 1000)]
    );
  }
}

export default router;
