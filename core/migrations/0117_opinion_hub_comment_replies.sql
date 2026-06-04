alter table opinion_topic_comments
  add column if not exists parent_comment_id text references opinion_topic_comments(id) on delete cascade,
  add column if not exists reply_to_comment_id text references opinion_topic_comments(id) on delete set null,
  add column if not exists reply_to_user_id text references users(id) on delete set null;

create index if not exists opinion_topic_comments_topic_parent_created_idx
  on opinion_topic_comments (topic_id, parent_comment_id, created_at asc);

create index if not exists opinion_topic_comments_reply_to_comment_idx
  on opinion_topic_comments (reply_to_comment_id);
