
"use client";

import { useState, useEffect } from 'react';
import { onSnapshot, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EventSettings, LocationSettings } from '@/lib/types';

interface CombinedSettings extends EventSettings, LocationSettings {
    originShort?: string;
}

export function useEventSettings() {
    const [settings, setSettings] = useState<CombinedSettings>({
        startTime: new Date(),
        registrationsOpen: true,
        origin: '',
        destination: '',
        originShort: '',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controllers: (()=>void)[] = [];

        const fetchSettings = () => {
            try {
                const eventDocRef = doc(db, 'settings', 'event');
                const unsubEvent = onSnapshot(eventDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data() as EventSettings;
                        const startTime = data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime);
                        setSettings(prev => ({ ...prev, ...data, startTime }));
                    }
                });
                controllers.push(unsubEvent);
                
                const routeDocRef = doc(db, 'settings', 'route');
                const unsubRoute = onSnapshot(routeDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data() as LocationSettings;
                        const originShort = data.origin?.split(',')[0]?.trim();
                        setSettings(prev => ({ ...prev, ...data, originShort }));
                    }
                });
                controllers.push(unsubRoute);

            } catch (err) {
                 setError('Failed to load settings.');
                 console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
        
        return () => {
            controllers.forEach(unsub => unsub());
        };
    }, []);

    return { settings, loading, error };
}
