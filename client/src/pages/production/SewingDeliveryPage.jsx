import { useEffect, useState } from "react";
import { createSewingDelivery, getSewingDeliveries, getSewingHolds, saveSewingHold, resolveSewingHold } from "../../api/productionApi.js";
import DataTable from "../../components/DataTable.jsx";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

const blank = { outwardNo:"", sewingName:"", deliveryPerson:"", colour:"", size:"", quantity:"", remarks:"" };
const blankHold = { outwardNo:"", colour:"", size:"", quantity:"", reason:"Quality hold", remarks:"" };
export default function SewingDeliveryPage({ notify }) {
  const [form,setForm]=useState(blank); const [rows,setRows]=useState([]);
  const [holdForm,setHoldForm]=useState(blankHold); const [holds,setHolds]=useState([]);
  async function load(){const [deliveries, holdRows] = await Promise.all([getSewingDeliveries(), getSewingHolds()]); setRows(deliveries); setHolds(holdRows);} useEffect(()=>{load();},[]);
  async function submit(event){event.preventDefault();await createSewingDelivery(form);setForm(blank);await load();notify("Sewing delivery saved");}
  async function submitHold(event){event.preventDefault();await saveSewingHold(holdForm);setHoldForm(blankHold);await load();notify("Sewing hold saved");}
  const columns=[{key:"deliveryNo",label:"Delivery No."},{key:"outwardNo",label:"Main Outward"},{key:"sewingName",label:"Sewing Name"},{key:"deliveryPerson",label:"Delivery Person"},{key:"colour",label:"Colour"},{key:"size",label:"Size"},{key:"quantity",label:"Qty"},{key:"deliveryDate",label:"Date",render:(row)=>new Date(row.deliveryDate).toLocaleDateString()}];
  return <><PageTitle title="Ready for Sewing" subtitle="Full/partial allocation, delivery balance and hold tracking"/><Card title="Sewing Allocation"><form className="production-start-grid" onSubmit={submit}>{Object.keys(blank).map(key=><label key={key}><span>{key}</span><input required={key!=="remarks"} type={key==="quantity"?"number":"text"} value={form[key]} onChange={event=>setForm({...form,[key]:event.target.value})}/></label>)}<button className="primary">Save Sewing Delivery</button></form></Card>
  <Card title="Sewing Hold"><form className="production-start-grid" onSubmit={submitHold}>{Object.keys(blankHold).map(key=><label key={key}><span>{key}</span>{key === "reason" ? <select value={holdForm.reason} onChange={event=>setHoldForm({...holdForm,reason:event.target.value})}>{["Colour shortage","Matching size incomplete","Quality hold","Rework pending","Replacement pending","Sewing unit unavailable","Delivery issue","Approval pending","Other reason"].map(v=><option key={v}>{v}</option>)}</select> : <input required={key!=="remarks"} type={key==="quantity"?"number":"text"} value={holdForm[key]} onChange={event=>setHoldForm({...holdForm,[key]:event.target.value})}/>}</label>)}<button className="primary">Save Hold</button></form><DataTable rows={holds} columns={[{key:"holdNo",label:"Hold No."},{key:"outwardNo",label:"Outward"},{key:"colour",label:"Colour"},{key:"size",label:"Size"},{key:"quantity",label:"Qty"},{key:"reason",label:"Reason"},{key:"status",label:"Status"},{key:"action",label:"Action",render:(row)=>row.status === "Active" ? <button onClick={async()=>{await resolveSewingHold(row._id);await load();}}>Resolve</button>:"-"}]}/></Card>
  <Card title="Delivery History"><DataTable rows={rows} columns={columns}/></Card></>;
}
