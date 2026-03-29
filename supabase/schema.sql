-- It's Been Days — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT UNIQUE NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  trial_start        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'trial'
                     CHECK (status IN ('trial', 'active', 'past_due', 'cancelled')),
  stripe_customer_id TEXT
);

-- Row Level Security: users can only read/update their own row.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own row"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own row"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role (used by Edge Functions) bypasses RLS automatically.
-- No additional policy needed for the webhook handler.
