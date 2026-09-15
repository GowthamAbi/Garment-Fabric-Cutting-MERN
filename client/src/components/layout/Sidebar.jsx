import {
  ArrowDownToLine,
  Boxes,
  Clock3,
  FileClock,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShoppingCart,
  Printer,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const links = [
  ["Dashboard", LayoutDashboard],
  ["Inward", ArrowDownToLine],
  ["PO", ShoppingCart],
  ["PO Pending", Clock3],
  ["Print", Printer],
  ["Stock", Boxes],
  ["History", FileClock],
  ["Master Data", Settings2],
];

export default function Sidebar({ page, open, onSelect, onClose }) {
  const { user, logout } = useAuth();
  return (
    <aside className={open ? "open" : ""}>
      <div className="brand">
        <span className="brand-icon">
          <Sparkles />
        </span>
        <div className="brand-copy">
          <b className="brand-title">Accessories Flow</b>
          <small className="brand-subtitle">ACCESSORIES MANAGER</small>
        </div>
        <button className="brand-close" onClick={onClose}>
          <X />
        </button>
      </div>
      <nav>
        {links.map(([name, Icon]) => (
          <button
            key={name}
            className={page === name ? "active" : ""}
            onClick={() => onSelect(name)}
          >
            <Icon />
            {name}
          </button>
        ))}
      </nav>
      <div className="profile">
        <div>
          <b>{user?.name}</b>
          <small>{user?.role}</small>
        </div>
        <button onClick={logout}>
          <LogOut />
        </button>
      </div>
    </aside>
  );
}
