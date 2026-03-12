TRUNCATE TABLE
  "ChapaWebhookLog",
  "InventoryLog",
  "Payment",
  "PrescriptionItem",
  "Prescription",
  "SaleItem",
  "Sale",
  "DrugBatch",
  "Drug",
  "PurchaseItem",
  "PurchaseOrder",
  "Supplier",
  "Notification",
  "Expense",
  "AuditLog",
  "Session",
  "Account",
  "User"
RESTART IDENTITY CASCADE;

1. Insert Users

sql
INSERT INTO "User" (id, email, password, name, phone, role, "twoFactorEnabled", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'admin@pharmacy.com',    '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Admin User',       '+251911111111', 'ADMIN', false, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pharmacist@pharmacy.com','$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'John Pharmacist',  '+251922222222', 'PHARMACIST', false, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'manager@pharmacy.com',  '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Sarah Manager',    '+251933333333', 'MANAGER', false, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'inventory@pharmacy.com','$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Mike Inventory',   '+251944444444', 'INVENTORY_MANAGER', false, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'assistant@pharmacy.com','$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', 'Lisa Assistant',   '+251955555555', 'SALES_ASSISTANT', false, true, NOW(), NOW());
  
3. Insert Suppliers
sql
INSERT INTO "Supplier" (id, name, company, "contactPerson", email, phone, address, "paymentTerms", "creditLimit", rating, "isActive", balance, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'MediCorp Pharmaceuticals', 'MediCorp Inc.', 'Sarah Johnson', 'sarah@medicorp.com', '+251966666666', 'Addis Ababa, Bole Road', 'Net 30', 500000, 5, true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'PharmaEthiopia', 'PharmaEthiopia PLC', 'Abebe Kebede', 'abebe@pharmaethiopia.com', '+251977777777', 'Addis Ababa, Mexico Square', 'Net 15', 250000, 4, true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'Global Health Supplies', NULL, 'Michael Chen', 'michael@globalhealth.com', '+251988888888', NULL, 'Net 45', 750000, 5, true, 0, NOW(), NOW());
4. Insert Drugs
sql
-- Create a temporary table to hold drug data for later reference
CREATE TEMP TABLE temp_drug (id TEXT PRIMARY KEY, name TEXT, price NUMERIC, cost NUMERIC, stock INT);

WITH drug_data AS (
  SELECT *
  FROM (VALUES
    (1, 'Amoxicillin', 'Amoxicillin', 'Amoxil', 'PRESCRIPTION', '500mg', 'capsule', 2.5, 1.2, 150, 50, 500, 75, '1234567890'),
    (2, 'Ibuprofen', 'Ibuprofen', 'Advil', 'OVER_THE_COUNTER', '400mg', 'tablet', 0.75, 0.25, 300, 100, 1000, 150, '1234567891'),
    (3, 'Paracetamol', 'Acetaminophen', 'Panadol', 'OVER_THE_COUNTER', '500mg', 'tablet', 0.5, 0.15, 500, 200, 2000, 250, '1234567892'),
    (4, 'Lisinopril', 'Lisinopril', 'Zestril', 'PRESCRIPTION', '10mg', 'tablet', 1.8, 0.9, 200, 50, 400, 80, '1234567893'),
    (5, 'Metformin', 'Metformin', 'Glucophage', 'PRESCRIPTION', '850mg', 'tablet', 1.2, 0.6, 180, 40, 300, 60, '1234567894'),
    (6, 'Atorvastatin', 'Atorvastatin', 'Lipitor', 'PRESCRIPTION', '20mg', 'tablet', 3.5, 1.8, 120, 30, 250, 50, '1234567895'),
    (7, 'Vitamin C', 'Ascorbic Acid', 'Nature''s Bounty', 'SUPPLEMENTS', '1000mg', 'tablet', 0.5, 0.15, 400, 100, 800, 150, '1234567896'),
    (8, 'Omeprazole', 'Omeprazole', 'Prilosec', 'PRESCRIPTION', '20mg', 'capsule', 2.0, 0.8, 150, 40, 300, 60, '1234567897'),
    (9, 'Salbutamol Inhaler', 'Albuterol', 'Ventolin', 'PRESCRIPTION', '100mcg', 'inhaler', 15.0, 7.5, 50, 20, 100, 30, '1234567898'),
    (10, 'Insulin Glargine', 'Insulin Glargine', 'Lantus', 'PRESCRIPTION', '100IU/mL', 'vial', 45.0, 22.0, 30, 10, 50, 15, '1234567899')
  ) AS t(idx, name, generic, brand, category, dosage, unit, price, cost, stock, min, max, reorder, barcode)
)
INSERT INTO "Drug" (id, name, "genericName", brand, category, dosage, unit, price, "costPrice", stock, "minStockLevel", "maxStockLevel", "reorderPoint", "supplierId", barcode, description, "storageCondition", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d.name,
  d.generic,
  d.brand,
  d.category::"DrugCategory",
  d.dosage,
  d.unit,
  d.price,
  d.cost,
  d.stock,
  d.min,
  d.max,
  d.reorder,
  s.id,
  d.barcode,
  'Sample description for ' || d.name,
  'Store at room temperature',
  true,
  NOW(),
  NOW()
FROM drug_data d
CROSS JOIN LATERAL (
  SELECT id FROM "Supplier" ORDER BY random() LIMIT 1
) s;

-- Store basic drug info in temp table
INSERT INTO temp_drug (id, name, price, cost, stock)
SELECT id, name, price, "costPrice", stock FROM "Drug";
5. Create Drug Batches (2 per drug)
sql
DO $$
DECLARE
  drug_rec RECORD;
  expiry_days INT;
  qty_per_batch INT;
BEGIN
  FOR drug_rec IN SELECT id, stock, cost FROM temp_drug LOOP
    FOR b IN 1..2 LOOP
      expiry_days := 60 + floor(random() * 365)::int;
      IF b = 2 AND random() > 0.5 THEN
        expiry_days := -30;
      END IF;
      qty_per_batch := drug_rec.stock / 2;
      INSERT INTO "DrugBatch" (id, "drugId", "batchNumber", "expiryDate", quantity, remaining, "costPrice", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        drug_rec.id,
        'BATCH-' || right(drug_rec.id, 4) || '-' || b,
        NOW() + (expiry_days || ' days')::interval,
        qty_per_batch,
        qty_per_batch,
        drug_rec.cost,
        NOW()
      );
    END LOOP;
  END LOOP;
END $$;
6. Insert Purchase Orders (PO1 DELIVERED, PO2 PENDING)
sql
-- PO1: DELIVERED
WITH po1 AS (
  INSERT INTO "PurchaseOrder" (
    id, "orderNumber", "supplierId", "totalAmount", status,
    "orderDate", "expectedDelivery", "receivedDate", notes
  )
  VALUES (
    gen_random_uuid()::text,
    'PO-' || extract(epoch from now())::bigint || '-1',
    (SELECT id FROM "Supplier" WHERE name = 'MediCorp Pharmaceuticals' LIMIT 1),
    12500,
    'DELIVERED',
    NOW() - interval '45 days',
    NOW() - interval '40 days',
    NOW() - interval '38 days',
    'Initial stock order'
  )
  RETURNING id
)
INSERT INTO "PurchaseItem" (id, "purchaseOrderId", "drugId", quantity, "unitCost", "batchNumber", "expiryDate")
SELECT
  gen_random_uuid()::text,
  (SELECT id FROM po1),
  d.id,
  100,
  d.cost,
  'BATCH-PO1-' || row_number() over (),
  NOW() + interval '300 days'
FROM temp_drug d
ORDER BY d.name
LIMIT 5;

-- PO2: PENDING
WITH po2 AS (
  INSERT INTO "PurchaseOrder" (
    id, "orderNumber", "supplierId", "totalAmount", status,
    "orderDate", "expectedDelivery", notes
  )
  VALUES (
    gen_random_uuid()::text,
    'PO-' || extract(epoch from now())::bigint || '-2',
    (SELECT id FROM "Supplier" WHERE name = 'PharmaEthiopia' LIMIT 1),
    8500,
    'PENDING',
    NOW() - interval '5 days',
    NOW() + interval '10 days',
    NULL
  )
  RETURNING id
)
INSERT INTO "PurchaseItem" (id, "purchaseOrderId", "drugId", quantity, "unitCost", "batchNumber", "expiryDate")
SELECT
  gen_random_uuid()::text,
  (SELECT id FROM po2),
  d.id,
  50,
  d.cost,
  'BATCH-PO2-' || row_number() over (),
  NOW() + interval '200 days'
FROM temp_drug d
ORDER BY d.name
OFFSET 5
LIMIT 3;
7. Inventory Logs for DELIVERED Purchase Order
sql
INSERT INTO "InventoryLog" (id, "drugId", type, quantity, "previousStock", "newStock", "purchaseOrderId", "batchNumber", "userId", "createdAt")
SELECT
  gen_random_uuid()::text,
  pi."drugId",
  'PURCHASE',
  pi.quantity,
  d.stock - pi.quantity,
  d.stock,
  po.id,
  pi."batchNumber",
  (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com' LIMIT 1),
  po."receivedDate"
FROM "PurchaseOrder" po
JOIN "PurchaseItem" pi ON pi."purchaseOrderId" = po.id
JOIN temp_drug d ON d.id = pi."drugId"
WHERE po.status = 'DELIVERED';
8. Generate Sales (30 sales)
This is a large PL/pgSQL block – run it as a single statement.

sql
DO $$
DECLARE
  user_ids TEXT[];
  drug_ids TEXT[];
  sale_id TEXT;
  sale_date TIMESTAMP;
  customer_name TEXT;
  payment_method TEXT;
  item_count INT;
  total NUMERIC;
  discount NUMERIC;
  tax NUMERIC;
  net NUMERIC;
  user_id TEXT;
  i INT;
  j INT;
  selected_drug_id TEXT;
  drug_price NUMERIC;
  drug_stock INT;
  quantity INT;
  subtotal NUMERIC;
  batch_record RECORD;
BEGIN
  SELECT array_agg(id) INTO user_ids FROM "User";
  SELECT array_agg(id) INTO drug_ids FROM temp_drug;

  FOR i IN 1..30 LOOP
    sale_date := NOW() - (random() * 60 || ' days')::interval;
    customer_name := (ARRAY['Abebe Alemu', 'Tigist Haile', 'Bekele Tadesse', 'Meron Assefa', 'Yonas Desta', 'Hana Wondimu', 'Dawit Mekonnen', 'Selam Tesfaye'])[floor(random() * 8 + 1)];
    payment_method := (ARRAY['CASH', 'CARD', 'CHAPA', 'INSURANCE', 'MIXED'])[floor(random() * 5 + 1)];
    user_id := user_ids[floor(random() * array_length(user_ids, 1) + 1)];
    item_count := floor(random() * 5 + 1);
    total := 0;

    -- Create sale placeholder
    INSERT INTO "Sale" (id, "invoiceNumber", "userId", "customerName", "customerPhone", "customerEmail", "totalAmount", discount, tax, "netAmount", "paymentMethod", status, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      'INV-' || lpad(i::text, 6, '0'),
      user_id,
      customer_name,
      '+2519' || floor(random() * 90000000 + 10000000)::text,
      lower(replace(customer_name, ' ', '.')) || '@example.com',
      0, 0, 0, 0,
      payment_method,
      'COMPLETED',
      sale_date,
      sale_date
    )
    RETURNING id INTO sale_id;

    -- Insert sale items and accumulate total
    FOR j IN 1..item_count LOOP
      selected_drug_id := drug_ids[floor(random() * array_length(drug_ids, 1) + 1)];
      SELECT price, stock INTO drug_price, drug_stock FROM temp_drug WHERE id = selected_drug_id;
      quantity := floor(random() * 5 + 1);
      subtotal := quantity * drug_price;
      total := total + subtotal;

      SELECT id, "batchNumber" INTO batch_record
      FROM "DrugBatch"
      WHERE "drugId" = selected_drug_id
      ORDER BY random()
      LIMIT 1;

      INSERT INTO "SaleItem" (id, "saleId", "drugId", quantity, "unitPrice", discount, tax, subtotal, "batchNumber", "batchId")
      VALUES (
        gen_random_uuid()::text,
        sale_id,
        selected_drug_id,
        quantity,
        drug_price,
        0,
        0,
        subtotal,
        batch_record."batchNumber",
        batch_record.id
      );

      INSERT INTO "InventoryLog" (id, "drugId", type, quantity, "previousStock", "newStock", "saleId", "batchNumber", "userId", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        selected_drug_id,
        'SALE',
        -quantity,
        drug_stock + quantity,
        drug_stock,
        sale_id,
        batch_record."batchNumber",
        user_id,
        sale_date
      );
    END LOOP;

    discount := CASE WHEN random() > 0.8 THEN total * 0.1 ELSE 0 END;
    tax := total * 0.15;
    net := total - discount + tax;

    UPDATE "Sale" SET
      "totalAmount" = total,
      discount = discount,
      tax = tax,
      "netAmount" = net
    WHERE id = sale_id;

    INSERT INTO "Payment" (id, "saleId", amount, method, status, "paidAt", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      sale_id,
      net,
      payment_method,
      'COMPLETED',
      sale_date,
      NOW(),
      NOW()
    );
  END LOOP;
END $$;
9. Pending Chapa Sale
sql
WITH pending_sale AS (
  INSERT INTO "Sale" (id, "invoiceNumber", "userId", "customerName", "customerEmail", "totalAmount", discount, tax, "netAmount", "paymentMethod", status, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'INV-CHAPA-001',
    (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com' LIMIT 1),
    'Chapa Customer',
    'chapa@example.com',
    2500,
    0,
    375,
    2875,
    'CHAPA',
    'PENDING',
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO "SaleItem" (id, "saleId", "drugId", quantity, "unitPrice", discount, tax, subtotal, "batchNumber", "batchId")
SELECT
  gen_random_uuid()::text,
  (SELECT id FROM pending_sale),
  d.id,
  5,
  d.price,
  0,
  0,
  5 * d.price,
  b."batchNumber",
  b.id
FROM temp_drug d
JOIN "DrugBatch" b ON b."drugId" = d.id
ORDER BY d.id
LIMIT 1;

INSERT INTO "Payment" (id, "saleId", amount, method, status, "chapaTxRef", "paymentLink", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  ps.id,
  2875,
  'CHAPA',
  'PENDING',
  'tx-pending-' || extract(epoch from now())::bigint,
  'https://checkout.chapa.co/payment-link',
  NOW(),
  NOW()
FROM (SELECT id FROM "Sale" WHERE "invoiceNumber" = 'INV-CHAPA-001') ps;
10. Prescription (linked to first completed sale)
sql
INSERT INTO "Prescription" (id, "prescriptionNumber", "saleId", "patientName", "patientAge", "patientGender", "doctorName", "doctorLicense", diagnosis, "issueDate", "expiryDate", "isDispensed")
SELECT
  gen_random_uuid()::text,
  'RX-' || extract(epoch from now())::bigint,
  s.id,
  'Patient Demo',
  45,
  'Male',
  'Dr. Tadesse',
  'MED12345',
  'Hypertension',
  NOW() - interval '10 days',
  NOW() + interval '20 days',
  true
FROM "Sale" s
WHERE s."invoiceNumber" = 'INV-000001'
LIMIT 1;

INSERT INTO "PrescriptionItem" (id, "prescriptionId", "drugId", dosage, frequency, duration, instructions, quantity, "isDispensed")
SELECT
  gen_random_uuid()::text,
  p.id,
  d.id,
  '10mg',
  'Once daily',
  '30 days',
  'Take in the morning',
  30,
  true
FROM "Prescription" p
CROSS JOIN (SELECT id FROM "Drug" WHERE name = 'Lisinopril' LIMIT 1) d
WHERE p."prescriptionNumber" LIKE 'RX-%'
LIMIT 1;
11. Notifications
sql
INSERT INTO "Notification" (id, "userId", title, message, type, link, "createdAt")
VALUES
  (gen_random_uuid()::text, (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com' LIMIT 1), 'Low Stock Alert', 'Amoxicillin is below minimum stock level', 'WARNING', '/dashboard/drugs/' || (SELECT id FROM "Drug" WHERE name = 'Amoxicillin' LIMIT 1), NOW()),
  (gen_random_uuid()::text, (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com' LIMIT 1), 'Expiring Soon', 'Batch BATCH-1234 of Ibuprofen expires in 15 days', 'WARNING', NULL, NOW()),
  (gen_random_uuid()::text, (SELECT id FROM "User" WHERE email = 'pharmacist@pharmacy.com' LIMIT 1), 'New Purchase Order', 'Purchase order PO-12345 has been received', 'INFO', NULL, NOW()),
  (gen_random_uuid()::text, (SELECT id FROM "User" WHERE email = 'manager@pharmacy.com' LIMIT 1), 'System Update', 'System maintenance scheduled for tonight', 'INFO', NULL, NOW());
12. Expenses
sql
INSERT INTO "Expense" (id, category, description, amount, date, "approvedBy", "createdAt")
VALUES
  (gen_random_uuid()::text, 'RENT', 'Monthly rent for January', 15000, NOW() - interval '15 days', (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com' LIMIT 1), NOW()),
  (gen_random_uuid()::text, 'UTILITIES', 'Electricity and water bill', 3500, NOW() - interval '10 days', NULL, NOW()),
  (gen_random_uuid()::text, 'SALARY', 'Staff salaries for January', 45000, NOW() - interval '5 days', (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com' LIMIT 1), NOW()),
  (gen_random_uuid()::text, 'MAINTENANCE', 'Air conditioning repair', 1200, NOW() - interval '7 days', NULL, NOW());
13. Audit Logs
sql
INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", "ipAddress", "userAgent", "createdAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  'LOGIN',
  'User',
  u.id,
  '127.0.0.1',
  'Seed script',
  NOW()
FROM "User" u
WHERE u.email = 'admin@pharmacy.com'
UNION ALL
SELECT
  gen_random_uuid()::text,
  u.id,
  'CREATE',
  'Sale',
  s.id,
  NULL,
  NULL,
  NOW()
FROM "User" u, "Sale" s
WHERE u.email = 'pharmacist@pharmacy.com' AND s."invoiceNumber" = 'INV-000001';
14. Clean up temporary table
sql
DROP TABLE temp_drug;
