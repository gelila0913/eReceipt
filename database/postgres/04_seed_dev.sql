-- =============================================================================
-- eReceipt database  |  04_seed_dev.sql  |  DEVELOPMENT / TEST ONLY - never run in production
-- The 15% rate below is a TEST FIXTURE, not a legal source (see legal_reference).
-- Fixed UUIDs make tests and API examples reproducible.
-- =============================================================================
USE ereceipt;
SET time_zone = '+00:00';

SET @dev_hash = '$argon2id$DEV_ONLY_NOT_A_REAL_HASH';

INSERT INTO users (id, role_id, email, phone, password_hash, full_name, status, email_verified_at) VALUES
 ('00000000-0000-7000-8000-000000000001', (SELECT id FROM roles WHERE code='SUPER_ADMIN'),          'admin@ereceipt.test',   NULL, @dev_hash, 'Dev Admin',        'ACTIVE', NOW(3)),
 ('00000000-0000-7000-8000-000000000002', (SELECT id FROM roles WHERE code='VERIFICATION_OFFICER'), 'officer@ereceipt.test', NULL, @dev_hash, 'Dev Officer',      'ACTIVE', NOW(3)),
 ('00000000-0000-7000-8000-000000000003', (SELECT id FROM roles WHERE code='MERCHANT'),             'owner1@shop.test',      '+251911000001', @dev_hash, 'Abebe Kebede',  'ACTIVE', NOW(3)),
 ('00000000-0000-7000-8000-000000000004', (SELECT id FROM roles WHERE code='MERCHANT'),             'cashier1@shop.test',    '+251911000002', @dev_hash, 'Tigist Alemu',  'ACTIVE', NOW(3)),
 ('00000000-0000-7000-8000-000000000005', (SELECT id FROM roles WHERE code='MERCHANT'),             'owner2@cafe.test',      '+251911000003', @dev_hash, 'Dawit Haile',   'ACTIVE', NOW(3)),
 ('00000000-0000-7000-8000-000000000006', (SELECT id FROM roles WHERE code='CUSTOMER'),             'customer@mail.test',    '+251911000004', @dev_hash, 'Selam Tesfaye', 'ACTIVE', NOW(3));

-- M1 approved, M2 pending (applicant), M3 suspended
INSERT INTO merchants (id, merchant_code, legal_name, trade_name, tin, region, city, sub_city, woreda, street_address, phone, email,
                       representative_name, status, approved_at) VALUES
 ('10000000-0000-7000-8000-000000000001','M000001','Kebede General Trading PLC','Kebede Shop','0012345678','Addis Ababa','Addis Ababa','Bole','03','Bole Rd','+251911000001','owner1@shop.test','Abebe Kebede','APPROVED', NOW(3)),
 ('10000000-0000-7000-8000-000000000002','M000002','Haile Cafe','Haile Cafe','0087654321','Addis Ababa','Addis Ababa','Kirkos','05',NULL,'+251911000003','owner2@cafe.test','Dawit Haile','PENDING', NULL),
 ('10000000-0000-7000-8000-000000000003','M000003','Suspended Traders','Suspended Traders','0011223344','Oromia','Adama',NULL,NULL,NULL,'+251911000009',NULL,'Some Owner','SUSPENDED', NOW(3));

INSERT INTO merchant_members (merchant_id, user_id, member_role) VALUES
 ('10000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000003','OWNER'),
 ('10000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000004','CASHIER'),
 ('10000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000005','OWNER');

INSERT INTO merchant_status_history (merchant_id, from_status, to_status, reason, changed_by) VALUES
 ('10000000-0000-7000-8000-000000000001', NULL,     'PENDING',  'Application submitted', '00000000-0000-7000-8000-000000000003'),
 ('10000000-0000-7000-8000-000000000001', 'PENDING','APPROVED', 'Documents verified',    '00000000-0000-7000-8000-000000000002'),
 ('10000000-0000-7000-8000-000000000003', 'APPROVED','SUSPENDED','Dev fixture',          '00000000-0000-7000-8000-000000000001');

INSERT INTO verification_applications (id, reference_no, merchant_id, status, decided_at, decided_by) VALUES
 ('20000000-0000-7000-8000-000000000001','VA-2026-000001','10000000-0000-7000-8000-000000000001','APPROVED', NOW(3), '00000000-0000-7000-8000-000000000002');
INSERT INTO verification_applications (id, reference_no, merchant_id, status) VALUES
 ('20000000-0000-7000-8000-000000000002','VA-2026-000002','10000000-0000-7000-8000-000000000002','PENDING');

-- TEST tax rules (approved by dev admin). Real rules must cite real legal references.
INSERT INTO tax_rules (id, tax_category_id, tax_type, applicable_regime, name, rate_percent, effective_from, status, legal_reference, created_by, approved_by, approved_at) VALUES
 ('30000000-0000-7000-8000-000000000001',(SELECT id FROM tax_categories WHERE code='STANDARD_RATED'),'VAT','ANY','DEV TEST standard rate',15.0000,'2020-01-01','ACTIVE','DEV-TEST ONLY - not a legal source','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001',NOW(3)),
 ('30000000-0000-7000-8000-000000000002',(SELECT id FROM tax_categories WHERE code='ZERO_RATED'),'VAT','ANY','DEV TEST zero rate',0.0000,'2020-01-01','ACTIVE','DEV-TEST ONLY - not a legal source','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001',NOW(3)),
 ('30000000-0000-7000-8000-000000000003',(SELECT id FROM tax_categories WHERE code='EXEMPT'),'VAT','ANY','DEV TEST exempt',0.0000,'2020-01-01','ACTIVE','DEV-TEST ONLY - not a legal source','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001',NOW(3));

INSERT INTO merchant_tax_profiles (id, merchant_id, tax_regime, effective_from, created_by) VALUES
 ('50000000-0000-7000-8000-0000000000f1','10000000-0000-7000-8000-000000000001','VAT_REGISTERED','2020-01-01','00000000-0000-7000-8000-000000000001');

INSERT INTO products (id, merchant_id, product_code, name, unit_price, uom_code, tax_category_id) VALUES
 ('40000000-0000-7000-8000-000000000001','10000000-0000-7000-8000-000000000001','COF-001','Coffee beans 1kg', 800.0000,'KG',  (SELECT id FROM tax_categories WHERE code='STANDARD_RATED')),
 ('40000000-0000-7000-8000-000000000002','10000000-0000-7000-8000-000000000001','BRD-001','Bread loaf',       25.0000,'PCS', (SELECT id FROM tax_categories WHERE code='EXEMPT')),
 ('40000000-0000-7000-8000-000000000003','10000000-0000-7000-8000-000000000001','NTB-001','Notebook A5',      60.0000,'PCS', (SELECT id FROM tax_categories WHERE code='STANDARD_RATED'));
