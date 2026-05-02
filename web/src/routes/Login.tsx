import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getVendorProfile } from "../lib/firestore";

export default function Login() {
  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      // Auth state change handled by useEffect below
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  // Redirect once auth state updates
  if (user && user.emailVerified && profile) {
    redirectByRole(navigate, profile.role, profile.uid);
    return null;
  }

  if (user && !user.emailVerified) {
    navigate("/verify-email", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-gutter">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-display text-on-surface block mb-lg">
          VendorPass.
        </Link>

        <h1 className="text-h1 text-on-surface mb-lg">Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-md">
          <div>
            <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
              Email
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
              Password
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-body-sm text-error">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-lg text-body-sm text-on-surface-variant">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

async function redirectByRole(
  navigate: ReturnType<typeof useNavigate>,
  role: string,
  uid: string
) {
  if (role === "vendor") {
    const profile = await getVendorProfile(uid);
    if (!profile?.businessName) {
      navigate("/onboard", { replace: true });
    } else {
      navigate("/vendor", { replace: true });
    }
  } else if (role === "property_manager") {
    navigate("/dashboard", { replace: true });
  } else if (role === "admin") {
    navigate("/admin", { replace: true });
  }
}
