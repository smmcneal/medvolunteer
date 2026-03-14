-- Push subscriptions for Web Push / VAPID notifications
-- Stores a browser PushSubscription object per volunteer per device

create table if not exists push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  volunteer_id      uuid not null references volunteers(id) on delete cascade,
  endpoint          text not null,
  p256dh            text not null,  -- public key for message encryption
  auth              text not null,  -- auth secret for message encryption
  user_agent        text,
  created_at        timestamptz not null default now(),

  -- One subscription per endpoint (upsert-safe)
  unique (endpoint)
);

-- Volunteers can only see and manage their own subscriptions
alter table push_subscriptions enable row level security;

create policy "Volunteers manage own push subscriptions"
  on push_subscriptions
  for all
  using (
    volunteer_id in (
      select id from volunteers where user_id = auth.uid()
    )
  )
  with check (
    volunteer_id in (
      select id from volunteers where user_id = auth.uid()
    )
  );

-- Admins (service role) can read all subscriptions to send pushes
-- (handled via service role key in edge functions — no policy needed)

create index push_subscriptions_volunteer_id_idx
  on push_subscriptions (volunteer_id);
