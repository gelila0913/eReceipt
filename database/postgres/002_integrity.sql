-- =============================================================================
-- prisma/custom/002_integrity.sql   (GENERATED from 02_integrity.sql)
-- Triggers, stored procedure and views. DELIMITER lines removed: they are a mysql-CLI feature,
-- not SQL, so they must not appear in a Prisma migration file.
-- =============================================================================
-- =============================================================================
-- eReceipt database  |  02_integrity.sql
-- Defense-in-depth: the database itself refuses to break the business rules,
-- even if application code has a bug or someone connects with a SQL client.
--   BR-01/BR-09  only APPROVED, non-expired merchants can create sales
--   BR-04        receipt totals must equal item/tax totals
--   BR-06        issued records are immutable; corrections = credit notes
--   BR-08        a receipt can only become OFFICIAL after an ACCEPTED authority acknowledgment
--   BR-10        audit trail cannot be edited or deleted
-- Run after 01_schema.sql with the mysql CLI (uses DELIMITER).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Gapless per-merchant document numbers. CALL inside the sale transaction:
--   CALL sp_next_document_number(@merchant_id, 'RECEIPT', 2026, @n);  -> M000123-2026-000045
-- The row lock on document_sequences serialises concurrent issuers for the same merchant;
-- if the transaction rolls back, the number is not consumed (no gaps).
-- ---------------------------------------------------------------------------
CREATE PROCEDURE sp_next_document_number(
  IN  p_merchant_id CHAR(36),
  IN  p_doc_type    VARCHAR(20),
  IN  p_year        SMALLINT UNSIGNED,
  OUT p_number      VARCHAR(40))
BEGIN
  DECLARE v_code VARCHAR(20);
  DECLARE v_val  BIGINT UNSIGNED;
  SELECT merchant_code INTO v_code FROM merchants WHERE id = p_merchant_id;
  IF v_code IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MERCHANT_NOT_FOUND';
  END IF;
  INSERT INTO document_sequences (merchant_id, doc_type, seq_year, current_value)
       VALUES (p_merchant_id, p_doc_type, p_year, LAST_INSERT_ID(1))
  ON DUPLICATE KEY UPDATE current_value = LAST_INSERT_ID(current_value + 1);
  SET v_val = LAST_INSERT_ID();
  SET p_number = CONCAT(v_code, '-', IF(p_doc_type = 'CREDIT_NOTE', 'CN-', ''), p_year, '-', LPAD(v_val, 6, '0'));
END;

-- ---------------------------------------------------------------------------
-- SALES
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_sales_bi BEFORE INSERT ON sales FOR EACH ROW
BEGIN
  DECLARE v_status   VARCHAR(20);
  DECLARE v_valid    DATE;
  DECLARE v_orig_type VARCHAR(20);
  DECLARE v_orig_total DECIMAL(18,2);
  DECLARE v_credited   DECIMAL(18,2);

  -- BR-01 / BR-09 / FR-13 / FR-14: merchant gate
  SELECT status, verification_valid_until INTO v_status, v_valid FROM merchants WHERE id = NEW.merchant_id;
  IF v_status IS NULL OR v_status <> 'APPROVED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MERCHANT_NOT_APPROVED';
  END IF;
  IF v_valid IS NOT NULL AND v_valid < UTC_DATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MERCHANT_VERIFICATION_EXPIRED';
  END IF;

  -- FR-28: credit notes may only correct a real SALE and never exceed it cumulatively
  IF NEW.sale_type = 'CREDIT_NOTE' THEN
    SELECT sale_type, grand_total INTO v_orig_type, v_orig_total
      FROM sales WHERE id = NEW.original_sale_id AND merchant_id = NEW.merchant_id;
    IF v_orig_type IS NULL OR v_orig_type <> 'SALE' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CREDIT_NOTE_MUST_REFERENCE_A_SALE';
    END IF;
    SELECT COALESCE(SUM(grand_total), 0) INTO v_credited
      FROM sales WHERE original_sale_id = NEW.original_sale_id AND sale_type = 'CREDIT_NOTE';
    IF v_credited + NEW.grand_total > v_orig_total THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CREDIT_EXCEEDS_ORIGINAL_SALE';
    END IF;
  END IF;
END;

CREATE TRIGGER trg_sales_bu BEFORE UPDATE ON sales FOR EACH ROW
BEGIN
  -- BR-06: only lifecycle_status may change, and never back to ACTIVE
  IF NOT (OLD.id <=> NEW.id AND OLD.merchant_id <=> NEW.merchant_id AND OLD.transaction_ref <=> NEW.transaction_ref
      AND OLD.sale_type <=> NEW.sale_type AND OLD.original_sale_id <=> NEW.original_sale_id
      AND OLD.correction_reason <=> NEW.correction_reason AND OLD.idempotency_key <=> NEW.idempotency_key
      AND OLD.request_hash <=> NEW.request_hash AND OLD.sold_at <=> NEW.sold_at
      AND OLD.currency_code <=> NEW.currency_code AND OLD.prices_include_tax <=> NEW.prices_include_tax
      AND OLD.subtotal <=> NEW.subtotal AND OLD.discount_total <=> NEW.discount_total
      AND OLD.tax_total <=> NEW.tax_total AND OLD.grand_total <=> NEW.grand_total
      AND OLD.payment_method <=> NEW.payment_method AND OLD.buyer_name <=> NEW.buyer_name
      AND OLD.buyer_tin <=> NEW.buyer_tin AND OLD.created_by <=> NEW.created_by AND OLD.created_at <=> NEW.created_at) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ISSUED_SALE_IS_IMMUTABLE';
  END IF;
  IF OLD.lifecycle_status <> 'ACTIVE' AND NEW.lifecycle_status = 'ACTIVE' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SALE_LIFECYCLE_CANNOT_REVERT';
  END IF;
END;

CREATE TRIGGER trg_sales_bd BEFORE DELETE ON sales FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SALES_CANNOT_BE_DELETED_USE_CREDIT_NOTE';
END;

-- ---------------------------------------------------------------------------
-- SALE ITEMS  (tax rule must be legitimate for this sale)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_sale_items_bi BEFORE INSERT ON sale_items FOR EACH ROW
BEGIN
  DECLARE v_sold_on   DATE;
  DECLARE v_rule_cat  VARCHAR(40);
  DECLARE v_rule_rate DECIMAL(7,4);
  DECLARE v_rule_status VARCHAR(10);
  DECLARE v_rule_regime VARCHAR(20);
  DECLARE v_from DATE;
  DECLARE v_to   DATE;
  DECLARE v_merchant_regime VARCHAR(20);

  IF EXISTS (SELECT 1 FROM receipts WHERE sale_id = NEW.sale_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RECEIPT_ALREADY_ISSUED_CANNOT_ADD_ITEMS';
  END IF;

  SELECT DATE(sold_at) INTO v_sold_on FROM sales WHERE id = NEW.sale_id;

  SELECT c.code, r.rate_percent, r.status, r.applicable_regime, r.effective_from, r.effective_to
    INTO v_rule_cat, v_rule_rate, v_rule_status, v_rule_regime, v_from, v_to
    FROM tax_rules r JOIN tax_categories c ON c.id = r.tax_category_id
   WHERE r.id = NEW.tax_rule_id;

  IF v_rule_status IS NULL OR v_rule_status = 'DRAFT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TAX_RULE_NOT_ACTIVE';
  END IF;
  IF v_sold_on < v_from OR (v_to IS NOT NULL AND v_sold_on > v_to) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TAX_RULE_NOT_EFFECTIVE_ON_SALE_DATE';
  END IF;
  IF NEW.tax_rate_percent <> v_rule_rate OR NEW.tax_category_code <> v_rule_cat THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ITEM_TAX_SNAPSHOT_DOES_NOT_MATCH_RULE';
  END IF;

  -- FR-56: merchants are not all taxed alike; regime-specific rules need a matching merchant profile
  IF v_rule_regime <> 'ANY' THEN
    SELECT p.tax_regime INTO v_merchant_regime
      FROM merchant_tax_profiles p
     WHERE p.merchant_id = NEW.merchant_id AND p.effective_from <= v_sold_on
       AND (p.effective_to IS NULL OR p.effective_to >= v_sold_on)
     ORDER BY p.effective_from DESC LIMIT 1;
    IF v_merchant_regime IS NULL OR v_merchant_regime <> v_rule_regime THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TAX_RULE_NOT_APPLICABLE_TO_MERCHANT_REGIME';
    END IF;
  END IF;
END;

CREATE TRIGGER trg_sale_items_bu BEFORE UPDATE ON sale_items FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SALE_ITEMS_ARE_IMMUTABLE'; END;
CREATE TRIGGER trg_sale_items_bd BEFORE DELETE ON sale_items FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SALE_ITEMS_ARE_IMMUTABLE'; END;

CREATE TRIGGER trg_tax_records_bi BEFORE INSERT ON tax_records FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM receipts WHERE sale_id = NEW.sale_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RECEIPT_ALREADY_ISSUED_CANNOT_ADD_TAX_RECORDS';
  END IF;
END;
CREATE TRIGGER trg_tax_records_bu BEFORE UPDATE ON tax_records FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TAX_RECORDS_ARE_IMMUTABLE'; END;
CREATE TRIGGER trg_tax_records_bd BEFORE DELETE ON tax_records FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TAX_RECORDS_ARE_IMMUTABLE'; END;

-- ---------------------------------------------------------------------------
-- RECEIPTS
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_receipts_bi BEFORE INSERT ON receipts FOR EACH ROW
BEGIN
  DECLARE v_n INT;
  DECLARE i_taxable, i_tax, i_disc, t_taxable, t_tax DECIMAL(18,2);
  DECLARE s_sub, s_tax, s_disc DECIMAL(18,2);

  SELECT COUNT(*), COALESCE(SUM(taxable_amount),0), COALESCE(SUM(tax_amount),0), COALESCE(SUM(discount_amount),0)
    INTO v_n, i_taxable, i_tax, i_disc FROM sale_items WHERE sale_id = NEW.sale_id;
  SELECT COALESCE(SUM(taxable_amount),0), COALESCE(SUM(tax_amount),0)
    INTO t_taxable, t_tax FROM tax_records WHERE sale_id = NEW.sale_id;
  SELECT subtotal, tax_total, discount_total INTO s_sub, s_tax, s_disc FROM sales WHERE id = NEW.sale_id;

  -- BR-04: receipt must agree with the transaction
  IF v_n = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SALE_HAS_NO_ITEMS';
  END IF;
  IF i_taxable <> s_sub OR i_tax <> s_tax OR i_disc <> s_disc OR t_taxable <> s_sub OR t_tax <> s_tax THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SALE_TOTALS_DO_NOT_MATCH_ITEMS_OR_TAX_RECORDS';
  END IF;
  -- FR-37 / BR-08: new receipts always start as platform receipts
  IF NEW.legal_status <> 'PLATFORM_RECEIPT' OR NEW.status <> 'ISSUED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NEW_RECEIPT_MUST_BE_PLATFORM_RECEIPT_AND_ISSUED';
  END IF;
END;

CREATE TRIGGER trg_receipts_bu BEFORE UPDATE ON receipts FOR EACH ROW
BEGIN
  -- Immutable content
  IF NOT (OLD.id <=> NEW.id AND OLD.sale_id <=> NEW.sale_id AND OLD.merchant_id <=> NEW.merchant_id
      AND OLD.receipt_number <=> NEW.receipt_number AND OLD.qr_token <=> NEW.qr_token
      AND OLD.issued_at <=> NEW.issued_at AND OLD.locale <=> NEW.locale
      AND OLD.template_version <=> NEW.template_version AND OLD.merchant_snapshot <=> NEW.merchant_snapshot
      AND OLD.content_sha256 <=> NEW.content_sha256) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ISSUED_RECEIPT_IS_IMMUTABLE';
  END IF;
  -- A rendered PDF may be attached once
  IF OLD.pdf_storage_key IS NOT NULL AND NOT (OLD.pdf_storage_key <=> NEW.pdf_storage_key AND OLD.pdf_sha256 <=> NEW.pdf_sha256) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RECEIPT_PDF_ALREADY_ATTACHED';
  END IF;
  -- Revocation is one-way
  IF OLD.status = 'REVOKED' AND NEW.status <> 'REVOKED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REVOKED_RECEIPT_CANNOT_BE_REINSTATED';
  END IF;
  -- BR-08: OFFICIAL only with an ACCEPTED + acknowledged authority submission; never downgrade
  IF OLD.legal_status = 'OFFICIAL_ELECTRONIC_INVOICE' AND NEW.legal_status <> OLD.legal_status THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'OFFICIAL_STATUS_CANNOT_BE_DOWNGRADED';
  END IF;
  IF OLD.legal_status <> NEW.legal_status AND NEW.legal_status = 'OFFICIAL_ELECTRONIC_INVOICE' THEN
    IF NOT EXISTS (SELECT 1 FROM government_submissions g
                    WHERE g.sale_id = NEW.sale_id AND g.status = 'ACCEPTED' AND g.acknowledged_at IS NOT NULL) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NO_ACCEPTED_AUTHORITY_ACKNOWLEDGMENT';
    END IF;
  END IF;
END;

CREATE TRIGGER trg_receipts_bd BEFORE DELETE ON receipts FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RECEIPTS_CANNOT_BE_DELETED_REVOKE_INSTEAD'; END;

-- ---------------------------------------------------------------------------
-- GOVERNMENT SUBMISSIONS
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_gov_sub_bu BEFORE UPDATE ON government_submissions FOR EACH ROW
BEGIN
  IF NOT (OLD.sale_id <=> NEW.sale_id AND OLD.merchant_id <=> NEW.merchant_id
      AND OLD.target_system <=> NEW.target_system AND OLD.idempotency_key <=> NEW.idempotency_key) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUBMISSION_IDENTITY_IS_IMMUTABLE';
  END IF;
  IF OLD.status = 'ACCEPTED' AND NOT (OLD.status <=> NEW.status AND OLD.external_reference <=> NEW.external_reference
                                      AND OLD.acknowledged_at <=> NEW.acknowledged_at) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ACCEPTED_SUBMISSION_IS_FINAL';
  END IF;
END;
CREATE TRIGGER trg_gov_sub_bd BEFORE DELETE ON government_submissions FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUBMISSIONS_CANNOT_BE_DELETED'; END;

CREATE TRIGGER trg_gov_attempts_bu BEFORE UPDATE ON government_submission_attempts FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUBMISSION_ATTEMPTS_ARE_APPEND_ONLY'; END;
CREATE TRIGGER trg_gov_attempts_bd BEFORE DELETE ON government_submission_attempts FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUBMISSION_ATTEMPTS_ARE_APPEND_ONLY'; END;

-- ---------------------------------------------------------------------------
-- AUDIT LOG: append-only (BR-10). Also REVOKE TRUNCATE/DELETE/UPDATE from the app DB user.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_audit_bu BEFORE UPDATE ON audit_logs FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUDIT_LOG_IS_APPEND_ONLY'; END;
CREATE TRIGGER trg_audit_bd BEFORE DELETE ON audit_logs FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUDIT_LOG_IS_APPEND_ONLY'; END;

-- ---------------------------------------------------------------------------
-- TAX RULES: versioned, non-overlapping, immutable once published (FR-54, FR-55)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_tax_rules_bi BEFORE INSERT ON tax_rules FOR EACH ROW
BEGIN
  IF NEW.status = 'ACTIVE' AND EXISTS (
       SELECT 1 FROM tax_rules t
        WHERE t.tax_category_id = NEW.tax_category_id AND t.tax_type = NEW.tax_type
          AND t.applicable_regime = NEW.applicable_regime AND t.status = 'ACTIVE'
          AND t.effective_from <= COALESCE(NEW.effective_to, '9999-12-31')
          AND COALESCE(t.effective_to, '9999-12-31') >= NEW.effective_from) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TAX_RULE_PERIOD_OVERLAPS_ACTIVE_RULE';
  END IF;
END;

CREATE TRIGGER trg_tax_rules_bu BEFORE UPDATE ON tax_rules FOR EACH ROW
BEGIN
  IF OLD.status <> 'DRAFT' AND NOT (OLD.tax_category_id <=> NEW.tax_category_id AND OLD.tax_type <=> NEW.tax_type
       AND OLD.applicable_regime <=> NEW.applicable_regime AND OLD.rate_percent <=> NEW.rate_percent
       AND OLD.effective_from <=> NEW.effective_from) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PUBLISHED_TAX_RULE_IS_IMMUTABLE_CREATE_A_NEW_VERSION';
  END IF;
  IF OLD.status = 'RETIRED' AND NEW.status <> 'RETIRED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RETIRED_TAX_RULE_CANNOT_BE_REACTIVATED';
  END IF;
  IF NEW.status = 'ACTIVE' AND EXISTS (
       SELECT 1 FROM tax_rules t
        WHERE t.id <> NEW.id AND t.tax_category_id = NEW.tax_category_id AND t.tax_type = NEW.tax_type
          AND t.applicable_regime = NEW.applicable_regime AND t.status = 'ACTIVE'
          AND t.effective_from <= COALESCE(NEW.effective_to, '9999-12-31')
          AND COALESCE(t.effective_to, '9999-12-31') >= NEW.effective_from) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TAX_RULE_PERIOD_OVERLAPS_ACTIVE_RULE';
  END IF;
END;

CREATE TRIGGER trg_tax_rules_bd BEFORE DELETE ON tax_rules FOR EACH ROW
BEGIN
  IF OLD.status <> 'DRAFT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PUBLISHED_TAX_RULE_CANNOT_BE_DELETED_RETIRE_IT';
  END IF;
END;


-- =============================================================================
-- VIEWS (reporting, FR-48..53). Ethiopia has no DST: local date = UTC + 3h.
-- Credit notes are subtracted so figures are NET of refunds/corrections.
-- =============================================================================

-- FR-53: locally recorded vs. accepted by the tax authority (one row per sale per target system)
CREATE OR REPLACE VIEW v_sale_official_status AS
SELECT s.id AS sale_id, s.merchant_id, s.transaction_ref, s.sale_type, s.sold_at, s.grand_total,
       r.receipt_number, r.status AS receipt_status, r.legal_status,
       g.target_system,
       COALESCE(g.status, 'NOT_SUBMITTED') AS tax_authority_status,
       g.external_reference,
       COALESCE(g.status = 'ACCEPTED', 0) AS is_officially_accepted
  FROM sales s
  LEFT JOIN receipts r ON r.sale_id = s.id
  LEFT JOIN government_submissions g ON g.sale_id = s.id;

-- FR-49: daily sales summary per merchant (net of credit notes)
CREATE OR REPLACE VIEW v_merchant_daily_sales AS
SELECT merchant_id,
       DATE(DATE_ADD(sold_at, INTERVAL 3 HOUR)) AS sale_date_eat,
       SUM(sale_type = 'SALE')         AS sales_count,
       SUM(sale_type = 'CREDIT_NOTE')  AS credit_note_count,
       SUM(CASE WHEN sale_type = 'SALE' THEN subtotal    ELSE -subtotal    END) AS net_subtotal,
       SUM(CASE WHEN sale_type = 'SALE' THEN tax_total   ELSE -tax_total   END) AS net_tax,
       SUM(CASE WHEN sale_type = 'SALE' THEN grand_total ELSE -grand_total END) AS net_total
  FROM sales
 GROUP BY merchant_id, DATE(DATE_ADD(sold_at, INTERVAL 3 HOUR));

-- FR-51: monthly tax report by tax type / category / rate (net of credit notes)
CREATE OR REPLACE VIEW v_tax_summary_monthly AS
SELECT s.merchant_id,
       DATE_FORMAT(DATE_ADD(s.sold_at, INTERVAL 3 HOUR), '%Y-%m') AS period_eat,
       tr.tax_type, tr.tax_category_code, tr.rate_percent,
       SUM(CASE WHEN s.sale_type = 'SALE' THEN tr.taxable_amount ELSE -tr.taxable_amount END) AS net_taxable_amount,
       SUM(CASE WHEN s.sale_type = 'SALE' THEN tr.tax_amount     ELSE -tr.tax_amount     END) AS net_tax_amount
  FROM tax_records tr
  JOIN sales s ON s.id = tr.sale_id
 GROUP BY s.merchant_id, DATE_FORMAT(DATE_ADD(s.sold_at, INTERVAL 3 HOUR), '%Y-%m'),
          tr.tax_type, tr.tax_category_code, tr.rate_percent;

-- FR-61 / FR-62: unresolved authority submissions for the admin dashboard and retry worker
CREATE OR REPLACE VIEW v_submission_backlog AS
SELECT g.id AS submission_id, g.sale_id, g.merchant_id, g.target_system, g.status, g.attempt_count,
       g.last_attempt_at, g.next_retry_at, g.rejection_code, g.rejection_message,
       TIMESTAMPDIFF(MINUTE, g.created_at, UTC_TIMESTAMP()) AS age_minutes
  FROM government_submissions g
 WHERE g.status IN ('PENDING','SUBMITTED','REJECTED','FAILED') AND g.reconciled_at IS NULL;

-- FR-14: accepted documents expiring within 30 days (or already expired)
CREATE OR REPLACE VIEW v_documents_expiring AS
SELECT d.id AS document_id, d.merchant_id, m.merchant_code, m.legal_name, dt.code AS document_type,
       d.expires_on, DATEDIFF(d.expires_on, UTC_DATE()) AS days_left
  FROM merchant_documents d
  JOIN merchants m ON m.id = d.merchant_id
  JOIN document_types dt ON dt.id = d.document_type_id
 WHERE d.status = 'ACCEPTED' AND d.expires_on IS NOT NULL AND d.expires_on <= DATE_ADD(UTC_DATE(), INTERVAL 30 DAY);

-- Reconciliation / health check: should always return ZERO rows (run from monitoring).
CREATE OR REPLACE VIEW v_integrity_violations AS
SELECT s.id AS sale_id, 'ITEM_TOTALS_MISMATCH' AS problem
  FROM sales s
  LEFT JOIN (SELECT sale_id, SUM(taxable_amount) t, SUM(tax_amount) x, SUM(discount_amount) d
               FROM sale_items GROUP BY sale_id) i ON i.sale_id = s.id
 WHERE i.sale_id IS NULL OR i.t <> s.subtotal OR i.x <> s.tax_total OR i.d <> s.discount_total
UNION ALL
SELECT s.id, 'TAX_RECORD_MISMATCH'
  FROM sales s
  LEFT JOIN (SELECT sale_id, SUM(tax_amount) x FROM tax_records GROUP BY sale_id) t ON t.sale_id = s.id
 WHERE COALESCE(t.x, 0) <> s.tax_total
UNION ALL
SELECT s.id, 'MISSING_RECEIPT'
  FROM sales s LEFT JOIN receipts r ON r.sale_id = s.id
 WHERE r.id IS NULL AND s.created_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE)
UNION ALL
SELECT r.id, 'OFFICIAL_WITHOUT_ACCEPTANCE'
  FROM receipts r
 WHERE r.legal_status = 'OFFICIAL_ELECTRONIC_INVOICE'
   AND NOT EXISTS (SELECT 1 FROM government_submissions g WHERE g.sale_id = r.sale_id AND g.status = 'ACCEPTED');
