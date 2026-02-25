import { Sidebar } from "@/app/components/dashboard/SideBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/20">{children}</main>
    </div>
  );
}