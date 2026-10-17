import { defineConfig, loadEnv } from "vite";
import {assertSafeNetlifyPreview} from "./src/utils/apiEndpointPolicy.mjs";
import react from "@vitejs/plugin-react";
import { readFileSync } from 'node:fs';

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),"VITE_");
  assertSafeNetlifyPreview({context:process.env.CONTEXT,apiUrl:env.VITE_API_URL});
  return {
  plugins: [react(), {name:'offline-pos-shared-modules',generateBundle(){
    for(const [fileName,path] of [['offline-pos/drafts.js','./src/utils/offlinePos.js'],['offline-pos/receipt.js','./src/utils/offlineReceipt.js']])
      this.emitFile({type:'asset',fileName,source:readFileSync(new URL(path,import.meta.url),'utf8')});
  }}],

  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("jspdf") || id.includes("html2canvas")) return "pdf-tools";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
        },
      },
    },
  },
};
});
