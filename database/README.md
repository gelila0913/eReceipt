# eReceipt: Database

> **Status: design complete, NOT connected to the backend yet.**
> The backend currently runs on **seed (sample) data** shared between group members.
> We are going to improve this by connecting the backend to the PostgreSQL design documented here.
> See [Current status and roadmap](docs/04-current-status-and-roadmap.md).

## What this folder is

The database design for **eReceipt**, a digital receipt and tax-record platform for merchants, customers and the tax authority in Ethiopia. Requirements come from our Software Requirements Specification (SRS v1.0).

## Documentation

| Document | What it covers |
|---|---|
| [01 Requirements and conceptual design](docs/01-requirements-and-conceptual-design.md) | What the system must store, business rules, entities and relationships |
| [02 Logical design](docs/02-logical-design.md) | Keys, normalization, deliberate exceptions, constraints |
| [03 Physical design and schema](docs/03-physical-design-and-schema.md) | PostgreSQL choices, table overview, rule enforcement, verification |
| [`postgres/`](postgres/) | SQL files, sample data and the automated test script |
| [04 Current status and roadmap](docs/04-current-status-and-roadmap.md) | What works today, what does not, and the plan |

## Why PostgreSQL

- Strong data integrity: foreign keys, CHECK constraints, triggers.
- An exclusion constraint that stops two active tax rules covering the same dates.
- Native types that fit our data: uuid, jsonb, enum, time zones, exact numeric for money.
- Business dates follow Ethiopian time (Africa/Addis_Ababa).
- Works with Prisma, the ORM we plan to use.

The SRS lists MySQL. The team chose PostgreSQL. The conceptual and logical design is independent of the database product, so only the physical layer is PostgreSQL-specific.

## At a glance

| Item | Status |
|---|---|
| Requirements analysis, conceptual and logical design | Done |
| PostgreSQL physical design (28 tables) | Done |
| Automated test suite (94 checks on PostgreSQL 16) | Done |
| Backend connected to the database | **Not yet** |
| Prisma schema and queries in the backend | **Not yet** |
| Real tax rules and taxpayer verification | **Not yet** |
