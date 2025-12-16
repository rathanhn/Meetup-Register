"use client";
import { ThemeToggle } from "./theme-toggle";
import Link from "next/link";
import { AuthButton } from "./auth-button";
import { useEventSettings } from "@/hooks/use-event-settings";
import { Bike, Code, Globe, Mail, Instagram, Phone, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Code className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">Developer Profile</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4 py-4">
                <Avatar className="h-24 w-24 border-4 border-primary/10">
                  <AvatarImage src={settings?.developerPhotoUrl} alt={settings?.developerName} />
                  <AvatarFallback><UserIcon className="h-12 w-12 text-muted-foreground/50" /></AvatarFallback>
                </Avatar>

                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold">{settings?.developerName || "Rathan.dev"}</h3>
                  {settings?.developerCompany && <p className="text-sm text-muted-foreground">{settings.developerCompany}</p>}
                </div>

                <div className="grid grid-cols-1 gap-3 w-full max-w-sm mt-4">
                  {settings?.developerWebsite && (
                    <Button variant="outline" className="w-full justify-start gap-3" asChild>
                      <Link href={settings.developerWebsite} target="_blank">
                        <Globe className="w-4 h-4 text-primary" />
                        <span>Website</span>
                      </Link>
                    </Button>
                  )}
                  {settings?.developerInstagram && (
                    <Button variant="outline" className="w-full justify-start gap-3" asChild>
                      <Link href={`https://instagram.com/${settings.developerInstagram.replace('@', '')}`} target="_blank">
                        <Instagram className="w-4 h-4 text-pink-500" />
                        <span>Instagram</span>
                      </Link>
                    </Button>
                  )}
                  {settings?.developerEmail && (
                    <Button variant="outline" className="w-full justify-start gap-3" asChild>
                      <Link href={`mailto:${settings.developerEmail}`}>
                        <Mail className="w-4 h-4 text-blue-500" />
                        <span>Email</span>
                      </Link>
                    </Button>
                  )}
                  {settings?.developerContact && (
                    <Button variant="outline" className="w-full justify-start gap-3" asChild>
                      <Link href={`tel:${settings.developerContact}`}>
                        <Phone className="w-4 h-4 text-green-500" />
                        <span>Contact</span>
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <AuthButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
