-- A person can now close a ticket and reply from the dashboard.

alter table tickets drop constraint tickets_status_check;
alter table tickets add constraint tickets_status_check
  check (status in ('open', 'answered', 'escalated', 'resolved'));

-- Who wrote an outgoing message. Null means the AI (every row before this migration).
alter table messages add column sent_by text check (sent_by in ('ai', 'agent'));

create index tickets_status_updated_at_idx on tickets (status, updated_at desc);
create index events_created_at_idx on events (created_at);
