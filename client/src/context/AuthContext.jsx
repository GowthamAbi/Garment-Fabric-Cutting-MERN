import { createContext, useContext, useEffect, useState } from "react";
import { request } from "../api/axiosInstance.js";
import { tokenService } from "../services/tokenService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  function clearSensitiveBrowserState() {
    tokenService.clearLegacyLogin();
    sessionStorage.clear();
    localStorage.removeItem("elastic_production_scan_draft");
  }

  useEffect(() => {
    clearSensitiveBrowserState();

    request("/auth/session", {
      suppressGlobalError: true,
      suppressSessionExpired: true,
    })
      .then((session) => setUser(session.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));

    const expireSession = () => {
      clearSensitiveBrowserState();
      setUser(null);
      window.history.replaceState({}, "", "/");
    };

    window.addEventListener("ug-session-expired", expireSession);
    return () =>
      window.removeEventListener("ug-session-expired", expireSession);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let inactivityTimer;
    const lockAfterInactivity = () => {
      window.clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(() => logout(), 30 * 60 * 1000);
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, lockAfterInactivity, {
        passive: true,
      }),
    );
    lockAfterInactivity();

    return () => {
      window.clearTimeout(inactivityTimer);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, lockAfterInactivity),
      );
    };
  }, [user?._id]);

  function login(loginData) {
    clearSensitiveBrowserState();
    setUser(loginData.user);
  }

  async function logout() {
    try {
      await request("/auth/logout", {
        method: "POST",
        suppressGlobalError: true,
        suppressSessionExpired: true,
      });
    } catch {
      // Local lock still happens if the network is unavailable.
    }
    clearSensitiveBrowserState();
    setUser(null);
    window.history.replaceState({}, "", "/");
  }

  return (
    <AuthContext.Provider
      value={{ token: Boolean(user), user, login, logout, checkingSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
