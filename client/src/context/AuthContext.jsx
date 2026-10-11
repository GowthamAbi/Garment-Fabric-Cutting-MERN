import { createContext, useContext, useEffect, useState } from "react";
import { request } from "../api/axiosInstance.js";
import { tokenService } from "../services/tokenService.js";
import { companyKeyFromLocation, tenantLoginPath } from "../utils/tenantClient.js";
import { idleExpired } from '../utils/sessionPolicy.js';
import {posScope,removeOfflineCatalog} from '../utils/offlinePos.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const lockKey='ug-session-lock:'+companyKeyFromLocation(),activityKey='ug-session-activity:'+companyKeyFromLocation();

  function clearSensitiveBrowserState() {
    tokenService.clearLegacyLogin();
    sessionStorage.clear();
    localStorage.removeItem("elastic_production_scan_draft");
  }

  useEffect(() => {
    clearSensitiveBrowserState();
    if(localStorage.getItem(lockKey)|| (localStorage.getItem(activityKey)&&idleExpired(Number(localStorage.getItem(activityKey))))){localStorage.setItem(lockKey,'1');setCheckingSession(false);return;}

    request("/auth/session", {
      suppressGlobalError: true,
      suppressSessionExpired: true,
    })
      .then((session) => {if(!localStorage.getItem(lockKey))setUser(session.user);})
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));

    const expireSession = () => {
      localStorage.setItem(lockKey,'1');
      clearSensitiveBrowserState();
      setUser(null);
      window.history.replaceState({}, "", tenantLoginPath(companyKeyFromLocation()));
    };

    window.addEventListener("ug-session-expired", expireSession);
    return () =>
      window.removeEventListener("ug-session-expired", expireSession);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let lastWrite=0;
    const readLast=()=>Number(localStorage.getItem(activityKey)||0);
    const check=()=>{if(localStorage.getItem(lockKey)||idleExpired(readLast()))logout();};
    const lockAfterInactivity = event => {
      if(event&&!event.isTrusted)return;
      if(idleExpired(readLast())){logout();return;}
      if(Date.now()-lastWrite>1000){lastWrite=Date.now();localStorage.setItem(activityKey,String(lastWrite));}
    };
    const activityEvents = ["pointermove", "pointerdown", "keydown", "touchstart", "scroll"];

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, lockAfterInactivity, {
        passive: true,
      }),
    );
    if(!localStorage.getItem(activityKey))localStorage.setItem(activityKey,String(Date.now()));
    const inactivityTimer=window.setInterval(check,1000);
    window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
    const storage=e=>{if(e.key===lockKey&&e.newValue){clearSensitiveBrowserState();setUser(null);}};
    window.addEventListener('storage',storage);

    return () => {
      window.clearInterval(inactivityTimer);
      window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);window.removeEventListener('storage',storage);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, lockAfterInactivity),
      );
    };
  }, [user?._id]);

  function login(loginData) {
    clearSensitiveBrowserState();
    localStorage.removeItem(lockKey);localStorage.setItem(activityKey,String(Date.now()));
    setUser(loginData.user);
  }

  async function logout() {
    setCheckingSession(true);
    localStorage.setItem(lockKey,'1');localStorage.removeItem(activityKey);
    if(user?.companyId&&user?.factoryId)try{removeOfflineCatalog(posScope(user,companyKeyFromLocation())).catch(()=>{});}catch{}
    clearSensitiveBrowserState();setUser(null);
    window.history.replaceState({}, "", tenantLoginPath(companyKeyFromLocation()));
    try {
      await request("/auth/logout", {
        method: "POST",
        suppressGlobalError: true,
        suppressSessionExpired: true,
      });
    } catch {
      // Local lock still happens if the network is unavailable.
    }
    setCheckingSession(false);
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
