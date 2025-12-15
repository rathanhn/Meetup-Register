
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Instagram } from "lucide-react";

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
)


import type { EventSettings } from "@/lib/types";

interface StoreDetailsProps {
  settings: EventSettings;
}

export function StoreDetails({ settings }: StoreDetailsProps) {
  // Use settings.sponsors array if available and not empty
  const sponsors = settings.sponsors && settings.sponsors.length > 0
    ? settings.sponsors
    // Fallback to singular fields if array is empty but singular image exists (backward compatibility)
    : (settings.sponsorImageUrl ? [{
      title: settings.sponsorTitle || "Sponsors / Collaborators",
      subtitle: settings.sponsorSubtitle || "",
      location: settings.sponsorLocation || "",
      description: settings.sponsorDescription || "",
      whatsappUrl: settings.sponsorWhatsapp || "",
      instagramUrl: settings.sponsorInstagram || "",
      imageUrl: settings.sponsorImageUrl
    }] : []);

  if (sponsors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Section Header if there are multiple sponsors, or just one if you prefer avoiding headers for single items */}
      {sponsors.length > 1 && (
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold font-headline">{settings.sponsorTitle || "Sponsors & Collaborators"}</h2>
        </div>
      )}

      {sponsors.map((sponsor, index) => (
        <Card key={index} className="overflow-hidden">
          <div className="flex flex-col md:flex-row h-full">
            {/* Left Side: Image */}
            <div className={`relative w-full md:w-1/2 h-64 md:h-auto min-h-[250px] bg-muted ${index % 2 === 1 ? 'md:order-2' : ''}`}>
              {sponsor.imageUrl ? (
                <Image
                  src={sponsor.imageUrl}
                  alt={sponsor.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image Available
                </div>
              )}
            </div>

            {/* Right Side: Content */}
            <div className="flex flex-col justify-center p-6 md:p-8 md:w-1/2 gap-6">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold font-headline mb-0.5 tracking-tight">
                  {sponsor.title}
                </h3>
                {(sponsor.subtitle || sponsor.location) && (
                  <div className="flex flex-wrap items-center gap-2 mb-3 text-sm font-medium text-primary">
                    {sponsor.subtitle && <span>{sponsor.subtitle}</span>}
                    {sponsor.subtitle && sponsor.location && <span>&bull;</span>}
                    {sponsor.location && <span className="uppercase tracking-wider">{sponsor.location}</span>}
                  </div>
                )}
                <p className="text-muted-foreground leading-relaxed mt-2 whitespace-pre-wrap">
                  {sponsor.description}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                {sponsor.whatsappUrl && (
                  <Button asChild className="flex-1 bg-green-500 hover:bg-green-600">
                    <Link href={sponsor.whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                    </Link>
                  </Button>
                )}
                {sponsor.instagramUrl && (
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={sponsor.instagramUrl} target="_blank" rel="noopener noreferrer">
                      <InstagramIcon className="mr-2 h-4 w-4" /> Instagram
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
