# 02. Logical design

Turning the conceptual model into tables, keys and rules, still independent of the database product.

## 1. Keys

- Every table has a **primary key**.
- Relationships are **foreign keys**.
- **Many-to-many links** use link tables: roles and permissions, merchants and their staff users, customers and their saved receipts.
- Business entities use non-guessable unique identifiers; high-volume log tables use simple increasing numbers.

## 2. Normalization

We normalize to **third normal form** by default.

| Problem in a flat design | Fix |
|---|---|
| A sale repeats product columns for each line (violates 1NF) | Move lines to their own table, `sale_items` |
| A product name depends on the product, not on the sale line (violates 2NF) | Keep product details in `products` |
| A tax rate depends on the tax rule, not on the line (violates 3NF) | Keep rates in `tax_rules` |
| A role's permissions repeated per user | Link table `role_permissions` |

## 3. Deliberate exceptions: snapshots

Some data is copied **on purpose** (denormalized) so history never changes:

- A sale line stores the product name, tax category, **rate** and the **tax rule used**.
- A receipt stores the merchant's name, TIN and address as they were at issue time.
- A merchant application stores the details exactly as submitted.

Reason: a receipt from last year must still show last year's price and rate, even if the product, the rate or the address changes later.

## 4. Tenant isolation

Every merchant-owned row also carries the merchant's id, and foreign keys include it. A sale item therefore cannot point to another merchant's product or sale, even through a bug or direct database access.

## 5. State machines as controlled lists

Statuses are enumerations with fixed values:

- Merchant: Pending, Under review, Approved, Rejected, Suspended
- Submission: Pending, Submitted, Accepted, Rejected, Failed
- Receipt: Issued, Revoked
- Receipt legal status: Platform receipt, Official electronic invoice
- Tax rule: Draft, Active, Retired

## 6. Time-dependent data

- Tax rules have a start date, an optional end date, a status and a legal reference. A rule cannot be active without a legal reference and an approver, and cannot be changed after publishing; a new version replaces it.
- A merchant's tax regime is stored with dates, so it can change over time.
- Merchant status changes are kept in a history table with reason and actor.

## 7. Corrections and safe retries

- **Credit notes:** a correction is a separate sale record of type credit note, linked to the original, with a required reason. Total credits cannot exceed the original sale.
- **Idempotency:** each sale has a client-generated key, unique per merchant, so a network retry cannot create a duplicate. Each government submission is unique per sale and target system.

## 8. Money and amounts

- Exact decimal numbers, never floating point.
- Amounts are never negative; credit notes are separate rows and reports subtract them.
- Stored identities: line total = taxable amount + tax; sale total = subtotal + tax; receipt totals must equal the sum of lines and tax records.

## 9. Privacy

- Receipts carry merchant data, not customer data. Buyer name and TIN are optional.
- The QR code holds only a random token that resolves to one receipt.
- Passwords, session tokens and reset tokens are stored only as hashes.
- A user's personal data can be erased by marking the account anonymized, keeping the row so links stay valid.

## 10. Audit

An append-only audit log records who did what to which record and when. It deliberately has no foreign keys, so it survives deletions and anonymization.

## 11. Deliberate trade-offs

| Choice | Benefit | Cost |
|---|---|---|
| Snapshots on lines and receipts | History is always correct | Some duplicated data |
| Business rules inside the database | Rules hold even if the app has a bug | Logic lives in two places; needs tests |
| Status stored on the merchant as well as in history | Fast approval checks | The application must keep both consistent |
| Credit notes instead of edits | Full traceability | Reports must subtract credit notes |
