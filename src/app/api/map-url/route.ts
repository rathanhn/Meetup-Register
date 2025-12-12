
import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LocationSettings } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.error('Google Places API key is missing.');
    return NextResponse.json(
      { error: 'Server configuration error: Missing API key.' },
      { status: 500 }
    );
  }

  try {
    const locationDoc = await getDoc(doc(db, 'settings', 'route'));
    const locationData = locationDoc.data() as LocationSettings | undefined;
    
    const origin = locationData?.origin || "City Hall";
    const destination = locationData?.destination || "Central Park";

    const mapSrc = `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    const viewMapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    
    return NextResponse.json({ origin, destination, mapSrc, viewMapUrl });

  } catch (error) {
    console.error('Error fetching location or building map URL:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
