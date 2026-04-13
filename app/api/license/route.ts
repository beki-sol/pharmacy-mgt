/*
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// ⚠️ Testing mode: 4 minutes (change back to 7 days later)
const TRIAL_MINUTES = 4; // Use minutes for testing

export async function GET() {
  try {
    // Get or create installation timestamp
    let result = await prisma.$queryRaw<{ value: string }[]>`
      SELECT value FROM "AppSetting" WHERE key = 'INSTALL_DATE' LIMIT 1
    `;

    let installDateStr: string;
    if (result.length === 0) {
      installDateStr = new Date().toISOString();
      await prisma.$executeRaw`
        INSERT INTO "AppSetting" (id, key, value, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'INSTALL_DATE', ${installDateStr}, NOW(), NOW())
      `;
    } else {
      installDateStr = result[0].value;
    }

    const installDate = new Date(installDateStr);
    const now = new Date();
    const minutesSinceInstall = Math.floor((now.getTime() - installDate.getTime()) / (1000 * 60));
    const isExpired = minutesSinceInstall >= TRIAL_MINUTES;

    return NextResponse.json({
      isExpired,
      minutesLeft: Math.max(0, TRIAL_MINUTES - minutesSinceInstall),
      installDate: installDate.toISOString(),
    });
  } catch (error) {
    console.error("License check error:", error);
    return NextResponse.json({ isExpired: true, error: "License check failed" }, { status: 500 });
  }
} */

  import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// Production: 7 days trial
const TRIAL_DAYS = 7;

export async function GET() {
  try {
    // Get or create installation timestamp
    let result = await prisma.$queryRaw<{ value: string }[]>`
      SELECT value FROM "AppSetting" WHERE key = 'INSTALL_DATE' LIMIT 1
    `;

    let installDateStr: string;
    if (result.length === 0) {
      installDateStr = new Date().toISOString();
      await prisma.$executeRaw`
        INSERT INTO "AppSetting" (id, key, value, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'INSTALL_DATE', ${installDateStr}, NOW(), NOW())
      `;
    } else {
      installDateStr = result[0].value;
    }

    const installDate = new Date(installDateStr);
    const now = new Date();
    const daysSinceInstall = Math.floor((now.getTime() - installDate.getTime()) / (1000 * 3600 * 24));
    const isExpired = daysSinceInstall >= TRIAL_DAYS;

    return NextResponse.json({
      isExpired,
      daysLeft: Math.max(0, TRIAL_DAYS - daysSinceInstall),
      installDate: installDate.toISOString(),
    });
  } catch (error) {
    console.error("License check error:", error);
    return NextResponse.json({ isExpired: true, error: "License check failed" }, { status: 500 });
  }
}