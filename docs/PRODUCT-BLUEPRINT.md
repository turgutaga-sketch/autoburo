# Nova Business OS — Production Blueprint

## Objective

Turn the existing prototype into a dependable business operating system without rewriting working components blindly.

## Core entities

- Company
- User and membership
- Customer
- Vehicle
- Appointment
- Work order
- Work-order position
- Part request and part status
- Quote
- Invoice and payment
- Cash transaction
- Accident lead and case
- Partner
- Media brand and content job
- Subscription and recurring cost
- Audit event

## Workshop workflow

`Fahrzeugannahme → Auftrag → Wartet auf Teile → Reparatur läuft → Fertig → Übergabe → Rechnung → Archiv`

Each transition records user, timestamp and optional note. Vehicles cannot silently skip mandatory acceptance and billing controls.

## MVP screens

1. Today dashboard
2. Vehicle intake
3. Kanban workshop board
4. Customer and vehicle profile
5. Work-order editor
6. Parts tracker
7. Appointment calendar
8. Quote/invoice editor and A4 export
9. Cash and expenses
10. Archive and global search
11. Company/user settings
12. Audit history

## Definition of done

A module is complete only when:

- mobile and desktop layouts work;
- empty, loading and error states exist;
- validation prevents invalid records;
- tenant isolation is tested;
- important mutations create audit entries;
- export/print behavior is verified;
- no secret is shipped to the browser;
- the workflow can be completed without developer tools.

## Recommended implementation order

1. Verify the current Supabase schema and migrations.
2. Add authentication, membership and role guards.
3. Implement workshop master data and status history.
4. Implement financial documents with immutable issued snapshots.
5. Add offline-safe draft handling.
6. Introduce n8n automations behind explicit approval gates.
7. Add accident and media verticals only after the shared core is stable.

## Explicit non-goals for MVP

- Fully autonomous legal, medical or financial decisions
- Automatic publication without approval
- Storing real secrets in frontend code
- A single table mixing workshop, accident and media company data
- Building every requested feature before the daily workshop flow is reliable
