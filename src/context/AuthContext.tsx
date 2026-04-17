import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig"; // ✅ import the existing auth instance

type Role = "donor" | "requester" | "admin" | "user" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  termsAccepted: boolean;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  termsAccepted: false,
  loading: true,
  refreshUserProfile: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setRole(null);
      setTermsAccepted(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setRole((data.role ?? null) as Role);
        // Show terms gate only for accounts explicitly marked with termsAccepted=false (new registrations).
        // Existing accounts without this field should not be blocked.
        const hasTermsAcceptedField = Object.prototype.hasOwnProperty.call(data, "termsAccepted");
        setTermsAccepted(hasTermsAcceptedField ? Boolean(data.termsAccepted) : true);
      } else {
        setRole(null);
        setTermsAccepted(false);
      }
    } catch (error) {
      const firebaseError = error as any;
      // Silence common permission/read race noise during auth transitions.
      if (firebaseError?.code !== "permission-denied") {
        console.warn("User profile could not be loaded.");
      }
      setRole(null);
      setTermsAccepted(false);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setLoading(true);
        if (firebaseUser) {
          setUser(firebaseUser);
          await refreshUserProfile();
        } else {
          setUser(null);
          setRole(null);
          setTermsAccepted(false);
        }
        setLoading(false);
      });
    } catch {
      console.warn("Auth listener failed to initialize.");
      setUser(null);
      setRole(null);
      setTermsAccepted(false);
      setLoading(false);
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [loading]);

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, termsAccepted, loading, refreshUserProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
