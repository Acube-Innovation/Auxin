import React, { useEffect, useState } from "react";
import OpsTaskService from "../../services/OpsTaskService";
import { useToast } from "../../context/ToastContext";
import { TIMER_LABEL, plannedText, workedSeconds, workedText } from "../../utils/opsFormat";
import ov from "./OperationsView.module.css";

// Current time, ticking every `ms` while `active` (for timers that are running)
export function useNow(active, ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

// Planned hours (from the template) and actual hours worked; actual turns red when over plan
export function TaskHours({ task, now }) {
  const worked = workedSeconds(task, now);
  const started = Boolean(task.timer?.state) || worked > 0;
  const over = task.plannedHours != null && worked > task.plannedHours * 3600;
  return (
    <div className={ov.hours}>
      <div><span className={ov.hoursLabel}>Plan</span> {plannedText(task.plannedHours)}</div>
      <div style={over ? { color: "#b42318", fontWeight: 600 } : undefined}>
        <span className={ov.hoursLabel}>Actual</span> {started ? workedText(worked) : "—"}
        {task.timer?.state === "RUNNING" && <span className={ov.liveDot} title="Timer running" />}
      </div>
      {task.timer?.state === "HELD" && <div className={ov.held}>{TIMER_LABEL.HELD}</div>}
    </div>
  );
}

// Start / Hold / Stop. Only running time counts towards the actual hours; time on hold does not.
export function TimerButtons({ task, onChanged }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  if (task.status === "DONE" || task.status === "NA") return null;
  const state = task.timer?.state || null;
  const name = task.baseName || task.name;

  const act = async (action) => {
    setBusy(true);
    try {
      const res = await OpsTaskService.timer(task._id, action);
      await onChanged(res, task);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={ov.timerBtns}>
      {state !== "RUNNING" && (
        <button className={`${ov.timerBtn} ${ov.timerStart}`} disabled={busy} onClick={() => act("start")} aria-label={`${state === "HELD" ? "Resume" : "Start"} ${name}`}>
          ▶ {state === "HELD" ? "Resume" : "Start"}
        </button>
      )}
      {state === "RUNNING" && (
        <button className={`${ov.timerBtn} ${ov.timerHold}`} disabled={busy} onClick={() => act("hold")} aria-label={`Hold ${name}`}>❚❚ Hold</button>
      )}
      {(state === "RUNNING" || state === "HELD") && (
        <button className={`${ov.timerBtn} ${ov.timerStop}`} disabled={busy} onClick={() => act("stop")} aria-label={`Stop ${name}`}>■ Stop</button>
      )}
    </span>
  );
}
