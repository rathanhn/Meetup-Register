
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

export interface StuntPerformer {
  id:string;
  name: string;
  role: string;
  imageUrl: string;
  imageHint: string;
  contactNumber?: string;
  createdAt: any; // Firestore timestamp
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
}

export interface Registration {
    id: string;
    registrationType: 'solo' | 'duo';
    fullName: string;
    age: number;
    phoneNumber: string;
    whatsappNumber?: string;
    photoURL?: string;
    fullName2?: string;
    age2?: number;
    phoneNumber2?: string;
    photoURL2?: string;
    createdAt: any; // Firestore timestamp
    status: 'pending' | 'approved' | 'rejected' | 'cancellation_requested' | 'cancelled';
    rider1CheckedIn?: boolean;
    rider2CheckedIn?: boolean;
    rider1Finished?: boolean;
    rider2Finished?: boolean;
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
