import { useAuth } from "../context/AuthContext.jsx";
import LoginPage from "../pages/auth/LoginPage.jsx";
import UGSaaSLoader from "../components/common/UGSaaSLoader.jsx";
export default function ProtectedRoute({ children }) {
  const { token, checkingSession } = useAuth();
  if (checkingSession)
    return (
      <div className="ug-session-loading"><UGSaaSLoader message="Verifying your secure session..." /></div>
    );
  return token ? children : <LoginPage />;
}
