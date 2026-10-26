-- Development cadence (26 Oct 2026): before launch, the worker on Railway does less
-- so it costs less. HonduCompras syncs twice a day (06:00 and 18:00 Honduras time,
-- 12:00 and 00:00 UTC) instead of every three hours, open processes are rechecked
-- every eight hours instead of hourly, and the heartbeat is hourly instead of every
-- minute. The daily wide sync stays. Restore 0 */3, 30 * * * *, and * * * * * before
-- go-live (plan Phase 6): report times assume a sync in the hour before each one.

select cron.schedule('enqueue-ingest-sync', '0 0,12 * * *', 'select private.enqueue_ingest_sync()');
select cron.schedule('enqueue-open-rechecks', '30 */8 * * *', 'select private.enqueue_open_rechecks()');
select cron.schedule('enqueue-worker-heartbeat', '0 * * * *', 'select private.enqueue_worker_heartbeat()');
