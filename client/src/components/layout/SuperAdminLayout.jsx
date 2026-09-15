import { useState } from "react";
import { Building2, ChevronDown, CreditCard, DatabaseBackup, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UserCircle, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const ownerNavigation = [
  ["SaaS Owner Dashboard", LayoutDashboard],
  ["Companies", Building2],
  ["Subscriptions", CreditCard],
  ["Owner Users", Users],
  ["Audit & Backup", DatabaseBackup],
  ["Owner Settings", Settings],
];

export default function SuperAdminLayout({ page, onPageChange, children }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  function select(name) { onPageChange(name); setMenuOpen(false); setProfileOpen(false); }
  function signOut() { localStorage.removeItem("elastic_production_scan_draft"); window.history.replaceState({}, "", "/"); logout(); }
  return <div className="owner-shell">
    <aside className={menuOpen ? "open" : ""}>
      <div className="owner-brand"><span><ShieldCheck/></span><div><b>Accessories Flow</b><small>SAAS OWNER CONSOLE</small></div><button onClick={()=>setMenuOpen(false)}><X/></button></div>
      <nav>{ownerNavigation.map(([name,Icon])=><button key={name} className={page===name?"active":""} onClick={()=>select(name)}><Icon/><span>{name}</span></button>)}</nav>
      <div className="owner-account">
        <button className="owner-profile-trigger" onClick={()=>setProfileOpen((open)=>!open)}><UserCircle/><span><b>{user?.name}</b><small>Super Administrator</small></span><ChevronDown className={profileOpen?"open":""}/></button>
        {profileOpen&&<div className="owner-profile-menu"><button onClick={()=>select("Account Details")}>Account Details</button><button onClick={()=>select("Profile Settings")}>Profile Settings</button><button onClick={()=>select("Owner Settings")}>Settings</button><button className="danger" onClick={signOut}><LogOut/> Logout</button></div>}
      </div>
    </aside>
    {menuOpen&&<div className="shade" onClick={()=>setMenuOpen(false)}/>}<main><header className="owner-topbar"><button className="menu" onClick={()=>setMenuOpen(true)}><Menu/></button><div><small>OWNER CONTROL CENTRE</small><h1>{page}</h1></div><span className="owner-secure"><ShieldCheck/> Secure</span></header><div className="page">{children}</div></main>
  </div>;
}
