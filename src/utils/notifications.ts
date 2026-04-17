import { db } from "../services/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Get admin user ID (you may need to fetch this from a config or hardcode for now)
// We'll assume there's a way to get the admin ID. For simplicity, we'll store admin ID in Firestore settings.
// Alternatively, you can fetch all admins from a "roles" collection, but for now we'll create a function that writes to a single admin.
// We'll use a placeholder: you need to replace with your actual admin ID.

export const createAdminNotification = async (
  type: "donor_pending" | "request_pending" | "support_message",
  title: string,
  body: string,
  data?: any
) => {
  // For a production app, you'd store admin IDs in a collection and iterate.
  // Here we assume there is a document 'adminConfig' with adminId field.
  try {
    const adminId = "ADMIN_USER_ID_PLACEHOLDER"; // Replace with actual admin ID
    if (!adminId) return;

    await addDoc(collection(db, "notifications"), {
      userId: adminId,
      type,
      title,
      body,
      data: data || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating admin notification:", error);
  }
};