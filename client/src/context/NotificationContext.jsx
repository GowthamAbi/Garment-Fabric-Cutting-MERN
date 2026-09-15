import { createContext, useContext, useState } from "react";
const NotificationContext = createContext(null);
export function NotificationProvider({ children }) {
  const [message, setMessage] = useState("");
  function notify(text) {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  }
  return (
    <NotificationContext.Provider value={{ message, notify }}>
      {children}
    </NotificationContext.Provider>
  );
}
export const useNotification = () => useContext(NotificationContext);
