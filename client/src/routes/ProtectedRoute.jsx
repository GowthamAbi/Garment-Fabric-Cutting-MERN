import { useAuth } from "../context/AuthContext.jsx";
import LoginPage from "../pages/auth/LoginPage.jsx";
export default function ProtectedRoute({ children }) {
  const { token, checkingSession } = useAuth();
  if (checkingSession)
    return (
      <div className="secure-session-check">Verifying secure session…</div>
    );
  return token ? children : <LoginPage />;
}
