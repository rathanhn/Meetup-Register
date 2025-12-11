

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  createdAt: any;
}

export interface Announcement {
  id: string; // Document ID from Firestore
  message: string;
  createdAt: any; // Firestore timestamp
  adminId: string;
  adminName: string;
  adminRole: UserRole;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  validity: string;
  imageUrl: string;
  imageHint: string;
  actualPrice?: number;
  offerPrice?: number;
  createdAt: any; // Firestore timestamp
}

export interface Organizer {
  id:string;
  name: string;
  role: string;
  imageUrl: string;
  imageHint: string;
  contactNumber?: string;
  createdAt: any; // Firestore timestamp
}

export interface LocationPartner {
  id: string;
  name: string;
  imageUrl: string;
  imageHint: string;
  websiteUrl?: string;
  createdAt: any; // Firestore timestamp
}

export interface Perk {
  title: string;
  description: string;
  icon: string;
}

export interface ScheduleEvent {
    id: string;
    time: string;
    title: string;
    description: string;
    icon: string;
    createdAt: any; // Firestore timestamp
}

export interface LocationSettings {
  origin: string;
  destination: string;
}

export interface EventSettings {
  startTime: any; // Firestore timestamp
  registrationsOpen?: boolean;
  // Homepage content settings
  showSchedule?: boolean;
  showReviews?: boolean;
  showOrganizers?: boolean;
  showPromotions?: boolean;
  heroTitle?: string;
  heroDescription?: string;
  heroImageUrl?: string;
  heroImageHint?: string;
  perk1Title?: string;
  perk1Description?: string;
  perk2Title?: string;
  perk2Description?: string;
  perk3Title?: string;
  perk3Description?: string;
}


export interface Registration {
    id: string;
    registrationType: 'bike' | 'jeep' | 'car';
    fullName: string;
    age: number;
    phoneNumber: string;
    whatsappNumber?: string;
    photoURL?: string;
    createdAt: any; // Firestore timestamp
    status: 'pending' | 'approved' | 'rejected' | 'cancellation_requested' | 'cancelled';
    rider1CheckedIn?: boolean;
    rider1Finished?: boolean;
    certificateGranted?: boolean;
    cancellationReason?: string;
    statusLastUpdatedAt?: any; // Firestore timestamp
    statusLastUpdatedBy?: string; // Admin User ID
}

export interface QnaQuestion {
    id: string;
    text: string;
    userId: string;
    userName: string;
    userPhotoURL?: string | null;
    createdAt: any; // Firestore timestamp
    isPinned?: boolean;
}

export interface QnaReply {
    id: string;
    text: string;
    userId: string;
    userName:string;
    userPhotoURL?: string | null;
    createdAt: any; // Firestore timestamp
    isAdmin?: boolean;
}

export type UserRole = 'superadmin' | 'admin' | 'viewer' | 'user';

export interface AppUser {
    id: string; // Corresponds to Firebase Auth UID
    email?: string;
    displayName?: string;
    photoURL?: string;
    role: UserRole;
    createdAt: any; // Firestore timestamp
    accessRequest?: {
        requestedAt: any;
        status: 'pending_review' | 'approved' | 'rejected';
    };
}
