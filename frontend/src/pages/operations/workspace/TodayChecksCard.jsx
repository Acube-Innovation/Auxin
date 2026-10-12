import React, { useCallback, useEffect, useState } from "react";
import DailyCheckList, { CheckProgress } from "../../../components/operations/DailyCheckList";
import OpsVoyageService from "../../../services/OpsVoyageService";
import { useToast } from "../../../context/ToastContext";
import { VESSEL_STATUS_LABEL } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";

// Overview: today's daily checks of an active voyage (E1), tickable in place
function TodayChecksCard({ voyage, officeTz, refreshKey, onOpen }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    OpsVoyageService.getDailyChecks(voyage._id).then(setData).catch(() => setData(null));
  }, [voyage._id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (!data || !data.log) return null;
  const toggle = async (item, done) => {
    try { setData(await OpsVoyageService.updateDailyCheck(voyage._id, item._id, { done })); } catch (e) { showToast(e.message, "error"); }
  };
  return (
    <div className={styles.card} style={{ marginBottom: 14 }} data-testid="today-checks">
      <div className={ws.sectionTitle} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>Today's checks <span className={styles.subtle} style={{ fontWeight: 400 }}>· {VESSEL_STATUS_LABEL[data.log.vesselStatus]}</span></span>
        <button className={styles.btnLink} onClick={onOpen}>Open Daily Checks →</button>
      </div>
      <CheckProgress items={data.log.items} />
      <DailyCheckList items={data.log.items} officeTz={officeTz} showRemarks={false} onToggle={data.editable ? toggle : undefined} />
    </div>
  );
}

export default TodayChecksCard;
