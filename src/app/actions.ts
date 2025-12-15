
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase"; // Using client SDK on server, which is fine for these operations
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// Helper to verify admin token
async function checkAdminToken(token: string): Promise<boolean> {
  if (!token) {
    console.warn("checkAdminToken: No token provided.");
    return false;
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    console.log(`checkAdminToken: Token verified for UID: ${uid}`);

    // Check the user's role in Firestore (using Admin SDK to bypass rules)
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.warn(`checkAdminToken: User document not found for UID: ${uid}`);
      return false;
    }

    const role = userDoc.data()?.role;
    console.log(`checkAdminToken: User role: ${role}`);
    return role === 'admin' || role === 'superadmin';
  } catch (error) {
    console.error("checkAdminToken: Verification failed:", error);
    return false;
  }
}


// Helper to get a user's role by directly querying Firestore
async function checkAdminPermissions(adminId: string): Promise<boolean> {
  if (!adminId) {
    return false;
  }
  try {
    const userDocRef = doc(db, 'users', adminId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return false;
    }
    const userRole = userDoc.data()?.role;
    return userRole === 'admin' || userRole === 'superadmin';
  } catch (error) {
    console.error('[AdminCheck] Error checking permissions:', error);
    return false;
  }
}

// Helper to check for superadmin permissions
async function checkSuperAdminPermissions(adminId: string): Promise<boolean> {
  if (!adminId) {
    return false;
  }
  try {
    const userDocRef = doc(db, 'users', adminId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return false;
    }
    const userRole = userDoc.data()?.role;
    return userRole === 'superadmin';
  } catch (error) {
    console.error('[SuperAdminCheck] Error checking permissions:', error);
    return false;
  }
}

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);


// The schema for the ride registration form
const registrationFormSchema = z
  .object({
    email: z.string().email("A valid email is required."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters."),

    // Rider 1
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    age: z.coerce.number().min(18, "You must be at least 18 years old.").max(100),
    phoneNumber: z.string().regex(phoneRegex, "Invalid phone number."),
    whatsappNumber: z.string().optional(),
    photoURL: z.string().url().optional(),

    // Individual rule consents
    rule1: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule2: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule3: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule4: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule5: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule6: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule7: z.boolean().refine(val => val, { message: "You must agree to this rule." }),

    registrationType: z.enum(["bike", "jeep", "car"], {
      required_error: "You need to select a vehicle type.",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

type RegistrationInput = z.infer<typeof registrationFormSchema>;

export async function createAccountAndRegisterRider(values: RegistrationInput) {
  console.log("[Action] Starting createAccountAndRegisterRider (Admin SDK) with values:", values);
  const parsed = registrationFormSchema.safeParse(values);
  if (!parsed.success) {
    console.error("[Action] Zod validation failed:", parsed.error.flatten());
    return { success: false, message: "Invalid data provided." };
  }

  const { email, password, confirmPassword, ...registrationData } = parsed.data;
  const { rule1, rule2, rule3, rule4, rule5, rule6, rule7, ...coreData } = registrationData;

  const dataToSave: any = {
    ...coreData,
    email: email,
    status: "pending" as const,
    consent: true,
  };

  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined) {
      delete dataToSave[key];
    }
  });

  try {
    console.log(`[Action] Creating user via Admin Auth: ${email}`);
    // 1. Create User via Admin Auth
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: registrationData.fullName,
      photoURL: registrationData.photoURL || undefined,
    });
    const uid = userRecord.uid;
    console.log(`[Action] User created. UID: ${uid}`);

    // 2. Write User Profile via Admin DB
    await adminDb.collection("users").doc(uid).set({
      email: userRecord.email,
      displayName: registrationData.fullName,
      role: 'user',
      photoURL: registrationData.photoURL || null,
      createdAt: new Date(),
    });

    // 3. Write Registration Data via Admin DB
    const finalRegistrationData = { ...dataToSave, uid, createdAt: new Date() };
    await adminDb.collection("registrations").doc(uid).set(finalRegistrationData);

    revalidatePath('/dashboard');
    return { success: true, message: "Registration successful! Your application is pending review.", uid: uid };

  } catch (error: any) {
    console.error("[Action] Registration process error:", error);

    if (error.code === 'auth/email-already-in-use') {
      return {
        success: false,
        message: "Email is already in use. Please log in or use a different email.",
        errorType: 'EMAIL_EXISTS', // Flag for client to handle if needed
      };
    }

    return { success: false, message: error.message || "Could not create your account. Please try again." };
  }
}

// Schema for authenticated users (no password/email needed)
const authenticatedRegistrationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  age: z.coerce.number().min(18, "You must be at least 18 years old.").max(100),
  phoneNumber: z.string().regex(phoneRegex, "Invalid phone number."),
  whatsappNumber: z.string().optional(),
  photoURL: z.string().url().optional(),
  registrationType: z.enum(["bike", "jeep", "car"]),

  // Individual rule consents (must still agree)
  rule1: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
  rule2: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
  rule3: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
  rule4: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
  rule5: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
  rule6: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
  rule7: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
});

export async function registerAuthenticatedUser(values: z.infer<typeof authenticatedRegistrationSchema> & { uid: string, token: string }) {
  console.log("[Action] Starting registerAuthenticatedUser", values);
  const { uid, token, ...data } = values;

  // 1. Verify Token
  if (!token) {
    return { success: false, message: "Authentication required." };
  }

  let verifiedUid: string;
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    verifiedUid = decodedToken.uid;

    // Ensure the token belongs to the user claiming it (extra safety)
    if (verifiedUid !== uid) {
      return { success: false, message: "Authentication mismatch." };
    }
  } catch (e) {
    console.error("Token verification failed", e);
    return { success: false, message: "Invalid session. Please login again." };
  }

  const parsed = authenticatedRegistrationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, message: "Invalid data." };
  }

  const { rule1, rule2, rule3, rule4, rule5, rule6, rule7, ...coreData } = parsed.data;

  // Use new Date() for Admin SDK
  const dataToSave = {
    ...coreData,
    status: "pending" as const,
    consent: true,
    uid: verifiedUid,
    createdAt: new Date(),
  };

  // Remove undefined
  Object.keys(dataToSave).forEach(key => dataToSave[key as keyof typeof dataToSave] === undefined && delete dataToSave[key as keyof typeof dataToSave]);

  try {
    // 1. Update User Profile if changed - Use Admin SDK
    await adminDb.collection("users").doc(verifiedUid).set({
      displayName: coreData.fullName,
      photoURL: coreData.photoURL || null,
    }, { merge: true });

    // 2. Create Registration Doc - Use Admin SDK
    await adminDb.collection("registrations").doc(verifiedUid).set(dataToSave);

    revalidatePath('/dashboard');
    return { success: true, message: "Registration submitted successfully!" };
  } catch (e: any) {
    console.error("Registration failed", e);
    return { success: false, message: "Failed to submit registration: " + e.message };
  }
}

// Schema for editing an existing registration
const editRegistrationFormSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    age: z.coerce.number().min(18, "You must be at least 18 years old.").max(100),
    phoneNumber: z.string().regex(phoneRegex, "Invalid phone number."),
    photoURL: z.string().url().optional(),
    registrationType: z.enum(["bike", "jeep", "car"]),
  })


type EditRegistrationInput = z.infer<typeof editRegistrationFormSchema> & {
  registrationId: string;
  adminId: string;
};

export async function updateRegistrationDetails(values: EditRegistrationInput & { token?: string }) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  const { registrationId, adminId, token, ...dataToUpdate } = values;
  const parsed = editRegistrationFormSchema.safeParse(dataToUpdate);

  if (!parsed.success) {
    console.log(parsed.error.flatten().fieldErrors);
    return { success: false, message: "Invalid data provided." };
  }

  try {
    await adminDb.collection("registrations").doc(registrationId).update(parsed.data);
    revalidatePath('/admin');
    revalidatePath(`/ticket/${registrationId}`);
    return { success: true, message: "Rider details updated successfully." };
  } catch (e: any) {
    console.error("Update registration failed", e);
    return { success: false, message: "Failed to update details: " + e.message };
  }
}

// Schema for updating a registration status
const updateStatusSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  status: z.enum(["approved", "rejected", "pending", "cancellation_requested", "cancelled"]),
  adminId: z.string().min(1, "Admin ID is required."),
  token: z.string().optional(),
});

export async function updateRegistrationStatus(values: z.infer<typeof updateStatusSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  const parsed = updateStatusSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  const { registrationId, status, adminId } = parsed.data;
  const dataToUpdate = {
    status,
    statusLastUpdatedAt: new Date(),
    statusLastUpdatedBy: adminId,
  };

  try {
    await adminDb.collection("registrations").doc(registrationId).update(dataToUpdate);
    return { success: true, message: `Registration status updated to ${status}.` };
  } catch (e: any) {
    console.error("Update status failed", e);
    return { success: false, message: "Failed to update status." };
  }
}

// Schema for deleting a registration
const deleteRegistrationSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
  token: z.string().optional(),
});

export async function deleteRegistration(values: z.infer<typeof deleteRegistrationSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  const { registrationId } = values;

  try {
    await adminDb.collection("registrations").doc(registrationId).delete();
    await adminDb.collection("users").doc(registrationId).delete();
    return { success: true, message: "Registration and user data have been deleted." };
  } catch (error: any) {
    console.error("Delete registration failed", error);
    return { success: false, message: "Failed to delete registration data." };
  }
}


// Schema for checking in a rider
const checkInSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
  token: z.string().optional(),
});

export async function checkInRider(values: z.infer<typeof checkInSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    await adminDb.collection("registrations").doc(values.registrationId).update({ rider1CheckedIn: true });
    return { success: true, message: `Rider checked in successfully.` };
  } catch (e: any) {
    console.error("Check-in failed", e);
    return { success: false, message: "Check-in failed: " + e.message };
  }
}

// Schema for marking a rider as finished
const finishRiderSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
  token: z.string().optional(),
});

export async function finishRider(values: z.infer<typeof finishRiderSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    await adminDb.collection("registrations").doc(values.registrationId).update({ rider1Finished: true });
    return { success: true, message: `Rider marked as finished!` };
  } catch (e: any) {
    console.error("Finish failed", e);
    return { success: false, message: "Finish update failed: " + e.message };
  }
}

// Schema for reverting a rider's check-in
const revertCheckInSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
  token: z.string().optional(),
});

export async function revertCheckIn(values: z.infer<typeof revertCheckInSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    await adminDb.collection("registrations").doc(values.registrationId).update({ rider1CheckedIn: false });
    return { success: true, message: `Rider check-in has been reverted.` };
  } catch (e: any) {
    return { success: false, message: "Revert failed: " + e.message };
  }
}

// Schema for reverting a rider's finish status
const revertFinishSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
  token: z.string().optional(),
});

export async function revertFinish(values: z.infer<typeof revertFinishSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    await adminDb.collection("registrations").doc(values.registrationId).update({ rider1Finished: false });
    return { success: true, message: `Rider finish status has been reverted.` };
  } catch (e: any) {
    return { success: false, message: "Revert failed: " + e.message };
  }
}

// Schema for adding a question
// Schema for adding a question
const addQuestionSchema = z.object({
  text: z.string().min(10, "Question must be at least 10 characters.").max(500, "Question cannot be longer than 500 characters."),
  userId: z.string().min(1, "User ID is required."),
  userName: z.string().min(1, "User name is required."),
  userPhotoURL: z.string().url().optional().nullable(),
  token: z.string().optional(),
});

export async function addQuestion(values: z.infer<typeof addQuestionSchema>) {
  const parsed = addQuestionSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  // Verify Identity
  if (!values.token) {
    return { success: false, message: "Authentication required." };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(values.token);
    if (decodedToken.uid !== values.userId) {
      return { success: false, message: "User identity mismatch." };
    }
  } catch (e) {
    console.error("Token verification failed", e);
    return { success: false, message: "Invalid authentication token." };
  }

  const { token, ...data } = parsed.data;

  // Use Admin SDK to write
  try {
    const userDoc = await adminDb.collection("users").doc(data.userId).get();
    const displayName = userDoc.data()?.displayName;

    await adminDb.collection("qna").add({
      ...data,
      userName: displayName || data.userName,
      isPinned: false,
      createdAt: new Date(), // Admin SDK uses native Date or Timestamp
    });

    revalidatePath('/');
    return { success: true, message: "Question posted successfully!" };
  } catch (e: any) {
    console.error("Add question failed", e);
    return { success: false, message: "Failed to post question: " + e.message };
  }
}


// Schema for adding a reply
// Schema for adding a reply
const addReplySchema = z.object({
  questionId: z.string().min(1, "Question ID is required."),
  text: z.string().min(1, "Reply cannot be empty.").max(500, "Reply cannot be longer than 500 characters."),
  userId: z.string().min(1, "User ID is required."),
  userName: z.string().min(1, "User name is required."),
  userPhotoURL: z.string().url().optional().nullable(),
  token: z.string().optional(),
});

export async function addReply(values: z.infer<typeof addReplySchema>) {
  const parsed = addReplySchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  if (!values.token) {
    return { success: false, message: "Authentication required." };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(values.token);
    if (decodedToken.uid !== values.userId) {
      return { success: false, message: "User identity mismatch." };
    }
  } catch (e) {
    console.error("Token verification failed", e);
    return { success: false, message: "Invalid authentication token." };
  }

  const { token, ...replyData } = parsed.data;

  try {
    const userDoc = await adminDb.collection('users').doc(replyData.userId).get();
    const userRole = userDoc.data()?.role;
    const displayName = userDoc.data()?.displayName;

    // Check if question exists
    const questionRef = adminDb.collection("qna").doc(replyData.questionId);
    const questionDoc = await questionRef.get();
    if (!questionDoc.exists) {
      return { success: false, message: "Question not found." };
    }

    const replyCollectionRef = questionRef.collection("replies");
    await replyCollectionRef.add({
      ...replyData,
      userName: displayName || replyData.userName,
      isAdmin: userRole === 'admin' || userRole === 'superadmin',
      createdAt: new Date(),
    });

    revalidatePath('/');
    return { success: true, message: "Reply posted successfully!" };
  } catch (e: any) {
    console.error("Add reply failed", e);
    return { success: false, message: "Failed to post reply: " + e.message };
  }
}




// Schema for requesting organizer access
const requestOrganizerAccessSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("A valid email is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  consent: z.boolean().refine(val => val, { message: "Consent is required." }),
});

export async function createAndRequestOrganizerAccess(values: z.infer<typeof requestOrganizerAccessSchema>) {
  console.log("[Action] Starting createAndRequestOrganizerAccess. Values:", values);
  const parsed = requestOrganizerAccessSchema.safeParse(values);
  if (!parsed.success) {
    console.error("[Action] Organizer Zod validation failed:", parsed.error.flatten());
    return { success: false, message: "Invalid data provided." };
  }
  console.log("[Action] Organizer Zod validation successful.");

  const { name, email, password } = parsed.data;

  try {
    console.log(`[Action] Attempting to create organizer user with email: ${email}`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log(`[Action] Organizer user created successfully. UID: ${user.uid}`);

    const userRef = doc(db, "users", user.uid);
    const userData = {
      email: user.email,
      displayName: name,
      role: 'user' as const,
      photoURL: null,
      createdAt: serverTimestamp(),
      accessRequest: {
        requestedAt: serverTimestamp(),
        status: 'pending_review' as const,
      }
    };

    console.log(`[Action] Attempting to save organizer profile to 'users/${user.uid}' with data:`, userData);
    try {
      await setDoc(userRef, userData);
      console.log("[Action] Organizer user profile and access request saved successfully.");
    } catch (firestoreError: any) {
      console.error("[Action] Firestore setDoc failed:", firestoreError);
      // This is the critical error we need to catch and report
      throw new FirestorePermissionError({
        path: userRef.path,
        operation: 'create',
        requestResourceData: userData,
      });
    }

    console.log("[Action] User profile creation complete. Returning success.");
    return { success: true, message: "Your account has been created and your request has been submitted. An admin will review it shortly.", uid: user.uid };

  } catch (error: any) {
    console.error("[Action] An error occurred in createAndRequestOrganizerAccess:", error);
    if (error instanceof FirestorePermissionError) {
      errorEmitter.emit('permission-error', error);
      return { success: false, message: "Failed to save user profile due to permissions." };
    }
    if (error.code === 'auth/email-already-in-use') {
      console.warn(`[Action] Email ${email} is already in use.`);
      return {
        success: false,
        message: "An account with this email already exists. Please log in and request access from your dashboard.",
      };
    }
    // For other errors, including potential Firestore errors.
    console.error("[Action] Full error object:", JSON.stringify(error, null, 2));
    return { success: false, message: "Failed to create account or submit your request." };
  }
}

// New action for existing users to request access
const requestAccessSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
});

export async function requestOrganizerAccess(values: z.infer<typeof requestAccessSchema>) {
  console.log("[Action] Starting requestOrganizerAccess for user:", values.userId);
  const userRef = doc(db, 'users', values.userId);

  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      return { success: false, message: "User profile not found." };
    }
    if (userDoc.data()?.accessRequest) {
      return { success: false, message: "You have already submitted a request." };
    }

    const dataToUpdate = {
      accessRequest: {
        requestedAt: serverTimestamp(),
        status: 'pending_review',
      }
    };

    await updateDoc(userRef, dataToUpdate);
    console.log("[Action] Access request field added for user:", values.userId);
    revalidatePath('/dashboard');
    return { success: true, message: "Your request for organizer access has been submitted." };
  } catch (e: any) {
    console.error("[Action] Error in requestOrganizerAccess:", e);
    const error = new FirestorePermissionError({
      path: userRef.path,
      operation: "update",
      requestResourceData: { accessRequest: { status: 'pending_review' } }
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: "Failed to submit your request." };
  }
}


// === ANNOUNCEMENT ACTIONS ===

const addAnnouncementSchema = z.object({
  message: z.string().min(5, "Announcement must be at least 5 characters.").max(280, "Announcement cannot be longer than 280 characters."),
  adminId: z.string().min(1, "Admin ID is required."),
  adminName: z.string().min(1, "Admin name is required."),
  token: z.string().optional(),
});

export async function addAnnouncement(values: z.infer<typeof addAnnouncementSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    // Fallback for older calls (though we should migrate all)
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  const parsed = addAnnouncementSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  const { token, ...data } = parsed.data;

  try {
    const userDoc = await adminDb.collection("users").doc(data.adminId).get();
    const userData = userDoc.data();
    const adminName = userData?.displayName || data.adminName;
    const adminRole = userData?.role || 'admin';

    await adminDb.collection("announcements").add({
      message: data.message,
      adminId: data.adminId,
      adminName,
      adminRole,
      createdAt: new Date(),
    });

    revalidatePath('/');
    return { success: true, message: "Announcement posted successfully!" };
  } catch (e: any) {
    console.error("Add announcement failed", e);
    return { success: false, message: "Failed to post announcement: " + e.message };
  }
}

const deleteAnnouncementSchema = z.object({
  announcementId: z.string().min(1, "Announcement ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
  token: z.string().optional(),
});

export async function deleteAnnouncement(values: z.infer<typeof deleteAnnouncementSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    await adminDb.collection("announcements").doc(values.announcementId).delete();
    revalidatePath('/');
    return { success: true, message: "Announcement deleted." };
  } catch (e: any) {
    console.error("Delete announcement failed", e);
    return { success: false, message: "Failed to delete: " + e.message };
  }
}

// Schema for ride cancellation
const cancelRegistrationSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  reason: z.string().min(10, "Please provide a reason for cancellation.").max(500),
});

export async function cancelRegistration(values: z.infer<typeof cancelRegistrationSchema>) {
  const parsed = cancelRegistrationSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  const registrationRef = doc(db, "registrations", values.registrationId);
  const dataToUpdate = {
    status: 'cancellation_requested',
    cancellationReason: values.reason,
  };

  updateDoc(registrationRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: registrationRef.path,
      operation: "update",
      requestResourceData: dataToUpdate
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: "Your cancellation request has been submitted." };
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export async function sendPasswordResetLink(values: z.infer<typeof forgotPasswordSchema>) {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid email provided." };
  }

  try {
    await sendPasswordResetEmail(auth, parsed.data.email);
    return { success: true, message: "If an account exists for this email, a password reset link has been sent." };
  } catch (error: any) {
    return { success: true, message: "If an account exists for this email, a password reset link has been sent." };
  }
}


// === CONTENT MANAGEMENT ACTIONS ===

const faqSchema = z.object({
  question: z.string().min(10, "Question is required."),
  answer: z.string().min(10, "Answer is required."),
});

export async function manageFaq(values: z.infer<typeof faqSchema> & { adminId: string; faqId?: string, token?: string }) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    // Fallback
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, faqId, token, ...data } = values;
  const parsed = faqSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid data.");

  try {
    if (faqId) {
      await adminDb.collection("faqs").doc(faqId).update(parsed.data);
      revalidatePath('/');
      return { success: true, message: "FAQ item updated." };
    } else {
      await adminDb.collection("faqs").add({ ...parsed.data, createdAt: new Date() });
      revalidatePath('/');
      return { success: true, message: "FAQ item added." };
    }
  } catch (e: any) {
    console.error("Update failed", e);
    // Legacy
    try {
      if (faqId) {
        const faqRef = doc(db, "faqs", faqId);
        await updateDoc(faqRef, parsed.data);
      } else {
        const faqCollectionRef = collection(db, "faqs");
        const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
        await addDoc(faqCollectionRef, dataToAdd);
      }
      revalidatePath('/');
      return { success: true, message: faqId ? "FAQ item updated." : "FAQ item added." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

export async function deleteFaq(id: string, adminId: string, token?: string) {
  if (token) {
    const isAdmin = await checkAdminToken(token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  try {
    await adminDb.collection("faqs").doc(id).delete();
    revalidatePath('/');
    return { success: true, message: "FAQ item deleted." };
  } catch (e: any) {
    console.error("Delete failed", e);
    // Legacy
    try {
      const faqRef = doc(db, "faqs", id);
      await deleteDoc(faqRef);
      revalidatePath('/');
      return { success: true, message: "FAQ item deleted." };
    } catch (legacyError: any) {
      throw new Error("Delete failed: " + e.message);
    }
  }
}


const scheduleSchema = z.object({
  time: z.string().min(1, "Time is required."),
  title: z.string().min(3, "Title is required."),
  description: z.string().min(10, "Description is required."),
  icon: z.string().min(1, "Icon is required."),
});

export async function manageSchedule(values: z.infer<typeof scheduleSchema> & { adminId: string; scheduleId?: string, token?: string }) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, scheduleId, token, ...data } = values;
  const parsed = scheduleSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid data.");

  try {
    if (scheduleId) {
      await adminDb.collection("schedule").doc(scheduleId).update(parsed.data);
      revalidatePath('/');
      return { success: true, message: "Schedule item updated." };
    } else {
      await adminDb.collection("schedule").add({ ...parsed.data, createdAt: new Date() });
      revalidatePath('/');
      return { success: true, message: "Schedule item added." };
    }
  } catch (e: any) {
    console.error("Update failed", e);
    // Legacy
    try {
      if (scheduleId) {
        const scheduleRef = doc(db, "schedule", scheduleId);
        await updateDoc(scheduleRef, parsed.data);
      } else {
        const scheduleCollectionRef = collection(db, "schedule");
        const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
        await addDoc(scheduleCollectionRef, dataToAdd);
      }
      revalidatePath('/');
      return { success: true, message: scheduleId ? "Schedule item updated." : "Schedule item added." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

export async function deleteScheduleItem(id: string, adminId: string, token?: string) {
  if (token) {
    const isAdmin = await checkAdminToken(token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  try {
    await adminDb.collection("schedule").doc(id).delete();
    revalidatePath('/');
    return { success: true, message: "Schedule item deleted." };
  } catch (e: any) {
    console.error("Delete failed", e);
    // Legacy
    try {
      const scheduleRef = doc(db, "schedule", id);
      await deleteDoc(scheduleRef);
      revalidatePath('/');
      return { success: true, message: "Schedule item deleted." };
    } catch (legacyError: any) {
      throw new Error("Delete failed: " + e.message);
    }
  }
}

const organizerSchema = z.object({
  name: z.string().min(3, "Name is required."),
  role: z.string().min(3, "Role is required."),
  imageUrl: z.string().url("A valid URL is required.").or(z.literal("")).optional(),
  imageHint: z.string().optional(),
  contactNumber: z.string().optional(),
});

export async function manageOrganizer(values: z.infer<typeof organizerSchema> & { adminId: string; organizerId?: string, token?: string }) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, organizerId, token, ...data } = values;
  const parsed = organizerSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Organizer validation failed:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid data.");
  }

  const dataToSave = { ...parsed.data };
  Object.keys(dataToSave).forEach((key) => {
    if (dataToSave[key as keyof typeof dataToSave] === "") {
      delete dataToSave[key as keyof typeof dataToSave];
    }
  });

  try {
    if (organizerId) {
      await adminDb.collection("organizers").doc(organizerId).update(dataToSave);
      revalidatePath('/');
      return { success: true, message: "Organizer updated." };
    } else {
      await adminDb.collection("organizers").add({ ...dataToSave, createdAt: new Date() });
      revalidatePath('/');
      return { success: true, message: "Organizer added." };
    }
  } catch (e: any) {
    console.error("Update failed", e);
    // Legacy
    try {
      if (organizerId) {
        const organizerRef = doc(db, "organizers", organizerId);
        await updateDoc(organizerRef, dataToSave);
      } else {
        const organizerCollectionRef = collection(db, "organizers");
        const dataToAdd = { ...dataToSave, createdAt: serverTimestamp() };
        await addDoc(organizerCollectionRef, dataToAdd);
      }
      revalidatePath('/');
      return { success: true, message: organizerId ? "Organizer updated." : "Organizer added." };
    } catch (legacyError: any) {
      const error = new FirestorePermissionError({
        path: organizerId ? doc(db, "organizers", organizerId).path : collection(db, "organizers").path,
        operation: organizerId ? "update" : "create",
        requestResourceData: dataToSave
      });
      errorEmitter.emit('permission-error', error);
      throw error;
    }
  }
}

export async function deleteOrganizer(id: string, adminId: string, token?: string) {
  if (token) {
    const isAdmin = await checkAdminToken(token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  try {
    await adminDb.collection("organizers").doc(id).delete();
    revalidatePath('/');
    return { success: true, message: "Organizer deleted." };
  } catch (e: any) {
    console.error("Delete failed", e);
    // Legacy
    try {
      const organizerRef = doc(db, "organizers", id);
      await deleteDoc(organizerRef);
      revalidatePath('/');
      return { success: true, message: "Organizer deleted." };
    } catch (legacyError: any) {
      const error = new FirestorePermissionError({ path: doc(db, "organizers", id).path, operation: "delete" });
      errorEmitter.emit('permission-error', error);
      throw error;
    }
  }
}


const promotionSchema = z.object({
  title: z.string().min(3, "Title is required."),
  description: z.string().min(10, "Description is required."),
  validity: z.string().min(3, "Validity is required."),
  imageUrl: z.string().url("A valid promotion photo is required."),
  imageHint: z.string().min(2, "Image hint is required"),
  actualPrice: z.coerce.number().optional(),
  offerPrice: z.coerce.number().optional(),
});

export async function managePromotion(values: z.infer<typeof promotionSchema> & { adminId: string; promotionId?: string, token?: string }) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, promotionId, token, ...data } = values;
  const parsed = promotionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid data.");

  try {
    if (promotionId) {
      await adminDb.collection("promotions").doc(promotionId).update(parsed.data);
      revalidatePath('/');
      return { success: true, message: "Promotion updated." };
    } else {
      await adminDb.collection("promotions").add({ ...parsed.data, createdAt: new Date() });
      revalidatePath('/');
      return { success: true, message: "Promotion added." };
    }
  } catch (e: any) {
    console.error("Update failed", e);
    // Legacy
    try {
      if (promotionId) {
        const promotionRef = doc(db, "promotions", promotionId);
        await updateDoc(promotionRef, parsed.data);
      } else {
        const promotionCollectionRef = collection(db, "promotions");
        const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
        await addDoc(promotionCollectionRef, dataToAdd);
      }
      revalidatePath('/');
      return { success: true, message: promotionId ? "Promotion updated." : "Promotion added." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

export async function deletePromotion(id: string, adminId: string, token?: string) {
  if (token) {
    const isAdmin = await checkAdminToken(token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  try {
    await adminDb.collection("promotions").doc(id).delete();
    revalidatePath('/');
    return { success: true, message: "Promotion deleted." };
  } catch (e: any) {
    console.error("Delete failed", e);
    // Legacy
    try {
      const promotionRef = doc(db, "promotions", id);
      await deleteDoc(promotionRef);
      revalidatePath('/');
      return { success: true, message: "Promotion deleted." };
    } catch (legacyError: any) {
      throw new Error("Delete failed: " + e.message);
    }
  }
}


const locationSchema = z.object({
  origin: z.string().min(5, "Origin is required."),
  destination: z.string().min(5, "Destination is required."),
});

export async function manageLocation(values: z.infer<typeof locationSchema> & { adminId: string, token?: string }) {
  // 1. Validate Token (Secure)
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    // Fallback
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, token, ...data } = values;
  // Set default value
  const finalData = {
    origin: data.origin || "City Hall",
    destination: data.destination || "Central Park",
  };

  const parsed = locationSchema.safeParse(finalData);
  if (!parsed.success) throw new Error("Invalid data.");

  try {
    await adminDb.collection("settings").doc("route").set(parsed.data);
    revalidatePath('/');
    return { success: true, message: "Route location updated successfully." };
  } catch (e: any) {
    console.error("Update failed", e);
    // Legacy fallback
    const settingsRef = doc(db, "settings", "route");
    try {
      await setDoc(settingsRef, parsed.data);
      revalidatePath('/');
      return { success: true, message: "Route location updated successfully." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

const eventTimeSchema = z.object({
  eventDate: z.date(),
});

export async function manageEventTime(values: z.infer<typeof eventTimeSchema> & { adminId: string, token?: string }) {
  // 1. Validate Token
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, token, ...data } = values;
  // Set default value
  const finalData = {
    eventDate: data.eventDate || new Date("2025-08-16T10:00:00")
  }

  const parsed = eventTimeSchema.safeParse(finalData);
  if (!parsed.success) throw new Error("Invalid data.");

  // Use Timestamp.fromDate for Firestore
  // Use Date object directly for Firestore compatibility
  const dataToUpdate = { startTime: parsed.data.eventDate };

  try {
    await adminDb.collection("settings").doc("event").set(dataToUpdate, { merge: true });
    revalidatePath('/');
    return { success: true, message: "Event time updated successfully." };
  } catch (e: any) {
    console.error("Update failed", e);
    const settingsRef = doc(db, "settings", "event");
    try {
      await setDoc(settingsRef, dataToUpdate, { merge: true });
      revalidatePath('/');
      return { success: true, message: "Event time updated successfully." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

const generalSettingsSchema = z.object({
  registrationsOpen: z.boolean().optional(),

  // Certificate
  certificateTitle: z.string().optional(),
  certificateSubtitle: z.string().optional(),
  certificateLogoUrl: z.string().optional(),
  certificateSignatoryName: z.string().optional(),
  certificateSignatoryRole: z.string().optional(),

  // Ticket
  ticketTitle: z.string().optional(),
  ticketSubtitle: z.string().optional(),
  ticketLogoUrl: z.string().optional(),
  originShort: z.string().optional(),

  // Header
  headerTitle: z.string().optional(),
  headerLogoUrl: z.string().optional(),
});

export async function manageGeneralSettings(values: z.infer<typeof generalSettingsSchema> & { adminId: string, token?: string }) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, token, ...data } = values;
  const parsed = generalSettingsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid data provided.");

  const dataToSave = { ...parsed.data };
  // Remove undefined keys so we don't nullify existing settings
  Object.keys(dataToSave).forEach(key => dataToSave[key as keyof typeof dataToSave] === undefined && delete dataToSave[key as keyof typeof dataToSave]);

  try {
    await adminDb.collection("settings").doc("event").set(dataToSave, { merge: true });
    revalidatePath('/');
    revalidatePath('/register');
    return { success: true, message: "Settings updated." };
  } catch (e: any) {
    console.error("Update failed", e);
    const settingsRef = doc(db, "settings", "event");
    try {
      await setDoc(settingsRef, parsed.data, { merge: true });
      revalidatePath('/');
      revalidatePath('/register');
      return { success: true, message: "Settings updated." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

// === LOCATION PARTNER ACTIONS ===

const locationPartnerSchema = z.object({
  name: z.string().min(3, "Name is required."),
  imageUrl: z.string().url("A valid URL is required."),
  imageHint: z.string().min(2, "Image hint is required."),
  websiteUrl: z.string().url("A valid Instagram profile URL is required.").optional(),
});

export async function manageLocationPartner(values: z.infer<typeof locationPartnerSchema> & { adminId: string; partnerId?: string, token?: string }) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, partnerId, token, ...data } = values;
  const parsed = locationPartnerSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Location partner validation failed:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid data.");
  }

  try {
    if (partnerId) {
      await adminDb.collection("locationPartners").doc(partnerId).update(parsed.data);
      revalidatePath('/');
      return { success: true, message: "Location partner updated." };
    } else {
      await adminDb.collection("locationPartners").add({ ...parsed.data, createdAt: new Date() });
      revalidatePath('/');
      return { success: true, message: "Location partner added." };
    }
  } catch (e: any) {
    console.error("Update failed", e);
    // Legacy
    try {
      if (partnerId) {
        const partnerRef = doc(db, "locationPartners", partnerId);
        await updateDoc(partnerRef, parsed.data);
      } else {
        const partnerCollectionRef = collection(db, "locationPartners");
        const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
        await addDoc(partnerCollectionRef, dataToAdd);
      }
      revalidatePath('/');
      return { success: true, message: partnerId ? "Location partner updated." : "Location partner added." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

export async function deleteLocationPartner(id: string, adminId: string, token?: string) {
  if (token) {
    const isAdmin = await checkAdminToken(token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  try {
    await adminDb.collection("locationPartners").doc(id).delete();
    revalidatePath('/');
    return { success: true, message: "Location partner deleted." };
  } catch (e: any) {
    console.error("Delete failed", e);
    // Legacy
    try {
      const partnerRef = doc(db, "locationPartners", id);
      await deleteDoc(partnerRef);
      revalidatePath('/');
      return { success: true, message: "Location partner deleted." };
    } catch (legacyError: any) {
      throw new Error("Delete failed: " + e.message);
    }
  }
}

// CERTIFICATE ACTIONS

const certificateSchema = z.object({
  registrationId: z.string().min(1),
  adminId: z.string().min(1),
  token: z.string().optional(),
});

export async function grantCertificate(values: z.infer<typeof certificateSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    await adminDb.collection("registrations").doc(values.registrationId).update({ certificateGranted: true });
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true, message: "Certificate granted to rider." };
  } catch (e: any) {
    console.error("Grant certificate failed", e);
    return { success: false, message: "Failed to grant: " + e.message };
  }
}

export async function revokeCertificate(values: z.infer<typeof certificateSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    await adminDb.collection("registrations").doc(values.registrationId).update({ certificateGranted: false });
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true, message: "Certificate revoked." };
  } catch (e: any) {
    console.error("Revoke certificate failed", e);
    return { success: false, message: "Failed to revoke: " + e.message };
  }
}


// New homepage content management
const homepageContentSchema = z.object({
  heroTitle: z.string().min(5),
  heroDescription: z.string().min(10),
  heroImageUrl: z.string().url().or(z.literal("")),
  heroImageHint: z.string().optional(),
  perks: z.array(z.object({
    title: z.string().min(3, "Title must be at least 3 chars"),
    description: z.string().min(3, "Description must be at least 3 chars"),
    icon: z.string().optional() // We might want to pass icon name here
  })).optional(),
  perk1Title: z.string().optional(),
  perk1Description: z.string().optional(),
  perk2Title: z.string().optional(),
  perk2Description: z.string().optional(),
  perk3Title: z.string().optional(),
  perk3Description: z.string().optional(),
  sponsorTitle: z.string().optional(),
  sponsorSubtitle: z.string().optional(), // New field for "what it is" (e.g., A retail mobile store)
  sponsorLocation: z.string().optional(), // New field for "where it is" (e.g., Madikeri)
  sponsorDescription: z.string().optional(),
  sponsorWhatsapp: z.string().optional(),
  sponsorInstagram: z.string().optional(),
  sponsorImageUrl: z.string().url().or(z.literal("")).optional(),
  sponsors: z.array(z.object({
    title: z.string(),
    subtitle: z.string(),
    location: z.string(),
    description: z.string(),
    whatsappUrl: z.string(),
    instagramUrl: z.string(),
    imageUrl: z.string()
  })).optional(),
  developerName: z.string().optional(),
  developerLink: z.string().optional(),
});

export async function manageHomepageContent(values: z.infer<typeof homepageContentSchema> & { adminId: string, token?: string }) {
  // 1. Validate Token (Secure)
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    // Fallback to insecure ID check
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, token, ...data } = values;
  const parsed = homepageContentSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid data provided.");

  try {
    // Use Admin SDK for the write
    await adminDb.collection("settings").doc("event").set(parsed.data, { merge: true });
    revalidatePath('/');
    return { success: true, message: "Homepage content updated successfully!" };
  } catch (e: any) {
    console.error("Update failed", e);

    // Attempt legacy write
    const settingsRef = doc(db, "settings", "event");
    try {
      await setDoc(settingsRef, parsed.data, { merge: true });
      revalidatePath('/');
      return { success: true, message: "Homepage content updated successfully!" };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}

// Schema for updating a user's role
const updateUserRoleSchema = z.object({
  adminId: z.string().min(1, "Performing user ID is required."),
  targetUserId: z.string().min(1, "Target user ID is required."),
  newRole: z.enum(['superadmin', 'admin', 'viewer', 'user']),
  token: z.string().optional(),
});

export async function updateUserRole(values: z.infer<typeof updateUserRoleSchema>) {
  let isSuperAdmin = false;
  let adminRole = '';

  if (values.token) {
    const decoded = await adminAuth.verifyIdToken(values.token);
    const adminUser = await adminDb.collection("users").doc(decoded.uid).get();
    adminRole = adminUser.data()?.role;
    isSuperAdmin = adminRole === 'superadmin';
    if (adminRole !== 'admin' && adminRole !== 'superadmin') throw new Error("Permission denied.");
  } else {
    isSuperAdmin = await checkSuperAdminPermissions(values.adminId);
    const adminDoc = await getDoc(doc(db, 'users', values.adminId));
    adminRole = adminDoc.data()?.role;
    if (adminRole !== 'admin' && adminRole !== 'superadmin') return { success: false, message: "Permission denied." };
  }

  // Only superadmins can assign the superadmin role.
  if (!isSuperAdmin && values.newRole === 'superadmin') {
    return { success: false, message: "Only superadmins can assign the superadmin role." };
  }

  const { targetUserId, newRole } = values;

  // Superadmins can't change their own role.
  if (values.adminId === targetUserId && newRole !== adminRole && adminRole === 'superadmin') {
    return { success: false, message: "Superadmins cannot change their own role." };
  }
  // Admins can't change their own role.
  if (values.adminId === targetUserId && newRole !== adminRole && adminRole === 'admin') {
    return { success: false, message: "Admins cannot change their own role." };
  }

  try {
    await adminDb.collection("users").doc(targetUserId).update({ role: newRole });
    return { success: true, message: `User role updated to ${newRole}.` };
  } catch (e: any) {
    console.error("Update role failed", e);
    return { success: false, message: "Failed to update role: " + e.message };
  }
}

// Schema for QnA moderation
const qnaModSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required."),
  questionId: z.string().min(1, "Question ID is required."),
  token: z.string().optional(),
});

// Action to delete a question
export async function deleteQuestion(values: z.infer<typeof qnaModSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    const questionRef = adminDb.collection("qna").doc(values.questionId);
    await questionRef.delete();
    return { success: true, message: "Question deleted." };
  } catch (e: any) {
    console.error("Delete question failed", e);
    return { success: false, message: "Failed: " + e.message };
  }
}

// Action to toggle pin status of a question
export async function togglePinQuestion(values: z.infer<typeof qnaModSchema>) {
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
  }

  try {
    const questionRef = adminDb.collection("qna").doc(values.questionId);
    const questionSnap = await questionRef.get();

    if (!questionSnap.exists) {
      return { success: false, message: "Question not found." };
    }

    const currentPinStatus = questionSnap.data()?.isPinned || false;
    await questionRef.update({ isPinned: !currentPinStatus });

    return { success: true, message: `Question ${!currentPinStatus ? 'pinned' : 'unpinned'}.` };
  } catch (e: any) {
    console.error("Toggle pin failed", e);
    return { success: false, message: "Failed: " + e.message };
  }
}

const homepageVisibilitySchema = z.object({
  showSchedule: z.boolean(),
  showReviews: z.boolean(),
  showOrganizers: z.boolean(),
  showPromotions: z.boolean(),
});

export async function manageHomepageVisibility(values: z.infer<typeof homepageVisibilitySchema> & { adminId: string, token?: string }) {
  // 1. Validate Token (Secure)
  if (values.token) {
    const isAdmin = await checkAdminToken(values.token);
    if (!isAdmin) throw new Error("Permission denied (Invalid Token).");
  } else {
    // Fallback to insecure ID check (legacy coverage)
    const isAdmin = await checkAdminPermissions(values.adminId);
    if (!isAdmin) throw new Error("Permission denied.");
  }

  const { adminId, token, ...data } = values;
  const parsed = homepageVisibilitySchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid data provided.");

  try {
    // Use Admin SDK for the write to bypass rules
    await adminDb.collection("settings").doc("event").set(parsed.data, { merge: true });
    revalidatePath('/');
    return { success: true, message: "Homepage section visibility updated." };
  } catch (e: any) {
    console.error("Update failed", e);

    // Attempt legacy write if Admin SDK failed (e.g. no creds) - though this will likely fail permissions too
    const settingsRef = doc(db, "settings", "event");
    try {
      await setDoc(settingsRef, parsed.data, { merge: true });
      revalidatePath('/');
      return { success: true, message: "Homepage section visibility updated." };
    } catch (legacyError: any) {
      throw new Error("Update failed: " + e.message);
    }
  }
}
