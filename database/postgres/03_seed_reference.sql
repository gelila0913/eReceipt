-- =============================================================================
-- eReceipt database  |  03_seed_reference.sql  |  safe for production
-- Reference data only. NO tax rates are seeded: rates must be entered by an authorized
-- admin as tax_rules with a legal_reference (SRS 8.3 - no hard-coded tax assumptions).
-- Document types and categories below are starting points to be confirmed against
-- the actual Ethiopian onboarding / tax requirements.
-- =============================================================================
USE ereceipt;

INSERT INTO roles (code, name, description) VALUES
 ('SUPER_ADMIN',          'Super administrator',   'Full platform administration, settings and user management'),
 ('VERIFICATION_OFFICER', 'Verification officer',  'Reviews merchant applications and documents'),
 ('AUDITOR',              'Auditor',               'Read-only access to audit logs, submissions and reports'),
 ('MERCHANT',             'Merchant user',         'Owner/staff of a merchant business (merchant_members decides the scope)'),
 ('CUSTOMER',             'Customer',              'Optional account for saving receipt history');

INSERT INTO permissions (code, description) VALUES
 ('MERCHANT_APPLICATION_REVIEW', 'View and review merchant applications and documents'),
 ('MERCHANT_APPROVE',            'Approve or reject merchant applications'),
 ('MERCHANT_SUSPEND',            'Suspend or reactivate merchants'),
 ('USER_MANAGE',                 'Suspend/reactivate user accounts'),
 ('AUDIT_LOG_VIEW',              'Search and view audit logs'),
 ('TAX_RULE_MANAGE',             'Create draft tax rules and categories'),
 ('TAX_RULE_APPROVE',            'Activate or retire tax rules'),
 ('SUBMISSION_VIEW',             'View government submissions and diagnostics'),
 ('SUBMISSION_RECONCILE',        'Reconcile failed/rejected submissions'),
 ('RECEIPT_REVOKE',              'Revoke a receipt through the authorized process'),
 ('SETTINGS_MANAGE',             'Manage platform settings'),
 ('PRODUCT_MANAGE',              'Create/update/deactivate own products'),
 ('SALE_CREATE',                 'Record sales and issue receipts'),
 ('CREDIT_NOTE_CREATE',          'Issue credit notes / corrections'),
 ('SALE_VIEW_OWN',               'View own merchant transactions'),
 ('REPORT_VIEW_OWN',             'View/export own merchant reports'),
 ('RECEIPT_VIEW_OWN',            'View saved receipts as a customer');

-- role -> permission matrix
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON
  (r.code = 'SUPER_ADMIN') OR
  (r.code = 'VERIFICATION_OFFICER' AND p.code IN ('MERCHANT_APPLICATION_REVIEW','MERCHANT_APPROVE')) OR
  (r.code = 'AUDITOR'  AND p.code IN ('AUDIT_LOG_VIEW','SUBMISSION_VIEW')) OR
  (r.code = 'MERCHANT' AND p.code IN ('PRODUCT_MANAGE','SALE_CREATE','CREDIT_NOTE_CREATE','SALE_VIEW_OWN','REPORT_VIEW_OWN')) OR
  (r.code = 'CUSTOMER' AND p.code IN ('RECEIPT_VIEW_OWN'));

INSERT INTO document_types (code, name, requires_expiry, is_required) VALUES
 ('BUSINESS_LICENSE',      'Business / trade license',          TRUE,  TRUE),
 ('TAX_REGISTRATION_CERT', 'Tax registration (TIN) certificate', FALSE, TRUE),
 ('REPRESENTATIVE_ID',     'Authorized representative ID',       TRUE,  TRUE),
 ('VAT_REGISTRATION_CERT', 'VAT registration certificate',       FALSE, FALSE),
 ('OTHER',                 'Other supporting document',          FALSE, FALSE);

INSERT INTO units_of_measure (code, name) VALUES
 ('PCS','Piece'),('KG','Kilogram'),('G','Gram'),('L','Litre'),('ML','Millilitre'),('M','Metre'),
 ('M2','Square metre'),('BOX','Box'),('DOZEN','Dozen'),('HOUR','Hour'),('SERVICE','Service');

INSERT INTO tax_categories (code, name, description) VALUES
 ('STANDARD_RATED', 'Standard rated', 'Taxed at the standard rate defined by an active tax rule'),
 ('ZERO_RATED',     'Zero rated',     'Taxable supply at 0% (requires a 0% rule for traceability)'),
 ('EXEMPT',         'Exempt',         'Exempt supply (requires a 0% rule for traceability)');
