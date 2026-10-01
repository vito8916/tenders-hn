-- «Me interesa» / «No me interesa» (spec §12.3): one decision per
-- organization and process, with an optional reason. Members read it; owners,
-- admins, and members (not viewers) decide. Processes marked «Me interesa» are
-- the saved opportunities whose changes the organization is told about.

create table public.opportunity_feedback (
  org_id uuid not null references public.organizations (id) on delete cascade,
  process_id uuid not null references public.procurement_processes (id) on delete cascade,
  decision text not null constraint opportunity_feedback_decision_check check (decision in ('interesa', 'no_interesa')),
  reason text constraint opportunity_feedback_reason_check check (char_length(reason) <= 1000),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz not null default now(),
  primary key (org_id, process_id)
);

create index opportunity_feedback_process_idx on public.opportunity_feedback using btree (process_id);
create index opportunity_feedback_decided_by_idx on public.opportunity_feedback using btree (decided_by);

grant select, insert, update, delete on public.opportunity_feedback to authenticated;
grant select, insert, update, delete on public.opportunity_feedback to service_role;

alter table public.opportunity_feedback enable row level security;

create policy "Members read their organization's feedback" on public.opportunity_feedback
  for select to authenticated using ((select private.user_org_role(org_id)) is not null);
create policy "Members other than viewers decide" on public.opportunity_feedback
  for insert to authenticated
  with check ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member') and decided_by = (select auth.uid()));
create policy "Members other than viewers change a decision" on public.opportunity_feedback
  for update to authenticated
  using ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member'))
  with check ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member') and decided_by = (select auth.uid()));
create policy "Members other than viewers clear a decision" on public.opportunity_feedback
  for delete to authenticated using ((select private.user_org_role(org_id)) in ('owner', 'admin', 'member'));
