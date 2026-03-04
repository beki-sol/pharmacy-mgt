🏥 Pharmacy Management System

A full-stack Pharmacy Management System built with:

⚡ Next.js

🧬 Prisma ORM

🐘 PostgreSQL

🔐 NextAuth Authentication

📦 Installation

Clone the repository and install dependencies:

npm install
🔐 Environment Variables Setup

Create a .env file in the root of the project and add the following:

# ==============================
# Database Configuration
# ==============================
DATABASE_URL="postgresql://<db_user>:<db_password>@localhost:5432/<db_name>"

# ==============================
# Authentication (NextAuth)
# ==============================
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<your_generated_secret>"

# ==============================
# Security
# ==============================
SALTROUNDS=12

# ==============================
# Application URL
# ==============================
APP_URL="http://localhost:3000"
🗄️ Database Configuration

Replace the placeholders with your actual PostgreSQL credentials:

<db_user> → Your PostgreSQL username

<db_password> → Your PostgreSQL password

<db_name> → Your database name

Example:

DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/pharmacy_db"
🔑 Generate a Secure NEXTAUTH_SECRET (Linux)

Run the following command in your Linux terminal:

openssl rand -base64 32

Copy the generated value and paste it into your .env file:

NEXTAUTH_SECRET="generated_secret_here"
🧬 Prisma Setup

This project uses Prisma as the ORM for database management.

1️⃣ Initialize Prisma (If Needed)
npx prisma init

This creates:

prisma/schema.prisma

.env (if not already created)

2️⃣ Run Database Migrations

After configuring DATABASE_URL, run:

npx prisma migrate dev --name init

This will:

Create migration files

Apply migrations to the database

Generate Prisma Client

3️⃣ Generate Prisma Client (If Schema Changes)
npx prisma generate
4️⃣ Push Schema Without Migration (Optional)

If you want to sync schema directly without migration history:

npx prisma db push
5️⃣ Seed the Database (If Configured)
npx prisma db seed
🚀 Running the Application

Start the development server:

npm run dev

Application will be available at:

http://localhost:3000
🗄 Database Backup & Restore (PostgreSQL)
📦 Creating a Backup (.sql file)
Option 1: Using pgAdmin

Open pgAdmin

Right-click your database (e.g., pharmacy_db)

Click Backup

Choose:

Format: Plain

Filename: pharmacy_db.sql

Click Backup

The backup file will contain:

Database schema

Tables

Data

Indexes

Constraints

🔄 Restoring a .sql Backup File
Option 1: Using pgAdmin

Open pgAdmin

Create a new empty database

Right-click Databases → Create → Database

Select the new database

Click Tools → Query Tool

Click the Open File (📂) icon

Select your pharmacy_db.sql file

Click Execute (▶)

The database will be fully restored.

Option 2: Using Command Line (Recommended / Professional)

If your backup file is located at:

C:\Users\YourName\Desktop\pharmacy_db.sql

Run:

psql -U postgres -d new_database_name -f "C:\Users\YourName\Desktop\pharmacy_db.sql"

Example:

psql -U postgres -d pharmacy_db_restored -f "C:\Users\YourName\Desktop\pharmacy_db.sql"