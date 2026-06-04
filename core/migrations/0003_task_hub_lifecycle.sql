create table if not exists task_reward_holds (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  creator_user_id text not null references users(id),
  assignee_user_id text not null references users(id),
  reward_currency text not null,
  reward_amount integer not null,
  status text not null,
  created_at timestamptz not null,
  settled_at timestamptz
);

create unique index if not exists task_reward_holds_task_idx
  on task_reward_holds(task_id);
