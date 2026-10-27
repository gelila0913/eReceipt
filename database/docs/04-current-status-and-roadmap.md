# 04. Current status and roadmap

> **The database is NOT connected to the backend yet.**
> The backend currently uses seed (sample) data that we shared directly between group members.
> This is a temporary prototype. We are going to improve it.

## 1. What the backend uses today

| Item | Current state |
|---|---|
| Backend | Express with TypeScript |
| Data layer | A single `Database` class that keeps receipts in memory and saves them to JSON files |
| Receipts | A JSON file, newest first |
| Receipt counter | A small JSON file; starts at 194 |
| Products | 8 hard-coded sample products |
| Taxpayers | 3 hard-coded sample taxpayers (demo data, not a real registry) |
| Database driver or ORM | **None** in `package.json` yet |

## 2. Why this is only a prototype

| Prototype behaviour | Problem | Planned fix (this design) |
|---|---|---|
| Whole file rewritten on every save | Slow; a crash can corrupt it | Database transactions |
| Counter incremented in memory | Two requests can get the same number | Counter function with row locking |
| Receipts can be edited or removed | Violates "no silent edits" | Immutability triggers and credit notes |
| Tax and excise rates written into product data | The SRS forbids hard-coded tax | Versioned tax rules with legal references |
| Fake taxpayer list marked as verified | Pretends verification happened | Real verification flow |
| One shared file for all merchants | Weak separation between merchants | Composite foreign keys per merchant |
| No audit or retry records | Nothing to investigate | Audit log and submission attempts |

**Do not use the current prototype for real tax data.**

## 3. What is done

- Requirements analysis, conceptual and logical design (documents 01 and 02)
- PostgreSQL physical design with 28 tables (document 03)
- SQL files, sample data and an automated test suite (94 checks, PostgreSQL 16) in [`../postgres/`](../postgres/)

## 4. What is not done

- Backend connected to PostgreSQL
- Prisma schema for PostgreSQL and database queries in the backend
- Real tax rules with legal references
- A real taxpayer verification flow
- Role and permission checks in the backend
- Load and performance testing
- The tax authority interface (not confirmed; designed but not built)

## 5. Field mapping from the prototype

| Prototype field | Planned database location |
|---|---|
| receiptNumber | receipts.receipt_number |
| irn | government_submissions.external_reference |
| customerName, customerTin | sales.buyer_name, sales.buyer_tin |
| merchantTin | merchants.tin |
| vatCategory, exciseRate | tax_categories and tax_rules |
| uom | units_of_measure |
| documentType | sales.sale_type (sale or credit note); other types need a schema extension |
| Sample products | products |
| Sample taxpayers | merchants and the verification flow |

Not covered yet by the schema: supply type, VAT number, withholding-agent flag, per-product excise rate. We will decide whether each is a real requirement.

## 6. Open questions

- Final confirmation that PostgreSQL replaces the MySQL named in the SRS.
- The exact Ethiopian TIN format.
- The list of required merchant documents.
- Which fields from the prototype are real requirements.
- Which tax authority interface we will integrate with.

## 7. Roadmap

- Design the database
-  Write the SQL files and tests
-  Install Prisma and create the schema for PostgreSQL
-  Create the tables and apply the integrity rules
-  Replace the JSON-file data layer with database queries, keeping the same method names
-  Turn the shared seed data into a proper database seed script
-  Add authentication and role checks
-  Load real tax rules and implement real taxpayer verification
-  Connect the tax authority interface when it is available
-  Load testing, backups and monitoring
