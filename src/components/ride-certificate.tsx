
"use client";

import React from 'react';
import Image from 'next/image';
import Logo from '@/Logo.png';
import { format } from 'date-fns';
import { User } from 'lucide-react';

interface RideCertificateProps {
  riderName: string;
  riderPhotoUrl?: string;
  registrationId: string;
  origin: string;
  settings?: any; // To avoid circular deps for now, or import EventSettings
}

const generateQrCodeUrl = (text: string) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(text)}&qzone=1&margin=0`;
}

export const RideCertificate = React.forwardRef<HTMLDivElement, RideCertificateProps>(
  ({ riderName, riderPhotoUrl, registrationId, origin, settings }, ref) => {
    const eventDate = settings?.startTime
      ? format(new Date(settings.startTime), "do 'of' MMMM yyyy")
      : format(new Date(), "do 'of' MMMM yyyy");
    const verificationUrl = origin ? `${origin}/ticket/${registrationId}` : '';
    const qrCodeUrl = verificationUrl ? generateQrCodeUrl(verificationUrl) : '';

    const title = settings?.certificateTitle || "Certificate of Completion";
    const subTitle = settings?.certificateSubtitle || "the Annual Community Bike Ride"; // added 'the' as prefix or allow user to type it
    // If settings has 'the', don't double it. But 'Annual...' usually needs 'the'. 
    // Let's assume user types full event name. The text below hardcodes "for successfully completing the".
    // "for successfully completing the [Annual Community Bike Ride]"

    // Logic for logo: if settings.logoUrl exists, use it. Else use default Logo.
    const logoSrc = settings?.certificateLogoUrl || Logo;

    const signatoryName = settings?.certificateSignatoryName || "RideRegister Team";
    const signatoryRole = settings?.certificateSignatoryRole || "Event Organizer";

    return (
      <div
        id="certificate"
        ref={ref}
        className="w-[1123px] h-[794px] bg-gradient-to-r from-primary via-white to-primary/30 p-2"
        style={{ fontFamily: "'Garamond', 'serif'" }}
      >
        <div className="w-full h-full p-6 bg-black flex flex-col items-center justify-between text-center relative">

          <div className="w-full flex justify-between items-start absolute top-0 left-0 p-8">
            <div className="w-20 h-20 border-t-4 border-l-4 border-primary"></div>
            <div className="w-20 h-20 border-t-4 border-r-4 border-primary"></div>
          </div>

          <div className="flex-grow flex flex-col items-center justify-center">
            <div className="block mx-auto">
              {/* Use img for external URLs to avoid Next.Image host config issues if users upload anywhere */}
              {typeof logoSrc === 'string' ? (
                <img src={logoSrc} alt="Event Logo" className="w-20 h-20 object-contain rounded-full" />
              ) : (
                <Image
                  src={logoSrc}
                  alt="Event Logo"
                  width={80}
                  height={80}
                  className="rounded-full"
                  priority
                />
              )}
            </div>

            <h1 className="text-5xl font-bold text-primary mt-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              {title}
            </h1>

            <p className="mt-6 text-lg text-gray-300">This certificate is proudly presented to</p>

            <div className="h-40 w-40 rounded-full border-4 border-primary/50 my-6 flex items-center justify-center overflow-hidden bg-muted">
              {riderPhotoUrl ? (
                <img src={riderPhotoUrl} alt={riderName} className="h-full w-full object-cover" crossOrigin="anonymous" />
              ) : (
                <User className="w-20 h-20 text-muted-foreground" />
              )}
            </div>

            <div className="w-full max-w-lg text-center">
              <p className="text-6xl font-extrabold text-white pb-2" style={{ fontFamily: "'Dancing Script', cursive" }}>
                {riderName || "Honorable Rider"}
              </p>
              <div className="h-[2px] bg-primary w-full"></div>
            </div>

            <p className="text-lg max-w-2xl text-gray-300 mt-6">
              for successfully completing <strong>{subTitle}</strong>.
              Your participation and spirit have made this event a grand success.
            </p>
          </div>

          <div className="w-full flex justify-between items-end absolute bottom-0 left-0 p-8">
            <div className="w-20 h-20 border-b-4 border-l-4 border-primary"></div>
            {qrCodeUrl && (
              <div className="bg-white p-1 rounded-sm">
                <img
                  src={qrCodeUrl}
                  alt="Verification QR Code"
                  width={100}
                  height={100}
                />
              </div>
            )}
            <div className="w-20 h-20 border-b-4 border-r-4 border-primary"></div>
          </div>

          <div className="w-full flex justify-around max-w-3xl pb-4">
            <div className="text-center">
              <p className="text-xl font-semibold border-b-2 border-primary pb-1" style={{ fontFamily: "'Playfair Display', serif" }}>{signatoryRole}</p>
              <p className="text-sm mt-1 text-gray-400">{signatoryName}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold border-b-2 border-primary pb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Date of Event</p>
              <p className="text-sm mt-1 text-gray-400">{eventDate}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

RideCertificate.displayName = 'RideCertificate';
