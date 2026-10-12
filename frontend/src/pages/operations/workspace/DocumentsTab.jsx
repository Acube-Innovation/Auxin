import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OpsModal from "../../../components/operations/OpsModal";
import DeleteModal from "../../../components/delete-modal/DeleteModal";
import OpsVoyageService from "../../../services/OpsVoyageService";
import OpsTaskService from "../../../services/OpsTaskService";
import { useToast } from "../../../context/ToastContext";
import { PORT_TYPE_LABEL, formatInstant } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";

const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);
const viewable = (doc) => /^(application\/pdf|image\/|text\/plain)/.test(doc.fileType || "");
const CAT_COLOR = { CP: "#3538cd", RECAP: "#3538cd", SOF: "#b54708", NOR: "#b54708", BL: "#067647", SURVEY: "#6941c6", CERTIFICATE: "#6941c6", INVOICE: "#0e7090", CORRESPONDENCE: "#475467", OTHER: "#475467" };

function DocForm({ form, setForm, categories, calls, withTitle }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className={styles.formGrid}>
      <div className={styles.field}>
        <label>Category</label>
        <select className={styles.select} value={form.category} onChange={set("category")} aria-label="Category">
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label>Port call <span className={styles.subtle}>(optional)</span></label>
        <select className={styles.select} value={form.portCall || ""} onChange={set("portCall")} aria-label="Port call">
          <option value="">— whole voyage —</option>
          {calls.map((p) => <option key={p._id} value={p._id}>{p.port?.name} ({PORT_TYPE_LABEL[p.type]})</option>)}
        </select>
      </div>
      {withTitle && (
        <div className={`${styles.field} ${styles.full}`}>
          <label>Title <span className={styles.subtle}>(optional; the file name is shown otherwise)</span></label>
          <input className={styles.input} value={form.title || ""} onChange={set("title")} aria-label="Title" />
        </div>
      )}
      <div className={`${styles.field} ${styles.full}`}>
        <label>Notes</label>
        <textarea className={styles.textarea} rows={2} value={form.notes || ""} onChange={set("notes")} aria-label="Notes" />
      </div>
    </div>
  );
}

// Documents tab (I2): CP, recaps, SOF, BL drafts, surveys and other files of the voyage, plus files attached to tasks
function DocumentsTab({ voyage, officeTz, refreshKey }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(null);   // { form, files, busy, error }
  const [editing, setEditing] = useState(null);       // { doc, form }
  const [toDelete, setToDelete] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    OpsVoyageService.getDocuments(voyage._id).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, [voyage._id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const calls = (voyage.portCalls || []).filter((p) => p.status !== "CANCELLED");
  const label = useMemo(() => Object.fromEntries((data?.categories || []).map((c) => [c.value, c.label])), [data]);
  const counts = useMemo(() => {
    const c = {};
    for (const d of data?.documents || []) c[d.category] = (c[d.category] || 0) + 1;
    return c;
  }, [data]);

  if (error) return <div className={styles.card}><div className={styles.formError}>{error}</div></div>;
  if (!data) return <div className={styles.card}><div className={styles.empty}>Loading…</div></div>;

  const q = search.trim().toLowerCase();
  const docs = data.documents.filter((d) => (!cat || d.category === cat)
    && (!q || `${d.title || ""} ${d.fileName} ${d.notes || ""} ${d.portCall?.port?.name || ""}`.toLowerCase().includes(q)));

  const open = (doc, view) => OpsVoyageService.openDocument(voyage._id, doc, { view }).catch((e) => showToast(e.message, "error"));

  const addFiles = (list) => {
    const files = [...(uploading.files || []), ...Array.from(list || [])].slice(0, 10);
    setUploading({ ...uploading, files, error: "" });
  };
  const doUpload = async () => {
    if (!uploading.files.length) { setUploading({ ...uploading, error: "Choose at least one file" }); return; }
    const big = uploading.files.find((f) => f.size > data.maxMb * 1048576);
    if (big) { setUploading({ ...uploading, error: `${big.name} is larger than ${data.maxMb} MB` }); return; }
    setUploading({ ...uploading, busy: true, error: "" });
    try {
      const created = await OpsVoyageService.uploadDocuments(voyage._id, uploading.files, uploading.form);
      showToast(`${created.length} document${created.length === 1 ? "" : "s"} uploaded`, "success");
      setUploading(null);
      load();
    } catch (e) { setUploading((u) => ({ ...u, busy: false, error: e.message })); }
  };
  const saveEdit = async () => {
    try {
      await OpsVoyageService.updateDocument(voyage._id, editing.doc._id, { ...editing.form, portCall: editing.form.portCall || null });
      showToast("Document details saved", "success");
      setEditing(null);
      load();
    } catch (e) { showToast(e.message, "error"); }
  };
  const confirmDelete = async () => {
    try {
      await OpsVoyageService.deleteDocument(voyage._id, toDelete._id);
      showToast(`${toDelete.fileName} deleted`, "success");
      setToDelete(null);
      load();
    } catch (e) { showToast(e.message, "error"); setToDelete(null); }
  };

  return (
    <div>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={ws.sectionTitle} style={{ margin: 0 }}>Documents <span className={styles.subtle} style={{ fontWeight: 400 }}>({data.documents.length})</span></div>
            <input className={styles.search} placeholder="Search title, file, notes, port" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search documents" />
          </div>
          {data.canEdit && <button className={styles.btnPrimary} onClick={() => setUploading({ form: { category: cat || "OTHER", portCall: "", notes: "" }, files: [], error: "" })}>+ Upload documents</button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button className={styles.btnLink} style={{ fontWeight: cat ? 400 : 700 }} onClick={() => setCat("")}>All ({data.documents.length})</button>
          {data.categories.filter((c) => counts[c.value]).map((c) => (
            <button key={c.value} className={styles.chip} onClick={() => setCat(cat === c.value ? "" : c.value)}
              style={{ cursor: "pointer", color: CAT_COLOR[c.value], background: "#f9fafb", border: cat === c.value ? `2px solid ${CAT_COLOR[c.value]}` : "1px solid #eaecf0" }}>
              {c.label} {counts[c.value]}
            </button>
          ))}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Category</th><th>Document</th><th>Port</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
            <tbody>
              {docs.length === 0 && <tr><td colSpan={6} className={styles.empty}>{data.documents.length ? "No documents match" : "No documents yet"}</td></tr>}
              {docs.map((d) => (
                <tr key={d._id} data-doc={d.fileName}>
                  <td><span className={styles.chip} style={{ color: CAT_COLOR[d.category], background: "#f9fafb", border: "1px solid #eaecf0", whiteSpace: "nowrap" }}>{label[d.category]}</span></td>
                  <td>
                    <button className={styles.btnLink} style={{ textAlign: "left", padding: 0 }} onClick={() => open(d, viewable(d))} title={viewable(d) ? "Open" : "Download"}>{d.title || d.fileName}</button>
                    {d.title && <div className={styles.note}>{d.fileName}</div>}
                    {d.notes && <div className={styles.note}>{d.notes}</div>}
                  </td>
                  <td>{d.portCall?.port?.name || <span className={styles.subtle}>voyage</span>}</td>
                  <td className={styles.subtle} style={{ whiteSpace: "nowrap" }}>{size(d.fileSize)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{d.uploadedBy?.username}<div className={styles.note}>{formatInstant(d.createdAt, officeTz, { withUtc: false })}</div></td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                      <button className={styles.btnLink} onClick={() => open(d, false)}>Download</button>
                      {data.canEdit && <button className={styles.btnLink} onClick={() => setEditing({ doc: d, form: { category: d.category, title: d.title || "", portCall: d.portCall?._id || "", notes: d.notes || "" } })}>Edit</button>}
                      {data.canEdit && <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => setToDelete(d)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.hint} style={{ marginTop: 8 }}>
          Files are kept privately on the server and shown only to people who can see this voyage. PDF and images open in a new tab; other files download. Up to {data.maxMb} MB per file, 10 files at a time.
        </div>
      </div>

      <div className={styles.card}>
        <div className={ws.sectionTitle}>Files attached to tasks <span className={styles.subtle} style={{ fontWeight: 400 }}>({data.taskFiles.length}) · added in the task panel of the Operations View</span></div>
        {data.taskFiles.length === 0 ? <div className={styles.subtle}>None</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>File</th><th>Task</th><th>Size</th><th>Uploaded</th></tr></thead>
              <tbody>
                {data.taskFiles.map((a) => (
                  <tr key={a._id}>
                    <td><button className={styles.btnLink} style={{ padding: 0 }} onClick={() => OpsTaskService.downloadAttachment(a.taskId, a).catch((e) => showToast(e.message, "error"))}>{a.fileName}</button></td>
                    <td>{a.code ? <span className={styles.mono}>{a.code} </span> : null}{a.task}</td>
                    <td className={styles.subtle}>{size(a.fileSize)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{a.uploadedBy?.username}<div className={styles.note}>{formatInstant(a.at, officeTz, { withUtc: false })}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OpsModal isOpen={Boolean(uploading)} title="Upload documents" onClose={() => setUploading(null)} width={680}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setUploading(null)}>Cancel</button>
          <button className={styles.btnPrimary} onClick={doUpload} disabled={uploading?.busy}>{uploading?.busy ? "Uploading…" : `Upload${uploading?.files.length ? ` ${uploading.files.length} file${uploading.files.length === 1 ? "" : "s"}` : ""}`}</button>
        </>}>
        {uploading && <>
          {uploading.error && <div className={styles.formError} role="alert">{uploading.error}</div>}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current && fileRef.current.click()}
            style={{ border: "2px dashed #84adff", borderRadius: 10, padding: "18px 12px", textAlign: "center", cursor: "pointer", background: "#f5f8ff", marginBottom: 12 }}>
            <b>Drop files here</b> or click to choose <div className={styles.note}>PDF, Word, Excel, images, e-mails (.msg / .eml), zip · up to {data.maxMb} MB each</div>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} aria-label="Choose files" data-testid="doc-file-input" />
          </div>
          {uploading.files.map((f, i) => (
            <div key={`${f.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "0.88rem" }}>
              <span>{f.name} <span className={styles.subtle}>{size(f.size)}</span></span>
              <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => setUploading({ ...uploading, files: uploading.files.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <DocForm form={uploading.form} setForm={(form) => setUploading({ ...uploading, form })} categories={data.categories} calls={calls} withTitle={uploading.files.length === 1} />
          </div>
          <div className={styles.hint}>The category, port and notes apply to every file uploaded now; each can be changed later.</div>
        </>}
      </OpsModal>

      <OpsModal isOpen={Boolean(editing)} title={editing ? `Edit — ${editing.doc.fileName}` : ""} onClose={() => setEditing(null)} width={640}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
          <button className={styles.btnPrimary} onClick={saveEdit}>Save</button>
        </>}>
        {editing && <DocForm form={editing.form} setForm={(form) => setEditing({ ...editing, form })} categories={data.categories} calls={calls} withTitle />}
      </OpsModal>

      <DeleteModal isOpen={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        title="Delete this document?" description={`${toDelete?.fileName || ""} will be removed from the voyage and from the server. This cannot be undone.`} />
    </div>
  );
}

export default DocumentsTab;
