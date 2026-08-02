# Nova Business OS

Nova Business OS is a modular, multilingual operating system for small businesses, initially focused on automotive workshops, accident-assistance operations, media automation and shared financial control.

## Product principles

- One command center, separated company data
- Mobile-first and installable as a PWA
- Human approval before sensitive automation
- Offline-friendly core workflows
- Supabase-backed multi-tenant security
- n8n orchestration without exposing secrets in the browser
- German, Turkish, English, Russian and Ukrainian ready
- Exportable business records: PDF, CSV and audit history

## First production verticals

1. **WerkstattOS** — customers, vehicles, work orders, parts, appointments, quotes, invoices, cash and archive.
2. **Unfallhilfe** — accident leads, callback queue, partner routing, case status and consent records.
3. **MediaOS** — brands, content queue, approvals, publishing jobs, costs and revenue.
4. **Finance Hub** — subscriptions, expenses, income, VAT overview and company separation.

## Architecture

```text
command-center/       Installable mobile-first frontend
supabase/             Database schema, RLS and audit policies
n8n/                  Importable automation workflows
docs/                 Product, architecture and delivery documents
runtime/              Local logs and backups (not committed)
```

## Delivery phases

### Phase 1 — Reliable core

- Authentication and company selection
- Role-based permissions
- Customers, vehicles and work orders
- Status board and appointment queue
- Quotes and invoices
- Cash entries and expense tracking
- Audit log and backup strategy

### Phase 2 — Automation

- Fahrzeugschein OCR review queue
- WhatsApp/email message preparation
- Parts-order tracking
- Accident-lead callback routing
- Media publishing approval queue

### Phase 3 — Platform

- Partner portals
- Multi-location support
- Subscription plans
- Analytics and forecasting
- App-store packaging where justified

## Security rules

- Never commit API keys or customer documents.
- Browser clients use only public Supabase configuration.
- Service-role keys stay in server-side or n8n secret storage.
- Every tenant-owned table must enforce row-level security.
- Financial and consent changes must be auditable.

## Local preview

```bash
cd ai-company-os
./install-ai-business-os.sh
```

The current prototype remains usable while production modules are introduced incrementally.