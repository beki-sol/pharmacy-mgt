"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Alert, AlertDescription } from "@/app/components/ui/Alert";
import { Label } from "@/app/components/ui/Label";
import { Eye, EyeOff, Lock, Mail, Pill } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        twoFactorCode: data.twoFactorCode,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        // Check if the error indicates 2FA is required
        // The backend should return an error message containing "2FA code required"
        if (result.error.includes("2FA code required")) {
          // Store email temporarily (password is not stored for security)
          // Instead, we redirect to a 2FA page that will re-prompt for password or use a token
          // For simplicity, we'll pass email and callbackUrl
          router.push(
            `/auth/two-factor?email=${encodeURIComponent(data.email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
          );
        } else {
          setError(result.error);
        }
      } else if (result?.url) {
        // Successful login
        router.push(result.url);
      }
    } catch (error: any) {
      setError(error.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Pill className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Pharmacy Inventory</h1>
          <p className="text-gray-600 mt-2">Sign in to access your dashboard</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorParam === "CredentialsSignin" && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  Invalid email or password. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="pharmacist@example.com"
                    className="pl-10"
                    {...register("email")}
                    disabled={requires2FA}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    {...register("password")}
                    disabled={requires2FA}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              {requires2FA && (
                <div className="space-y-2">
                  <Label htmlFor="twoFactorCode">Two-Factor Authentication Code</Label>
                  <Input
                    id="twoFactorCode"
                    type="text"
                    placeholder="Enter 6-digit code"
                    {...register("twoFactorCode")}
                  />
                  <p className="text-sm text-gray-500">
                    Enter the code from your authenticator app
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="remember" className="text-sm text-gray-600">
                    Remember me
                  </label>
                </div>
                <Link
                  href="/auth/reset-password"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" loading={loading}>
                {requires2FA ? "Verify & Sign In" : "Sign In"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link href="/auth/register" className="text-blue-600 hover:text-blue-700">
                Contact administrator
              </Link>
            </div>
            <div className="w-full border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500 text-center">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </CardFooter>
        </Card>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-700 mb-2">Demo Credentials</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Admin:</span>
              <p>admin@pharmacy.com</p>
              <p>Admin@123</p>
            </div>
            <div>
              <span className="text-gray-500">Pharmacist:</span>
              <p>pharmacist@pharmacy.com</p>
              <p>Admin@123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}