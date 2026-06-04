alter table notification_webhook_incident_saved_views
  add column if not exists playbook_defaults jsonb;

update notification_webhook_incident_saved_views
set playbook_defaults = '{"batchLimit":10,"silenceDurationMinutes":60,"preferredAction":"acknowledge"}'::jsonb
where playbook_defaults is null;

alter table notification_webhook_incident_saved_views
  alter column playbook_defaults set default '{"batchLimit":10,"silenceDurationMinutes":60,"preferredAction":"acknowledge"}'::jsonb;

alter table notification_webhook_incident_saved_views
  alter column playbook_defaults set not null;
