import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

type Role = "donor" | "requester" | "super_admin" | "admin" | "blood_admin" | "funeral_admin" | "user" | null;
type BanNotice = { reason: string; banEndsLabel: string } | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  termsAccepted: boolean;
  banNotice: BanNotice;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
  clearBanNotice: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  termsAccepted: false,
  banNotice: null,
  loading: true,
  refreshUserProfile: async () => {},
  clearBanNotice: () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [banNotice, setBanNotice] = useState<BanNotice>(null);
  const [loading, setLoading] = useState(true);

  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "object" && value !== null && "toDate" in value) {
      const converted = (value as { toDate?: () => Date }).toDate?.();
      return converted && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const clearBanNotice = () => setBanNotice(null);

  const handleUserProfile = useCallback(async (firebaseUser: User, data: Record<string, any>) => {
    const disabled = Boolean(data?.disabled);
    const bannedUntil = toDate(data?.bannedUntil);
    const hasValidBanEnd = bannedUntil !== null;

    if (disabled && hasValidBanEnd && bannedUntil.getTime() <= Date.now()) {
      try {
        await updateDoc(doc(db, "users", firebaseUser.uid), {
          disabled: false,
          banReason: null,
          bannedBy: null,
          bannedAt: null,
          bannedUntil: null,
        });
      } catch {
        // Best effort only; do not block access refresh if this cleanup fails.
      }
    }

    if (disabled && (!hasValidBanEnd || bannedUntil.getTime() > Date.now())) {
      setBanNotice({
        reason: String(data?.banReason || "").trim() || "No reason provided by admin.",
        banEndsLabel: hasValidBanEnd ? bannedUntil.toLocaleString() : "No end date (permanent)",
      });
      setRole(null);
      setTermsAccepted(false);
      try {
        await auth.signOut();
      } catch {
        // Ignore auth race errors on forced sign-out.
      }
      return;
    }

    setRole((data.role ?? null) as Role);
    const hasTermsAcceptedField = Object.prototype.hasOwnProperty.call(data, "termsAccepted");
    setTermsAccepted(hasTermsAcceptedField ? Boolean(data.termsAccepted) : true);
  }, []);

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
        await handleUserProfile(firebaseUser, userDoc.data() as Record<string, any>);
      } else {
        setRole(null);
        setTermsAccepted(false);
      }
    } catch (error) {
      const firebaseError = error as any;
      if (firebaseError?.code !== "permission-denied") {
        console.warn("User profile could not be loaded.");
      }
      setRole(null);
      setTermsAccepted(false);
    }
  };

  useEffect(() => {
    let unsubscribeAuth = () => {};
    let unsubscribeUserDoc: (() => void) | null = null;

    try {
      unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        unsubscribeUserDoc?.();
        unsubscribeUserDoc = null;
        setLoading(true);

        if (firebaseUser) {
          setUser(firebaseUser);
          unsubscribeUserDoc = onSnapshot(
            doc(db, "users", firebaseUser.uid),
            (snapshot) => {
              const data = snapshot.data() as Record<string, any> | undefined;
              if (!data) {
                setRole(null);
                setTermsAccepted(false);
                setLoading(false);
                return;
              }
              void (async () => {
                await handleUserProfile(firebaseUser, data);
                setLoading(false);
              })();
            },
            (error) => {
              console.warn("User profile listener warning:", (error as any)?.message || error);
              setRole(null);
              setTermsAccepted(false);
              setLoading(false);
            }
          );
          return;
        }

        setUser(null);
        setRole(null);
        setTermsAccepted(false);
        setLoading(false);
      });
    } catch {
      console.warn("Auth listener failed to initialize.");
      setUser(null);
      setRole(null);
      setTermsAccepted(false);
      setLoading(false);
    }

    return () => {
      unsubscribeUserDoc?.();
      unsubscribeAuth();
    };
  }, [handleUserProfile]);

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
    <AuthContext.Provider
      value={{ user, role, termsAccepted, banNotice, loading, refreshUserProfile, clearBanNotice, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
