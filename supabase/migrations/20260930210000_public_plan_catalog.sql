-- The landing page shows the plans for sale to visitors, so anon reads the
-- catalog: plans that are not archived and their active prices. Nothing else
-- about billing is public.

grant select on public.plans, public.plan_prices to anon;

create policy "Plans for sale readable by visitors"
on public.plans for select to anon
using (not is_archived);

create policy "Active prices readable by visitors"
on public.plan_prices for select to anon
using (is_active);
