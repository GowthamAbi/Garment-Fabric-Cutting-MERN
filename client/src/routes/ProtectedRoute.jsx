import { useAuth } from "../context/AuthContext.jsx";
import LoginPage from "../pages/auth/LoginPage.jsx";
export default function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <LoginPage />;
}
