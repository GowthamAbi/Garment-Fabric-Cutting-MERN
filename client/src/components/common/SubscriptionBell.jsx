import {useEffect,useRef,useState} from "react";
import {Bell} from "lucide-react";
import {createPortal} from "react-dom";
import {api} from "../../api.js";
export default function SubscriptionBell({user,onRenew}){
  const [status,setStatus]=useState(null),[open,setOpen]=useState(false);
  const panel=useRef(null),dropdown=useRef(null);
  const [position,setPosition]=useState({top:64,right:12});
  useEffect(()=>{if(!open)return;const place=()=>{const bounds=panel.current?.getBoundingClientRect();if(bounds)setPosition({top:Math.min(bounds.bottom+10,window.innerHeight-120),right:Math.max(12,window.innerWidth-bounds.right)});};
    place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};},[open]);
  useEffect(()=>{let alive=true;const load=()=>api("/saas/access-status").then(v=>{if(alive)setStatus(v);}).catch(()=>{});
    load();const timer=setInterval(load,60000);return()=>{alive=false;clearInterval(timer);};},[user?._id]);
  useEffect(()=>{if(!open)return;const close=e=>{if(!panel.current?.contains(e.target)&&!dropdown.current?.contains(e.target))setOpen(false);};const escape=e=>{if(e.key==="Escape"){setOpen(false);panel.current?.querySelector("button")?.focus();}};
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};},[open]);
  const attention=status && (status.alert!=="ACTIVE" || status.kind==="TRIAL");
  return <div className="subscription-bell" ref={panel}>
    <button type="button" aria-label="Subscription notifications" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Bell size={20}/>{attention && <span className="notification-dot" aria-hidden="true"/>}</button>
    {open && createPortal(<div ref={dropdown} className="subscription-notification-panel" style={{position:"fixed",top:position.top,right:position.right,zIndex:2200,maxHeight:"calc(100dvh - 100px)",overflowY:"auto"}}><strong>Subscription notifications</strong>
      {!status ? <p>Subscription status is unavailable. Try again shortly.</p> : <p>
        {status.alert==="PAYMENT_PENDING"?"Payment is required to activate your package.":status.expired?"Subscription expired. Renew to continue.":status.kind==="TRIAL"?
          `Trial: ${status.daysRemaining} day(s) remaining.`:`Subscription: ${status.daysRemaining} day(s) remaining.`}
        {status.expiresAt && <> Expires {new Date(status.expiresAt).toLocaleDateString("en-IN")}.</>}</p>}
      {["company_owner","company_admin","admin"].includes(user?.role) && onRenew && <button type="button" onClick={()=>{setOpen(false);onRenew();}}>Payment / Upgrade / Renew</button>}
    </div>,document.body)}
  </div>;
}
