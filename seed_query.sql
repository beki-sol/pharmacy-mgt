select * from "User";
-- ===================================================================
-- Pharmacy Inventory System – Full Data Population (New Schema)
-- ===================================================================

BEGIN;

-- 1. Clear existing data (order matters for foreign keys)
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
  "Draft",
  "User",
  "Category"
RESTART IDENTITY CASCADE;

-- 2. Insert Categories
INSERT INTO "Category" (id, name, "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Antibiotic', NOW(), NOW()),
  (gen_random_uuid()::text, 'Pain Relief', NOW(), NOW()),
  (gen_random_uuid()::text, 'Cardiovascular', NOW(), NOW()),
  (gen_random_uuid()::text, 'Diabetes', NOW(), NOW()),
  (gen_random_uuid()::text, 'Antihistamine', NOW(), NOW()),
  (gen_random_uuid()::text, 'Vitamin', NOW(), NOW());

-- 3. Insert Users (no emailVerified or image)
INSERT INTO "User" (
  id, email, password, name, phone, role, "twoFactorEnabled", "isActive",
  "createdAt", "updatedAt"
) VALUES
  (gen_random_uuid()::text, 'admin@pharmacy.com',
   '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW', -- password123
   'Admin User', '+251911111111', 'ADMIN', false, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pharmacist@pharmacy.com',
   '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
   'John Pharmacist', '+251922222222', 'PHARMACIST', false, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'assistant@pharmacy.com',
   '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
   'Lisa Assistant', '+251933333333', 'SALES_ASSISTANT', false, true, NOW(), NOW());

-- 4. Insert Suppliers
INSERT INTO "Supplier" (id, name, company, "contactPerson", email, phone, address, "paymentTerms", "creditLimit", rating, "isActive", balance, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'MediCorp Pharmaceuticals', 'MediCorp Inc.', 'Sarah Johnson', 'sarah@medicorp.com', '+251966666666', 'Addis Ababa, Bole Road', 'Net 30', 50000, 5, true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'Global Health Supplies', NULL, 'Michael Chen', 'michael@globalhealth.com', '+251988888888', NULL, 'Net 45', 75000, 5, true, 0, NOW(), NOW());

-- 5. Insert Drugs (using correct column names: "category_id", "supplierId")
WITH cat AS (SELECT id, name FROM "Category")
INSERT INTO "Drug" (
  id, name, "genericName", brand, "category_id", dosage, unit, price, "costPrice",
  stock, "minStockLevel", "maxStockLevel", "reorderPoint",
  barcode, description, "storageCondition", "isActive", "createdAt", "updatedAt", "supplierId"
)
SELECT
  gen_random_uuid()::text,
  drug.name,
  drug.generic,
  drug.brand,
  c.id,                                     -- category_id (foreign key)
  drug.dosage,
  drug.unit,
  drug.price,
  drug.cost,
  0,                                        -- stock updated later
  drug.min,
  drug.max,
  drug.reorder,
  drug.barcode,
  drug.desc_text,
  drug.storage,
  true,
  NOW(),
  NOW(),
  (SELECT id FROM "Supplier" WHERE name = drug.supplier_name)   -- supplierId
FROM (
  VALUES
    ('Amoxicillin', 'Amoxicillin', 'Amoxil', 'Antibiotic', '500mg', 'capsule', 12.50, 8.00, 50, 500, 75, '1234567890123', 'Antibiotic for bacterial infections', 'Store below 25°C', 'MediCorp Pharmaceuticals'),
    ('Ibuprofen', 'Ibuprofen', 'Advil', 'Pain Relief', '400mg', 'tablet', 5.00, 2.50, 100, 1000, 150, '1234567890124', 'Pain reliever and fever reducer', 'Store in a cool dry place', 'MediCorp Pharmaceuticals'),
    ('Paracetamol', 'Acetaminophen', 'Panadol', 'Pain Relief', '500mg', 'tablet', 3.00, 1.20, 200, 2000, 250, '1234567890125', 'Mild pain and fever', 'Room temperature', 'Global Health Supplies'),
    ('Lisinopril', 'Lisinopril', 'Zestril', 'Cardiovascular', '10mg', 'tablet', 15.00, 9.00, 30, 300, 50, '1234567890126', 'Blood pressure medication', 'Store at room temperature', 'Global Health Supplies'),
    ('Metformin', 'Metformin', 'Glucophage', 'Diabetes', '850mg', 'tablet', 8.50, 4.00, 40, 400, 60, '1234567890127', 'Diabetes medication', 'Store below 30°C', 'MediCorp Pharmaceuticals')
) AS drug(name, generic, brand, category_name, dosage, unit, price, cost, min, max, reorder, barcode, desc_text, storage, supplier_name)
JOIN cat c ON c.name = drug.category_name;

-- 6. Insert Batches (2 batches per drug, split initial stock)
-- First, set initial stock in Drug table to minStockLevel * 2 (will be increased later by purchase orders)
UPDATE "Drug" SET stock = "minStockLevel" * 2;

DO $$
DECLARE
  drug_rec RECORD;
  batch_num INT;
  batch_qty INT;
BEGIN
  FOR drug_rec IN SELECT id, name, stock, "costPrice" FROM "Drug" LOOP
    batch_qty := drug_rec.stock / 2;
    FOR batch_num IN 1..2 LOOP
      INSERT INTO "DrugBatch" (
        id, "drugId", "batchNumber", "expiryDate", quantity, remaining, "costPrice", "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        drug_rec.id,
        'BATCH-' || drug_rec.name || '-' || batch_num,
        NOW() + (CASE WHEN batch_num = 1 THEN INTERVAL '2 years' ELSE INTERVAL '1 year' END),
        batch_qty,
        batch_qty,
        drug_rec."costPrice",
        NOW()
      );
    END LOOP;
  END LOOP;
END $$;

-- 7. Purchase Orders (one delivered, one pending)
INSERT INTO "PurchaseOrder" (
  id, "orderNumber", "supplierId", "totalAmount", status, "orderDate", "expectedDelivery", "receivedDate", notes
)
VALUES
  (
    gen_random_uuid()::text,
    'PO-1001',
    (SELECT id FROM "Supplier" WHERE name = 'MediCorp Pharmaceuticals'),
    12500.00,
    'DELIVERED',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '15 days',
    'Initial stock order'
  ),
  (
    gen_random_uuid()::text,
    'PO-1002',
    (SELECT id FROM "Supplier" WHERE name = 'Global Health Supplies'),
    8500.00,
    'PENDING',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '5 days',
    NULL,
    'Reorder'
  );

-- 8. Purchase Items for the delivered order (add items for each drug)
WITH po_delivered AS (SELECT id FROM "PurchaseOrder" WHERE status = 'DELIVERED')
INSERT INTO "PurchaseItem" (
  id, "purchaseOrderId", "drugId", quantity, "unitCost", "batchNumber", "expiryDate"
)
SELECT
  gen_random_uuid()::text,
  po.id,
  d.id,
  floor(random() * 100 + 50)::int,
  d."costPrice" * (0.9 + random() * 0.2),
  'BATCH-PO-' || po.id || '-' || d.name,
  NOW() + INTERVAL '1 year' + (random() * INTERVAL '1 year')
FROM po_delivered po
CROSS JOIN LATERAL (
  SELECT id, name, "costPrice" FROM "Drug"
) d
ORDER BY random()
LIMIT 5;

-- 9. Update Drug stock based on purchase items (increase)
UPDATE "Drug" d
SET stock = d.stock + sub.total_added
FROM (
  SELECT pi."drugId", SUM(pi.quantity) AS total_added
  FROM "PurchaseItem" pi
  JOIN "PurchaseOrder" po ON pi."purchaseOrderId" = po.id
  WHERE po.status = 'DELIVERED'
  GROUP BY pi."drugId"
) sub
WHERE d.id = sub."drugId";

-- 10. Update batch remaining for purchased items (add to first batch)
UPDATE "DrugBatch" b
SET remaining = b.remaining + sub.total_added
FROM (
  SELECT pi."drugId", SUM(pi.quantity) AS total_added
  FROM "PurchaseItem" pi
  JOIN "PurchaseOrder" po ON pi."purchaseOrderId" = po.id
  WHERE po.status = 'DELIVERED'
  GROUP BY pi."drugId"
) sub
WHERE b."drugId" = sub."drugId"
AND b.id = (SELECT id FROM "DrugBatch" WHERE "drugId" = sub."drugId" ORDER BY "createdAt" LIMIT 1);

-- 11. Inventory Logs for purchase orders (PURCHASE)
INSERT INTO "InventoryLog" (
  id, "drugId", type, quantity, "previousStock", "newStock", "purchaseOrderId", "batchNumber", "userId", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  pi."drugId",
  'PURCHASE'::"InventoryAction",
  pi.quantity,
  d.stock - pi.quantity,
  d.stock,
  po.id,
  pi."batchNumber",
  (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com'),
  po."receivedDate"
FROM "PurchaseOrder" po
JOIN "PurchaseItem" pi ON pi."purchaseOrderId" = po.id
JOIN "Drug" d ON d.id = pi."drugId"
WHERE po.status = 'DELIVERED';

-- 12. Sales (create 5 completed sales and 1 pending)
-- 12. Sales (create 5 completed sales and 1 pending)
DO $$
DECLARE
  i INT;
  sale_id TEXT;
  user_id TEXT;
  sale_date TIMESTAMP;
  cust_name TEXT;
  cust_phone TEXT;
  payment_method TEXT;
  total_amt DECIMAL;
  discount_amt DECIMAL := 0;
  tax_amt DECIMAL;
  net_amt DECIMAL;
  status_val "SaleStatus";
  item_count INT;
  drug_rec RECORD;
  batch_rec RECORD;
  item_qty INT;          -- renamed to avoid conflict with column name
  item_subtotal DECIMAL;
BEGIN
  user_id := (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com');
  FOR i IN 1..6 LOOP
    sale_date := NOW() - (random() * INTERVAL '30 days');
    cust_name := 'Customer ' || i;
    cust_phone := '+2519' || floor(random() * 90000000 + 10000000)::text;
    payment_method := CASE WHEN random() > 0.7 THEN 'CARD' ELSE 'CASH' END;
    status_val := CASE WHEN i <= 5 THEN 'COMPLETED'::"SaleStatus" ELSE 'PENDING'::"SaleStatus" END;
    total_amt := 0;

    -- Insert sale
    INSERT INTO "Sale" (
      id, "invoiceNumber", "userId", "customerName", "customerPhone", "totalAmount", discount, tax, "netAmount",
      "paymentMethod", status, "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      'INV-' || i || '-TEST',
      user_id,
      cust_name,
      cust_phone,
      0, 0, 0, 0,
      payment_method,
      status_val,
      sale_date,
      sale_date
    ) RETURNING id INTO sale_id;

    -- Add 1-3 sale items
    item_count := floor(random() * 3 + 1);
    FOR j IN 1..item_count LOOP
      SELECT id, price INTO drug_rec FROM "Drug" ORDER BY random() LIMIT 1;
      item_qty := floor(random() * 5 + 1);
      item_subtotal := drug_rec.price * item_qty;
      total_amt := total_amt + item_subtotal;

      -- Get a batch for this drug
      SELECT id, "batchNumber" INTO batch_rec FROM "DrugBatch" WHERE "drugId" = drug_rec.id LIMIT 1;

      INSERT INTO "SaleItem" (
        id, "saleId", "drugId", quantity, "unitPrice", discount, tax, subtotal, "batchId", "batchNumber"
      ) VALUES (
        gen_random_uuid()::text,
        sale_id,
        drug_rec.id,
        item_qty,
        drug_rec.price,
        0,
        0,
        item_subtotal,
        batch_rec.id,
        batch_rec."batchNumber"
      );

      -- If completed, update stock and batch remaining immediately
      IF status_val = 'COMPLETED' THEN
        UPDATE "Drug" SET stock = stock - item_qty WHERE id = drug_rec.id;
        UPDATE "DrugBatch" SET remaining = remaining - item_qty WHERE id = batch_rec.id;
      END IF;
    END LOOP;

    discount_amt := 0;
    tax_amt := 0;
    net_amt := total_amt;
    UPDATE "Sale" SET
      "totalAmount" = total_amt,
      discount = discount_amt,
      tax = tax_amt,
      "netAmount" = net_amt
    WHERE id = sale_id;
  END LOOP;
END $$;

-- 13. Inventory Logs for sales (SALE) – only for completed sales
INSERT INTO "InventoryLog" (
  id, "drugId", type, quantity, "previousStock", "newStock", "saleId", "batchNumber", "userId", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  si."drugId",
  'SALE'::"InventoryAction",
  -si.quantity,
  d.stock + si.quantity,
  d.stock,
  s.id,
  si."batchNumber",
  s."userId",
  s."createdAt"
FROM "Sale" s
JOIN "SaleItem" si ON si."saleId" = s.id
JOIN "Drug" d ON d.id = si."drugId"
WHERE s.status = 'COMPLETED';

-- 14. Notifications (low stock alerts)
INSERT INTO "Notification" (
  id, "userId", title, message, type, "isRead", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  u.id,
  'Low Stock Alert',
  'Drug ' || d.name || ' is below minimum stock level. Current: ' || d.stock || ', Min: ' || d."minStockLevel",
  'WARNING',
  false,
  NOW()
FROM "Drug" d
CROSS JOIN (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com') u
WHERE d.stock <= d."minStockLevel"
LIMIT 5;

-- 15. Expenses
INSERT INTO "Expense" (
  id, category, description, amount, date, "approvedBy", "createdAt"
)
VALUES
  (gen_random_uuid()::text, 'RENT', 'Monthly rent', 15000, NOW() - INTERVAL '15 days', (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com'), NOW()),
  (gen_random_uuid()::text, 'UTILITIES', 'Electricity bill', 3500, NOW() - INTERVAL '10 days', NULL, NOW()),
  (gen_random_uuid()::text, 'SALARY', 'Staff salaries', 45000, NOW() - INTERVAL '5 days', (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com'), NOW());

-- 16. Audit Logs
INSERT INTO "AuditLog" (
  id, "userId", action, entity, "entityId", "ipAddress", "userAgent", "createdAt"
)
VALUES
  (gen_random_uuid()::text, (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com'), 'LOGIN', 'User', (SELECT id FROM "User" WHERE email = 'admin@pharmacy.com'), '127.0.0.1', 'Mozilla/5.0', NOW()),
  (gen_random_uuid()::text, (SELECT id FROM "User" WHERE email = 'pharmacist@pharmacy.com'), 'CREATE', 'Sale', (SELECT id FROM "Sale" LIMIT 1), '192.168.1.1', 'Chrome', NOW());

-- 17. Drafts
INSERT INTO "Draft" (
  id, "sessionId", data, "createdAt", "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  'test-session-123',
  '{"items":[{"drugId":"some-id","quantity":2,"unitPrice":5.00}],"customerName":"Draft Customer"}',
  NOW(),
  NOW()
);

COMMIT;