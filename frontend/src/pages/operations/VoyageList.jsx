import React, { useCallback, useEffect, useState } from "react";
import OpsLayout from "../../components/operations/OpsLayout";
import VoyageSummaryModal from "../../components/operations/VoyageSummaryModal";
import DeleteModal from "../../components/delete-modal/DeleteModal";
import OpsVoyageService from "../../services/OpsVoyageService";
import OpsMasterService from "../../services/OpsMasterService";
import EmployeeService from "../../services/EmployeeService";
import { useToast } from "../../context/ToastContext";
import { formatInstantDate, VESSEL_STATUS_LABEL } from "../../utils/opsFormat";
import styles from "./masters/Masters.module.css";

const TABS = [
  { key: "ACTIVE", label: "Active" },
  { key: "DRAFT", label: "Draft" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ALL", label: "All" },
];
const STATUS_CLASS = { DRAFT: styles.chipNone, ACTIVE: styles.chipActive, COMPLETED: styles.chipExcel, CANCELLED: styles.chipInactive };
const TYPE_LETTER = { LOADING: "L", DISCHARGING: "D", BUNKERING: "B" };
const TYPE_COLOR = { LOADING: "#067647", DISCHARGING: "#b54708", BUNKERING: "#3538cd" };
const PAGE_SIZE = 20;

// Voyages — /operations/voyages (features B1, B10)
function VoyageList() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [vessel, setVessel] = useState("");
  const [operator, setOperator] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, counts: {} });
  const [loading, setLoading] = useState(true);
  const [vessels, setVessels] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [officeTz, setOfficeTz] = useState("Asia/Kolkata");
  const [viewId, setViewId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    OpsMasterService.getMeta().then((m) => setOfficeTz(m.officeTimeZone)).catch(() => {});
    OpsMasterService.getVessels().then(setVessels).catch(() => {});
    EmployeeService.getEmployees().then((list) => setEmployees(Array.isArray(list) ? list : [])).catch(() => {});
  }, []);

  // Wait until typing pauses before searching
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await OpsVoyageService.list({ status: tab, search, vessel, operator, page, limit: PAGE_SIZE }));
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [tab, search, vessel, operator, page, showToast]);

  useEffect(() => { load(); }, [load]);

  const copy = async (v) => {
    try {
      const created = await OpsVoyageService.clone(v._id);
      showToast(`Draft ${created.voyageNo} created from ${v.voyageNo} (dates left empty)`, "success");
      setTab("DRAFT");
      setPage(1);
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const confirmDelete = async () => {
    try {
      await OpsVoyageService.remove(toDelete._id);
      showToast(`Voyage ${toDelete.voyageNo} deleted`, "success");
      setToDelete(null);
      load();
    } catch (e) {
      showToast(e.message, "error");
      setToDelete(null);
    }
  };

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <OpsLayout title="Voyages" breadcrumbs={[{ label: "Vessel Operations" }, { label: "Voyages" }]}>
      <div className={styles.page}>
        <nav className={styles.tabs} aria-label="Voyage status">
          {TABS.map((t) => (
            <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`} onClick={() => { setTab(t.key); setPage(1); }}>
              {t.label} <span className={styles.subtle}>({data.counts?.[t.key] ?? 0})</span>
            </button>
          ))}
        </nav>

        <div className={styles.card}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <input className={styles.search} placeholder="Search voyage no. or vessel" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              <select className={styles.select} value={vessel} onChange={(e) => { setVessel(e.target.value); setPage(1); }} aria-label="Vessel">
                <option value="">All vessels</option>
                {vessels.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>
              <select className={styles.select} value={operator} onChange={(e) => { setOperator(e.target.value); setPage(1); }} aria-label="Operator">
                <option value="">All operators</option>
                {employees.map((e) => <option key={e._id} value={e._id}>{e.employeeName}</option>)}
              </select>
            </div>
            {data.canCreate && <span className={styles.subtle}>New voyages are created with the New Voyage form (next step).</span>}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Voyage</th><th>Vessel</th><th>Charterer</th><th>Rotation</th><th>Delivery → Re-delivery</th><th>Operators</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className={styles.empty}>Loading…</td></tr>}
                {!loading && data.items.length === 0 && <tr><td colSpan={8} className={styles.empty}>No voyages here</td></tr>}
                {!loading && data.items.map((v) => (
                  <tr key={v._id} className={styles.clickable} onClick={() => setViewId(v._id)}>
                    <td className={styles.mono} style={{ whiteSpace: "nowrap" }}><b>{v.voyageNo}</b><div className={styles.note} style={{ fontFamily: "Inter, sans-serif" }}>Updated {formatInstantDate(v.updatedAt, officeTz)}</div></td>
                    <td style={{ whiteSpace: "nowrap" }}>{v.vessel?.name}</td>
                    <td>{v.charterers?.companyName || "—"}</td>
                    <td>
                      {v.rotation.length === 0 ? "—" : v.rotation.filter((r) => r.status !== "CANCELLED").map((r, i) => (
                        <span key={r._id} style={{ whiteSpace: "nowrap" }}>
                          {i > 0 && <span className={styles.subtle}> → </span>}
                          {r.port}<sup style={{ color: TYPE_COLOR[r.type], fontWeight: 700, marginLeft: 1 }}>{TYPE_LETTER[r.type]}</sup>
                        </span>
                      ))}
                    </td>
                    <td>
                      {formatInstantDate(v.delivery?.estimated, v.delivery?.timeZone) || "—"} → {formatInstantDate(v.redelivery?.estimated, v.redelivery?.timeZone) || "—"}
                    </td>
                    <td>{(v.operators || []).map((o) => o.employeeName).join(", ")}</td>
                    <td>
                      <span className={`${styles.chip} ${STATUS_CLASS[v.status]}`}>{v.status[0] + v.status.slice(1).toLowerCase()}</span>
                      {v.status === "ACTIVE" && (
                        <>
                          <div className={styles.note} style={{ whiteSpace: "nowrap" }}>{VESSEL_STATUS_LABEL[v.vesselStatusShown]}</div>
                          {(v.taskCounts?.overdue > 0 || v.taskCounts?.today > 0) && (
                            <div style={{ whiteSpace: "nowrap", marginTop: 2 }}>
                              {v.taskCounts.overdue > 0 && <span className={`${styles.chip} ${styles.chipHigh}`}>{v.taskCounts.overdue} overdue</span>}{" "}
                              {v.taskCounts.today > 0 && <span className={`${styles.chip} ${styles.chipMedium}`}>{v.taskCounts.today} today</span>}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                      <button className={styles.btnLink} onClick={() => setViewId(v._id)}>View</button>
                      {v.permissions?.canCopy && <button className={styles.btnLink} onClick={() => copy(v)}>Copy</button>}
                      {v.permissions?.canDelete && <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => setToDelete(v)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.toolbar} style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            <span className={styles.subtle}>{data.total} voyage{data.total === 1 ? "" : "s"} · <sup style={{ color: TYPE_COLOR.LOADING }}>L</sup> load · <sup style={{ color: TYPE_COLOR.BUNKERING }}>B</sup> bunkering · <sup style={{ color: TYPE_COLOR.DISCHARGING }}>D</sup> discharge</span>
            <div className={styles.toolbarLeft}>
              <button className={styles.btnSecondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className={styles.subtle}>Page {page} of {pages}</span>
              <button className={styles.btnSecondary} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div>

      <VoyageSummaryModal voyageId={viewId} officeTz={officeTz} onClose={() => setViewId(null)} onChanged={load} />
      <DeleteModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this draft voyage?"
        description={`${toDelete?.voyageNo || ""} and its port calls will be removed. This cannot be undone.`}
      />
    </OpsLayout>
  );
}

export default VoyageList;
