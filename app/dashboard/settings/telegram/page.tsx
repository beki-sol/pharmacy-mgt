"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Alert, AlertDescription } from "@/app/components/ui/Alert";
import { Label } from "@/app/components/ui/Label";
import { CheckCircle } from "lucide-react";

export default function TelegramSettings() {
  const { data: session, update } = useSession();
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Fetch current telegram chat ID
    const fetchTelegramChatId = async () => {
      const res = await fetch("/api/user/telegram");
      const data = await res.json();
      setChatId(data.telegramChatId || "");
    };
    fetchTelegramChatId();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: chatId }),
      });
      if (res.ok) {
        setMessage("Telegram chat ID saved successfully!");
        await update(); // refresh session if needed
      } else {
        const error = await res.json();
        setMessage(error.error || "Failed to save");
      }
    } catch (error) {
      setMessage("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Telegram Notifications</CardTitle>
          <CardDescription>
            Link your Telegram account to receive alerts and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chatId">Telegram Chat ID</Label>
            <Input
              id="chatId"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g., 123456789"
            />
            <p className="text-xs text-muted-foreground">
              To get your chat ID, send a message to the bot and check <code>getUpdates</code>.
            </p>
          </div>
          {message && (
            <Alert variant={message.includes("success") ? "default" : "destructive"}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleSave} loading={loading} className="w-full">
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}