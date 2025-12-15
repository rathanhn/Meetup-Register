"use client";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import Logo from "@/Logo.png";
import Link from "next/link";
import { AuthButton } from "./auth-button";
import { useEventSettings } from "@/hooks/use-event-settings";

export function Header() {
  const { settings } = useEventSettings();
  const title = settings?.headerTitle || "RideRegister";
  const logoSrc = settings?.headerLogoUrl || Logo;

  return (
    <header className="bg-card shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          {typeof logoSrc === 'string' ? (
            <img src={logoSrc} alt="Logo" className="w-10 h-10 object-contain rounded-full" />
          ) : (
            <Image src={logoSrc} alt="TeleFun Mobile Logo" width={40} height={40} className="rounded-full" />
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
