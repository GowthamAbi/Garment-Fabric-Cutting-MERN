import { Boxes, ClipboardList, Factory, Gauge, Layers3, Menu, PackageOpen, Ruler, Scissors, X } from "lucide-react";
import { useState } from "react";
const links = [["Dashboard", Gauge], ["Garment BOM", ClipboardList], ["Purchase Orders", ClipboardList], ["Fabric Master", Layers3], ["Fabric Inward", PackageOpen], ["Fabric Outward", Boxes], ["Cutting Queue", Scissors], ["Machines", Factory], ["Cutting Actual", Ruler], ["Folding Fabric", Layers3]];
export default function Layout({ page, setPage, children }) {
  const [open, setOpen] = useState(false);
  const select = (name) => { setPage(name); setOpen(false); };
  return <div className="shell"><aside className={open ? "open" : ""}><div className="brand"><span><Factory /></span><div><b>Garment Fabric Flow</b><small>FABRIC TO FOLDING</small></div><button onClick={() => setOpen(false)}><X /></button></div><nav>{links.map(([name, Icon]) => <button className={page === name ? "active" : ""} key={name} onClick={() => select(name)}><Icon />{name}</button>)}</nav><footer>Standalone module<br /><small>Ready for Accessories merge</small></footer></aside>{open && <div className="shade" onClick={() => setOpen(false)} />}<main><header><button className="menu" onClick={() => setOpen(true)}><Menu /></button><div><small>GARMENT PRODUCTION</small><h1>{page}</h1></div></header><div className="content">{children}</div></main></div>;
}
