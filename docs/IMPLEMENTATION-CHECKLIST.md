# Implementation Checklist

## P0 — Safety and foundation

- [ ] Confirm `.env.local`, runtime logs and customer uploads are ignored by Git.
- [ ] Review every Supabase table for company ownership and RLS.
- [ ] Add roles: owner, manager, office, mechanic, accounting, viewer.
- [ ] Add audit events for permissions, invoices, payments and consent.
- [ ] Add automated database backup documentation and restore rehearsal.

## P1 — Workshop daily operation

- [ ] Customer and vehicle CRUD with plate/VIN duplicate checks.
- [ ] Vehicle intake checklist and damage/photo references.
- [ ] Work-order positions for labour, parts and notes.
- [ ] Required workshop status history.
- [ ] Parts states: ordered, paid, arrived, missing, incorrect.
- [ ] Appointment and capacity view.
- [ ] Quote → work order → invoice conversion.
- [ ] A4 PDF, VAT calculation, discount and payment status.
- [ ] Cash income/expense with edit history.
- [ ] Archive, search and export.

## P2 — Useful automation

- [ ] Fahrzeugschein OCR as draft fields requiring human confirmation.
- [ ] Customer message templates in DE/TR/EN/RU/UA.
- [ ] Reminder queue for appointments, unpaid invoices and missing parts.
- [ ] n8n error queue, retries and idempotency keys.
- [ ] Cost limits and usage logging for every AI provider.

## P3 — Separate verticals

- [ ] Unfallhilfe lead intake and callback escalation.
- [ ] Consent record and partner assignment history.
- [ ] Media brand, content, approval and publication queue.
- [ ] Subscription-cost register and monthly overview.

## Release gate

- [ ] No critical or high security findings.
- [ ] Daily workshop scenario tested end-to-end.
- [ ] Data export and restore tested.
- [ ] iPhone Safari, Mac Safari and desktop Chrome tested.
- [ ] Production deployment uses separate development and production environments.
