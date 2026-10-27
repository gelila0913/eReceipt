#!/usr/bin/env bash
# =============================================================================
# eReceipt database acceptance tests (maps to SRS section 10 criteria that the DB layer can prove)
# Usage:  ./05_tests.sh            (rebuilds the DB from 01..04, then runs all tests)
# Needs:  mysql CLI able to connect as a user allowed to create the 'ereceipt' database.
# =============================================================================
set -u
cd "$(dirname "$0")"
# SKIP_BUILD=1 -> tables/triggers already created (e.g. via Prisma Migrate); only load the seeds.
FILES="01_schema.sql 02_integrity.sql 03_seed_reference.sql 04_seed_dev.sql"
[ "${SKIP_BUILD:-0}" = "1" ] && FILES="03_seed_reference.sql 04_seed_dev.sql"
for f in $FILES; do
  mysql < "$f" || { echo "FAILED loading $f"; exit 1; }
done

M1='10000000-0000-7000-8000-000000000001'; M2='10000000-0000-7000-8000-000000000002'; M3='10000000-0000-7000-8000-000000000003'
CASH='00000000-0000-7000-8000-000000000004'; OWNER='00000000-0000-7000-8000-000000000003'; ADMIN='00000000-0000-7000-8000-000000000001'
OFFICER='00000000-0000-7000-8000-000000000002'; CUST='00000000-0000-7000-8000-000000000006'
P1='40000000-0000-7000-8000-000000000001'; P2='40000000-0000-7000-8000-000000000002'; P3='40000000-0000-7000-8000-000000000003'
R_STD='30000000-0000-7000-8000-000000000001'; R_ZERO='30000000-0000-7000-8000-000000000002'; R_EX='30000000-0000-7000-8000-000000000003'
QR='LEFT(REPLACE(REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(32)),"+","-"),"/","_"),"=",""),43)'

QRFIX="'$(printf 'A%.0s' {1..43})'"

PASS=0; FAIL=0
run() { mysql --batch -e "USE ereceipt; SET time_zone='+00:00'; $1" 2>&1; }
ok()  { local out; out=$(run "$2"); if [ $? -eq 0 ]; then PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"; else FAIL=$((FAIL+1)); printf '  FAIL  %s\n        %s\n' "$1" "$out"; fi; }
bad() { local out; out=$(run "$3"); if [ $? -ne 0 ] && grep -q -- "$2" <<<"$out"; then PASS=$((PASS+1)); printf '  PASS  %s  [blocked: %s]\n' "$1" "$2"; else FAIL=$((FAIL+1)); printf '  FAIL  %s (expected error %s)\n        %s\n' "$1" "$2" "$out"; fi; }
val() { local out; out=$(mysql --batch -N -e "USE ereceipt; $3" 2>&1); if [ "$out" = "$2" ]; then PASS=$((PASS+1)); printf '  PASS  %s  [= %s]\n' "$1" "$2"; else FAIL=$((FAIL+1)); printf '  FAIL  %s expected [%s] got [%s]\n' "$1" "$2" "$out"; fi; }

# Standard 1-line sale: 1 x Notebook (60.00) @ rule $4, tax 9.00 -> 69.00. $1=nn  $2=merchant  $3=qr expression
mk_sale() {
  local n=$1 m=${2:-$M1} qr=${3:-$QR}
  cat <<SQL
CALL sp_next_document_number('$m','RECEIPT',2026,@rn);
INSERT INTO sales (id, merchant_id, transaction_ref, idempotency_key, sold_at, subtotal, discount_total, tax_total, grand_total, created_by)
 VALUES ('50000000-0000-7000-8000-0000000000$n','$m','TXN-T-$n','idem-$n','2026-10-20 10:00:00.000',60.00,0.00,9.00,69.00,'$CASH');
INSERT INTO sale_items (sale_id,merchant_id,line_no,product_id,product_code,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total)
 VALUES ('50000000-0000-7000-8000-0000000000$n','$m',1,NULL,'NTB-001','Notebook A5','PCS',1.000,60.0000,60.00,0.00,60.00,'STANDARD_RATED','$R_STD',15.0000,9.00,69.00);
INSERT INTO tax_records (sale_id,merchant_id,tax_rule_id,tax_type,tax_category_code,rate_percent,taxable_amount,tax_amount)
 VALUES ('50000000-0000-7000-8000-0000000000$n','$m','$R_STD','VAT','STANDARD_RATED',15.0000,60.00,9.00);
INSERT INTO receipts (id,sale_id,merchant_id,receipt_number,qr_token,merchant_snapshot,content_sha256)
 VALUES ('60000000-0000-7000-8000-0000000000$n','50000000-0000-7000-8000-0000000000$n','$m',@rn,$qr,
         JSON_OBJECT('legal_name','Kebede General Trading PLC','tin','0012345678'),SHA2('receipt-$n',256));
SQL
}
sale_hdr() { # sale insert only: $1=nn $2=merchant $3=extra tail
  echo "INSERT INTO sales (id, merchant_id, transaction_ref, idempotency_key, sold_at, subtotal, discount_total, tax_total, grand_total, created_by) VALUES ('50000000-0000-7000-8000-0000000000$1','${2:-$M1}','TXN-H-$1','idem-h-$1','2026-10-20 10:00:00.000',60.00,0.00,9.00,69.00,'$CASH');"
}
credit() { # $1=nn $2=original $3=subtotal $4=tax $5=total  (credit-note header only)
  echo "INSERT INTO sales (id,merchant_id,transaction_ref,sale_type,original_sale_id,correction_reason,idempotency_key,sold_at,subtotal,tax_total,grand_total,created_by) VALUES ('50000000-0000-7000-8000-0000000000$1','$M1','TXN-C-$1','CREDIT_NOTE','$2','customer return','idem-c-$1','2026-10-21 10:00:00.000',$3,$4,$5,'$CASH');"
}

echo "== 1. Golden path: sale -> items -> tax records -> receipt (single transaction)"
ok "approved merchant issues a 2-line sale with mixed tax (15% + exempt) and a receipt" "
START TRANSACTION;
CALL sp_next_document_number('$M1','RECEIPT',2026,@rn);
INSERT INTO sales (id, merchant_id, transaction_ref, idempotency_key, request_hash, sold_at, subtotal, discount_total, tax_total, grand_total, payment_method, created_by)
 VALUES ('50000000-0000-7000-8000-000000000001','$M1','TXN-T-01','idem-01',SHA2('payload-01',256),'2026-10-20 09:30:00.000',1600.00,100.00,225.00,1825.00,'CASH','$CASH');
INSERT INTO sale_items (sale_id,merchant_id,line_no,product_id,product_code,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES
 ('50000000-0000-7000-8000-000000000001','$M1',1,'$P1','COF-001','Coffee beans 1kg','KG',2.000,800.0000,1600.00,100.00,1500.00,'STANDARD_RATED','$R_STD',15.0000,225.00,1725.00),
 ('50000000-0000-7000-8000-000000000001','$M1',2,'$P2','BRD-001','Bread loaf','PCS',4.000,25.0000,100.00,0.00,100.00,'EXEMPT','$R_EX',0.0000,0.00,100.00);
INSERT INTO tax_records (sale_id,merchant_id,tax_rule_id,tax_type,tax_category_code,rate_percent,taxable_amount,tax_amount) VALUES
 ('50000000-0000-7000-8000-000000000001','$M1','$R_STD','VAT','STANDARD_RATED',15.0000,1500.00,225.00),
 ('50000000-0000-7000-8000-000000000001','$M1','$R_EX','VAT','EXEMPT',0.0000,100.00,0.00);
INSERT INTO receipts (id,sale_id,merchant_id,receipt_number,qr_token,merchant_snapshot,content_sha256)
 VALUES ('60000000-0000-7000-8000-000000000001','50000000-0000-7000-8000-000000000001','$M1',@rn,$QR,
         JSON_OBJECT('legal_name','Kebede General Trading PLC','tin','0012345678'),SHA2('receipt-01',256));
COMMIT;"
val "receipt number is merchant-prefixed and sequential" "M000001-2026-000001" "SELECT receipt_number FROM receipts WHERE sale_id='50000000-0000-7000-8000-000000000001';"
val "receipt starts as PLATFORM_RECEIPT, never 'official' (FR-37)" "PLATFORM_RECEIPT" "SELECT legal_status FROM receipts WHERE id='60000000-0000-7000-8000-000000000001';"
val "QR token is exactly 43 url-safe chars" "43" "SELECT CHAR_LENGTH(qr_token) FROM receipts WHERE id='60000000-0000-7000-8000-000000000001';"
val "daily summary net total (FR-49)" "1825.00" "SELECT net_total FROM v_merchant_daily_sales WHERE merchant_id='$M1';"
val "tax report: 15% line (FR-51)" "225.00" "SELECT net_tax_amount FROM v_tax_summary_monthly WHERE merchant_id='$M1' AND rate_percent=15;"
val "FR-53 view: not yet accepted by authority" "NOT_SUBMITTED|0" "SELECT CONCAT(tax_authority_status,'|',is_officially_accepted) FROM v_sale_official_status WHERE sale_id='50000000-0000-7000-8000-000000000001';"

echo "== 2. Merchant gate (BR-01, BR-09, FR-13, FR-14)"
bad "pending merchant cannot create a sale"   MERCHANT_NOT_APPROVED "$(sale_hdr 20 $M2)"
bad "suspended merchant cannot create a sale" MERCHANT_NOT_APPROVED "$(sale_hdr 21 $M3)"
bad "expired verification blocks issuing"     MERCHANT_VERIFICATION_EXPIRED "START TRANSACTION; UPDATE merchants SET verification_valid_until='2020-01-01' WHERE id='$M1'; $(sale_hdr 22 $M1)"

echo "== 3. Duplicates & idempotency (FR-26, FR-30, BR-03)"
bad "same idempotency key cannot create a second sale" "uq_sales_idem" "INSERT INTO sales (id,merchant_id,transaction_ref,idempotency_key,sold_at,subtotal,tax_total,grand_total,created_by) VALUES (UUID(),'$M1','TXN-DUP-1','idem-01','2026-10-20',60,9,69,'$CASH');"
bad "same transaction_ref rejected"                    "uq_sales_txn"    "$(sale_hdr 23 | sed "s/TXN-H-23/TXN-T-01/")"
ok  "second sale gets next gapless receipt number"  "START TRANSACTION; $(mk_sale 02); COMMIT;"
val "sequence advanced to 000002" "M000001-2026-000002" "SELECT receipt_number FROM receipts WHERE sale_id='50000000-0000-7000-8000-000000000002';"
val "rolled-back transaction does not burn a number" "1" "SET @y=0; START TRANSACTION; CALL sp_next_document_number('$M1','RECEIPT',2099,@a); ROLLBACK; CALL sp_next_document_number('$M1','RECEIPT',2099,@b); SELECT @a=@b;"
ok  "set up a sale for the duplicate-QR test" "START TRANSACTION; $(mk_sale 08 $M1 "$QRFIX"); COMMIT;"
bad "two receipts cannot share a QR token" "uq_receipts_qr" "START TRANSACTION; $(mk_sale 09 $M1 "$QRFIX")"
bad "one receipt per sale" "uq_receipts_sale" "INSERT INTO receipts (id,sale_id,merchant_id,receipt_number,qr_token,merchant_snapshot,content_sha256) VALUES (UUID(),'50000000-0000-7000-8000-000000000001','$M1','M000001-2026-999999',$QR,JSON_OBJECT('a',1),SHA2('x',256));"

echo "== 4. Immutability (BR-06)"
bad "cannot edit a sale total"       ISSUED_SALE_IS_IMMUTABLE "UPDATE sales SET grand_total = 1.00, subtotal = 1.00, tax_total = 0 WHERE id='50000000-0000-7000-8000-000000000001';"
bad "cannot delete a sale"           SALES_CANNOT_BE_DELETED  "DELETE FROM sales WHERE id='50000000-0000-7000-8000-000000000001';"
bad "cannot edit a line item"        SALE_ITEMS_ARE_IMMUTABLE "UPDATE sale_items SET quantity=99 WHERE sale_id='50000000-0000-7000-8000-000000000001' AND line_no=1;"
bad "cannot delete a line item"      SALE_ITEMS_ARE_IMMUTABLE "DELETE FROM sale_items WHERE sale_id='50000000-0000-7000-8000-000000000001';"
bad "cannot edit a tax record"       TAX_RECORDS_ARE_IMMUTABLE "UPDATE tax_records SET tax_amount=0 WHERE sale_id='50000000-0000-7000-8000-000000000001';"
bad "cannot add items after receipt" RECEIPT_ALREADY_ISSUED "INSERT INTO sale_items (sale_id,merchant_id,line_no,product_id,product_code,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000001','$M1',3,NULL,'X','Late line','PCS',1,1,1,0,1,'EXEMPT','$R_EX',0,0,1);"
bad "cannot edit receipt number"     ISSUED_RECEIPT_IS_IMMUTABLE "UPDATE receipts SET receipt_number='FORGED-1' WHERE id='60000000-0000-7000-8000-000000000001';"
bad "cannot edit receipt content hash" ISSUED_RECEIPT_IS_IMMUTABLE "UPDATE receipts SET content_sha256=SHA2('forged',256) WHERE id='60000000-0000-7000-8000-000000000001';"
bad "cannot delete a receipt"        RECEIPTS_CANNOT_BE_DELETED "DELETE FROM receipts WHERE id='60000000-0000-7000-8000-000000000001';"
ok  "lifecycle_status (the only mutable sale column) can move forward" "UPDATE sales SET lifecycle_status='CREDITED' WHERE id='50000000-0000-7000-8000-000000000002';"
bad "lifecycle cannot revert to ACTIVE" SALE_LIFECYCLE_CANNOT_REVERT "UPDATE sales SET lifecycle_status='ACTIVE' WHERE id='50000000-0000-7000-8000-000000000002';"

echo "== 5. Arithmetic integrity (BR-04)"
bad "grand_total must equal subtotal + tax" ck_sales_total "INSERT INTO sales (id,merchant_id,transaction_ref,idempotency_key,sold_at,subtotal,tax_total,grand_total,created_by) VALUES (UUID(),'$M1','TXN-X-1','idem-x-1','2026-10-20',100,15,116,'$CASH');"
bad "negative amounts rejected"             ck_sales_amounts "INSERT INTO sales (id,merchant_id,transaction_ref,idempotency_key,sold_at,subtotal,tax_total,grand_total,created_by) VALUES (UUID(),'$M1','TXN-X-2','idem-x-2','2026-10-20',-5,0,-5,'$CASH');"
bad "line tax must match rate x taxable"    ck_items_tax "START TRANSACTION; $(sale_hdr 24); INSERT INTO sale_items (sale_id,merchant_id,line_no,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000024','$M1',1,'Notebook','PCS',1,60,60,0,60,'STANDARD_RATED','$R_STD',15,5.00,65.00);"
bad "receipt refused when sale totals disagree with items" SALE_TOTALS_DO_NOT_MATCH "START TRANSACTION;
 INSERT INTO sales (id,merchant_id,transaction_ref,idempotency_key,sold_at,subtotal,discount_total,tax_total,grand_total,created_by) VALUES ('50000000-0000-7000-8000-000000000025','$M1','TXN-H-25','idem-h-25','2026-10-20',70.00,0,9.00,79.00,'$CASH');
 INSERT INTO sale_items (sale_id,merchant_id,line_no,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000025','$M1',1,'Notebook','PCS',1,60,60,0,60,'STANDARD_RATED','$R_STD',15,9.00,69.00);
 INSERT INTO tax_records (sale_id,merchant_id,tax_rule_id,tax_type,tax_category_code,rate_percent,taxable_amount,tax_amount) VALUES ('50000000-0000-7000-8000-000000000025','$M1','$R_STD','VAT','STANDARD_RATED',15,60,9);
 INSERT INTO receipts (id,sale_id,merchant_id,receipt_number,qr_token,merchant_snapshot,content_sha256) VALUES (UUID(),'50000000-0000-7000-8000-000000000025','$M1','M000001-2026-777777',$QR,JSON_OBJECT('a',1),SHA2('x',256));"
bad "receipt refused for a sale with no items" SALE_HAS_NO_ITEMS "START TRANSACTION; $(sale_hdr 26); INSERT INTO receipts (id,sale_id,merchant_id,receipt_number,qr_token,merchant_snapshot,content_sha256) VALUES (UUID(),'50000000-0000-7000-8000-000000000026','$M1','M000001-2026-888888',$QR,JSON_OBJECT('a',1),SHA2('x',256));"

echo "== 6. Multi-tenant isolation (FR-05, NFR-23)"
ok  "fixture: product owned by merchant 2" "INSERT INTO products (id,merchant_id,product_code,name,unit_price,uom_code,tax_category_id) VALUES ('40000000-0000-7000-8000-000000000009','$M2','M2-001','Latte',50,'PCS',(SELECT id FROM tax_categories WHERE code='STANDARD_RATED'));"
bad "merchant 1 sale cannot use merchant 2's product" fk_items_product "START TRANSACTION; $(sale_hdr 27); INSERT INTO sale_items (sale_id,merchant_id,line_no,product_id,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000027','$M1',1,'40000000-0000-7000-8000-000000000009','Latte','PCS',1,60,60,0,60,'STANDARD_RATED','$R_STD',15,9.00,69.00);"
bad "item cannot be attached to another merchant's sale" fk_items_sale "START TRANSACTION; $(sale_hdr 28); INSERT INTO sale_items (sale_id,merchant_id,line_no,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000028','$M2',1,'x','PCS',1,60,60,0,60,'STANDARD_RATED','$R_STD',15,9.00,69.00);"
bad "receipt cannot be filed under another merchant" fk_receipts_sale "START TRANSACTION; $(mk_sale 33 | sed '/INSERT INTO receipts/,$d') INSERT INTO receipts (id,sale_id,merchant_id,receipt_number,qr_token,merchant_snapshot,content_sha256) VALUES (UUID(),'50000000-0000-7000-8000-000000000033','$M2','M000002-2026-000001',$QR,JSON_OBJECT('a',1),SHA2('x',256));"

echo "== 7. Tax rules (FR-54..56)"
ok  "fixture: DRAFT rule + regime-specific rule" "INSERT INTO tax_rules (id,tax_category_id,tax_type,applicable_regime,name,rate_percent,effective_from,status) VALUES ('30000000-0000-7000-8000-000000000009',(SELECT id FROM tax_categories WHERE code='STANDARD_RATED'),'VAT','ANY','Draft future rate',16,'2027-01-01','DRAFT');
  INSERT INTO tax_rules (id,tax_category_id,tax_type,applicable_regime,name,rate_percent,effective_from,status,legal_reference,approved_by,approved_at) VALUES ('30000000-0000-7000-8000-00000000000a',(SELECT id FROM tax_categories WHERE code='ZERO_RATED'),'TOT','TURNOVER_TAX','Test TOT rule',2,'2020-01-01','ACTIVE','TEST FIXTURE','$ADMIN',NOW(3));"
bad "DRAFT rule cannot be applied to a sale" TAX_RULE_NOT_ACTIVE "START TRANSACTION; $(sale_hdr 29); INSERT INTO sale_items (sale_id,merchant_id,line_no,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000029','$M1',1,'x','PCS',1,60,60,0,60,'STANDARD_RATED','30000000-0000-7000-8000-000000000009',16,9.60,69.60);"
bad "rule not yet effective on sale date" TAX_RULE_NOT_EFFECTIVE "START TRANSACTION; UPDATE tax_rules SET effective_to='2026-12-31' WHERE id='$R_STD'; UPDATE tax_rules SET status='ACTIVE', legal_reference='x', approved_by='$ADMIN', approved_at=NOW(3) WHERE id='30000000-0000-7000-8000-000000000009'; $(sale_hdr 30); INSERT INTO sale_items (sale_id,merchant_id,line_no,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000030','$M1',1,'x','PCS',1,60,60,0,60,'STANDARD_RATED','30000000-0000-7000-8000-000000000009',16,9.60,69.60);"
bad "rate snapshot must equal rule rate" ITEM_TAX_SNAPSHOT_DOES_NOT_MATCH_RULE "START TRANSACTION; $(sale_hdr 31); INSERT INTO sale_items (sale_id,merchant_id,line_no,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000031','$M1',1,'x','PCS',1,60,60,0,60,'STANDARD_RATED','$R_STD',10,6.00,66.00);"
bad "regime-specific rule needs matching merchant profile" TAX_RULE_NOT_APPLICABLE_TO_MERCHANT_REGIME "START TRANSACTION; $(sale_hdr 32); INSERT INTO sale_items (sale_id,merchant_id,line_no,description,uom_code,quantity,unit_price,gross_amount,discount_amount,taxable_amount,tax_category_code,tax_rule_id,tax_rate_percent,tax_amount,line_total) VALUES ('50000000-0000-7000-8000-000000000032','$M1',1,'x','PCS',1,60,60,0,60,'ZERO_RATED','30000000-0000-7000-8000-00000000000a',2,1.20,61.20);"
bad "overlapping ACTIVE rules rejected" TAX_RULE_PERIOD_OVERLAPS "INSERT INTO tax_rules (id,tax_category_id,tax_type,applicable_regime,name,rate_percent,effective_from,status,legal_reference,approved_by,approved_at) VALUES (UUID(),(SELECT id FROM tax_categories WHERE code='STANDARD_RATED'),'VAT','ANY','Overlap',12,'2026-06-01','ACTIVE','x','$ADMIN',NOW(3));"
bad "ACTIVE rule must cite a legal reference" ck_taxrule_legal "INSERT INTO tax_rules (id,tax_category_id,tax_type,applicable_regime,name,rate_percent,effective_from,status) VALUES (UUID(),(SELECT id FROM tax_categories WHERE code='EXEMPT'),'EXCISE','ANY','No citation',5,'2020-01-01','ACTIVE');"
bad "published rule rate cannot be edited" PUBLISHED_TAX_RULE_IS_IMMUTABLE "UPDATE tax_rules SET rate_percent=99 WHERE id='$R_STD';"
bad "published rule cannot be deleted"     PUBLISHED_TAX_RULE_CANNOT_BE_DELETED "DELETE FROM tax_rules WHERE id='$R_STD';"
ok  "published rule can be end-dated and retired (new version replaces it)" "START TRANSACTION; UPDATE tax_rules SET effective_to='2026-12-31' WHERE id='30000000-0000-7000-8000-00000000000a'; ROLLBACK;"

echo "== 8. Corrections: credit notes (FR-28)"
ok  "partial credit note against a sale"        "START TRANSACTION; $(credit 40 50000000-0000-7000-8000-000000000001 26.09 3.91 30.00); ROLLBACK;"
bad "credit note without a reason"              ck_sales_credit_reason "INSERT INTO sales (id,merchant_id,transaction_ref,sale_type,original_sale_id,idempotency_key,sold_at,subtotal,tax_total,grand_total,created_by) VALUES (UUID(),'$M1','TXN-C-X','CREDIT_NOTE','50000000-0000-7000-8000-000000000001','idem-c-x','2026-10-21',10,0,10,'$CASH');"
bad "credit note must reference an original"    CREDIT_NOTE_MUST_REFERENCE "INSERT INTO sales (id,merchant_id,transaction_ref,sale_type,correction_reason,idempotency_key,sold_at,subtotal,tax_total,grand_total,created_by) VALUES (UUID(),'$M1','TXN-C-Y','CREDIT_NOTE','r','idem-c-y','2026-10-21',10,0,10,'$CASH');"
bad "credit note exceeding the original"        CREDIT_EXCEEDS_ORIGINAL_SALE "$(credit 41 50000000-0000-7000-8000-000000000002 60.00 15.00 75.00)"
bad "cumulative credits cannot exceed original" CREDIT_EXCEEDS_ORIGINAL_SALE "START TRANSACTION; $(credit 42 50000000-0000-7000-8000-000000000002 26.09 3.91 30.00) $(credit 43 50000000-0000-7000-8000-000000000002 34.78 5.22 40.00)"
bad "cannot credit a credit note"               CREDIT_NOTE_MUST_REFERENCE "START TRANSACTION; $(credit 44 50000000-0000-7000-8000-000000000002 26.09 3.91 30.00) $(credit 45 50000000-0000-7000-8000-000000000044 8.69 1.31 10.00)"
val "net reporting subtracts credit notes (1963.00 - 30.00)" "1933.00" "START TRANSACTION; $(credit 46 50000000-0000-7000-8000-000000000001 26.09 3.91 30.00) SELECT SUM(net_total) FROM v_merchant_daily_sales WHERE merchant_id='$M1'; ROLLBACK;"

echo "== 9. Government integration (BR-08, FR-58..63)"
bad "ACCEPTED requires an acknowledgment timestamp" ck_gs_accepted "INSERT INTO government_submissions (id,sale_id,merchant_id,target_system,idempotency_key,status) VALUES (UUID(),'50000000-0000-7000-8000-000000000001','$M1','MOR_TEST','gs-bad','ACCEPTED');"
bad "receipt cannot become OFFICIAL without acceptance" NO_ACCEPTED_AUTHORITY_ACKNOWLEDGMENT "UPDATE receipts SET legal_status='OFFICIAL_ELECTRONIC_INVOICE' WHERE id='60000000-0000-7000-8000-000000000001';"
ok  "queue a submission (PENDING)" "INSERT INTO government_submissions (id,sale_id,merchant_id,target_system,idempotency_key,status,next_retry_at) VALUES ('70000000-0000-7000-8000-000000000001','50000000-0000-7000-8000-000000000001','$M1','MOR_TEST','gs-50000000-0000-7000-8000-000000000001-MOR_TEST','PENDING',NOW(3));"
bad "one submission per sale per target" uq_gs_sale_target "INSERT INTO government_submissions (id,sale_id,merchant_id,target_system,idempotency_key,status) VALUES (UUID(),'50000000-0000-7000-8000-000000000001','$M1','MOR_TEST','gs-other','PENDING');"
val "backlog view shows it" "1" "SELECT COUNT(*) FROM v_submission_backlog WHERE submission_id='70000000-0000-7000-8000-000000000001';"
ok  "record a failed attempt, then a successful one" "UPDATE government_submissions SET status='FAILED',attempt_count=1,last_attempt_at=NOW(3),next_retry_at=NOW(3) WHERE id='70000000-0000-7000-8000-000000000001';
  INSERT INTO government_submission_attempts (submission_id,attempt_no,outcome,error_code,error_message) VALUES ('70000000-0000-7000-8000-000000000001',1,'TIMEOUT','E_TIMEOUT','gateway timeout');
  INSERT INTO government_submission_attempts (submission_id,attempt_no,outcome,http_status) VALUES ('70000000-0000-7000-8000-000000000001',2,'SUCCESS',200);
  UPDATE government_submissions SET status='ACCEPTED',attempt_count=2,submitted_at=NOW(3),acknowledged_at=NOW(3),external_reference='MOR-REF-0001',next_retry_at=NULL WHERE id='70000000-0000-7000-8000-000000000001';"
bad "attempt log is append-only" SUBMISSION_ATTEMPTS_ARE_APPEND_ONLY "UPDATE government_submission_attempts SET outcome='SUCCESS' WHERE attempt_no=1;"
bad "accepted submission is final" ACCEPTED_SUBMISSION_IS_FINAL "UPDATE government_submissions SET status='FAILED' WHERE id='70000000-0000-7000-8000-000000000001';"
bad "accepted reference cannot be altered" ACCEPTED_SUBMISSION_IS_FINAL "UPDATE government_submissions SET external_reference='FORGED' WHERE id='70000000-0000-7000-8000-000000000001';"
ok  "receipt can now be promoted to OFFICIAL" "UPDATE receipts SET legal_status='OFFICIAL_ELECTRONIC_INVOICE' WHERE id='60000000-0000-7000-8000-000000000001';"
bad "OFFICIAL cannot be downgraded" OFFICIAL_STATUS_CANNOT_BE_DOWNGRADED "UPDATE receipts SET legal_status='PLATFORM_RECEIPT' WHERE id='60000000-0000-7000-8000-000000000001';"
val "FR-53 view: accepted by authority" "ACCEPTED|1|MOR-REF-0001" "SELECT CONCAT(tax_authority_status,'|',is_officially_accepted,'|',external_reference) FROM v_sale_official_status WHERE sale_id='50000000-0000-7000-8000-000000000001';"
val "backlog view no longer lists it" "0" "SELECT COUNT(*) FROM v_submission_backlog WHERE submission_id='70000000-0000-7000-8000-000000000001';"

echo "== 10. Revocation & customer access (FR-41, FR-43..47)"
bad "revocation requires a reason" ck_receipts_revoked "UPDATE receipts SET status='REVOKED', revoked_at=NOW(3) WHERE id='60000000-0000-7000-8000-000000000002';"
ok  "authorized revocation with reason" "UPDATE receipts SET status='REVOKED', revoked_at=NOW(3), revoked_by='$ADMIN', revocation_reason='issued in error' WHERE id='60000000-0000-7000-8000-000000000002';"
bad "revoked receipt cannot be reinstated" REVOKED_RECEIPT_CANNOT_BE_REINSTATED "UPDATE receipts SET status='ISSUED', revoked_at=NULL, revocation_reason=NULL WHERE id='60000000-0000-7000-8000-000000000002';"
ok  "customer saves a receipt to their history" "INSERT INTO customer_receipts (user_id,receipt_id) VALUES ('$CUST','60000000-0000-7000-8000-000000000001');"
bad "saving the same receipt twice is idempotent-safe (PK)" "Duplicate entry" "INSERT INTO customer_receipts (user_id,receipt_id) VALUES ('$CUST','60000000-0000-7000-8000-000000000001');"
val "customer history query uses owner filter" "1" "SELECT COUNT(*) FROM customer_receipts cr JOIN receipts r ON r.id=cr.receipt_id JOIN sales s ON s.id=r.sale_id WHERE cr.user_id='$CUST' AND s.merchant_id='$M1';"
ok  "scan log records a failed token guess" "INSERT INTO receipt_access_logs (receipt_id,presented_token_hash,result,ip_address) VALUES (NULL,SHA2('guess',256),'NOT_FOUND','203.0.113.9');"

echo "== 11. Merchant verification & identity (FR-07..12)"
bad "rejection requires a reason" ck_va_reject_reason "INSERT INTO verification_applications (id,reference_no,merchant_id,status,decided_at,decided_by) VALUES (UUID(),'VA-2026-009999','$M2','REJECTED',NOW(3),'$OFFICER');"
bad "decision requires decider + time" ck_va_decided "INSERT INTO verification_applications (id,reference_no,merchant_id,status) VALUES (UUID(),'VA-2026-009998','$M2','APPROVED');"
bad "application reference numbers are unique" uq_va_reference "INSERT INTO verification_applications (id,reference_no,merchant_id) VALUES (UUID(),'VA-2026-000001','$M2');"
bad "TIN is unique per merchant" uq_merchants_tin "INSERT INTO merchants (id,merchant_code,legal_name,tin,region,city,phone,representative_name) VALUES (UUID(),'M000009','Dup','0012345678','Addis Ababa','Addis Ababa','+251900000000','X');"
bad "TIN must be numeric" ck_merchants_tin "INSERT INTO merchants (id,merchant_code,legal_name,tin,region,city,phone,representative_name) VALUES (UUID(),'M000010','Bad','ABC123','Addis Ababa','Addis Ababa','+251900000000','X');"
bad "approved merchant must have approved_at" ck_merchants_approved "INSERT INTO merchants (id,merchant_code,legal_name,tin,region,city,phone,representative_name,status) VALUES (UUID(),'M000011','NoDate','0099887766','Addis Ababa','Addis Ababa','+251900000000','X','APPROVED');"
bad "user needs at least one contact method" ck_users_contact "INSERT INTO users (id,role_id,password_hash,full_name) VALUES (UUID(),1,'h','Nobody');"
bad "email unique (case-insensitive)" uq_users_email "INSERT INTO users (id,role_id,email,password_hash,full_name) VALUES (UUID(),4,'ADMIN@ereceipt.test','h','Dup');"
bad "document size must be positive" ck_md_size "INSERT INTO merchant_documents (id,merchant_id,document_type_id,storage_key,original_filename,mime_type,size_bytes,sha256,uploaded_by) VALUES (UUID(),'$M2',1,'k/1','a.pdf','application/pdf',0,SHA2('a',256),'$OWNER');"

echo "== 12. Audit log is append-only (BR-10)"
ok  "audit entry can be appended" "INSERT INTO audit_logs (actor_type,actor_user_id,merchant_id,action,entity_type,entity_id,summary,new_values) VALUES ('USER','$ADMIN','$M1','MERCHANT_APPROVED','merchant','$M1','approved',JSON_OBJECT('status','APPROVED'));"
bad "audit entry cannot be updated" AUDIT_LOG_IS_APPEND_ONLY "UPDATE audit_logs SET summary='tampered' WHERE id=1;"
bad "audit entry cannot be deleted" AUDIT_LOG_IS_APPEND_ONLY "DELETE FROM audit_logs WHERE id=1;"

echo "== 13. Whole-database reconciliation"
val "v_integrity_violations is empty" "0" "SELECT COUNT(*) FROM v_integrity_violations;"
ACCESS=$(mysql --batch -N -e "USE ereceipt; EXPLAIN SELECT id FROM receipts WHERE qr_token=$QRFIX;" | cut -f5)
if [ "$ACCESS" = "const" ]; then PASS=$((PASS+1)); echo "  PASS  QR lookup uses unique index (access type: const)"; else FAIL=$((FAIL+1)); echo "  FAIL  QR lookup access type: $ACCESS"; fi

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
