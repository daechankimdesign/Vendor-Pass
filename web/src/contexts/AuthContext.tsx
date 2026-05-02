import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export type UserRole = "property_manager" | "vendor" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  createdAt: unknown;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    role: Exclude<UserRole, "admin">,
    displayName: string,
    inviteId?: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  sendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        setProfile(snap.exists() ? { uid: firebaseUser.uid, ...(snap.data() as Omit<UserProfile, "uid">) } : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signUp(
    email: string,
    password: string,
    role: Exclude<UserRole, "admin">,
    displayName: string,
    inviteId?: string
  ) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = credential.user;

    // Create users/{uid} doc
    const userProfile: Omit<UserProfile, "uid"> = {
      email,
      role,
      displayName,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", uid), userProfile);

    // If vendor, create vendor shell doc (public fields only)
    if (role === "vendor") {
      await setDoc(doc(db, "vendors", uid), {
        businessName: "",
        businessZipCode: "",
        serviceZipCodes: [],
        categories: [],
        discoverable: true,
        createdAt: serverTimestamp(),
      });
      // Private contact doc
      await setDoc(doc(db, "vendors", uid, "private", "contact"), {
        contactEmail: email,
        phone: "",
      });
    }

    // Attach pending invite if present
    if (inviteId) {
      const { attachInviteToNewVendor } = await import("../lib/firestore");
      await attachInviteToNewVendor(inviteId, uid);
    }

    await sendEmailVerification(credential.user);
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logOut() {
    await signOut(auth);
  }

  async function sendVerification() {
    if (user) await sendEmailVerification(user);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, logOut, sendVerification }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
