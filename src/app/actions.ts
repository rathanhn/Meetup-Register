
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase"; // Using client SDK on server, which is fine for these operations
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';


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
const addQuestionSchema = z.object({
  text: z.string().min(10, "Question must be at least 10 characters.").max(500, "Question cannot be longer than 500 characters."),
  userId: z.string().min(1, "User ID is required."),
  userName: z.string().min(1, "User name is required."),
  userPhotoURL: z.string().url().optional().nullable(),
});

export async function addQuestion(values: z.infer<typeof addQuestionSchema>) {
    const parsed = addQuestionSchema.safeParse(values);
    if (!parsed.success) {
        return { success: false, message: "Invalid data provided." };
    }
    
    const userDocRef = doc(db, "users", values.userId);
    const userDocSnap = await getDoc(userDocRef);
    const displayName = userDocSnap.data()?.displayName;
    const qnaCollectionRef = collection(db, "qna");
    const dataToAdd = {
        ...parsed.data,
        userName: displayName || values.userName,
        isPinned: false,
        createdAt: serverTimestamp(),
    };

    addDoc(qnaCollectionRef, dataToAdd).catch((e: any) => {
        const error = new FirestorePermissionError({
            path: qnaCollectionRef.path,
            operation: "create",
            requestResourceData: dataToAdd
        });
        errorEmitter.emit('permission-error', error);
        return { success: false, message: e.message };
    });
    
    return { success: true, message: "Question posted successfully!" };
}


// Schema for adding a reply
const addReplySchema = z.object({
    questionId: z.string().min(1, "Question ID is required."),
    text: z.string().min(1, "Reply cannot be empty.").max(500, "Reply cannot be longer than 500 characters."),
    userId: z.string().min(1, "User ID is required."),
    userName: z.string().min(1, "User name is required."),
    userPhotoURL: z.string().url().optional().nullable(),
});

export async function addReply(values: z.infer<typeof addReplySchema>) {
    const parsed = addReplySchema.safeParse(values);
    if (!parsed.success) {
        return { success: false, message: "Invalid data provided." };
    }

    const userDocRef = doc(db, 'users', values.userId);
    const userDoc = await getDoc(userDocRef);
    const userRole = userDoc.data()?.role;
    const displayName = userDoc.data()?.displayName;
    
    const { questionId, ...replyData } = parsed.data;
    const replyCollectionRef = collection(db, "qna", questionId, "replies");
    const dataToAdd = {
        ...replyData,
        userName: displayName || values.userName,
        isAdmin: userRole === 'admin' || userRole === 'superadmin',
        createdAt: serverTimestamp(),
    };
    
    addDoc(replyCollectionRef, dataToAdd).catch((e: any) => {
        const error = new FirestorePermissionError({
            path: replyCollectionRef.path,
            operation: "create",
            requestResourceData: dataToAdd
        });
        errorEmitter.emit('permission-error', error);
        return { success: false, message: e.message };
    });
    
    return { success: true, message: "Reply posted successfully!" };
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

  return { success: true, message: `User role updated to ${newRole}.`};
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
  email: z.string().email("A valid email is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  consent: z.boolean().refine(val => val, { message: "Consent is required."}),
});

export async function createAndRequestOrganizerAccess(values: z.infer<typeof requestOrganizerAccessSchema>) {
  console.log("[Action] Starting createAndRequestOrganizerAccess with values:", values);
  const parsed = requestOrganizerAccessSchema.safeParse(values);
  if (!parsed.success) {
    console.error("[Action] Organizer Zod validation failed:", parsed.error.flatten());
    return { success: false, message: "Invalid data provided." };
  }
  console.log("[Action] Organizer Zod validation successful.");

  const { email, password } = parsed.data;

  try {
    console.log(`[Action] Attempting to create organizer user with email: ${email}`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log(`[Action] Organizer user created successfully. UID: ${user.uid}`);
    
    const userRef = doc(db, "users", user.uid);
    console.log(`[Action] Saving organizer user profile to 'users/${user.uid}'...`);
    await setDoc(userRef, {
        email: user.email,
        displayName: user.email?.split('@')[0],
        role: 'user',
        photoURL: null,
        createdAt: serverTimestamp(),
        accessRequest: {
          requestedAt: serverTimestamp(),
          status: 'pending_review',
        }
    });
    console.log("[Action] Organizer user profile and access request saved.");

    return { success: true, message: "Your account has been created and your request has been submitted. An admin will review it shortly.", uid: user.uid };
  } catch (error: any) {
    console.error("[Action] An error occurred in createAndRequestOrganizerAccess:", error);
    if (error.code === 'auth/email-already-in-use') {
        console.warn(`[Action] Email ${email} is already in use.`);
        return { 
            success: false, 
            message: "An account with this email already exists. Please log in and request access from your dashboard.",
        };
    }
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

export async function manageFaq(values: z.infer<typeof faqSchema> & { adminId: string; faqId?: string }) {
  const { adminId, faqId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = faqSchema.safeParse(data);
  if (!parsed.success) return { success: false, message: "Invalid data." };

  if (faqId) {
    const faqRef = doc(db, "faqs", faqId);
    updateDoc(faqRef, parsed.data).catch((e: any) => {
        const error = new FirestorePermissionError({
            path: faqRef.path, operation: "update", requestResourceData: parsed.data
        });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "FAQ item updated." };
  } else {
    const faqCollectionRef = collection(db, "faqs");
    const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
    addDoc(faqCollectionRef, dataToAdd).catch((e: any) => {
        const error = new FirestorePermissionError({
            path: faqCollectionRef.path, operation: "create", requestResourceData: dataToAdd
        });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "FAQ item added." };
  }
}

export async function deleteFaq(id: string, adminId: string) {
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  
  const faqRef = doc(db, "faqs", id);
  deleteDoc(faqRef).catch((e:any) => {
    const error = new FirestorePermissionError({ path: faqRef.path, operation: "delete" });
    errorEmitter.emit('permission-error', error);
  });

  revalidatePath('/');
  return { success: true, message: "FAQ item deleted." };
}


const scheduleSchema = z.object({
  time: z.string().min(1, "Time is required."),
  title: z.string().min(3, "Title is required."),
  description: z.string().min(10, "Description is required."),
  icon: z.string().min(1, "Icon is required."),
});

export async function manageSchedule(values: z.infer<typeof scheduleSchema> & { adminId: string; scheduleId?: string }) {
  const { adminId, scheduleId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = scheduleSchema.safeParse(data);
  if (!parsed.success) return { success: false, message: "Invalid data." };

  if (scheduleId) {
    const scheduleRef = doc(db, "schedule", scheduleId);
    updateDoc(scheduleRef, parsed.data).catch((e: any) => {
        const error = new FirestorePermissionError({ path: scheduleRef.path, operation: "update", requestResourceData: parsed.data });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "Schedule item updated." };
  } else {
    const scheduleCollectionRef = collection(db, "schedule");
    const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
    addDoc(scheduleCollectionRef, dataToAdd).catch((e: any) => {
        const error = new FirestorePermissionError({ path: scheduleCollectionRef.path, operation: "create", requestResourceData: dataToAdd });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "Schedule item added." };
  }
}

export async function deleteScheduleItem(id: string, adminId: string) {
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  
  const scheduleRef = doc(db, "schedule", id);
  deleteDoc(scheduleRef).catch((e: any) => {
    const error = new FirestorePermissionError({ path: scheduleRef.path, operation: "delete" });
    errorEmitter.emit('permission-error', error);
  });
  
  revalidatePath('/');
  return { success: true, message: "Schedule item deleted." };
}

const organizerSchema = z.object({
  name: z.string().min(3, "Name is required."),
  role: z.string().min(3, "Role is required."),
  imageUrl: z.string().url("A valid URL is required.").or(z.literal("")).optional(),
  imageHint: z.string().optional(),
  contactNumber: z.string().optional(),
});

export async function manageOrganizer(values: z.infer<typeof organizerSchema> & { adminId: string; organizerId?: string }) {
  const { adminId, organizerId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = organizerSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Organizer validation failed:", parsed.error.flatten().fieldErrors);
    return { success: false, message: "Invalid data." };
  }

  const dataToSave = { ...parsed.data };
  Object.keys(dataToSave).forEach((key) => {
      if (dataToSave[key as keyof typeof dataToSave] === "") {
          delete dataToSave[key as keyof typeof dataToSave];
      }
  });
  
  if (organizerId) {
    const organizerRef = doc(db, "organizers", organizerId);
    updateDoc(organizerRef, dataToSave).catch((e: any) => {
        const error = new FirestorePermissionError({ path: organizerRef.path, operation: "update", requestResourceData: dataToSave });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "Organizer updated." };
  } else {
    const organizerCollectionRef = collection(db, "organizers");
    const dataToAdd = { ...dataToSave, createdAt: serverTimestamp() };
    addDoc(organizerCollectionRef, dataToAdd).catch((e: any) => {
        const error = new FirestorePermissionError({ path: organizerCollectionRef.path, operation: "create", requestResourceData: dataToAdd });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "Organizer added." };
  }
}

export async function deleteOrganizer(id: string, adminId: string) {
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  
  const organizerRef = doc(db, "organizers", id);
  deleteDoc(organizerRef).catch((e: any) => {
      const error = new FirestorePermissionError({ path: organizerRef.path, operation: "delete" });
      errorEmitter.emit('permission-error', error);
  });
  
  revalidatePath('/');
  return { success: true, message: "Organizer deleted." };
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

export async function managePromotion(values: z.infer<typeof promotionSchema> & { adminId: string; promotionId?: string }) {
  const { adminId, promotionId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = promotionSchema.safeParse(data);
  if (!parsed.success) return { success: false, message: "Invalid data." };

  if (promotionId) {
    const promotionRef = doc(db, "promotions", promotionId);
    updateDoc(promotionRef, parsed.data).catch((e: any) => {
        const error = new FirestorePermissionError({ path: promotionRef.path, operation: "update", requestResourceData: parsed.data });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "Promotion updated." };
  } else {
    const promotionCollectionRef = collection(db, "promotions");
    const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
    addDoc(promotionCollectionRef, dataToAdd).catch((e: any) => {
        const error = new FirestorePermissionError({ path: promotionCollectionRef.path, operation: "create", requestResourceData: dataToAdd });
        errorEmitter.emit('permission-error', error);
    });
    revalidatePath('/');
    return { success: true, message: "Promotion added." };
  }
}

export async function deletePromotion(id: string, adminId: string) {
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  
  const promotionRef = doc(db, "promotions", id);
  deleteDoc(promotionRef).catch((e: any) => {
      const error = new FirestorePermissionError({ path: promotionRef.path, operation: "delete" });
      errorEmitter.emit('permission-error', error);
  });
  
  revalidatePath('/');
  return { success: true, message: "Promotion deleted." };
}


const locationSchema = z.object({
  origin: z.string().min(5, "Origin is required."),
  destination: z.string().min(5, "Destination is required."),
});

export async function manageLocation(values: z.infer<typeof locationSchema> & { adminId: string }) {
  const { adminId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  
  // Set default value
  const finalData = {
    origin: data.origin || "City Hall",
    destination: data.destination || "Central Park",
  };

  const parsed = locationSchema.safeParse(finalData);
  if (!parsed.success) return { success: false, message: "Invalid data." };
  
  const settingsRef = doc(db, "settings", "route");
  setDoc(settingsRef, parsed.data).catch((e: any) => {
      const error = new FirestorePermissionError({ path: settingsRef.path, operation: "create", requestResourceData: parsed.data });
      errorEmitter.emit('permission-error', error);
  });

  revalidatePath('/');
  return { success: true, message: "Route location updated successfully." };
}

const eventTimeSchema = z.object({
  eventDate: z.date(),
});

export async function manageEventTime(values: z.infer<typeof eventTimeSchema> & { adminId: string }) {
  const { adminId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  
  // Set default value
  const finalData = {
      eventDate: data.eventDate || new Date("2025-08-16T10:00:00")
  }

  const parsed = eventTimeSchema.safeParse(finalData);
  if (!parsed.success) return { success: false, message: "Invalid data." };
  
  const settingsRef = doc(db, "settings", "event");
  const dataToUpdate = { startTime: parsed.data.eventDate };
  setDoc(settingsRef, dataToUpdate, { merge: true }).catch((e: any) => {
      const error = new FirestorePermissionError({ path: settingsRef.path, operation: "update", requestResourceData: dataToUpdate });
      errorEmitter.emit('permission-error', error);
  });

  revalidatePath('/');
  return { success: true, message: "Event time updated successfully." };
}

const generalSettingsSchema = z.object({
    registrationsOpen: z.boolean(),
});

export async function manageGeneralSettings(values: z.infer<typeof generalSettingsSchema> & { adminId: string }) {
  const { adminId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = generalSettingsSchema.safeParse(data);
  if (!parsed.success) return { success: false, message: "Invalid data." };

  const settingsRef = doc(db, "settings", "event");
  setDoc(settingsRef, parsed.data, { merge: true }).catch((e: any) => {
      const error = new FirestorePermissionError({ path: settingsRef.path, operation: "update", requestResourceData: parsed.data });
      errorEmitter.emit('permission-error', error);
  });

  revalidatePath('/');
  revalidatePath('/register');
  return { success: true, message: "Settings updated." };
}

// === LOCATION PARTNER ACTIONS ===

const locationPartnerSchema = z.object({
  name: z.string().min(3, "Name is required."),
  imageUrl: z.string().url("A valid URL is required."),
  imageHint: z.string().min(2, "Image hint is required."),
  websiteUrl: z.string().url("A valid Instagram profile URL is required.").optional(),
});

export async function manageLocationPartner(values: z.infer<typeof locationPartnerSchema> & { adminId: string; partnerId?: string }) {
  const { adminId, partnerId, ...data } = values;
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  const parsed = locationPartnerSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Location partner validation failed:", parsed.error.flatten().fieldErrors);
    return { success: false, message: "Invalid data." };
  }

  if (partnerId) {
      const partnerRef = doc(db, "locationPartners", partnerId);
      updateDoc(partnerRef, parsed.data).catch((e: any) => {
          const error = new FirestorePermissionError({ path: partnerRef.path, operation: "update", requestResourceData: parsed.data });
          errorEmitter.emit('permission-error', error);
      });
      revalidatePath('/');
      return { success: true, message: "Location partner updated." };
  } else {
      const partnerCollectionRef = collection(db, "locationPartners");
      const dataToAdd = { ...parsed.data, createdAt: serverTimestamp() };
      addDoc(partnerCollectionRef, dataToAdd).catch((e: any) => {
          const error = new FirestorePermissionError({ path: partnerCollectionRef.path, operation: "create", requestResourceData: dataToAdd });
          errorEmitter.emit('permission-error', error);
      });
      revalidatePath('/');
      return { success: true, message: "Location partner added." };
  }
}

export async function deleteLocationPartner(id: string, adminId: string) {
  const isAdmin = await checkAdminPermissions(adminId);
  if (!isAdmin) {
    return { success: false, message: "Permission denied." };
  }
  
  const partnerRef = doc(db, "locationPartners", id);
  deleteDoc(partnerRef).catch((e: any) => {
      const error = new FirestorePermissionError({ path: partnerRef.path, operation: "delete" });
      errorEmitter.emit('permission-error', error);
  });
  
  revalidatePath('/');
  return { success: true, message: "Location partner deleted." };
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
  perk1Title: z.string().min(3),
  perk1Description: z.string().min(3),
  perk2Title: z.string().min(3),
  perk2Description: z.string().min(3),
  perk3Title: z.string().min(3),
  perk3Description: z.string().min(3),
});

export async function manageHomepageContent(values: z.infer<typeof homepageContentSchema> & { adminId: string }) {
    const { adminId, ...data } = values;
    const isAdmin = await checkAdminPermissions(adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
    
    const parsed = homepageContentSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: "Invalid data provided." };
    
    const settingsRef = doc(db, "settings", "event");
    setDoc(settingsRef, parsed.data, { merge: true }).catch((e: any) => {
        const error = new FirestorePermissionError({ path: settingsRef.path, operation: "update", requestResourceData: parsed.data });
        errorEmitter.emit('permission-error', error);
    });

    revalidatePath('/');
    return { success: true, message: "Homepage content updated successfully!" };
}

const homepageVisibilitySchema = z.object({
  showSchedule: z.boolean(),
  showReviews: z.boolean(),
  showOrganizers: z.boolean(),
  showPromotions: z.boolean(),
});

export async function manageHomepageVisibility(values: z.infer<typeof homepageVisibilitySchema> & { adminId: string }) {
    const { adminId, ...data } = values;
    const isAdmin = await checkAdminPermissions(adminId);
    if (!isAdmin) return { success: false, message: "Permission denied." };
    
    const parsed = homepageVisibilitySchema.safeParse(data);
    if (!parsed.success) return { success: false, message: "Invalid data provided." };
    
    const settingsRef = doc(db, "settings", "event");
    setDoc(settingsRef, parsed.data, { merge: true }).catch((e: any) => {
        const error = new FirestorePermissionError({ path: settingsRef.path, operation: "update", requestResourceData: parsed.data });
        errorEmitter.emit('permission-error', error);
    });

    revalidatePath('/');
    return { success: true, message: "Homepage section visibility updated." };
}
