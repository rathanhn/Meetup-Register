
"use client";

import { useState, useEffect } from 'react';
import { doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EventSettings, LocationSettings } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/memo';

interface CombinedSettings extends EventSettings, LocationSettings {
    originShort?: string;
}

export function useEventSettings() {
    const eventSettingsRef = useMemoFirebase(() => doc(db, 'settings', 'event'), []);
    const { data: eventSettingsData, loading: eventLoading, error: eventError } = useDoc<EventSettings>(eventSettingsRef);

    const routeSettingsRef = useMemoFirebase(() => doc(db, 'settings', 'route'), []);
    const { data: routeSettingsData, loading: routeLoading, error: routeError } = useDoc<LocationSettings>(routeSettingsRef);

    const [settings, setSettings] = useState<CombinedSettings>({
        startTime: new Date(),
        registrationsOpen: true,
        origin: '',
        destination: '',
        originShort: '',
    });

    const loading = eventLoading || routeLoading;
    const error = eventError || routeError;

    useEffect(() => {
        setSettings(prev => {
            const newSettings = { ...prev };
            if (eventSettingsData) {
                const startTime = eventSettingsData.startTime instanceof Timestamp 
                    ? eventSettingsData.startTime.toDate() 
                    : new Date(eventSettingsData.startTime || Date.now());
                Object.assign(newSettings, { ...eventSettingsData, startTime });
            }
            if (routeSettingsData) {
                const originShort = routeSettingsData.origin?.split(',')[0]?.trimEnd();
                Object.assign(newSettings, { ...routeSettingsData, originShort });
            }
            return newSettings;
        });
    }, [eventSettingsData, routeSettingsData]);

    return { settings, loading, error: error ? "Failed to load settings." : null };
}
