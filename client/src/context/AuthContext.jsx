import { createContext, useContext, useState } from "react";
import { tokenService } from "../services/tokenService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(tokenService.getToken());
  const [user, setUser] = useState(tokenService.getUser());

  function login(loginData) {
    tokenService.saveLogin(loginData);
    setToken(loginData.token);
    setUser(loginData.user);
  }

  function logout() {
    tokenService.clearLogin();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
