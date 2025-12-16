"use client";
import { ThemeToggle } from "./theme-toggle";
import Link from "next/link";
import { AuthButton } from "./auth-button";
import { useEventSettings } from "@/hooks/use-event-settings";
import { Bike } from "lucide-react";

export function Header() {
  const { settings } = useEventSettings();
  const title = settings?.headerTitle || "RideRegister";
  const logoUrl = settings?.headerLogoUrl;

  return (
    <header className="bg-card shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-full" />
          ) : (
            <div className="p-2 bg-primary/10 rounded-full">
              <Bike className="w-6 h-6 text-primary" />
            </div>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-primary font-headline">
            {title}
          </h1>
        </Link>
        <div className="flex items-center gap-4">
          <AuthButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
