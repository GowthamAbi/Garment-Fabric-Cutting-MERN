// Render initialization check only; not a browser interaction test.
import {createServer} from '../client/node_modules/vite/dist/node/index.js';
import React from '../client/node_modules/react/index.js';
import {renderToString} from '../client/node_modules/react-dom/server.node.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../client/',import.meta.url));
globalThis.localStorage={getItem:()=>null};
globalThis.window={location:{pathname:'/login',hostname:'localhost',href:'http://localhost/login',search:''}};
const server=await createServer({root,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true}});
try{
 const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');
 const {LanguageProvider}=await server.ssrLoadModule('/src/context/LanguageContext.jsx');
 for(const name of ['MainLayout','SuperAdminLayout']){
  const {default:Layout}=await server.ssrLoadModule('/src/components/layout/'+name+'.jsx');
  const html=renderToString(React.createElement(AuthProvider,null,React.createElement(LanguageProvider,null,React.createElement(Layout,{page:'Company Dashboard',onPageChange:()=>{}},'Acceptance render'))));
  for(const label of ['Light theme','Dark theme','System theme','Profile and help'])if(!html.includes(label))throw new Error(name+': missing '+label);
  console.log(name+': render passed');
 }
}finally{await server.close();}
