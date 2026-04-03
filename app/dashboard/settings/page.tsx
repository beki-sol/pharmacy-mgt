"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/Tabs";
import { Header } from "@/app/components/dashboard/Header";
import ProfileSettings from "@/app/components/ProfileSettings";
import TelegramSettings from "./telegram/page"; // your existing component

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" subtitle="Manage your account and preferences" />
      <div className="p-6">
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="telegram">Telegram</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>
          <TabsContent value="telegram">
            <TelegramSettings />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}