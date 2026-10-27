-- =============================================================================
-- eReceipt database  |  01_schema.sql  |  MySQL 8.0.16+ (CHECK constraints enforced)
-- Conventions
--   * Time      : DATETIME(3), stored in UTC. Display conversion (EAT, Ethiopian calendar) is a UI concern.
--   * Money     : DECIMAL(18,2) for amounts, DECIMAL(18,4) for unit prices, DECIMAL(18,3) for quantities.
--                 Amounts are never negative; credit notes are separate sales rows (sale_type = 'CREDIT_NOTE').
--   * Keys      : CHAR(36) UUID (generate UUIDv7 in the app for index locality) for business entities;
--                 BIGINT AUTO_INCREMENT for high-volume append-only child/log tables;
--                 small ints / natural codes for lookup tables.
--   * Tenancy   : every merchant-owned child row carries merchant_id and uses COMPOSITE foreign keys
--                 (id, merchant_id), so a row can never point at another merchant's data (FR-05, NFR-23).
--   * Tokens    : secrets/tokens use ascii_bin (case-sensitive); only hashes of session/reset tokens are stored.
-- =============================================================================

DROP DATABASE IF EXISTS ereceipt;
CREATE DATABASE ereceipt CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE ereceipt;
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- A. IDENTITY & ACCESS
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_system   BOOLEAN      NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(80)  NOT NULL,
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id       SMALLINT UNSIGNED NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  role_id           SMALLINT UNSIGNED NOT NULL,
  email             VARCHAR(254) NULL,
  phone             VARCHAR(20)  NULL COMMENT 'E.164 format, e.g. +251911234567',
  password_hash     VARCHAR(255) NOT NULL COMMENT 'argon2id/bcrypt hash only',
  full_name         VARCHAR(150) NOT NULL,
  preferred_locale  VARCHAR(10)  NOT NULL DEFAULT 'en' COMMENT 'en, am, om, ti ...',
  status            ENUM('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DISABLED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
  email_verified_at DATETIME(3)  NULL,
  phone_verified_at DATETIME(3)  NULL,
  failed_login_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until      DATETIME(3)  NULL,
  last_login_at     DATETIME(3)  NULL,
  anonymized_at     DATETIME(3)  NULL COMMENT 'set when personal data erased per retention rules; row kept for FK integrity',
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  KEY ix_users_role_status (role_id, status),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT ck_users_contact CHECK (email IS NOT NULL OR phone IS NOT NULL OR anonymized_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE user_sessions (
  id                 CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id            CHAR(36)    NOT NULL,
  refresh_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 of refresh token',
  user_agent         VARCHAR(255) NULL,
  ip_address         VARCHAR(45)  NULL,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at       DATETIME(3) NULL,
  expires_at         DATETIME(3) NOT NULL,
  revoked_at         DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (refresh_token_hash),
  KEY ix_sessions_user (user_id, revoked_at),
  KEY ix_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)    NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prt_token (token_hash),
  KEY ix_prt_user (user_id),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- B. MERCHANTS & VERIFICATION
-- ---------------------------------------------------------------------------
CREATE TABLE merchants (
  id                      CHAR(36)     NOT NULL DEFAULT (UUID()),
  merchant_code           VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'short public code used in receipt numbers, e.g. M000123',
  legal_name              VARCHAR(200) NOT NULL,
  trade_name              VARCHAR(200) NULL,
  tin                     VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Tax Identification Number; exact format validated in app/config',
  region                  VARCHAR(80)  NOT NULL,
  city                    VARCHAR(80)  NOT NULL,
  sub_city                VARCHAR(80)  NULL,
  woreda                  VARCHAR(40)  NULL,
  street_address          VARCHAR(255) NULL,
  phone                   VARCHAR(20)  NOT NULL,
  email                   VARCHAR(254) NULL,
  representative_name     VARCHAR(150) NOT NULL,
  representative_id_no    VARCHAR(50)  NULL,
  representative_phone    VARCHAR(20)  NULL,
  representative_email    VARCHAR(254) NULL,
  status                  ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  approved_at             DATETIME(3)  NULL,
  verification_valid_until DATE        NULL COMMENT 'NULL = no expiry; past date blocks issuing until re-verified (FR-14)',
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_merchants_code (merchant_code),
  UNIQUE KEY uq_merchants_tin (tin),
  KEY ix_merchants_status (status),
  CONSTRAINT ck_merchants_tin CHECK (tin REGEXP '^[0-9]{6,20}$'),
  CONSTRAINT ck_merchants_approved CHECK (status <> 'APPROVED' OR approved_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE merchant_members (
  merchant_id CHAR(36) NOT NULL,
  user_id     CHAR(36) NOT NULL,
  member_role ENUM('OWNER','MANAGER','CASHIER') NOT NULL DEFAULT 'CASHIER',
  status      ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (merchant_id, user_id),
  KEY ix_mm_user (user_id),
  CONSTRAINT fk_mm_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  CONSTRAINT fk_mm_user     FOREIGN KEY (user_id)     REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE merchant_status_history (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  merchant_id CHAR(36) NOT NULL,
  from_status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED') NULL,
  to_status   ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED') NOT NULL,
  reason      VARCHAR(500) NULL,
  changed_by  CHAR(36) NULL COMMENT 'NULL = system',
  changed_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_msh_merchant (merchant_id, changed_at),
  CONSTRAINT fk_msh_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  CONSTRAINT fk_msh_user     FOREIGN KEY (changed_by)  REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE document_types (
  id             SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code           VARCHAR(50)  NOT NULL,
  name           VARCHAR(150) NOT NULL,
  requires_expiry BOOLEAN NOT NULL DEFAULT FALSE,
  is_required    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctypes_code (code)
) ENGINE=InnoDB;

CREATE TABLE verification_applications (
  id                    CHAR(36)    NOT NULL DEFAULT (UUID()),
  reference_no          VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'unique application reference (FR-09)',
  merchant_id           CHAR(36)    NOT NULL,
  application_type      ENUM('INITIAL','REVERIFICATION') NOT NULL DEFAULT 'INITIAL',
  status                ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  submitted_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  assigned_reviewer_id  CHAR(36)    NULL,
  review_started_at     DATETIME(3) NULL,
  decided_at            DATETIME(3) NULL,
  decided_by            CHAR(36)    NULL,
  rejection_reason      VARCHAR(1000) NULL,
  reviewer_notes        VARCHAR(2000) NULL,
  external_check_status ENUM('NOT_CHECKED','MATCHED','MISMATCH','UNAVAILABLE') NOT NULL DEFAULT 'NOT_CHECKED' COMMENT 'FR-15 authorized verification service result',
  external_check_ref    VARCHAR(100) NULL,
  external_checked_at   DATETIME(3) NULL,
  merchant_snapshot     JSON        NULL COMMENT 'business details exactly as submitted',
  created_at            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_va_reference (reference_no),
  KEY ix_va_queue (status, submitted_at),
  KEY ix_va_merchant (merchant_id, submitted_at),
  KEY ix_va_reviewer (assigned_reviewer_id),
  CONSTRAINT fk_va_merchant FOREIGN KEY (merchant_id)          REFERENCES merchants(id),
  CONSTRAINT fk_va_reviewer FOREIGN KEY (assigned_reviewer_id) REFERENCES users(id),
  CONSTRAINT fk_va_decider  FOREIGN KEY (decided_by)           REFERENCES users(id),
  CONSTRAINT ck_va_reject_reason CHECK (status <> 'REJECTED' OR (rejection_reason IS NOT NULL AND CHAR_LENGTH(rejection_reason) > 0)),
  CONSTRAINT ck_va_decided CHECK (status NOT IN ('APPROVED','REJECTED') OR (decided_at IS NOT NULL AND decided_by IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE merchant_documents (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  merchant_id      CHAR(36)     NOT NULL,
  application_id   CHAR(36)     NULL,
  document_type_id SMALLINT UNSIGNED NOT NULL,
  storage_key      VARCHAR(500) NOT NULL COMMENT 'key in PRIVATE object storage; never a public URL',
  original_filename VARCHAR(255) NOT NULL,
  mime_type        VARCHAR(100) NOT NULL,
  size_bytes       BIGINT UNSIGNED NOT NULL,
  sha256           CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  document_number  VARCHAR(100) NULL,
  issued_on        DATE NULL,
  expires_on       DATE NULL,
  status           ENUM('SUBMITTED','ACCEPTED','REJECTED','SUPERSEDED','EXPIRED') NOT NULL DEFAULT 'SUBMITTED',
  review_note      VARCHAR(500) NULL,
  reviewed_by      CHAR(36) NULL,
  reviewed_at      DATETIME(3) NULL,
  uploaded_by      CHAR(36) NOT NULL,
  uploaded_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_md_storage (storage_key),
  KEY ix_md_merchant_type (merchant_id, document_type_id, status),
  KEY ix_md_application (application_id),
  KEY ix_md_expiry (expires_on, status),
  CONSTRAINT fk_md_merchant FOREIGN KEY (merchant_id)      REFERENCES merchants(id),
  CONSTRAINT fk_md_app      FOREIGN KEY (application_id)   REFERENCES verification_applications(id),
  CONSTRAINT fk_md_type     FOREIGN KEY (document_type_id) REFERENCES document_types(id),
  CONSTRAINT fk_md_reviewer FOREIGN KEY (reviewed_by)      REFERENCES users(id),
  CONSTRAINT fk_md_uploader FOREIGN KEY (uploaded_by)      REFERENCES users(id),
  CONSTRAINT ck_md_size CHECK (size_bytes > 0),
  CONSTRAINT ck_md_dates CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- C. CATALOG & TAX CONFIGURATION
-- ---------------------------------------------------------------------------
CREATE TABLE units_of_measure (
  code VARCHAR(16)  NOT NULL,
  name VARCHAR(80)  NOT NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB;

CREATE TABLE tax_categories (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_taxcat_code (code)
) ENGINE=InnoDB;

-- Versioned, effective-dated rates. No rate is hard-coded anywhere (FR-54, 56; SRS 8.3).
CREATE TABLE tax_rules (
  id                CHAR(36)    NOT NULL DEFAULT (UUID()),
  tax_category_id   SMALLINT UNSIGNED NOT NULL,
  tax_type          ENUM('VAT','TOT','EXCISE','OTHER') NOT NULL,
  applicable_regime ENUM('ANY','VAT_REGISTERED','TURNOVER_TAX','EXEMPT_ENTITY','OTHER') NOT NULL DEFAULT 'ANY',
  name              VARCHAR(150) NOT NULL,
  rate_percent      DECIMAL(7,4) NOT NULL,
  effective_from    DATE        NOT NULL,
  effective_to      DATE        NULL COMMENT 'inclusive; NULL = open ended',
  status            ENUM('DRAFT','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
  legal_reference   VARCHAR(500) NULL COMMENT 'citation of the proclamation/directive that authorizes this rate',
  created_by        CHAR(36)    NULL,
  approved_by       CHAR(36)    NULL,
  approved_at       DATETIME(3) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_taxrule_version (tax_category_id, tax_type, applicable_regime, effective_from),
  KEY ix_taxrule_lookup (tax_category_id, status, effective_from, effective_to),
  CONSTRAINT fk_taxrule_cat      FOREIGN KEY (tax_category_id) REFERENCES tax_categories(id),
  CONSTRAINT fk_taxrule_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT fk_taxrule_approver FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT ck_taxrule_rate   CHECK (rate_percent >= 0 AND rate_percent <= 100),
  CONSTRAINT ck_taxrule_window CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT ck_taxrule_legal  CHECK (status <> 'ACTIVE' OR (legal_reference IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE merchant_tax_profiles (
  id             CHAR(36) NOT NULL DEFAULT (UUID()),
  merchant_id    CHAR(36) NOT NULL,
  tax_regime     ENUM('VAT_REGISTERED','TURNOVER_TAX','EXEMPT_ENTITY','OTHER') NOT NULL,
  effective_from DATE NOT NULL,
  effective_to   DATE NULL,
  note           VARCHAR(500) NULL,
  created_by     CHAR(36) NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_mtp_version (merchant_id, effective_from),
  CONSTRAINT fk_mtp_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  CONSTRAINT fk_mtp_user     FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT ck_mtp_window CHECK (effective_to IS NULL OR effective_to >= effective_from)
) ENGINE=InnoDB;

CREATE TABLE products (
  id              CHAR(36)     NOT NULL DEFAULT (UUID()),
  merchant_id     CHAR(36)     NOT NULL,
  product_code    VARCHAR(50)  NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     VARCHAR(500) NULL,
  unit_price      DECIMAL(18,4) NOT NULL,
  uom_code        VARCHAR(16)  NOT NULL DEFAULT 'PCS',
  tax_category_id SMALLINT UNSIGNED NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_code (merchant_id, product_code),
  UNIQUE KEY uq_products_tenant (id, merchant_id),
  KEY ix_products_active (merchant_id, is_active, name),
  CONSTRAINT fk_products_merchant FOREIGN KEY (merchant_id)     REFERENCES merchants(id),
  CONSTRAINT fk_products_uom      FOREIGN KEY (uom_code)        REFERENCES units_of_measure(code),
  CONSTRAINT fk_products_taxcat   FOREIGN KEY (tax_category_id) REFERENCES tax_categories(id),
  CONSTRAINT ck_products_price CHECK (unit_price >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- D. SALES (immutable once receipt issued; enforced in 02_integrity.sql)
-- ---------------------------------------------------------------------------
CREATE TABLE sales (
  id                 CHAR(36)    NOT NULL DEFAULT (UUID()),
  merchant_id        CHAR(36)    NOT NULL,
  transaction_ref    VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'public unique transaction identifier (FR-22)',
  sale_type          ENUM('SALE','CREDIT_NOTE') NOT NULL DEFAULT 'SALE',
  original_sale_id   CHAR(36)    NULL COMMENT 'credit notes point at the sale they correct/refund',
  correction_reason  VARCHAR(500) NULL,
  idempotency_key    VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'client-generated; kills duplicates from retries (FR-26)',
  request_hash       CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'hash of payload; detects key reuse with different body',
  sold_at            DATETIME(3) NOT NULL,
  currency_code      CHAR(3)     NOT NULL DEFAULT 'ETB',
  prices_include_tax BOOLEAN     NOT NULL DEFAULT FALSE,
  subtotal           DECIMAL(18,2) NOT NULL COMMENT 'sum of line taxable_amount (excl. tax, after discount)',
  discount_total     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_total          DECIMAL(18,2) NOT NULL,
  grand_total        DECIMAL(18,2) NOT NULL,
  payment_method     ENUM('CASH','MOBILE_MONEY','CARD','BANK_TRANSFER','OTHER') NULL COMMENT 'informational only; payments are out of scope',
  buyer_name         VARCHAR(200) NULL,
  buyer_tin          VARCHAR(20)  NULL,
  lifecycle_status   ENUM('ACTIVE','CREDITED','CANCELLED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'the ONLY mutable column after insert',
  created_by         CHAR(36)    NOT NULL,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sales_txn (transaction_ref),
  UNIQUE KEY uq_sales_idem (merchant_id, idempotency_key),
  UNIQUE KEY uq_sales_tenant (id, merchant_id),
  KEY ix_sales_merchant_date (merchant_id, sold_at),
  KEY ix_sales_type_date (merchant_id, sale_type, sold_at),
  KEY ix_sales_original (original_sale_id),
  KEY ix_sales_creator (created_by),
  CONSTRAINT fk_sales_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  CONSTRAINT fk_sales_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT fk_sales_original FOREIGN KEY (original_sale_id, merchant_id) REFERENCES sales(id, merchant_id),
  CONSTRAINT ck_sales_amounts CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0),
  CONSTRAINT ck_sales_total   CHECK (grand_total = subtotal + tax_total),
  CONSTRAINT ck_sales_credit  CHECK ((sale_type = 'CREDIT_NOTE') = (original_sale_id IS NOT NULL)),
  CONSTRAINT ck_sales_credit_reason CHECK (sale_type = 'SALE' OR correction_reason IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE sale_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id           CHAR(36)     NOT NULL,
  merchant_id       CHAR(36)     NOT NULL,
  line_no           SMALLINT UNSIGNED NOT NULL,
  product_id        CHAR(36)     NULL COMMENT 'NULL for ad-hoc lines; product fields below are snapshots',
  product_code      VARCHAR(50)  NULL,
  description       VARCHAR(255) NOT NULL,
  uom_code          VARCHAR(16)  NOT NULL,
  quantity          DECIMAL(18,3) NOT NULL,
  unit_price        DECIMAL(18,4) NOT NULL,
  gross_amount      DECIMAL(18,2) NOT NULL COMMENT 'quantity x unit_price as entered',
  discount_amount   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  taxable_amount    DECIMAL(18,2) NOT NULL COMMENT 'amount tax is computed on (always excl. tax)',
  tax_category_code VARCHAR(40)  NOT NULL COMMENT 'snapshot',
  tax_rule_id       CHAR(36)     NOT NULL COMMENT 'exact rule applied (FR-55); use a 0% rule for exempt/zero-rated lines',
  tax_rate_percent  DECIMAL(7,4) NOT NULL COMMENT 'snapshot of rule rate',
  tax_amount        DECIMAL(18,2) NOT NULL,
  line_total        DECIMAL(18,2) NOT NULL COMMENT 'taxable_amount + tax_amount',
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_line (sale_id, line_no),
  KEY ix_items_product (product_id),
  KEY ix_items_rule (tax_rule_id),
  KEY ix_items_tenant_sale (sale_id, merchant_id),
  CONSTRAINT fk_items_sale    FOREIGN KEY (sale_id, merchant_id)    REFERENCES sales(id, merchant_id),
  CONSTRAINT fk_items_product FOREIGN KEY (product_id, merchant_id) REFERENCES products(id, merchant_id),
  CONSTRAINT fk_items_uom     FOREIGN KEY (uom_code)    REFERENCES units_of_measure(code),
  CONSTRAINT fk_items_rule    FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(id),
  CONSTRAINT ck_items_qty   CHECK (quantity > 0),
  CONSTRAINT ck_items_money CHECK (unit_price >= 0 AND gross_amount >= 0 AND discount_amount >= 0 AND discount_amount <= gross_amount
                                   AND taxable_amount >= 0 AND tax_amount >= 0),
  CONSTRAINT ck_items_total CHECK (line_total = taxable_amount + tax_amount),
  CONSTRAINT ck_items_tax   CHECK (ABS(tax_amount - ROUND(taxable_amount * tax_rate_percent / 100, 2)) <= 0.01)
) ENGINE=InnoDB;

-- One row per (sale, tax rule): the tax breakdown printed on the receipt and used by reports (FR-31, FR-55).
CREATE TABLE tax_records (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id           CHAR(36)     NOT NULL,
  merchant_id       CHAR(36)     NOT NULL,
  tax_rule_id       CHAR(36)     NOT NULL,
  tax_type          ENUM('VAT','TOT','EXCISE','OTHER') NOT NULL,
  tax_category_code VARCHAR(40)  NOT NULL,
  rate_percent      DECIMAL(7,4) NOT NULL,
  taxable_amount    DECIMAL(18,2) NOT NULL,
  tax_amount        DECIMAL(18,2) NOT NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_taxrec (sale_id, tax_rule_id),
  KEY ix_taxrec_rule (tax_rule_id),
  CONSTRAINT fk_taxrec_sale FOREIGN KEY (sale_id, merchant_id) REFERENCES sales(id, merchant_id),
  CONSTRAINT fk_taxrec_rule FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(id),
  CONSTRAINT ck_taxrec CHECK (taxable_amount >= 0 AND tax_amount >= 0)
) ENGINE=InnoDB;

-- Gapless per-merchant counters (allocate inside the sale transaction; see sp_next_document_number).
CREATE TABLE document_sequences (
  merchant_id CHAR(36) NOT NULL,
  doc_type    ENUM('RECEIPT','CREDIT_NOTE') NOT NULL,
  seq_year    SMALLINT UNSIGNED NOT NULL,
  current_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (merchant_id, doc_type, seq_year),
  CONSTRAINT fk_seq_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- E. RECEIPTS & CUSTOMER ACCESS
-- ---------------------------------------------------------------------------
CREATE TABLE receipts (
  id               CHAR(36)    NOT NULL DEFAULT (UUID()),
  sale_id          CHAR(36)    NOT NULL,
  merchant_id      CHAR(36)    NOT NULL,
  receipt_number   VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'globally unique, e.g. M000123-2026-000045',
  qr_token         CHAR(43)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '256-bit random, base64url; the ONLY thing in the QR URL (FR-34, BR-07)',
  status           ENUM('ISSUED','REVOKED') NOT NULL DEFAULT 'ISSUED',
  legal_status     ENUM('PLATFORM_RECEIPT','OFFICIAL_ELECTRONIC_INVOICE') NOT NULL DEFAULT 'PLATFORM_RECEIPT' COMMENT 'FR-37 / BR-08',
  issued_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locale           VARCHAR(10) NOT NULL DEFAULT 'en',
  template_version VARCHAR(20) NOT NULL DEFAULT '1',
  merchant_snapshot JSON       NOT NULL COMMENT 'name/TIN/address as at issue time',
  content_sha256   CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'hash of canonical receipt content (tamper evidence)',
  pdf_storage_key  VARCHAR(500) NULL,
  pdf_sha256       CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  revoked_at       DATETIME(3) NULL,
  revoked_by       CHAR(36)    NULL,
  revocation_reason VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipts_sale (sale_id),
  UNIQUE KEY uq_receipts_number (receipt_number),
  UNIQUE KEY uq_receipts_qr (qr_token),
  KEY ix_receipts_merchant_date (merchant_id, issued_at),
  CONSTRAINT fk_receipts_sale   FOREIGN KEY (sale_id, merchant_id) REFERENCES sales(id, merchant_id),
  CONSTRAINT fk_receipts_revoker FOREIGN KEY (revoked_by) REFERENCES users(id),
  CONSTRAINT ck_receipts_revoked CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE customer_receipts (
  user_id    CHAR(36) NOT NULL,
  receipt_id CHAR(36) NOT NULL,
  saved_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, receipt_id),
  KEY ix_cr_user_saved (user_id, saved_at),
  KEY ix_cr_receipt (receipt_id),
  CONSTRAINT fk_cr_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cr_receipt FOREIGN KEY (receipt_id) REFERENCES receipts(id)
) ENGINE=InnoDB;

-- Scan log: abuse detection (token guessing) and investigation (FR-69). High volume: purge/partition by month.
CREATE TABLE receipt_access_logs (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_id           CHAR(36) NULL COMMENT 'NULL when the presented token matched nothing',
  presented_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  result               ENUM('OK','NOT_FOUND','REVOKED') NOT NULL,
  user_id              CHAR(36) NULL,
  ip_address           VARCHAR(45)  NULL,
  user_agent           VARCHAR(255) NULL,
  accessed_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_ral_receipt (receipt_id, accessed_at),
  KEY ix_ral_time (accessed_at),
  KEY ix_ral_ip (ip_address, accessed_at),
  CONSTRAINT fk_ral_receipt FOREIGN KEY (receipt_id) REFERENCES receipts(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- F. GOVERNMENT / TAX-AUTHORITY INTEGRATION
-- ---------------------------------------------------------------------------
CREATE TABLE government_submissions (
  id                CHAR(36)    NOT NULL DEFAULT (UUID()),
  sale_id           CHAR(36)    NOT NULL,
  merchant_id       CHAR(36)    NOT NULL,
  target_system     VARCHAR(50) NOT NULL COMMENT 'which authorized interface/provider',
  idempotency_key   VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'stable per (sale,target); resent on every retry (FR-60)',
  status            ENUM('PENDING','SUBMITTED','ACCEPTED','REJECTED','FAILED') NOT NULL DEFAULT 'PENDING',
  attempt_count     INT UNSIGNED NOT NULL DEFAULT 0,
  last_attempt_at   DATETIME(3) NULL,
  next_retry_at     DATETIME(3) NULL,
  submitted_at      DATETIME(3) NULL,
  acknowledged_at   DATETIME(3) NULL COMMENT 'set ONLY when authority confirmation received (FR-63)',
  external_reference VARCHAR(150) NULL COMMENT 'authority-issued reference/IRN when provided (FR-59)',
  rejection_code    VARCHAR(50)  NULL,
  rejection_message VARCHAR(1000) NULL,
  payload_sha256    CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reconciled_at     DATETIME(3) NULL,
  reconciled_by     CHAR(36)    NULL,
  reconciliation_note VARCHAR(1000) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gs_sale_target (sale_id, target_system),
  UNIQUE KEY uq_gs_idem (idempotency_key),
  UNIQUE KEY uq_gs_external (target_system, external_reference),
  KEY ix_gs_worker (status, next_retry_at),
  KEY ix_gs_merchant (merchant_id, status),
  CONSTRAINT fk_gs_sale FOREIGN KEY (sale_id, merchant_id) REFERENCES sales(id, merchant_id),
  CONSTRAINT fk_gs_reconciler FOREIGN KEY (reconciled_by) REFERENCES users(id),
  CONSTRAINT ck_gs_accepted CHECK (status <> 'ACCEPTED' OR acknowledged_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE government_submission_attempts (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id  CHAR(36)    NOT NULL,
  attempt_no     INT UNSIGNED NOT NULL,
  started_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at    DATETIME(3) NULL,
  outcome        ENUM('SUCCESS','REJECTED','TRANSPORT_ERROR','TIMEOUT','INVALID_RESPONSE') NOT NULL,
  http_status    SMALLINT UNSIGNED NULL,
  error_code     VARCHAR(50)  NULL,
  error_message  VARCHAR(1000) NULL,
  request_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  response_payload JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gsa_attempt (submission_id, attempt_no),
  KEY ix_gsa_outcome (outcome, started_at),
  CONSTRAINT fk_gsa_submission FOREIGN KEY (submission_id) REFERENCES government_submissions(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- G. PLATFORM: AUDIT & NOTIFICATIONS
-- ---------------------------------------------------------------------------
-- Append-only. Deliberately NO foreign keys: audit history must outlive/never block deletes or anonymization.
CREATE TABLE audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  occurred_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actor_type    ENUM('USER','SYSTEM','INTEGRATION') NOT NULL DEFAULT 'USER',
  actor_user_id CHAR(36)    NULL,
  merchant_id   CHAR(36)    NULL,
  action        VARCHAR(80) NOT NULL COMMENT 'e.g. MERCHANT_APPROVED, RECEIPT_ISSUED, SALE_CORRECTED',
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     VARCHAR(64) NOT NULL,
  summary       VARCHAR(500) NULL,
  old_values    JSON NULL,
  new_values    JSON NULL,
  request_id    CHAR(36)    NULL,
  ip_address    VARCHAR(45) NULL,
  user_agent    VARCHAR(255) NULL,
  prev_hash     CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'optional hash chain for tamper evidence (app-computed)',
  row_hash      CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  KEY ix_audit_entity (entity_type, entity_id, occurred_at),
  KEY ix_audit_actor (actor_user_id, occurred_at),
  KEY ix_audit_merchant (merchant_id, occurred_at),
  KEY ix_audit_action (action, occurred_at),
  KEY ix_audit_time (occurred_at)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)    NOT NULL,
  channel     ENUM('IN_APP','EMAIL','SMS') NOT NULL DEFAULT 'IN_APP',
  type        VARCHAR(50) NOT NULL COMMENT 'e.g. MERCHANT_REJECTED, SUBMISSION_FAILED',
  title       VARCHAR(200) NOT NULL,
  body        VARCHAR(1000) NULL,
  entity_type VARCHAR(50) NULL,
  entity_id   VARCHAR(64) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  sent_at     DATETIME(3) NULL,
  read_at     DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY ix_notif_user (user_id, read_at, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
