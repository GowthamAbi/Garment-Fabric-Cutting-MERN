import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

const steps = [
  ["company", "Confirm company and factory details"],
  ["users", "Create Store and Production users"],
  ["masters", "Register sections, machines and employees; print QR cards"],
  ["store", "Create PO, inward stock and print inward QR"],
  ["cutting", "Create Cutting DC with colour, size, PCS and measurement"],
  ["production", "Test main DC, machine and employee QR production flow"],
  ["backup", "Download company backup and review Audit History"],
  ["security", "Configure HTTPS, email reset and subscription keys"],
];

export default function OnboardingPage({ notify }) {
  const [done, setDone] = useState(() => JSON.parse(localStorage.getItem("accessories_onboarding") || "{}"));
  function toggle(key) { const next = { ...done, [key]: !done[key] }; setDone(next); localStorage.setItem("accessories_onboarding", JSON.stringify(next)); if (steps.every(([id]) => next[id])) notify("Onboarding completed"); }
  const completed = steps.filter(([key]) => done[key]).length;
  return <><PageTitle title="Setup Guide" subtitle="Complete these steps before live factory use"/><Card><div className="onboarding-progress"><b>{completed}/{steps.length} complete</b><progress max={steps.length} value={completed}/></div><div className="onboarding-list">{steps.map(([key,label],index)=><button key={key} className={done[key]?"done":""} onClick={()=>toggle(key)}>{done[key]?<CheckCircle2/>:<Circle/>}<span><small>STEP {index+1}</small><b>{label}</b></span></button>)}</div></Card></>;
}
