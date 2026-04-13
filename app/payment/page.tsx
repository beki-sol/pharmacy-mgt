/*"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { AlertTriangle, Key } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function PaymentPage() {
  const [secret, setSecret] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!secret) {
      toast.error("Please enter the reset key");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      toast.success("Trial reset! You can now log in.");
      // Reload the page to redirect to login
      window.location.href = "/auth/login";
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Trial Expired</CardTitle>
          <CardDescription>
            Your trial period has ended. Please purchase a license to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold">Payment Instructions</p>
            <p className="text-sm mt-2">
              Contact us at <strong>sales@pharmacy.com</strong> or call <strong>+251 911 123 456</strong> to complete your payment.
            </p>
            <p className="text-sm mt-2">After payment, you will receive a reset key.</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Already paid? Enter your reset key:</p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Reset key"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleReset} disabled={resetting} variant="outline">
                <Key className="mr-2 h-4 w-4" />
                {resetting ? "Resetting..." : "Reset"}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/auth/login">Return to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}*/

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { AlertTriangle, Key } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function PaymentPage() {
  const [secret, setSecret] = useState("");
  const [resetting, setResetting] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLicense = async () => {
      try {
        const res = await fetch("/api/license");
        const data = await res.json();
        setDaysLeft(data.daysLeft);
      } catch (error) {
        console.error("Failed to load license info", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLicense();
  }, []);

  const handleReset = async () => {
    if (!secret) {
      toast.error("Please enter the reset key");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      toast.success("Trial reset! You can now log in.");
      window.location.href = "/auth/login";
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Trial Expired</CardTitle>
          <CardDescription>
            {daysLeft !== null && daysLeft > 0
              ? `Your trial has ${daysLeft} day(s) remaining.`
              : "Your trial period has ended."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            To continue using the Pharmacy Inventory System, please purchase a license.
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold">Payment Instructions</p>
            <p className="text-sm mt-2">
              Contact us at <strong>sales@pharmacy.com</strong> or call <strong>+251 911 123 456</strong> to complete your payment.
            </p>
            <p className="text-sm mt-2">After payment, you will receive a reset key.</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Already paid? Enter your reset key:</p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Reset key"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleReset} disabled={resetting} variant="outline">
                <Key className="mr-2 h-4 w-4" />
                {resetting ? "Resetting..." : "Reset"}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/auth/login">Return to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}