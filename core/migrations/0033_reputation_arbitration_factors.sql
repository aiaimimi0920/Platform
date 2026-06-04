alter table reputation_snapshots
  add column if not exists favorable_arbitration_count integer not null default 0;

alter table reputation_snapshots
  add column if not exists unfavorable_arbitration_count integer not null default 0;

alter table reputation_snapshots
  add column if not exists arbitration_win_bonus integer not null default 0;

alter table reputation_snapshots
  add column if not exists arbitration_loss_penalty integer not null default 0;

alter table reputation_history
  add column if not exists favorable_arbitration_count integer not null default 0;

alter table reputation_history
  add column if not exists unfavorable_arbitration_count integer not null default 0;

alter table reputation_history
  add column if not exists arbitration_win_bonus integer not null default 0;

alter table reputation_history
  add column if not exists arbitration_loss_penalty integer not null default 0;
