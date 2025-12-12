
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase"; // Using client SDK on server, which is fine for these operations
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } from "firebase/firestore";
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
  console.log("[Action] Starting createAccountAndRegisterRider with values:", values);
  const parsed = registrationFormSchema.safeParse(values);
  if (!parsed.success) {
    console.error("[Action] Zod validation failed:", parsed.error.flatten());
    return { success: false, message: "Invalid data provided." };
  }
  console.log("[Action] Zod validation successful.");

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
  console.log("[Action] Data prepared for saving:", dataToSave);


  try {
    console.log(`[Action] Attempting to create user with email: ${email}`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const uid = user.uid;
    console.log(`[Action] User created successfully. UID: ${uid}`);

    console.log(`[Action] Saving user profile to 'users/${uid}'...`);
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      email: user.email,
      displayName: registrationData.fullName,
      role: 'user',
      photoURL: registrationData.photoURL || null,
      createdAt: serverTimestamp(),
    });
    console.log("[Action] User profile saved successfully.");

    const registrationRef = doc(db, "registrations", uid);
    const finalRegistrationData = { ...dataToSave, uid, createdAt: serverTimestamp() };
    console.log(`[Action] Saving registration data to 'registrations/${uid}'...`, finalRegistrationData);
    await setDoc(registrationRef, finalRegistrationData);
    console.log("[Action] Registration data saved successfully.");

    revalidatePath('/dashboard');
    console.log("[Action] Revalidated dashboard path. Returning success.");
    return { success: true, message: "Registration successful! Your application is pending review.", uid: uid };

  } catch (error: any) {
    console.error("[Action] An error occurred in the registration process:", error);

    if (error.code === 'auth/email-already-in-use') {
      console.log("[Action] Email is already in use. Handling as existing user.");
      return {
        success: true,
        message: "Account already exists. We've linked this registration to your account. Logging you in...",
        uid: null,
        existingUser: true,
        dataForExistingUser: dataToSave
      };
    }

    console.error("Error creating account and registration:", error);
    return { success: false, message: error.message || "Could not create your account or registration. Please try again." };
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

export async function updateRegistrationDetails(values: EditRegistrationInput) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const { registrationId, adminId, ...dataToUpdate } = values;
  const parsed = editRegistrationFormSchema.safeParse(dataToUpdate);

  if (!parsed.success) {
    console.log(parsed.error.flatten().fieldErrors);
    return { success: false, message: "Invalid data provided." };
  }

  const registrationRef = doc(db, "registrations", registrationId);

  updateDoc(registrationRef, parsed.data).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: registrationRef.path,
      operation: "update",
      requestResourceData: parsed.data
    })
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  revalidatePath('/admin');
  revalidatePath(`/ticket/${registrationId}`);
  return { success: true, message: "Rider details updated successfully." };
}

// Schema for updating a registration status
const updateStatusSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  status: z.enum(["approved", "rejected", "pending", "cancellation_requested", "cancelled"]),
  adminId: z.string().min(1, "Admin ID is required."),
});

export async function updateRegistrationStatus(values: z.infer<typeof updateStatusSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const parsed = updateStatusSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  const { registrationId, status, adminId } = parsed.data;
  const registrationRef = doc(db, "registrations", registrationId);
  const dataToUpdate = {
    status,
    statusLastUpdatedAt: serverTimestamp(),
    statusLastUpdatedBy: adminId,
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

  return { success: true, message: `Registration status updated to ${status}.` };
}

// Schema for deleting a registration
const deleteRegistrationSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
});

export async function deleteRegistration(values: z.infer<typeof deleteRegistrationSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const parsed = deleteRegistrationSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  const { registrationId } = parsed.data;

  try {
    await deleteDoc(doc(db, "registrations", registrationId));
    await deleteDoc(doc(db, "users", registrationId));
    return { success: true, message: "Registration and user data have been deleted." };
  } catch (error: any) {
    const registrationRef = doc(db, "registrations", registrationId);
    const permError = new FirestorePermissionError({
      path: registrationRef.path,
      operation: "delete",
    });
    errorEmitter.emit('permission-error', permError);
    return { success: false, message: "Failed to delete registration data." };
  }
}


// Schema for checking in a rider
const checkInSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
});

export async function checkInRider(values: z.infer<typeof checkInSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const parsed = checkInSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, message: "Invalid data provided for check-in." };
  }

  const { registrationId } = parsed.data;
  const registrationRef = doc(db, "registrations", registrationId);
  const dataToUpdate = { rider1CheckedIn: true };

  updateDoc(registrationRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: registrationRef.path,
      operation: "update",
      requestResourceData: dataToUpdate
    })
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: `Rider checked in successfully.` };
}

// Schema for marking a rider as finished
const finishRiderSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
});

export async function finishRider(values: z.infer<typeof finishRiderSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const parsed = finishRiderSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, message: "Invalid data provided for finishing." };
  }

  const { registrationId } = parsed.data;
  const registrationRef = doc(db, "registrations", registrationId);
  const dataToUpdate = { rider1Finished: true };

  updateDoc(registrationRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: registrationRef.path,
      operation: "update",
      requestResourceData: dataToUpdate
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: `Rider marked as finished!` };
}

// Schema for reverting a rider's check-in
const revertCheckInSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
});

export async function revertCheckIn(values: z.infer<typeof revertCheckInSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = revertCheckInSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: "Invalid data for check-in reversal." };

  const { registrationId } = parsed.data;
  const registrationRef = doc(db, "registrations", registrationId);
  const dataToUpdate = { rider1CheckedIn: false };

  updateDoc(registrationRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: registrationRef.path,
      operation: "update",
      requestResourceData: dataToUpdate
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: `Rider check-in has been reverted.` };
}

// Schema for reverting a rider's finish status
const revertFinishSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
});

export async function revertFinish(values: z.infer<typeof revertFinishSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = revertFinishSchema.safeParse(values);
  if (!parsed.success) return { success: false, message: "Invalid data for finish reversal." };

  const { registrationId } = parsed.data;
  const registrationRef = doc(db, "registrations", registrationId);
  const dataToUpdate = { rider1Finished: false };

  updateDoc(registrationRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: registrationRef.path,
      operation: "update",
      requestResourceData: dataToUpdate
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: `Rider finish status has been reverted.` };
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

// Schema for updating a user's role
const updateUserRoleSchema = z.object({
  adminId: z.string().min(1, "Performing user ID is required."),
  targetUserId: z.string().min(1, "Target user ID is required."),
  newRole: z.enum(['superadmin', 'admin', 'viewer', 'user']),
});

export async function updateUserRole(values: z.infer<typeof updateUserRoleSchema>) {
  const isSuperAdmin = await checkSuperAdminPermissions(values.adminId);
  const adminDoc = await getDoc(doc(db, 'users', values.adminId));
  const adminRole = adminDoc.data()?.role;

  // Only superadmins can assign the superadmin role.
  if (!isSuperAdmin && values.newRole === 'superadmin') {
    return { success: false, message: "Only superadmins can assign the superadmin role." };
  }
  // Only superadmins or admins can change roles.
  if (adminRole !== 'superadmin' && adminRole !== 'admin') {
    return { success: false, message: "Permission denied." };
  }

  const parsed = updateUserRoleSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data." };
  }

  const { targetUserId, newRole } = parsed.data;

  // Superadmins can't change their own role.
  if (values.adminId === targetUserId && newRole !== adminRole && adminRole === 'superadmin') {
    return { success: false, message: "Superadmins cannot change their own role." };
  }
  // Admins can't change their own role.
  if (values.adminId === targetUserId && newRole !== adminRole && adminRole === 'admin') {
    return { success: false, message: "Admins cannot change their own role." };
  }

  const userRef = doc(db, "users", targetUserId);
  const dataToUpdate = { role: newRole };

  updateDoc(userRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: userRef.path,
      operation: "update",
      requestResourceData: dataToUpdate
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: `User role updated to ${newRole}.` };
}

// Schema for QnA moderation
const qnaModSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required."),
  questionId: z.string().min(1, "Question ID is required."),
});

// Action to delete a question
export async function deleteQuestion(values: z.infer<typeof qnaModSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const questionRef = doc(db, "qna", values.questionId);

  deleteDoc(questionRef).catch((e: any) => {
    const error = new FirestorePermissionError({ path: questionRef.path, operation: "delete" });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: "Question deleted." };
}

// Action to toggle pin status of a question
export async function togglePinQuestion(values: z.infer<typeof qnaModSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const questionRef = doc(db, "qna", values.questionId);
  const questionSnap = await getDoc(questionRef);
  if (!questionSnap.exists()) {
    return { success: false, message: "Question not found." };
  }
  const currentPinStatus = questionSnap.data()?.isPinned || false;
  const dataToUpdate = { isPinned: !currentPinStatus };

  updateDoc(questionRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: questionRef.path,
      operation: "update",
      requestResourceData: dataToUpdate
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: `Question ${!currentPinStatus ? 'pinned' : 'unpinned'}.` };
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
});

export async function addAnnouncement(values: z.infer<typeof addAnnouncementSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = addAnnouncementSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Invalid data provided." };
  }

  const userDocSnap = await getDoc(doc(db, "users", values.adminId));
  const userData = userDocSnap.data();
  const announcementCollectionRef = collection(db, "announcements");
  const dataToAdd = {
    ...parsed.data,
    adminName: userData?.displayName || values.adminName,
    adminRole: userData?.role || 'admin',
    createdAt: serverTimestamp(),
  };

  addDoc(announcementCollectionRef, dataToAdd).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: announcementCollectionRef.path,
      operation: "create",
      requestResourceData: dataToAdd
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: "Announcement posted successfully!" };
}

const deleteAnnouncementSchema = z.object({
  announcementId: z.string().min(1, "Announcement ID is required."),
  adminId: z.string().min(1, "Admin ID is required."),
});

export async function deleteAnnouncement(values: z.infer<typeof deleteAnnouncementSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const announcementRef = doc(db, "announcements", values.announcementId);

  deleteDoc(announcementRef).catch((e: any) => {
    const error = new FirestorePermissionError({
      path: announcementRef.path,
      operation: "delete"
    });
    errorEmitter.emit('permission-error', error);
    return { success: false, message: e.message };
  });

  return { success: true, message: "Announcement deleted." };
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
  const dataToUpdate = { startTime: Timestamp.fromDate(parsed.data.eventDate) };

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
  registrationsOpen: z.boolean(),
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

  try {
    await adminDb.collection("settings").doc("event").set(parsed.data, { merge: true });
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
});

export async function grantCertificate(values: z.infer<typeof certificateSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const registrationRef = doc(db, "registrations", values.registrationId);
  const dataToUpdate = { certificateGranted: true };
  updateDoc(registrationRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({ path: registrationRef.path, operation: "update", requestResourceData: dataToUpdate });
    errorEmitter.emit('permission-error', error);
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, message: "Certificate granted to rider." };
}

export async function revokeCertificate(values: z.infer<typeof certificateSchema>) {
  const isAdmin = await checkAdminPermissions(values.adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }

  const registrationRef = doc(db, "registrations", values.registrationId);
  const dataToUpdate = { certificateGranted: false };
  updateDoc(registrationRef, dataToUpdate).catch((e: any) => {
    const error = new FirestorePermissionError({ path: registrationRef.path, operation: "update", requestResourceData: dataToUpdate });
    errorEmitter.emit('permission-error', error);
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, message: "Certificate revoked." };
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




