import { Role, DrugCategory, SaleStatus, InventoryAction } from '@/app/generated/prisma/client';
import { prisma } from "@/app/lib/prisma";

import bcrypt from 'bcryptjs';
import { subDays, addDays } from 'date-fns';





async function main() {
  console.log('🌱 Seeding database...');
  console.log("DATABASE_URL:", process.env.DATABASE_URL);

  // Clear existing data (order matters due to foreign keys)
  await prisma.$transaction([
    prisma.chapaWebhookLog.deleteMany(),
    prisma.inventoryLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.drugBatch.deleteMany(),
    prisma.drug.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@pharmacy.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        phone: '+251911111111',
        twoFactorEnabled: false,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'pharmacist@pharmacy.com',
        password: hashedPassword,
        name: 'John Pharmacist',
        role: 'PHARMACIST',
        phone: '+251922222222',
        twoFactorEnabled: false,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'manager@pharmacy.com',
        password: hashedPassword,
        name: 'Sarah Manager',
        role: 'MANAGER',
        phone: '+251933333333',
        twoFactorEnabled: false,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'inventory@pharmacy.com',
        password: hashedPassword,
        name: 'Mike Inventory',
        role: 'INVENTORY_MANAGER',
        phone: '+251944444444',
        twoFactorEnabled: false,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'assistant@pharmacy.com',
        password: hashedPassword,
        name: 'Lisa Assistant',
        role: 'SALES_ASSISTANT',
        phone: '+251955555555',
        twoFactorEnabled: false,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        name: 'MediCorp Pharmaceuticals',
        company: 'MediCorp Inc.',
        contactPerson: 'Sarah Johnson',
        email: 'sarah@medicorp.com',
        phone: '+251966666666',
        address: 'Addis Ababa, Bole Road',
        paymentTerms: 'Net 30',
        creditLimit: 500000,
        rating: 5,
        isActive: true,
        balance: 0,
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'PharmaEthiopia',
        company: 'PharmaEthiopia PLC',
        contactPerson: 'Abebe Kebede',
        email: 'abebe@pharmaethiopia.com',
        phone: '+251977777777',
        address: 'Addis Ababa, Mexico Square',
        paymentTerms: 'Net 15',
        creditLimit: 250000,
        rating: 4,
        isActive: true,
        balance: 0,
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'Global Health Supplies',
        contactPerson: 'Michael Chen',
        email: 'michael@globalhealth.com',
        phone: '+251988888888',
        paymentTerms: 'Net 45',
        creditLimit: 750000,
        rating: 5,
        isActive: true,
        balance: 0,
      },
    }),
  ]);

  console.log(`✅ Created ${suppliers.length} suppliers`);

  // Create drugs with batches
  const drugs: (Awaited<ReturnType<typeof prisma.drug.findUnique>> & { batches: any[] })[] = [];
  const categories = [
    'PRESCRIPTION',
    'OVER_THE_COUNTER',
    'CONTROLLED',
    'HERBAL',
    'SUPPLEMENTS',
    'VACCINE',
    'MEDICAL_SUPPLY',
  ] as DrugCategory[];

  const drugData = [
    {
      name: 'Amoxicillin',
      generic: 'Amoxicillin',
      brand: 'Amoxil',
      dosage: '500mg',
      unit: 'capsule',
      price: 2.5,
      cost: 1.2,
      stock: 150,
      min: 50,
      max: 500,
      reorder: 75,
    },
    {
      name: 'Ibuprofen',
      generic: 'Ibuprofen',
      brand: 'Advil',
      dosage: '400mg',
      unit: 'tablet',
      price: 0.75,
      cost: 0.25,
      stock: 300,
      min: 100,
      max: 1000,
      reorder: 150,
    },
    {
      name: 'Paracetamol',
      generic: 'Acetaminophen',
      brand: 'Panadol',
      dosage: '500mg',
      unit: 'tablet',
      price: 0.5,
      cost: 0.15,
      stock: 500,
      min: 200,
      max: 2000,
      reorder: 250,
    },
    {
      name: 'Lisinopril',
      generic: 'Lisinopril',
      brand: 'Zestril',
      dosage: '10mg',
      unit: 'tablet',
      price: 1.8,
      cost: 0.9,
      stock: 200,
      min: 50,
      max: 400,
      reorder: 80,
    },
    {
      name: 'Metformin',
      generic: 'Metformin',
      brand: 'Glucophage',
      dosage: '850mg',
      unit: 'tablet',
      price: 1.2,
      cost: 0.6,
      stock: 180,
      min: 40,
      max: 300,
      reorder: 60,
    },
    {
      name: 'Atorvastatin',
      generic: 'Atorvastatin',
      brand: 'Lipitor',
      dosage: '20mg',
      unit: 'tablet',
      price: 3.5,
      cost: 1.8,
      stock: 120,
      min: 30,
      max: 250,
      reorder: 50,
    },
    {
      name: 'Vitamin C',
      generic: 'Ascorbic Acid',
      brand: 'Nature\'s Bounty',
      dosage: '1000mg',
      unit: 'tablet',
      price: 0.5,
      cost: 0.15,
      stock: 400,
      min: 100,
      max: 800,
      reorder: 150,
    },
    {
      name: 'Omeprazole',
      generic: 'Omeprazole',
      brand: 'Prilosec',
      dosage: '20mg',
      unit: 'capsule',
      price: 2.0,
      cost: 0.8,
      stock: 150,
      min: 40,
      max: 300,
      reorder: 60,
    },
    {
      name: 'Salbutamol Inhaler',
      generic: 'Albuterol',
      brand: 'Ventolin',
      dosage: '100mcg',
      unit: 'inhaler',
      price: 15.0,
      cost: 7.5,
      stock: 50,
      min: 20,
      max: 100,
      reorder: 30,
    },
    {
      name: 'Insulin Glargine',
      generic: 'Insulin Glargine',
      brand: 'Lantus',
      dosage: '100IU/mL',
      unit: 'vial',
      price: 45.0,
      cost: 22.0,
      stock: 30,
      min: 10,
      max: 50,
      reorder: 15,
    },
  ];

  for (let i = 0; i < drugData.length; i++) {
    const d = drugData[i];
    const category = categories[i % categories.length];
    const supplier = suppliers[i % suppliers.length];

    const drug = await prisma.drug.create({
      data: {
        name: d.name,
        genericName: d.generic,
        brand: d.brand,
        category,
        dosage: d.dosage,
        unit: d.unit,
        price: d.price,
        costPrice: d.cost,
        stock: d.stock,
        minStockLevel: d.min,
        maxStockLevel: d.max,
        reorderPoint: d.reorder,
        supplierId: supplier.id,
        barcode: `123456789${i}`,
        description: `Sample description for ${d.name}`,
        storageCondition: 'Store at room temperature',
        isActive: true,
      },
    });

    // Create batches
    const batchCount = Math.floor(Math.random() * 3) + 1;
    for (let b = 0; b < batchCount; b++) {
      const expiryDays = Math.random() > 0.7 ? -30 : Math.floor(Math.random() * 365) + 60;
      await prisma.drugBatch.create({
        data: {
          drugId: drug.id,
          batchNumber: `BATCH-${drug.id.slice(-4)}-${b + 1}`,
          expiryDate: addDays(new Date(), expiryDays),
          quantity: Math.floor(d.stock / batchCount),
          remaining: Math.floor(d.stock / batchCount),
          costPrice: d.cost,
        },
      });
    }

    // Fetch drug with batches for later use
    const drugWithBatches = await prisma.drug.findUnique({
      where: { id: drug.id },
      include: { batches: true },
    });
    if (!drugWithBatches) throw new Error(`Drug ${drug.id} not found after creation`);
    drugs.push(drugWithBatches);
  }

  console.log(`✅ Created ${drugs.length} drugs with batches`);

  // Create purchase orders
  const purchaseOrders = await Promise.all([
    prisma.purchaseOrder.create({
      data: {
        orderNumber: `PO-${Date.now()}-1`,
        supplierId: suppliers[0].id,
        totalAmount: 12500,
        status: 'DELIVERED',
        orderDate: subDays(new Date(), 45),
        expectedDelivery: subDays(new Date(), 40),
        receivedDate: subDays(new Date(), 38),
        notes: 'Initial stock order',
        purchaseItems: {
          create: drugs.slice(0, 5).map((drug, idx) => ({
            drugId: drug.id,
            quantity: 100,
            unitCost: drug.costPrice,
            batchNumber: `BATCH-PO1-${idx}`,
            expiryDate: addDays(new Date(), 300),
          })),
        },
      },
    }),
    prisma.purchaseOrder.create({
      data: {
        orderNumber: `PO-${Date.now()}-2`,
        supplierId: suppliers[1].id,
        totalAmount: 8500,
        status: 'PENDING',
        orderDate: subDays(new Date(), 5),
        expectedDelivery: addDays(new Date(), 10),
        purchaseItems: {
          create: drugs.slice(5, 8).map((drug, idx) => ({
            drugId: drug.id,
            quantity: 50,
            unitCost: drug.costPrice,
            batchNumber: `BATCH-PO2-${idx}`,
            expiryDate: addDays(new Date(), 200),
          })),
        },
      },
    }),
  ]);

  console.log(`✅ Created ${purchaseOrders.length} purchase orders`);

  // Create inventory logs for received purchase order
  for (const po of purchaseOrders) {
    if (po.status === 'DELIVERED' && po.receivedDate) {
      const items = await prisma.purchaseItem.findMany({
        where: { purchaseOrderId: po.id },
      });
      for (const item of items) {
        const drug = await prisma.drug.findUnique({
          where: { id: item.drugId },
        });
        if (!drug) {
          console.warn(`Drug ${item.drugId} not found, skipping inventory log for purchase order`);
          continue;
        }
        await prisma.inventoryLog.create({
          data: {
            drugId: item.drugId,
            type: 'PURCHASE',
            quantity: item.quantity,
            previousStock: drug.stock - item.quantity,
            newStock: drug.stock,
            purchaseOrderId: po.id,
            batchNumber: item.batchNumber,
            userId: users[0].id,
            createdAt: po.receivedDate,
          },
        });
      }
    }
  }

  // Create sales with items
  const sales = [];
  const paymentMethods = ['CASH', 'CARD', 'CHAPA', 'INSURANCE', 'MIXED'];
  const customers = [
    'Abebe Alemu',
    'Tigist Haile',
    'Bekele Tadesse',
    'Meron Assefa',
    'Yonas Desta',
    'Hana Wondimu',
    'Dawit Mekonnen',
    'Selam Tesfaye',
  ];

  for (let i = 0; i < 30; i++) {
    const saleDate = subDays(new Date(), Math.floor(Math.random() * 60));
    const customerName = customers[Math.floor(Math.random() * customers.length)];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const items = [];
    let total = 0;

    for (let j = 0; j < itemCount; j++) {
      const drug = drugs[Math.floor(Math.random() * drugs.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const price = drug.price.toNumber();
      const subtotal = quantity * price;
      total += subtotal;
      items.push({
        drugId: drug.id,
        quantity,
        unitPrice: price,
        discount: 0,
        subtotal,
        batchId: drug.batches && drug.batches.length > 0 ? drug.batches[Math.floor(Math.random() * drug.batches.length)].id : undefined,
        batchNumber: drug.batches && drug.batches.length > 0 ? drug.batches[0].batchNumber : undefined,
      });
    }

    const discount = Math.random() > 0.8 ? total * 0.1 : 0;
    const tax = total * 0.15;
    const net = total - discount + tax;

    const sale = await prisma.sale.create({
      data: {
        invoiceNumber: `INV-${String(i + 1).padStart(6, '0')}`,
        userId: users[Math.floor(Math.random() * users.length)].id,
        customerName,
        customerPhone: `+2519${Math.floor(10000000 + Math.random() * 90000000)}`,
        customerEmail: customerName.toLowerCase().replace(' ', '.') + '@example.com',
        totalAmount: total,
        discount,
        tax,
        netAmount: net,
        paymentMethod,
        status: SaleStatus.COMPLETED,
        createdAt: saleDate,
        saleItems: {
          create: items.map(item => ({
            drugId: item.drugId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            tax: 0,
            subtotal: item.subtotal,
            batchNumber: item.batchNumber,
            batchId: item.batchId,
          })),
        },
      },
    });

    // Create payment
    await prisma.payment.create({
      data: {
        saleId: sale.id,
        amount: net,
        method: paymentMethod,
        status: 'COMPLETED',
        paidAt: saleDate,
      },
    });

    // Create inventory logs for each sale item
    for (const item of items) {
      const drug = await prisma.drug.findUnique({
        where: { id: item.drugId },
      });
      if (!drug) {
        console.warn(`Drug ${item.drugId} not found, skipping inventory log for sale ${sale.id}`);
        continue;
      }
      const previousStock = drug.stock + item.quantity;
      await prisma.inventoryLog.create({
        data: {
          drugId: item.drugId,
          type: 'SALE',
          quantity: -item.quantity,
          previousStock,
          newStock: drug.stock,
          saleId: sale.id,
          batchNumber: item.batchNumber,
          userId: sale.userId,
          createdAt: saleDate,
        },
      });
    }

    sales.push(sale);
  }

  console.log(`✅ Created ${sales.length} sales`);

  // Create a pending Chapa payment
  const firstDrug = drugs[0];
  if (!firstDrug) throw new Error('No drugs available for pending sale');
  const pendingSale = await prisma.sale.create({
    data: {
      invoiceNumber: 'INV-CHAPA-001',
      userId: users[0].id,
      customerName: 'Chapa Customer',
      customerEmail: 'chapa@example.com',
      totalAmount: 2500,
      discount: 0,
      tax: 375,
      netAmount: 2875,
      paymentMethod: 'CHAPA',
      status: SaleStatus.PENDING,
      saleItems: {
        create: [
          {
            drugId: firstDrug.id,
            quantity: 5,
            unitPrice: firstDrug.price,
            discount: 0,
            tax: 0,
            subtotal: 5 * firstDrug.price.toNumber(),
            batchNumber: firstDrug.batches?.[0]?.batchNumber,
            batchId: firstDrug.batches?.[0]?.id,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      saleId: pendingSale.id,
      amount: 2875,
      method: 'CHAPA',
      status: 'PENDING',
      chapaTxRef: `tx-pending-${Date.now()}`,
      paymentLink: 'https://checkout.chapa.co/payment-link',
    },
  });

  // Create a prescription linked to first completed sale
  if (sales.length === 0) throw new Error('No sales created for prescription');
  await prisma.prescription.create({
    data: {
      prescriptionNumber: `RX-${Date.now()}`,
      saleId: sales[0].id,
      patientName: 'Patient Demo',
      patientAge: 45,
      patientGender: 'Male',
      doctorName: 'Dr. Tadesse',
      doctorLicense: 'MED12345',
      diagnosis: 'Hypertension',
      issueDate: subDays(new Date(), 10),
      expiryDate: addDays(new Date(), 20),
      isDispensed: true,
      prescriptionItems: {
        create: [
          {
            drugId: drugs[3]?.id ?? drugs[0].id,
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '30 days',
            instructions: 'Take in the morning',
            quantity: 30,
            isDispensed: true,
          },
        ],
      },
    },
  });

  // Create notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: users[0].id,
        title: 'Low Stock Alert',
        message: 'Amoxicillin is below minimum stock level',
        type: 'WARNING',
        link: `/dashboard/drugs/${drugs[0]?.id ?? ''}`,
      },
      {
        userId: users[0].id,
        title: 'Expiring Soon',
        message: 'Batch BATCH-1234 of Ibuprofen expires in 15 days',
        type: 'WARNING',
      },
      {
        userId: users[1].id,
        title: 'New Purchase Order',
        message: 'Purchase order PO-12345 has been received',
        type: 'INFO',
      },
      {
        userId: users[2].id,
        title: 'System Update',
        message: 'System maintenance scheduled for tonight',
        type: 'INFO',
      },
    ],
  });

  // Create expenses
  await prisma.expense.createMany({
    data: [
      {
        category: 'RENT',
        description: 'Monthly rent for January',
        amount: 15000,
        date: subDays(new Date(), 15),
        approvedBy: users[0].id,
      },
      {
        category: 'UTILITIES',
        description: 'Electricity and water bill',
        amount: 3500,
        date: subDays(new Date(), 10),
      },
      {
        category: 'SALARY',
        description: 'Staff salaries for January',
        amount: 45000,
        date: subDays(new Date(), 5),
        approvedBy: users[0].id,
      },
      {
        category: 'MAINTENANCE',
        description: 'Air conditioning repair',
        amount: 1200,
        date: subDays(new Date(), 7),
      },
    ],
  });

  // Create audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: users[0].id,
        action: 'LOGIN',
        entity: 'User',
        entityId: users[0].id,
        ipAddress: '127.0.0.1',
        userAgent: 'Seed script',
      },
      {
        userId: users[1].id,
        action: 'CREATE',
        entity: 'Sale',
        entityId: sales[0]?.id ?? '',
        newData: sales[0],
      },
    ],
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });