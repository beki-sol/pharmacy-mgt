/*import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    const expectedSecret = process.env.RESET_SECRET;
    if (!expectedSecret) {
      console.error("RESET_SECRET not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Trim and compare to avoid whitespace issues
    if (!secret || secret.trim() !== expectedSecret.trim()) {
      return NextResponse.json({ error: "Invalid reset key" }, { status: 401 });
    }

    // Delete the installation date – this resets the trial
    await prisma.$executeRaw`
      DELETE FROM "AppSetting" WHERE key = 'INSTALL_DATE'
    `;

    return NextResponse.json({ success: true, message: "Trial reset successfully" });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: "Failed to reset trial" }, { status: 500 });
  }
}*/

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    const expectedSecret = process.env.RESET_SECRET;
    if (!expectedSecret) {
      console.error("RESET_SECRET not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!secret || secret.trim() !== expectedSecret.trim()) {
      return NextResponse.json({ error: "Invalid reset key" }, { status: 401 });
    }

    // Delete the installation date – this resets the trial
    await prisma.$executeRaw`
      DELETE FROM "AppSetting" WHERE key = 'INSTALL_DATE'
    `;

    return NextResponse.json({ success: true, message: "Trial reset successfully" });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: "Failed to reset trial" }, { status: 500 });
  }
}
