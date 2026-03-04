"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { CheckCheck, Bell, AlertTriangle, Info, AlertCircle, Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  isRead: boolean;
  link?: string;
  createdAt: string;
  source?: "notification" | "expiry"; // to distinguish
}

interface ExpiringBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  remaining: number;
  drug: { name: string };
}

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expiring, setExpiring] = useState<ExpiringBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  useEffect(() => {
    fetchAllAlerts();
  }, [pagination.page]);

  const fetchAllAlerts = async () => {
    setLoading(true);
    try {
      // Fetch notifications
      const notifRes = await fetch(`/api/notifications?page=${pagination.page}&limit=${pagination.limit}`);
      const notifData = await notifRes.json();
      const fetchedNotifications = notifData.notifications || [];

      // Fetch expiring batches
      const expiringRes = await fetch("/api/inventory/expiring");
      const expiringData = await expiringRes.json();
      const fetchedExpiring = expiringData.expiring || [];

      // Convert expiring batches to alert format
      const expiryAlerts: Notification[] = fetchedExpiring.map((batch: ExpiringBatch) => {
        const daysLeft = Math.ceil(
          (new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24)
        );
        return {
          id: `expiry-${batch.id}`,
          title: "Batch Expiring Soon",
          message: `${batch.drug.name} – Batch ${batch.batchNumber} expires ${daysLeft < 0 ? "today" : `in ${daysLeft} days`}. Remaining: ${batch.remaining}`,
          type: daysLeft < 0 ? "ERROR" : "WARNING",
          isRead: false,
          createdAt: batch.expiryDate,
          source: "expiry",
        };
      });

      // Combine and sort by date (newest first)
      const combined = [...fetchedNotifications, ...expiryAlerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(combined);
      // Pagination: we'll just show all for now; you could paginate if needed
      setPagination(prev => ({ ...prev, total: combined.length, pages: Math.ceil(combined.length / prev.limit) }));
    } catch (error) {
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    // For expiry alerts, we just toggle locally (they are not stored in DB)
    if (id.startsWith("expiry-")) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      return;
    }
    // For real notifications, call API
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      toast.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    // Mark all notifications as read via API
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      // For expiry alerts, we mark them locally
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success("All marked as read");
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  const getIcon = (type: string, source?: string) => {
    if (source === "expiry") return <Package className="h-5 w-5 text-orange-500" />;
    switch (type) {
      case "WARNING": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "ERROR": return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "SUCCESS": return <CheckCheck className="h-5 w-5 text-green-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <>
      <Header
        title="Alerts & Notifications"
        actions={
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
        }
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No alerts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      notif.isRead ? "bg-muted/20" : "bg-muted"
                    }`}
                  >
                    {getIcon(notif.type, notif.source)}
                    <div className="flex-1">
                      <p className="font-medium">{notif.title}</p>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <Button variant="ghost" size="sm" onClick={() => markAsRead(notif.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}