
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
    // Cast to avoid implicit incompatibility
    const eventSettingsRef = useMemoFirebase(() => doc(db, 'settings', 'event') as any as import('firebase/firestore').DocumentReference<EventSettings>, []);
    const { data: eventSettingsData, loading: eventLoading, error: eventError } = useDoc<EventSettings>(eventSettingsRef);

    const routeSettingsRef = useMemoFirebase(() => doc(db, 'settings', 'route') as any as import('firebase/firestore').DocumentReference<LocationSettings>, []);
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

            // 1. Merge Route Settings first (so Event settings can override)
            if (routeSettingsData) {
                const derivedOriginShort = routeSettingsData.origin?.split(',')[0]?.trimEnd();
                Object.assign(newSettings, { ...routeSettingsData, originShort: derivedOriginShort });
            }

            // 2. Merge Event Settings (overrides route settings)
            if (eventSettingsData) {
                const startTime = eventSettingsData.startTime instanceof Timestamp
                    ? eventSettingsData.startTime.toDate()
                    : new Date(eventSettingsData.startTime || Date.now());

                // Only override originShort if it is explicitly set in eventSettingsData
                const manualOriginShort = eventSettingsData.originShort;

                Object.assign(newSettings, {
                    ...eventSettingsData,
                    startTime,
                    // Prefer manual override, fallback to derived (from step 1), fallback to ''
                    originShort: manualOriginShort || newSettings.originShort || ''
                });
            }

            return newSettings;
        });
    }, [eventSettingsData, routeSettingsData]);

    return { settings, loading, error: error ? "Failed to load settings." : null };
}
