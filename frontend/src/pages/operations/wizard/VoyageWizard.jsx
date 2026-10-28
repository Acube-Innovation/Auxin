import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import OpsLayout from "../../../components/operations/OpsLayout";
import ProgressSteps from "../../../components/ProgressSteps";
import OpsMasterService from "../../../services/OpsMasterService";
import OpsVoyageService from "../../../services/OpsVoyageService";
import EmployeeService from "../../../services/EmployeeService";
import UserService from "../../../services/UserService";
import { useToast } from "../../../context/ToastContext";
import { DEFAULT_SETTINGS } from "../../../utils/opsSuggest";
import { OPS_OPERATORS } from "../../../config/opsRoles";
import {
  STEPS, emptyForm, fromVoyage, voyagePayload, rowPayload, stepError, vesselOption, portOption, clientOption, employeeOption,
} from "./wizardModel";
import StepFixture from "./StepFixture";
import StepCargo from "./StepCargo";
import StepRotation from "./StepRotation";
import StepTaskPreview from "./StepTaskPreview";
import StepReview from "./StepReview";
import QuickAddPort from "./QuickAddPort";
import shared from "../masters/Masters.module.css";
import styles from "./Wizard.module.css";

const CLIENT_TYPES = ["Charterer", "Ship Owners", "Broker", "Agent", "Supplier"];
const addTo = (list, opt) => [...(list || []).filter((o) => o.value !== opt.value), opt].sort((a, b) => a.label.localeCompare(b.label));

// New Voyage wizard — /operations/voyages/new and /operations/voyages/:id/edit (drafts) — features B1–B10
function VoyageWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const role = localStorage.getItem("role") || "";
  const isOperator = OPS_OPERATORS.includes(role);

  const [meta, setMeta] = useState(null);
  const [opts, setOpts] = useState({ vessels: [], ports: [], employees: [], clients: {} });
  const [form, setForm] = useState(emptyForm());
  const [step, setStep] = useState(1);
  const [voyageId, setVoyageId] = useState(id || null);
  const [saved, setSaved] = useState(null);        // populated voyage after the last save
  const [preview, setPreview] = useState(null);
  const [excluded, setExcluded] = useState(new Set());
  const [adhoc, setAdhoc] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [portRequest, setPortRequest] = useState(null); // { name, resolve } while the Add port dialog is open
  const loadedId = useRef(null);

  const officeTz = meta?.officeTimeZone || "Asia/Kolkata";
  const settings = meta?.suggestionSettings || DEFAULT_SETTINGS;

  // Options for the pickers
  useEffect(() => {
    (async () => {
      try {
        const [m, vessels, ports, employees, clients] = await Promise.all([
          OpsMasterService.getMeta(),
          OpsMasterService.getVessels({ active: true }),
          OpsMasterService.getPorts({ active: true }),
          EmployeeService.getEmployees(),
          OpsMasterService.lookupClients(""), // every client: the customer can be any type
        ]);
        setMeta(m);
        const byType = Object.fromEntries(CLIENT_TYPES.map((t) => [t, []]));
        clients.forEach((c) => byType[c.clientType] && byType[c.clientType].push(clientOption(c)));
        byType.All = clients.map(clientOption);
        setOpts({
          vessels: vessels.map(vesselOption),
          ports: ports.map(portOption),
          employees: (Array.isArray(employees) ? employees : []).filter((e) => e.employeeStatus !== "InActive").map(employeeOption),
          clients: byType,
        });
      } catch (e) {
        setLoadError(`Could not load the form: ${e.message}`);
      }
    })();
  }, []);

  // A new voyage created by an operator lists them as operator from the start
  useEffect(() => {
    if (id || !isOperator) return;
    UserService.getMe().then((me) => {
      const emp = me?.employeeId;
      if (!emp) return;
      EmployeeService.getEmployee(emp).then((e) => {
        if (e && e._id) setForm((f) => (f.operators.some((o) => o.value === e._id) ? f : { ...f, operators: [...f.operators, employeeOption(e)] }));
      }).catch(() => {});
    }).catch(() => {});
  }, [id, isOperator]);

  // Edit an existing draft
  useEffect(() => {
    if (!id || loadedId.current === id) return;
    loadedId.current = id;
    OpsVoyageService.get(id).then((v) => {
      if (v.status !== "DRAFT") {
        setLoadError(`${v.voyageNo} is ${v.status.toLowerCase()}. Only drafts are edited here; an active voyage is changed in its workspace.`);
        return;
      }
      setVoyageId(v._id);
      setSaved(v);
      setForm(fromVoyage(v));
    }).catch((e) => setLoadError(e.message));
  }, [id]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    const onUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const update = useCallback((fn) => {
    setForm((f) => fn(f));
    setDirty(true);
    setError(""); // the user is fixing it
    setPreview(null); // tasks must be regenerated after any change
  }, []);

  // ------------------------------------------------------------------ quick add (type a name that is not in the list)
  // Each returns the new option (already added to the picker's list), or null when cancelled or refused.
  const quickAdd = useMemo(() => ({
    client: async (clientType, companyName) => {
      try {
        const opt = clientOption(await OpsMasterService.quickAddClient({ clientType, companyName }));
        setOpts((o) => ({ ...o, clients: { ...o.clients, [clientType]: addTo(o.clients[clientType], opt), All: addTo(o.clients.All, opt) } }));
        showToast(`${opt.label} added (${clientType})`, "success");
        return opt;
      } catch (e) { showToast(e.message, "error"); return null; }
    },
    vessel: async (name) => {
      try {
        const opt = vesselOption(await OpsMasterService.quickAddVessel({ name }));
        setOpts((o) => ({ ...o, vessels: addTo(o.vessels, opt) }));
        showToast(`Vessel ${name} added; IMO, type and owners can be completed in Ops Masters → Vessels`, "success");
        return opt;
      } catch (e) { showToast(e.message, "error"); return null; }
    },
    port: (name) => new Promise((resolve) => setPortRequest({ name, resolve })),
  }), [showToast]);

  const savePort = async (data) => {
    const opt = portOption(await OpsMasterService.quickAddPort(data)); // errors are shown in the dialog
    setOpts((o) => ({ ...o, ports: addTo(o.ports, opt) }));
    showToast(`Port ${opt.label} added`, "success");
    portRequest.resolve(opt);
    setPortRequest(null);
  };
  const cancelPort = () => { if (portRequest) portRequest.resolve(null); setPortRequest(null); };

  // ------------------------------------------------------------------ save draft (create, or sync voyage + port calls)
  const saveDraft = async () => {
    const payload = voyagePayload(form);
    let v;
    if (!voyageId) {
      v = await OpsVoyageService.create({ ...payload, portCalls: form.rows.map(rowPayload) });
      loadedId.current = v._id;
      setVoyageId(v._id);
      // Show the draft's address without a route change (keeps the wizard's step and state)
      window.history.replaceState(window.history.state, "", `/operations/voyages/${v._id}/edit`);
    } else {
      // 1. voyage fields
      await OpsVoyageService.update(voyageId, payload);
      // 2. port calls: remove, update, add
      const server = await OpsVoyageService.get(voyageId);
      const keep = new Set(form.rows.filter((r) => r._id).map((r) => r._id));
      for (const pc of server.portCalls) if (!keep.has(pc._id)) await OpsVoyageService.removePortCall(voyageId, pc._id);
      const ids = [];
      for (const row of form.rows) {
        if (row._id) {
          await OpsVoyageService.updatePortCall(voyageId, row._id, rowPayload(row));
          ids.push(row._id);
        } else {
          const res = await OpsVoyageService.addPortCall(voyageId, rowPayload(row));
          ids.push(res.portCall._id);
        }
      }
      // 3. order
      if (ids.length > 1) await OpsVoyageService.reorderPortCalls(voyageId, ids);
      v = await OpsVoyageService.get(voyageId);
    }
    setSaved(v);
    setForm(fromVoyage(v));
    setDirty(false);
    return v;
  };

  const checkUpTo = (last) => {
    for (let s = 1; s <= last; s++) {
      const err = stepError(s, form, { isOperator, settings });
      if (err) return { step: s, err };
    }
    return null;
  };

  const loadPreview = async () => {
    const p = await OpsVoyageService.previewTasks(voyageIdRef.current);
    setPreview(p);
    setExcluded(new Set(p.tasks.filter((t) => !t.included).map((t) => t.key)));
  };
  const voyageIdRef = useRef(voyageId);
  useEffect(() => { voyageIdRef.current = voyageId; }, [voyageId]);

  // Move to a step. Steps 4 (Task Preview) and 5 (Review) need a saved, valid draft and the generated tasks.
  const goTo = async (target) => {
    setError("");
    if (target <= 3) {
      if (target > step) {
        const problem = checkUpTo(Math.min(step, target - 1));
        if (problem) { setError(problem.err); setStep(problem.step); return; }
      }
      setStep(target);
      return;
    }
    const problem = checkUpTo(3);
    if (problem) { setError(problem.err); setStep(problem.step); return; }
    setBusy(true);
    try {
      if (dirty || !voyageId) {
        const v = await saveDraft();
        voyageIdRef.current = v._id;
      }
      if (!preview || dirty) await loadPreview();
      setStep(target);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveOnly = async () => {
    setError("");
    const problem = stepError(2, form, { isOperator, settings }); // a draft needs the vessel and operators
    if (problem) { setError(problem); setStep(2); return; }
    setBusy(true);
    try {
      const v = await saveDraft();
      showToast(`Draft ${v.voyageNo} saved`, "success");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    const included = preview.tasks.length - excluded.size;
    if (!window.confirm(`Activate ${saved.voyageNo}? ${included + adhoc.length} tasks will be created${excluded.size ? ` and ${excluded.size} kept as Not applicable` : ""}.`)) return;
    setBusy(true);
    setError("");
    try {
      const ex = preview.tasks.filter((t) => excluded.has(t.key)).map((t) => ({ code: t.code, portCall: t.portCall ? t.portCall._id : null }));
      const res = await OpsVoyageService.activate(voyageId, { excluded: ex, adhocTasks: adhoc.map(({ name, dueDate, priority }) => ({ name, dueDate, priority })) });
      showToast(`${res.voyageNo} is active: ${res.activation.created} tasks created`, "success");
      setDirty(false);
      navigate(`/operations/voyages/${res._id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm("Leave without saving your changes?")) return;
    setDirty(false);
    navigate("/operations/voyages");
  };

  const counts = useMemo(() => ({
    included: preview ? preview.tasks.length - excluded.size : 0,
    excluded: excluded.size,
    adhoc: adhoc.length,
  }), [preview, excluded, adhoc]);

  const title = saved ? `Edit draft ${saved.voyageNo}` : "New Voyage";
  const crumbs = [{ label: "Vessel Operations" }, { label: "Voyages", to: "/operations/voyages" }, { label: saved ? saved.voyageNo : "New Voyage" }];

  if (loadError) {
    return (
      <OpsLayout title={title} breadcrumbs={crumbs}>
        <div className={shared.card}>
          <div className={shared.formError}>{loadError}</div>
          <button className={shared.btnSecondary} onClick={() => navigate("/operations/voyages")}>Back to Voyages</button>
        </div>
      </OpsLayout>
    );
  }

  const stepProps = { form, update, opts, officeTz, settings, isOperator, quickAdd };

  return (
    <OpsLayout title={title} breadcrumbs={crumbs}>
      <div className={`${shared.page} ${styles.wizard}`}>
        <div className={styles.steps}>
          <ProgressSteps steps={STEPS} currentStep={step} onStepClick={(s) => !busy && goTo(s)} />
          {saved && <span className={shared.subtle}>Draft {saved.voyageNo}{dirty ? " · unsaved changes" : " · saved"}</span>}
          {!saved && dirty && <span className={shared.subtle}>Not saved yet</span>}
        </div>

        <div className={shared.card}>
          <div className={shared.cardTitle} style={{ marginBottom: 12 }}>{step}. {STEPS[step - 1]}</div>
          {error && <div className={shared.formError} role="alert">{error}</div>}
          {!meta ? <div className={shared.empty}>Loading…</div> : (
            <>
              {step === 1 && <StepCargo {...stepProps} />}
              {step === 2 && <StepFixture {...stepProps} />}
              {step === 3 && <StepRotation {...stepProps} />}
              {step === 4 && <StepTaskPreview preview={preview} excluded={excluded} setExcluded={setExcluded} adhoc={adhoc} setAdhoc={setAdhoc} loading={busy} />}
              {step === 5 && <StepReview voyage={saved} officeTz={officeTz} counts={counts} />}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={shared.btnSecondary} onClick={cancel} disabled={busy}>Cancel</button>
          <div className={shared.toolbarLeft}>
            {step > 1 && <button className={shared.btnSecondary} onClick={() => goTo(step - 1)} disabled={busy}>Back</button>}
            <button className={shared.btnSecondary} onClick={saveOnly} disabled={busy || (!dirty && Boolean(voyageId))}>{busy ? "Saving…" : "Save draft"}</button>
            {step < 5 && <button className={shared.btnPrimary} onClick={() => goTo(step + 1)} disabled={busy}>{step === 3 ? "Save & preview tasks" : "Next"}</button>}
            {step === 5 && <button className={shared.btnPrimary} onClick={activate} disabled={busy || !preview}>{busy ? "Activating…" : "Activate voyage"}</button>}
          </div>
        </div>
      </div>
      <QuickAddPort request={portRequest} onSave={savePort} onCancel={cancelPort} />
    </OpsLayout>
  );
}

export default VoyageWizard;
