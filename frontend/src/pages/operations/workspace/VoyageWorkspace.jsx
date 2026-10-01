import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import OpsLayout from "../../../components/operations/OpsLayout";
import OperationsView from "../../../components/operations/OperationsView";
import PortCallDialog from "../../../components/operations/PortCallDialog";
import KeyDatesDialog from "../../../components/operations/KeyDatesDialog";
import EtaChangeModal from "../../../components/operations/EtaChangeModal";
import OpsVoyageService from "../../../services/OpsVoyageService";
import OpsMasterService from "../../../services/OpsMasterService";
import useVoyageSocket from "../../../hooks/useVoyageSocket";
import { useToast } from "../../../context/ToastContext";
import { VESSEL_STATUS_LABEL } from "../../../utils/opsFormat";
import { DEFAULT_SETTINGS } from "../../../utils/opsSuggest";
import { portOption } from "../wizard/wizardModel";
import OverviewTab from "./OverviewTab";
import PortCallsTab from "./PortCallsTab";
import ActivityTab from "./ActivityTab";
import DailyChecksTab from "./DailyChecksTab";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "portcalls", label: "Port Calls & SOF" },
  { key: "checks", label: "Daily Checks" },
  { key: "tasks", label: "Operations View" },
  { key: "activity", label: "Activity" },
];
const STATUS_CLASS = { DRAFT: styles.chipNone, ACTIVE: styles.chipActive, COMPLETED: styles.chipExcel, CANCELLED: styles.chipInactive };
const STATUS_ACTIONS = {
  DRAFT: [["CANCELLED", "Cancel voyage"]],
  ACTIVE: [["COMPLETED", "Mark completed"], ["CANCELLED", "Cancel voyage"]],
  COMPLETED: [["ACTIVE", "Re-open"]],
  CANCELLED: [["DRAFT", "Restore as draft"]],
};

// Voyage workspace — /operations/voyages/:id?tab=… (features C1–C6, D1–D10, E1–E2, G1)
function VoyageWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const myId = localStorage.getItem("userId");

  const [voyage, setVoyage] = useState(null);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [options, setOptions] = useState({ ports: [], agents: [] });
  const [dialog, setDialog] = useState(null);       // { mode, portCall }
  const [keyDatesOpen, setKeyDatesOpen] = useState(false);
  const [moved, setMoved] = useState(null);          // ETA-change alert
  const [refreshKey, setRefreshKey] = useState(0);
  const [taskBucket, setTaskBucket] = useState("");

  const load = useCallback(async () => {
    try {
      setVoyage(await OpsVoyageService.get(id));
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    OpsMasterService.getMeta().then(setMeta).catch(() => {});
    Promise.all([OpsMasterService.getPorts({ active: true }), OpsMasterService.lookupClients("Agent")])
      .then(([ports, agents]) => setOptions({ ports: ports.map(portOption), agents: agents.map((a) => ({ value: a._id, label: a.companyName })) }))
      .catch(() => {});
  }, []);

  // Someone else changed this voyage: refresh and say so
  useVoyageSocket(id, (event, payload) => {
    if (payload && payload.by === myId) return;
    if (event === "ops-voyage-updated") {
      showToast(`${payload.byName || "Someone"} updated this voyage — refreshed`, "info");
      load();
    }
  });

  const officeTz = meta?.officeTimeZone || "Asia/Kolkata";
  const settings = meta?.suggestionSettings || DEFAULT_SETTINGS;
  const canEdit = Boolean(voyage?.permissions?.canEdit);
  const editable = canEdit && voyage?.status === "ACTIVE";
  const setTab = (key) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });

  // After any change: refresh, then show which due dates moved (feature F3)
  const afterChange = async (res, title) => {
    await load();
    if (res && res.checksTicked) showToast(`${res.checksTicked} daily check${res.checksTicked === 1 ? "" : "s"} ticked automatically`, "info");
    if (res && res.autoCompleted) showToast(`${res.autoCompleted} task${res.autoCompleted === 1 ? "" : "s"} marked Done automatically (linked date entered)`, "info");
    if (res && res.movedTasks && res.movedTasks.length) setMoved({ ...res, title });
  };

  const onAction = async (action, pc, extra) => {
    if (action === "keyDates") return setKeyDatesOpen(true);
    if (["planned", "actual", "details", "add"].includes(action)) return setDialog({ mode: action, portCall: pc || null });
    if (action === "move") {
      const active = voyage.portCalls.filter((p) => p.status !== "CANCELLED");
      const all = voyage.portCalls.map((p) => p._id);
      const i = active.findIndex((p) => p._id === pc._id);
      const j = i + extra;
      if (j < 0 || j >= active.length) return undefined;
      // swap the two active calls, keep cancelled calls where they are
      const a = all.indexOf(active[i]._id);
      const b = all.indexOf(active[j]._id);
      [all[a], all[b]] = [all[b], all[a]];
      try {
        await OpsVoyageService.reorderPortCalls(voyage._id, all);
        showToast("Rotation re-ordered", "success");
        await load();
      } catch (e) { showToast(e.message, "error"); }
      return undefined;
    }
    if (action === "cancel") {
      const reason = window.prompt(`Cancel the call at ${pc.port?.name}? Its open tasks become Not applicable.\nReason (optional):`, "");
      if (reason === null) return undefined;
      try {
        const res = await OpsVoyageService.removePortCall(voyage._id, pc._id, reason);
        showToast(res.message, "success");
        await afterChange(res, `${pc.port?.name} cancelled — due dates moved`);
      } catch (e) { showToast(e.message, "error"); }
    }
    return undefined;
  };

  const submitDialog = async (body) => {
    const { mode, portCall } = dialog;
    const res = mode === "add"
      ? await OpsVoyageService.addPortCall(voyage._id, body)
      : await OpsVoyageService.updatePortCall(voyage._id, portCall._id, body);
    setDialog(null);
    if (mode === "add") showToast(`${res.portCall.port?.name} added; ${res.tasksCreated} tasks created`, "success");
    else showToast(`${portCall.port?.name} updated`, "success");
    await afterChange(res, mode === "planned" ? `${portCall.port?.name} — due dates moved` : "Due dates moved");
  };

  const submitKeyDates = async (body) => {
    const res = await OpsVoyageService.update(voyage._id, body);
    setKeyDatesOpen(false);
    showToast("Key dates saved", "success");
    await afterChange(res, "Key dates changed — due dates moved");
  };

  const changeStatus = async (to, label) => {
    const reason = window.prompt(`${label} ${voyage.voyageNo}?\nReason (optional):`, "");
    if (reason === null) return;
    try {
      await OpsVoyageService.update(voyage._id, { status: to, reason });
      showToast(`${voyage.voyageNo}: ${label.toLowerCase()} done`, "success");
      await load();
    } catch (e) { showToast(e.message, "error"); }
  };

  const setVesselStatus = async (value) => {
    try {
      setVoyage(await OpsVoyageService.setVesselStatus(voyage._id, value || null));
      showToast(value ? `Vessel status set to ${VESSEL_STATUS_LABEL[value]}` : "Vessel status follows the actual times again", "success");
      setRefreshKey((k) => k + 1);
    } catch (e) { showToast(e.message, "error"); }
  };

  const copy = async () => {
    try {
      const created = await OpsVoyageService.clone(voyage._id);
      showToast(`Draft ${created.voyageNo} created from ${voyage.voyageNo} — enter the new dates`, "success");
      navigate(`/operations/voyages/${created._id}/edit`);
    } catch (e) { showToast(e.message, "error"); }
  };

  const crumbs = [{ label: "Vessel Operations" }, { label: "Voyages", to: "/operations/voyages" }, { label: voyage ? voyage.voyageNo : "…" }];
  if (error) {
    return (
      <OpsLayout title="Voyage" breadcrumbs={crumbs}>
        <div className={styles.card}><div className={styles.formError}>{error}</div><button className={styles.btnSecondary} onClick={() => navigate("/operations/voyages")}>Back to Voyages</button></div>
      </OpsLayout>
    );
  }
  if (!voyage) return <OpsLayout title="Voyage" breadcrumbs={crumbs}><div className={styles.empty}>Loading…</div></OpsLayout>;

  return (
    <OpsLayout title={`Voyage ${voyage.voyageNo}`} breadcrumbs={crumbs}>
      <div className={styles.page}>
        <div className={`${styles.card} ${ws.header}`}>
          <div>
            <div className={ws.vessel}>{voyage.vessel?.name}</div>
            <div className={ws.chips}>
              <span className={`${styles.chip} ${STATUS_CLASS[voyage.status]}`}>{voyage.status}</span>
              <span className={`${styles.chip} ${styles.chipScope}`}>{voyage.voyageType === "TC_TRIP" ? "Time-charter trip" : "Voyage charter"}</span>
              {voyage.status !== "DRAFT" && <span className={`${styles.chip} ${styles.chipExcel}`} data-testid="vessel-status">{VESSEL_STATUS_LABEL[voyage.vesselStatusShown]}{voyage.vesselStatusOverride?.value ? " (set by hand)" : ""}</span>}
            </div>
            <div className={styles.subtle} style={{ marginTop: 6 }}>
              {[voyage.charterers?.companyName && `Charterer: ${voyage.charterers.companyName}`,
                (voyage.cargo || []).map((c) => `${c.description}${c.quantity != null ? ` ${c.quantity.toLocaleString("en-IN")} ${c.unit}` : ""}`).join(", "),
                `Operators: ${(voyage.operators || []).map((o) => o.employeeName).join(", ")}`].filter(Boolean).join(" · ")}
            </div>
            {voyage.remarks && <div className={styles.note}>{voyage.remarks}</div>}
          </div>
          <div className={ws.actions}>
            {voyage.status === "DRAFT" && canEdit && <button className={styles.btnPrimary} onClick={() => navigate(`/operations/voyages/${voyage._id}/edit`)}>Edit draft</button>}
            {editable && <button className={styles.btnSecondary} onClick={() => setKeyDatesOpen(true)}>Key dates</button>}
            {editable && (
              <select className={styles.select} value={voyage.vesselStatusOverride?.value || ""} onChange={(e) => setVesselStatus(e.target.value)} aria-label="Vessel status override">
                <option value="">Vessel status: automatic ({VESSEL_STATUS_LABEL[voyage.vesselStatus]})</option>
                {Object.entries(VESSEL_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>Set by hand: {l}</option>)}
              </select>
            )}
            {canEdit && (STATUS_ACTIONS[voyage.status] || []).map(([to, label]) => (
              <button key={to} className={to === "CANCELLED" ? styles.btnDanger : styles.btnSecondary} onClick={() => changeStatus(to, label)}>{label}</button>
            ))}
            {voyage.permissions?.canCopy && <button className={styles.btnLink} onClick={copy}>Copy</button>}
          </div>
        </div>

        <nav className={styles.tabs} aria-label="Voyage workspace">
          {TABS.map((t) => (
            <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`} onClick={() => setTab(t.key)}>
              {t.label}{t.key === "tasks" && voyage.tasks ? <span className={styles.subtle}> ({voyage.tasks.total})</span> : null}
            </button>
          ))}
        </nav>

        {tab === "overview" && <OverviewTab voyage={voyage} officeTz={officeTz} canEdit={canEdit} onActivated={load} onOpenTasks={(b) => { setTaskBucket(b); setTab("tasks"); }}
          onOpenChecks={() => setTab("checks")} refreshKey={refreshKey} />}
        {tab === "checks" && <DailyChecksTab voyage={voyage} officeTz={officeTz} refreshKey={refreshKey} onChanged={(res) => afterChange(res, "Due dates moved")} />}
        {tab === "portcalls" && <PortCallsTab voyage={voyage} officeTz={officeTz} editable={editable} refreshKey={refreshKey} onAction={onAction} />}
        {tab === "tasks" && (
          <div className={styles.card}>
            {voyage.status === "DRAFT" ? <div className={styles.empty}>Tasks are created when the voyage is activated (Overview → Preview tasks).</div>
              : <OperationsView voyage={voyage} editable={editable} refreshKey={refreshKey} initialBucket={taskBucket} officeTz={officeTz}
                  openTaskId={params.get("task") || ""} onTaskClosed={() => params.get("task") && setParams({ tab: "tasks" }, { replace: true })}
                  onChanged={(res) => afterChange(res, "Due dates moved")} />}
          </div>
        )}
        {tab === "activity" && <ActivityTab voyageId={voyage._id} officeTz={officeTz} refreshKey={refreshKey} />}
      </div>

      <PortCallDialog mode={dialog?.mode} portCall={dialog?.portCall} portCalls={voyage.portCalls} options={options} settings={settings}
        onClose={() => setDialog(null)} onSubmit={submitDialog} />
      {keyDatesOpen && <KeyDatesDialog voyage={voyage} officeTz={officeTz} onClose={() => setKeyDatesOpen(false)} onSubmit={submitKeyDates} />}
      <EtaChangeModal result={moved} onClose={() => setMoved(null)} />
    </OpsLayout>
  );
}

export default VoyageWorkspace;
