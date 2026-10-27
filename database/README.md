# eReceipt: Database Design (PostgreSQL)

> **Status: design phase. The database is NOT connected to the backend yet.**
> The backend currently runs on seed (sample) data. See "Current status" below.

## 1. Overview

eReceipt is a digital receipt and tax record platform for merchants, customers and the tax authority in Ethiopia. This folder documents the PostgreSQL database design for it. The requirements come from our Software Requirements Specification (SRS v1.0).

## 2. Current status (read this first)

| Item | Status |
|---|---|
| Database design (conceptual, logical, PostgreSQL physical) | Done |
| Design validated with automated tests on PostgreSQL 16 | Done (test suite will be added to this repository) |
| Schema documentation | Next commit |
| Backend connected to PostgreSQL | **Not yet** |
| Prisma schema and database queries in the backend | **Not yet** |

**What the backend uses today:** seed data only. This means JSON files for receipts, a receipt counter file, and a hard-coded list of sample products and sample taxpayers. These were shared directly between group members.

**This is a temporary prototype.** It has no real verification, no tax-rule history, no protection against editing or duplicating receipts, and it is not safe for real tax data. We are going to improve it by connecting the backend to this PostgreSQL design.

## 3. Why PostgreSQL

- Strong data-integrity features: foreign keys, CHECK constraints, triggers.
- An exclusion constraint that stops two active tax rules from covering the same dates.
- Native types that fit our data: uuid, jsonb, enum, timestamp with time zone, exact numeric for money.
- Time zone support, so business dates follow Ethiopian time (Africa/Addis_Ababa).
- Works with Prisma, the ORM we plan to use.

The SRS lists MySQL. The team chose PostgreSQL instead. The conceptual and logical design does not depend on the database product, so only the physical layer is specific to PostgreSQL.

## 4. Design process

We followed the usual database design phases.

### 4.1 Requirements analysis
We read the SRS and listed three things: the nouns (candidate entities), the verbs (relationships) and the business rules (BR-01 to BR-10). We also listed the main questions the system must answer, such as "show a merchant's sales for a month" or "has the tax authority accepted this receipt?"

### 4.2 Conceptual design
Technology-independent: entities and how they relate, with no data types.

| Entity | Meaning | Main relationships |
|---|---|---|
| Merchant | A business that issues receipts | Has users, products, documents and sales |
| User | A person with a role (admin, merchant staff, customer) | Works for merchants; customers save receipts |
| Product and tax rule | What is sold, and the legally cited tax rates | Each product has a tax category; rules are versioned |
| Sale | One transaction with its lines | Belongs to one merchant; has many items; can have credit notes |
| Receipt | The document and QR code for a sale | At most one per sale; customers can save it |
| Government submission | Reporting a sale to the tax authority | Many attempts; independent from the sale |
| Audit log | Record of important actions | Cross-cutting |

Key conceptual decision: a **sale** (the financial fact) is separate from a **receipt** (a document about it), and the **government submission** has its own life cycle because the tax authority interface is not confirmed yet.

### 4.3 Logical design
We turned entities into tables and decided the keys and rules.

- **Primary and foreign keys** for every table; many-to-many links resolved with link tables.
- **Normalization:** third normal form by default. Repeating lines moved to their own table, product details live with the product, rates live with the tax rule.
- **Deliberate snapshots:** a sale line copies the product name, the tax rate and the rule used, and a receipt copies the merchant's identity at issue time. This is on purpose: old receipts must never change when prices, rates or addresses change later.
- **Tenant isolation:** every merchant-owned row carries the merchant id, and foreign keys include it, so one merchant can never link to another merchant's data.
- **Status columns** are controlled lists (enums) that represent state machines, for example merchant status and submission status.
- **Effective-dated tax rules:** each rule has a start and optional end date and a legal reference.
- **Corrections are credit notes**, never edits.
- **Safe retries:** unique idempotency keys prevent duplicate sales and duplicate submissions.

### 4.4 Physical design (PostgreSQL)
- uuid keys for business entities; bigint identity keys for high-volume logs.
- timestamp with time zone, stored in UTC; business dates use Africa/Addis_Ababa.
- numeric types for money, never floating point.
- jsonb for snapshots and API responses.
- Enum types for statuses.
- Explicit indexes on foreign-key columns, because PostgreSQL does not create them automatically.
- CHECK constraints for amounts, totals and required reasons.
- An **exclusion constraint** that prevents overlapping active tax rules.
- Triggers and functions for rules a simple constraint cannot express (see 4.5).
- Emails stored in lower case; QR tokens must match a fixed format.
- Protection against TRUNCATE on protected tables, not only DELETE.

### 4.5 Business rules and how the database enforces them

| Rule | Mechanism |
|---|---|
| Only approved, non-expired merchants can create sales | Trigger on sales |
| Issued records cannot be edited or deleted | Triggers on sales, items, tax records, receipts |
| Corrections use credit notes, capped at the original total | Trigger on sales |
| Receipt totals must match items and tax records | Trigger on receipts |
| Tax rates are never hard-coded | Versioned tax rules, legal reference required, no overlap |
| A receipt is "official" only after tax-authority acceptance | Trigger on receipts, final submission status |
| Duplicate requests do not create duplicate sales | Unique idempotency key |
| Receipt numbers have no gaps | Counter function with row locking |
| Audit history cannot be changed | Append-only triggers |
| QR codes reveal no customer data | Random token only |


## 5. Known limitations

- Not connected to the backend yet.
- Real tax rules with legal references still need to be loaded.
- The exact TIN format and the document list need confirmation.
- The tax authority interface is not confirmed, so the integration is designed but not built.
- Role checks must still be implemented in the backend.

## 6. Roadmap

-  Design the database
-  Add schema documentation (next commit)
-  Add the SQL files and tests to the repository
-  Add Prisma to the backend and create the tables
-  Replace the JSON-file data layer with database queries
-  Load real tax rules and a real taxpayer verification flow
-  Connect the tax authority interface when it is available

## 7. Team

[Add group name and members]
