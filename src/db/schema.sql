CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL UNIQUE,
  timezone    TEXT NOT NULL DEFAULT 'America/New_York',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan                   TEXT NOT NULL DEFAULT 'basic', -- basic | premium
  status                 TEXT NOT NULL DEFAULT 'active', -- active | canceled | past_due
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- response style
  response_style  TEXT NOT NULL DEFAULT 'detailed', -- detailed | simple

  -- EOD summary
  summary_time    TIME NOT NULL DEFAULT '08:00:00', -- local time

  -- goals (null = not set)
  goal_preset     TEXT,    -- lose_weight | maintain | build_muscle | custom
  calorie_goal    INT,
  protein_goal_g  INT,
  carbs_goal_g    INT,
  fat_goal_g      INT,

  -- reminders (JSON array of {label, time, enabled})
  -- e.g. [{"label":"breakfast","time":"08:30","enabled":true}, ...]
  reminders       JSONB NOT NULL DEFAULT '[]',

  -- text-based onboarding state (null = done)
  onboarding_step TEXT,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text     TEXT NOT NULL,
  calories     INT,
  protein_g    NUMERIC(6,1),
  carbs_g      NUMERIC(6,1),
  fat_g        NUMERIC(6,1),
  description  TEXT,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_signups (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted  BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS water_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_ml  INT NOT NULL,
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meals_user_logged      ON meals (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS water_logs_user        ON water_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_user     ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS otp_codes_phone        ON otp_codes (phone);
CREATE INDEX IF NOT EXISTS sessions_token         ON sessions (token);
