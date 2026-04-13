"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import toast from "react-hot-toast";

export default function LicenseAdminPage() {
  const [loading, setLoading] = useState(false);

  const resetTrial = async () => {
    if (!confirm("Reset trial period? This will set the installation date to now.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-trial", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      toast.success("Trial reset successfully");
    } catch (error) {
      toast.error("Failed to reset trial");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>License Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={resetTrial} disabled={loading} variant="destructive">
            Reset Trial Period
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}