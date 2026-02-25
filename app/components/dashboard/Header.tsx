"use client";

import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Bell, Search } from "lucide-react";
import { format } from "date-fns";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  onSearch?: (value: string) => void;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, showSearch, onSearch, actions }: HeaderProps) {
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch?.(e.target.value);
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
      <div className="flex flex-1 items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {showSearch && (
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full pl-8"
              onChange={handleSearch}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden md:inline">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </span>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
            3
          </span>
        </Button>
        {actions}
      </div>
    </header>
  );
}