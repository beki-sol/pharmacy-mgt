"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Alert, AlertDescription } from "@/app/components/ui/Alert";
import { Label } from "@/app/components/ui/Label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/Tabs";
import { Separator } from "@/app/components/ui/Separator";
import { Badge } from "@/app/components/ui/Badge";
import { Shield, Smartphone, QrCode, Key, CheckCircle, AlertCircle } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

export default function SecurityPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUrl: string;
    otpauthUrl: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => {
    fetchTwoFactorStatus();
  }, []);

  const fetchTwoFactorStatus = async () => {
    try {
      const res = await fetch("/api/auth/two-factor");
      const data = await res.json();
      setTwoFactorEnabled(data.twoFactorEnabled);
    } catch (error) {
      console.error("Failed to fetch 2FA status:", error);
    }
  };

  const handleEnable2FA = async () => {
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup",
          password: currentPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to setup 2FA");
      }

      setSetupData(data);
      setCurrentPassword("");
      toast.success("2FA setup initiated. Scan the QR code with your authenticator app.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode) {
      toast.error("Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          code: verificationCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setTwoFactorEnabled(true);
      setSetupData(null);
      setVerificationCode("");
      toast.success("Two-factor authentication enabled successfully");
      
      // Update session to reflect 2FA enabled
      await update();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!currentPassword || !disableCode) {
      toast.error("Please enter your password and 2FA code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disable",
          password: currentPassword,
          code: disableCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to disable 2FA");
      }

      setTwoFactorEnabled(false);
      setCurrentPassword("");
      setDisableCode("");
      toast.success("Two-factor authentication disabled");
      
      // Update session
      await update();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelSetup = () => {
    setSetupData(null);
    setVerificationCode("");
    setCurrentPassword("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Security Settings"
        subtitle="Manage your account security and two-factor authentication"
      />

      <main className="p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 2FA Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="h-6 w-6 text-blue-600" />
                  <CardTitle>Two-Factor Authentication</CardTitle>
                </div>
                <Badge variant={twoFactorEnabled ? "success" : "secondary"}>
                  {twoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <CardDescription>
                Add an extra layer of security to your account. Once enabled, you&apos;ll need to enter a verification code from your authenticator app when signing in.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {!twoFactorEnabled && !setupData && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Smartphone className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Ready to enhance your security?</p>
                        <p className="mt-1">
                          Enable two-factor authentication to protect your account from unauthorized access.
                          You&apos;ll need an authenticator app like Google Authenticator or Authy.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                    />
                  </div>

                  <Button
                    onClick={handleEnable2FA}
                    loading={loading}
                    className="w-full"
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Enable Two-Factor Authentication
                  </Button>
                </div>
              )}

              {setupData && (
                <div className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Scan this QR code with your authenticator app. After scanning, enter the 6-digit code below to verify.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-lg border">
                      <Image
                        src={setupData.qrCodeUrl}
                        alt="2FA QR Code"
                        width={200}
                        height={200}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Can&apos;t scan the QR code? Use this secret key:
                    </p>
                    <div className="flex items-center space-x-2">
                      <code className="bg-gray-100 px-3 py-2 rounded text-sm font-mono flex-1">
                        {setupData.secret}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(setupData.secret);
                          toast.success("Secret copied to clipboard");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <Input
                      id="verification-code"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleVerify2FA}
                      loading={loading}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify and Enable
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelSetup}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {twoFactorEnabled && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="text-sm text-green-800">
                        <p className="font-medium">Two-factor authentication is enabled</p>
                        <p className="mt-1">
                          Your account is protected with an extra layer of security.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Disable Two-Factor Authentication</h3>
                    <div className="space-y-2">
                      <Label htmlFor="disable-password">Current Password</Label>
                      <Input
                        id="disable-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disable-code">2FA Verification Code</Label>
                      <Input
                        id="disable-code"
                        type="text"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleDisable2FA}
                      loading={loading}
                    >
                      Disable Two-Factor Authentication
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Other Security Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Key className="h-6 w-6 text-blue-600" />
                <CardTitle>Password & Authentication</CardTitle>
              </div>
              <CardDescription>
                Update your password and manage other authentication methods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="password">
                <TabsList className="mb-4">
                  <TabsTrigger value="password">Change Password</TabsTrigger>
                  <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
                </TabsList>

                <TabsContent value="password">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current">Current Password</Label>
                      <Input id="current" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new">New Password</Label>
                      <Input id="new" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm">Confirm New Password</Label>
                      <Input id="confirm" type="password" />
                    </div>
                    <Button>Update Password</Button>
                  </div>
                </TabsContent>

                <TabsContent value="sessions">
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                      You are currently signed in on these devices:
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Current Session</p>
                          <p className="text-sm text-gray-500">
                            Chrome on Windows • IP: 192.168.1.1
                          </p>
                        </div>
                        <Badge>Active</Badge>
                      </div>
                    </div>
                    <Button variant="outline">Sign Out All Other Sessions</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}