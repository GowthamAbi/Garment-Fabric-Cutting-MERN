import CuttingMachinePlanPage from "./CuttingMachinePlanPage.jsx";

// Both machine types are displayed, with their existing detailed timeline,
// downtime reasons and clickable seven-day machine summary.
export default function CuttingGanttOverviewPage({notify}) {
  return <div>
    <CuttingMachinePlanPage mode="timeline-spreader" notify={notify}/>
    <CuttingMachinePlanPage mode="timeline-cutter" notify={notify}/>
  </div>;
}
