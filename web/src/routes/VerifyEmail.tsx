import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { getVendorProfile } from "../lib/firestore";

export default function VerifyEmail() {
  const { user, profile, sendVerification } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);

  // Poll for email verification every 5 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        clearInterval(interval);
        await redirectAfterVerification(navigate, profile?.role ?? null, user.uid);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, profile, navigate]);

  async function handleResend() {
    setResending(true);
    try {
      await sendVerification();
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    await auth.currentUser?.reload();
    if (auth.currentUser?.emailVerified) {
      await redirectAfterVerification(navigate, profile?.role ?? null, user?.uid ?? "");
    } else {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-gutter">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-display text-on-surface mb-md">Check your email</h1>
        <p className="text-body-md text-on-surface-variant mb-lg">
          We sent a verification link to{" "}
          <strong className="text-on-surface">{user?.email}</strong>.
          <br />
          Click the link to activate your account.
        </p>

        <div className="space-y-sm">
          <button
            className="btn-primary w-full"
            onClick={handleCheckNow}
            disabled={checking}
          >
            {checking ? "Checking…" : "I've verified my email"}
          </button>

          {resent ? (
            <p className="text-body-sm text-on-surface-variant">Verification email resent.</p>
          ) : (
            <button
              className="btn-tertiary text-body-sm"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

async function redirectAfterVerification(
  navigate: ReturnType<typeof useNavigate>,
  role: string | null,
  uid: string
) {
  if (role === "vendor") {
    const profile = await getVendorProfile(uid);
    navigate(profile?.businessName ? "/vendor" : "/onboard", { replace: true });
  } else if (role === "property_manager") {
    navigate("/dashboard", { replace: true });
  } else if (role === "admin") {
    navigate("/admin", { replace: true });
  } else {
    navigate("/dashboard", { replace: true });
  }
}
