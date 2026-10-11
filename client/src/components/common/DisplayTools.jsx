import {useEffect,useState} from 'react';
import OptionGuide from './OptionGuide.jsx';
export default function DisplayTools({page}){
 const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('ug-display-theme')||'system';}catch{return 'system';}}),[help,setHelp]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;};apply();media.addEventListener('change',apply);try{localStorage.setItem('ug-display-theme',theme);}catch{}return()=>media.removeEventListener('change',apply);},[theme]);
 return <div className="display-tools"><label><span className="sr-only">Display theme</span><select aria-label="Display theme" value={theme} onChange={e=>setTheme(e.target.value)}><option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option></select></label><button onClick={()=>setHelp(true)}>How to use</button>{help&&<OptionGuide page={page} onClose={()=>setHelp(false)}/>}</div>;
}
