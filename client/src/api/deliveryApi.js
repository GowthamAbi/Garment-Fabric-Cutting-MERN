import { api } from "../api.js";
const qs = (p={}) => { const s=new URLSearchParams(Object.entries(p).filter(([,v])=>v)); return s.toString()?`?${s}`:""; };
export const deliveryApi = {
  vendors: (p) => api("/delivery/vendors"+qs(p)), vendor: (code) => api("/delivery/vendors/"+encodeURIComponent(code)),
  saveVendor: (data,id) => api("/delivery/vendors"+(id?`/${id}`:""), {method:id?"PUT":"POST",body:JSON.stringify(data)}),
  plans: () => api("/delivery/plans"), plan: (no) => api("/delivery/plans/"+encodeURIComponent(no)),
  saveChallan: (data) => api("/delivery/challans", {method:"POST",body:JSON.stringify(data)}),
  history: (p) => api("/delivery/history"+qs(p)), cuttingStock: () => api("/delivery/cutting-stock"),
};
