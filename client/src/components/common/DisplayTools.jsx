import {useEffect,useState} from 'react';
import {Sun,Moon} from 'lucide-react';
import SubscriptionBell from './SubscriptionBell.jsx';
export default function DisplayTools({user,onRenew}) {
 const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('ug-display-theme')==='dark'?'dark':'light';}catch{return 'light';}});
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('ug-display-theme',theme);}catch{}},[theme]);
 return <div className="display-tools corner-display-tools">{user?.role!=='saas_super_admin'&&<SubscriptionBell user={user} onRenew={onRenew}/>}<button type="button" className="theme-swap" role="switch" aria-checked={theme==='dark'} aria-label="Dark theme" title={theme==='dark'?'Switch to light theme':'Switch to dark theme'} onClick={()=>setTheme(v=>v==='dark'?'light':'dark')}><Sun className="theme-sun" size={18}/><Moon className="theme-moon" size={18}/><span className="theme-thumb" aria-hidden="true"/></button></div>;
}
