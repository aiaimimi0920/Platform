alter table opinion_topics
  add column if not exists tags text[] not null default array['other']::text[];

update opinion_topics
set tags = array['other']::text[]
where tags is null or cardinality(tags) = 0;
