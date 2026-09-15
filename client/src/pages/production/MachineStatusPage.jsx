import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Clock3 } from "lucide-react";
import { getProductionSummary } from "../../api/productionApi.js";
import Card from "../../components/common/Card.jsx";
import PageTitle from "../../components/common/PageTitle.jsx";

const STOP_STATUSES = ["Breakdown", "Thread Change", "Bobbin Change", "Box Change", "Size Change", "Other Change"];

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

function overlapHours(start, stop, rangeStart, rangeEnd) {
  const from = Math.max(new Date(start).getTime(), rangeStart.getTime());
  const to = Math.min(new Date(stop).getTime(), rangeEnd.getTime());
  return Math.max(0, to - from) / 3600000;
}

function jobSegments(job, rangeStart, rangeEnd) {
  const now = new Date();
  const jobEnd = job.stopTime ? new Date(job.stopTime) : now;
  const events = [...(job.events || [])].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const segments = [];
  let runningStart = new Date(job.startTime);

  events.forEach((event) => {
    const stopStart = new Date(event.startTime);
    if (stopStart > runningStart) segments.push({ type: "Production", start: runningStart, stop: stopStart });
    const stopEnd = event.stopTime ? new Date(event.stopTime) : jobEnd;
    segments.push({ type: event.type || "Stopped", start: stopStart, stop: stopEnd });
    runningStart = stopEnd;
  });

  if (runningStart < jobEnd && !STOP_STATUSES.includes(job.status)) {
    segments.push({ type: "Production", start: runningStart, stop: jobEnd });
  }

  return segments
    .map((segment) => {
      const start = new Date(Math.max(segment.start.getTime(), rangeStart.getTime()));
      const stop = new Date(Math.min(segment.stop.getTime(), rangeEnd.getTime()));
      return { ...segment, start, stop };
    })
    .filter((segment) => segment.stop > segment.start);
}

function daySummary(machine, jobs, date) {
  const from = startOfDay(date);
  const to = endOfDay(date);
  const dayJobs = jobs.filter((job) => job.machineCode === machine.machineCode && new Date(job.startTime) < to && new Date(job.stopTime || Date.now()) > from);
  const segments = dayJobs.flatMap((job) => jobSegments(job, from, to));
  const actualHours = segments.filter((segment) => segment.type === "Production").reduce((sum, segment) => sum + overlapHours(segment.start, segment.stop, from, to), 0);
  const stoppingHours = segments.filter((segment) => segment.type !== "Production").reduce((sum, segment) => sum + overlapHours(segment.start, segment.stop, from, to), 0);
  const totalWorkHours = actualHours + stoppingHours;
  const totalProduction = dayJobs.reduce((sum, job) => sum + Number(job.okPcs || 0) + Number(job.reworkPcs || 0) + Number(job.rejectionPcs || 0), 0);
  const achievedProduction = dayJobs.reduce((sum, job) => sum + Number(job.okPcs || 0), 0);
  const targetProduction = Math.round(Number(machine.capacityPerHour || 0) * actualHours);
  return {
    totalWorkHours,
    stoppingHours,
    actualHours,
    totalProduction,
    targetProduction,
    achievedProduction,
    balance: achievedProduction - targetProduction,
  };
}

function hours(value) {
  return `${Number(value || 0).toFixed(2)} h`;
}

export default function MachineStatusPage() {
  const [data, setData] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const todayEnd = useMemo(() => endOfDay(new Date()), []);

  useEffect(() => {
    getProductionSummary().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="loading-state"><Activity className="spin" /> Loading machine status...</div>;

  const selected = data.machines.find((machine) => machine.machineCode === selectedMachine);
  const weekRows = selected ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { date, ...daySummary(selected, data.jobs, date) };
  }) : [];

  return <>
    <PageTitle title="Status" subtitle="24-hour machine production and stopping timeline" />
    <Card title="Today · 24 Hours">
      <div className="gantt-legend"><span><i className="production" /> Production</span><span><i className="stopped" /> Stopped</span><small>Click a machine row to view its one-week report</small></div>
      <div className="machine-gantt">
        <div className="gantt-hours"><b>Machine</b><div>{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{String(hour).padStart(2, "0")}</span>)}</div><b>Status</b></div>
        {data.machines.map((machine) => {
          const segments = data.jobs.filter((job) => job.machineCode === machine.machineCode).flatMap((job) => jobSegments(job, todayStart, todayEnd));
          return <button type="button" className={`gantt-machine-row ${selectedMachine === machine.machineCode ? "selected" : ""}`} key={machine._id} onClick={() => setSelectedMachine((current) => current === machine.machineCode ? null : machine.machineCode)}>
            <span className="gantt-machine-name"><b>{machine.machineCode}</b><small>{machine.machineName}</small></span>
            <span className="gantt-track">{segments.map((segment, index) => {
              const left = overlapHours(todayStart, segment.start, todayStart, todayEnd) / 24 * 100;
              const width = overlapHours(segment.start, segment.stop, todayStart, todayEnd) / 24 * 100;
              return <i key={`${segment.type}-${index}`} className={segment.type === "Production" ? "production" : "stopped"} style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }} title={`${segment.type}: ${segment.start.toLocaleTimeString()} - ${segment.stop.toLocaleTimeString()}`} />;
            })}</span>
            <span className={`machine-status status-${machine.status.toLowerCase().replaceAll(" ", "-")}`}>{machine.status}</span>
          </button>;
        })}
      </div>
    </Card>

    {selected && <Card title={`${selected.machineCode} · One Week Status`}>
      <div className="week-machine-heading"><CalendarDays /><div><b>{selected.machineName}</b><small>Capacity: {selected.capacityPerHour || 0} pcs/hour</small></div></div>
      <div className="table-wrap"><table className="status-week-table"><thead><tr><th>S.No</th><th>Date</th><th>Total Production</th><th>T. Work Hrs</th><th>T. Stopping Hrs</th><th>Actual Work Hrs</th><th>Target Production</th><th>Achieved Production</th><th>Balance +/−</th></tr></thead><tbody>{weekRows.map((row, index) => <tr key={row.date.toISOString()}><td>{index + 1}</td><td>{row.date.toLocaleDateString()}</td><td>{row.totalProduction}</td><td>{hours(row.totalWorkHours)}</td><td className={row.stoppingHours > 0 ? "metric-negative" : ""}>{hours(row.stoppingHours)}</td><td>{hours(row.actualHours)}</td><td>{row.targetProduction}</td><td>{row.achievedProduction}</td><td className={row.balance >= 0 ? "metric-positive" : "metric-negative"}>{row.balance >= 0 ? "+" : ""}{row.balance}</td></tr>)}</tbody></table></div>
    </Card>}
  </>;
}
