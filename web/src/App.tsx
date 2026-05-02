import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ADMIN_EMAILS } from "./config/admins";

// Route shells — will be fully implemented after design.md handoff
import Landing from "./routes/Landing";
import Login from "./routes/Login";
import Signup from "./routes/Signup";
import VerifyEmail from "./routes/VerifyEmail";
import Onboard from "./routes/Onboard";
import VendorDashboard from "./routes/VendorDashboard";
import PmDashboard from "./routes/PmDashboard";
import Search from "./routes/Search";
import ProjectDetail from "./routes/ProjectDetail";
import VendorDetail from "./routes/VendorDetail";
import Admin from "./routes/Admin";
import Terms from "./routes/Terms";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/terms" element={<Terms />} />

      <Route
        path="/onboard"
        element={
          <RequireAuth>
            <Onboard />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor"
        element={
          <RequireAuth>
            <VendorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <PmDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/search"
        element={
          <RequireAuth>
            <Search />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <RequireAuth>
            <ProjectDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/vendors/:id"
        element={
          <RequireAuth>
            <VendorDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <Admin />
          </RequireAdmin>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
