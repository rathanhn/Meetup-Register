
"use client";

import { ScheduleManager } from "./schedule-manager";
import { OrganizerManager } from "./organizer-manager";
import { PromotionManager } from "./promotion-manager";
import { LocationManager } from "./location-manager";
import { EventTimeManager } from "./event-time-manager";
import { GeneralSettingsManager } from "@/components/admin/general-settings-manager";
import { LocationPartnerManager } from "./location-partner-manager";
import { FaqManager } from "./faq-manager";
import { HomepageContentManager } from "./homepage-content-manager";
import { HomepageVisibilityManager } from "./homepage-visibility-manager";


export default function ContentManagement() {
  return (
    <div className="space-y-8">
        <GeneralSettingsManager />
        <HomepageVisibilityManager />
        <HomepageContentManager />
        <ScheduleManager />
        <OrganizerManager />
        <LocationPartnerManager />
        <PromotionManager />
        <FaqManager />
        <LocationManager />
        <EventTimeManager />
    </div>
  );
}
