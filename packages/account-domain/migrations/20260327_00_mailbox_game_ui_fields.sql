alter table mailbox_messages
  add column if not exists folder text;

update mailbox_messages
set folder = 'inbox'
where folder is null;

alter table mailbox_messages
  alter column folder set default 'inbox';

alter table mailbox_messages
  alter column folder set not null;

alter table mailbox_messages
  add column if not exists summary text;

update mailbox_messages
set summary = left(body, 180)
where summary is null;

alter table mailbox_messages
  add column if not exists source_label text;

update mailbox_messages
set source_label = case
  when type = 'compensation' then '项目组'
  when type = 'reward' then '运营组'
  else '系统'
end
where source_label is null;

create index if not exists mailbox_messages_user_folder_created_idx
  on mailbox_messages(user_id, folder, created_at desc);

alter table mailbox_attachments
  add column if not exists title text;

alter table mailbox_attachments
  add column if not exists sort_order integer;

update mailbox_attachments
set sort_order = 0
where sort_order is null;

alter table mailbox_attachments
  alter column sort_order set default 0;

alter table mailbox_attachments
  alter column sort_order set not null;

create index if not exists mailbox_attachments_message_sort_idx
  on mailbox_attachments(message_id, sort_order, id);
