"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Switch } from "@/app/components/ui/Switch";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const profileSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfileSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });
  const twoFactorEnabled = watch("twoFactorEnabled");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/users/profile");
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        reset({
          name: data.name,
          phone: data.phone || "",
          twoFactorEnabled: data.twoFactorEnabled,
        });
      } catch (error) {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [reset]);

  const onSubmit = async (data: ProfileForm) => {
    setSaving(true);
    try {
      const payload: any = {
        name: data.name,
        phone: data.phone,
        twoFactorEnabled: data.twoFactorEnabled,
      };
      // Only send password fields if newPassword is provided and non-empty
      if (data.newPassword && data.newPassword.trim() !== "") {
        payload.newPassword = data.newPassword;
        payload.currentPassword = data.currentPassword;
      }
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Update failed");
      toast.success("Profile updated");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" {...register("phone")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Change your password or enable two-factor authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password (required to change password)</Label>
            <Input id="currentPassword" type="password" {...register("currentPassword")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password (min 6 characters, leave blank to keep current)</Label>
            <Input id="newPassword" type="password" {...register("newPassword")} />
            {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="twoFactorEnabled"
              checked={twoFactorEnabled}
              onCheckedChange={(checked) => setValue("twoFactorEnabled", checked)}
            />
            <Label htmlFor="twoFactorEnabled">Enable Two-Factor Authentication</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}