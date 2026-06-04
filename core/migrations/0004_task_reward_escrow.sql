alter table task_reward_holds
  alter column assignee_user_id drop not null;

update task_reward_holds
set status = 'escrowed'
where status = 'pending';
