"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/Popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  unit: string;
  price: number;
  stock: number;
}

interface DrugSelectProps {
  value: string;
  onChange: (value: string, drug: Drug) => void;
  drugs: Drug[];
  error?: string;
  disabled?: boolean;
}

export function DrugSelect({
  value,
  onChange,
  drugs,
  error,
  disabled,
}: DrugSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedDrug = drugs.find((d) => d.id === value);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedDrug
              ? `${selectedDrug.name} (Stock: ${selectedDrug.stock})`
              : "Select drug..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search drug..." />
            <CommandEmpty>No drug found.</CommandEmpty>
            <CommandGroup>
              {drugs.map((drug) => (
                <CommandItem
                  key={drug.id}
                  value={drug.name} // This tells Command what text to search
                  onSelect={() => {
                    onChange(drug.id, drug);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === drug.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {drug.name} (Stock: {drug.stock})
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}