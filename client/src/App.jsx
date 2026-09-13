import { useState } from "react";
import Layout from "./components/Layout.jsx";
import Feedback from "./components/Feedback.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import MasterPage from "./pages/MasterPage.jsx";
import BomPage from "./pages/BomPage.jsx";
import PurchaseOrderPage from "./pages/PurchaseOrderPage.jsx";
import InwardPage from "./pages/InwardPage.jsx";
import OutwardPage from "./pages/OutwardPage.jsx";
import CuttingPage from "./pages/CuttingPage.jsx";
import CuttingActualPage from "./pages/CuttingActualPage.jsx";
export default function App(){const[page,setPage]=useState('Dashboard');let content=<DashboardPage/>;if(page==='Garment BOM')content=<BomPage/>;if(page==='Purchase Orders')content=<PurchaseOrderPage/>;if(page==='Fabric Master')content=<MasterPage mode="fabric"/>;if(page==='Fabric Inward')content=<InwardPage/>;if(page==='Fabric Outward')content=<OutwardPage/>;if(page==='Cutting Queue')content=<CuttingPage mode="queue"/>;if(page==='Machines')content=<CuttingPage mode="machines"/>;if(page==='Cutting Actual')content=<CuttingActualPage/>;if(page==='Folding Fabric')content=<CuttingPage mode="folding"/>;return <><Feedback/><Layout page={page} setPage={setPage}>{content}</Layout></>}
