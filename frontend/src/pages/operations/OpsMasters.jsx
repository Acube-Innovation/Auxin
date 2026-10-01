import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import OpsLayout from "../../components/operations/OpsLayout";
import OpsMasterService from "../../services/OpsMasterService";
import { useToast } from "../../context/ToastContext";
import VesselsMaster from "./masters/VesselsMaster";
import PortsMaster from "./masters/PortsMaster";
import TaskTemplatesMaster from "./masters/TaskTemplatesMaster";
import StagesMaster from "./masters/StagesMaster";
import DailyCheckSetsMaster from "./masters/DailyCheckSetsMaster";
import ScheduledJobs from "./masters/ScheduledJobs";
import { OPS_ADMIN, hasRole } from "../../config/opsRoles";
import styles from "./masters/Masters.module.css";

const MASTERS = [
  { key: "vessels", label: "Vessels", edit: "vessels", Component: VesselsMaster },
  { key: "ports", label: "Ports", edit: "ports", Component: PortsMaster },
  { key: "task-templates", label: "Task Templates", edit: "taskTemplates", Component: TaskTemplatesMaster },
  { key: "stages", label: "Stages", edit: "stages", Component: StagesMaster },
  { key: "daily-checks", label: "Daily Check Sets", edit: "dailyChecks", Component: DailyCheckSetsMaster },
  { key: "jobs", label: "Scheduled Jobs", edit: null, Component: ScheduledJobs, adminOnly: true },
];

// Ops Masters — /operations/masters/:master (features A1–A5; Scheduled Jobs F1–F6, admin)
function OpsMasters() {
  const { master } = useParams();
  const { showToast } = useToast();
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    OpsMasterService.getMeta()
      .then(setMeta)
      .catch((e) => showToast(`Could not load settings: ${e.message}`, "error"));
  }, [showToast]);

  const visible = MASTERS.filter((m) => !m.adminOnly || hasRole(OPS_ADMIN));
  const current = visible.find((m) => m.key === master);
  if (!current) return <Navigate to="/operations/masters/vessels" replace />;
  const { Component } = current;

  return (
    <OpsLayout
      title="Ops Masters"
      breadcrumbs={[{ label: "Vessel Operations" }, { label: "Masters", to: "/operations/masters/vessels" }, { label: current.label }]}
    >
      <div className={styles.page}>
        <nav className={styles.tabs} aria-label="Masters">
          {visible.map((m) => (
            <Link key={m.key} to={`/operations/masters/${m.key}`} className={`${styles.tab} ${m.key === master ? styles.tabActive : ""}`}>
              {m.label}
            </Link>
          ))}
        </nav>
        {meta ? <Component key={current.key} canEdit={Boolean(meta.canEdit?.[current.edit])} meta={meta} /> : <div className={styles.empty}>Loading…</div>}
      </div>
    </OpsLayout>
  );
}

export default OpsMasters;
