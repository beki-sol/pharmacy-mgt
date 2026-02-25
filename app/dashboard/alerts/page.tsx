"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { CheckCheck, Bell, AlertTriangle, Info, AlertCircle } from "lucide-react";
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
}

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  useEffect(() => {
    fetchNotifications();
  }, [pagination.page]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?page=${pagination.page}&limit=${pagination.limit}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (error) {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
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
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success("All marked as read");
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  const getIcon = (type: string) => {
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
                <p>No notifications</p>
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
                    {getIcon(notif.type)}
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