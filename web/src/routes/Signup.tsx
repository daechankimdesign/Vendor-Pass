import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { UserRole } from "../contexts/AuthContext";

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteId = params.get("invite") ?? undefined;

  const [role, setRole] = useState<Exclude<UserRole, "admin">>("property_manager");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password, role, displayName, inviteId);
      navigate("/verify-email", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("email-already-in-use")) {
        setError("An account with this email already exists.");
      } else {
        setError("Sign up failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-gutter">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-display text-on-surface block mb-lg">
          Compliance Roster.
        </Link>

        {inviteId && (
          <div className="mb-lg bg-surface-container-low border border-outline-variant rounded p-sm text-body-sm text-on-surface-variant">
            You've been invited. Create an account to accept.
          </div>
        )}

        <h1 className="text-h1 text-on-surface mb-lg">Create account</h1>

        <form onSubmit={handleSubmit} className="space-y-md">
          {/* Role selection */}
          <div>
            <p className="text-label-caps uppercase text-on-surface-variant mb-sm">I am a</p>
            <div className="flex gap-sm">
              {(["property_manager", "vendor"] as const).map((r) => (
                <label
                  key={r}
                  className={`flex-1 flex items-center justify-center gap-sm py-sm px-md rounded border cursor-pointer text-body-md transition-colors ${
                    role === r
                      ? "border-primary-container bg-surface-container-low text-on-surface"
                      : "border-tier-1-border text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="sr-only"
                  />
                  {r === "property_manager" ? "Property Manager" : "Vendor"}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
              {role === "vendor" ? "Business name" : "Full name"}
            </label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

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
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="mt-xs text-body-sm text-on-surface-variant">Minimum 8 characters</p>
          </div>

          {error && <p className="text-body-sm text-error">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-lg text-body-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link to="/login" className="text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
