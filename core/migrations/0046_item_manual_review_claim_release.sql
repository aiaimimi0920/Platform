alter table item_manual_reviews
  add column if not exists last_claim_released_at timestamptz;

alter table item_manual_reviews
  add column if not exists last_claim_release_reason text;

create index if not exists item_manual_reviews_claimed_status_idx
  on item_manual_reviews (status, claimed_at);

create index if not exists item_manual_reviews_last_claim_released_idx
  on item_manual_reviews (last_claim_released_at);
