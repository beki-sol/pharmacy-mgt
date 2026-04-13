"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/app/lib/utils";
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Key,
  Home,
  Truck,
  Wallet,
  ClipboardCheck,
  AlertCircle,
  Bell,
  User,
  Tags, // ← import Tags icon for categories
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/app/components/ui/Button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Drugs", href: "/dashboard/drugs", icon: Pill },
  { name: "Sales", href: "/dashboard/sales", icon: ShoppingCart },
  { name: "Inventory", href: "/dashboard/inventory", icon: Package },
  { name: "Suppliers", href: "/dashboard/suppliers", icon: Truck },
  { name: "Categories", href: "/dashboard/categories", icon: Tags }, // ← new entry
  { name: "Prescriptions", href: "/dashboard/prescriptions", icon: ClipboardCheck },
  { name: "Users", href: "/dashboard/admin/users", icon: Users },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Alerts", href: "/dashboard/alerts", icon: AlertCircle },
  { name: "Expenses", href: "/dashboard/expenses", icon: Wallet },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "License", href: "/dashboard/admin/license", icon: Key }
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-gray-900 text-white transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Pill className="h-8 w-8 text-blue-400" />
            <span className="text-xl font-bold">PharmaInventory</span>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex justify-center">
            <Pill className="h-8 w-8 text-blue-400" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white hover:bg-gray-800 rounded p-1"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-gray-800">
        {!collapsed ? (
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
              <p className="text-xs text-blue-400 capitalize">
                {session?.user?.role?.toLowerCase().replace("_", " ")}
              </p>
            </div>
            <Link href="/dashboard/notifications" className="relative">
              <Bell className="h-5 w-5 text-gray-400 hover:text-white" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs flex items-center justify-center">3</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <Link href="/dashboard/notifications" className="relative">
              <Bell className="h-5 w-5 text-gray-400" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs flex items-center justify-center">3</span>
            </Link>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white",
                collapsed ? "justify-center" : ""
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className={cn("h-5 w-5", collapsed ? "" : "mr-3")} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className={cn(
            "flex items-center w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white",
            collapsed ? "justify-center" : ""
          )}
        >
          <LogOut className={cn("h-5 w-5", collapsed ? "" : "mr-3")} />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </aside>
  );
}