import React, { useEffect, useMemo, useState } from "react";
import LeaveApproverService from "../../services/LeaveApproverService";
import DeleteModal from "../delete-modal/DeleteModal";
import { useToast } from "../../context/ToastContext";
import own from "./LeaveApproversTab.module.css";

const EMPTY = { person: "", hod: "", hr: "" };

function personKey(row) {
    if (row.employee) return `e:${row.employee._id}`;
    if (row.user) return `u:${row.user._id}`;
    return "";
}

// Add / edit one row: employee (or login-only person), HOD, HR
function ApproverForm({ row, options, onClose, onSaved }) {
    const [form, setForm] = useState(row ? { person: personKey(row), hod: row.hod?._id || "", hr: row.hr?._id || "" } : EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // People that already have a row are left out when adding (edit keeps its own person)
    const people = options.people.filter((p) => !p.mappingId || (row && p.mappingId === row._id));
    const person = options.people.find((p) => p.key === form.person);
    const personLogin = row?.user?._id;

    const save = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.person) return setError("Choose the employee.");
        if (!form.hod && !form.hr) return setError("Choose an HOD or an HR (or both).");
        setSaving(true);
        try {
            const data = { person: form.person, hod: form.hod || null, hr: form.hr || null };
            if (row) await LeaveApproverService.update(row._id, data);
            else await LeaveApproverService.create(data);
            onSaved(row ? "Leave approvers updated." : "Leave approvers added.");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const loginSelect = (field, label, hint) => (
        <label className={own.field}>
            <span>{label}</span>
            <select value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} data-field={field}>
                <option value="">— None —</option>
                {options.logins.map((u) => (
                    <option key={u._id} value={u._id}>{u.username} ({u.role})</option>
                ))}
            </select>
            <small>{hint}</small>
        </label>
    );

    return (
        <div className={own.overlay} role="dialog" aria-modal="true" aria-label={row ? "Edit leave approvers" : "Add leave approvers"}>
            <form className={own.modal} onSubmit={save}>
                <div className={own.modalHead}>
                    <h3>{row ? "Edit leave approvers" : "Add leave approvers"}</h3>
                    <button type="button" className={own.close} onClick={onClose} aria-label="Close">×</button>
                </div>
                {error && <div className={own.formError}>{error}</div>}
                <label className={own.field}>
                    <span>Employee *</span>
                    <select value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} data-field="person" disabled={!!row}>
                        <option value="">— Select employee —</option>
                        {people.map((p) => (
                            <option key={p.key} value={p.key}>{p.label}{p.department ? ` – ${p.department}` : ""}</option>
                        ))}
                    </select>
                    <small>{person ? `Department: ${person.department || "not set"}` : "People who already have a row are edited from the table."}</small>
                </label>
                {loginSelect("hod", "HOD", "Approves first. The request then shows “HOD Approved”.")}
                {loginSelect("hr", "HR", "Gives the final approval. Without an HOD, requests go straight to HR.")}
                {personLogin && (form.hod === personLogin || form.hr === personLogin) && (
                    <div className={own.formWarn}>This person cannot approve their own leave; Admin will need to do that step.</div>
                )}
                <div className={own.modalFoot}>
                    <button type="button" className={own.secondary} onClick={onClose}>Cancel</button>
                    <button type="submit" className={own.primary} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                </div>
            </form>
        </div>
    );
}

// User Management → Leave Approvers
function LeaveApproversTab({ styles }) {
    const { showToast } = useToast();
    const [rows, setRows] = useState([]);
    const [options, setOptions] = useState({ people: [], logins: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filters, setFilters] = useState({ q: "", department: "", hod: "", hr: "" });
    const [editing, setEditing] = useState(null); // null | 'new' | row
    const [deleting, setDeleting] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [list, opts] = await Promise.all([LeaveApproverService.list(), LeaveApproverService.options()]);
            setRows(list);
            setOptions(opts);
            setError("");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const departments = useMemo(() => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(), [rows]);
    const approvers = (key) => {
        const map = new Map();
        rows.forEach((r) => r[key] && map.set(r[key]._id, r[key].username));
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    };

    const shown = rows.filter((r) => {
        const q = filters.q.trim().toLowerCase();
        if (q && ![r.name, r.employee?.employeeId, ...(r.logins || []), r.department, r.hod?.username, r.hr?.username].some((v) => (v || "").toLowerCase().includes(q))) return false;
        if (filters.department === "__none" ? r.department : filters.department && r.department !== filters.department) return false;
        if (filters.hod === "__none" ? r.hod : filters.hod && r.hod?._id !== filters.hod) return false;
        if (filters.hr === "__none" ? r.hr : filters.hr && r.hr?._id !== filters.hr) return false;
        return true;
    });
    const filtered = Object.values(filters).some(Boolean);
    const unassigned = options.people.filter((p) => !p.mappingId);

    const confirmDelete = async () => {
        try {
            await LeaveApproverService.remove(deleting._id);
            showToast("Leave approvers deleted.", "success");
            load();
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div data-testid="leave-approvers">
            <div className={styles.header}>
                <div>
                    <h1>Leave Approvers</h1>
                    <p className={own.intro}>For each employee: the HOD who approves first, then the HR who gives the final approval. Their login role does not matter.</p>
                </div>
                <button className={styles.addButton} onClick={() => setEditing("new")}>Add Approvers</button>
            </div>

            <div className={own.toolbar}>
                <input className={own.search} placeholder="Search employee, HOD or HR" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search" />
                <select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} aria-label="Department" data-filter="department">
                    <option value="">All departments</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    <option value="__none">No department</option>
                </select>
                <select value={filters.hod} onChange={(e) => setFilters({ ...filters, hod: e.target.value })} aria-label="HOD" data-filter="hod">
                    <option value="">All HODs</option>
                    {approvers("hod").map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    <option value="__none">No HOD</option>
                </select>
                <select value={filters.hr} onChange={(e) => setFilters({ ...filters, hr: e.target.value })} aria-label="HR" data-filter="hr">
                    <option value="">All HR</option>
                    {approvers("hr").map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    <option value="__none">No HR</option>
                </select>
                {filtered && <button className={own.clear} onClick={() => setFilters({ q: "", department: "", hod: "", hr: "" })}>Clear filters</button>}
                <span className={own.count}>{shown.length} of {rows.length}</span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Department</th>
                            <th>HOD</th>
                            <th>HR</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className={styles.noData}>Loading…</td></tr>
                        ) : shown.length === 0 ? (
                            <tr><td colSpan="5" className={styles.noData}>{rows.length ? "No rows match the filters." : "No leave approvers yet. Use Add Approvers."}</td></tr>
                        ) : shown.map((r) => (
                            <tr key={r._id} data-approver-row={r.name}>
                                <td>
                                    <div className={own.name}>{r.name}</div>
                                    <div className={own.sub}>{[r.employee?.employeeId, r.logins?.length ? `login: ${r.logins.join(", ")}` : null].filter(Boolean).join(" · ") || "—"}</div>
                                </td>
                                <td>{r.department || <span className={own.muted}>—</span>}</td>
                                <td>{r.hod ? r.hod.username : <span className={own.muted}>—</span>}</td>
                                <td>{r.hr ? r.hr.username : <span className={own.muted}>—</span>}</td>
                                <td>
                                    <button className={styles.editButton} onClick={() => setEditing(r)}>Edit</button>
                                    <button className={styles.deleteButton} onClick={() => setDeleting(r)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {!loading && unassigned.length > 0 && (
                <p className={own.note}>
                    Without a row (their leave goes to Admin only): {unassigned.map((p) => p.label.replace(" (login only)", "")).join(", ")}.
                </p>
            )}

            {editing && (
                <ApproverForm
                    row={editing === "new" ? null : editing}
                    options={options}
                    onClose={() => setEditing(null)}
                    onSaved={(msg) => { setEditing(null); showToast(msg, "success"); load(); }}
                />
            )}
            <DeleteModal
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                title={deleting ? `Delete approvers of ${deleting.name}?` : "Delete?"}
                description="Their leave requests will then go to Admin only. The employee and the logins are not deleted."
            />
        </div>
    );
}

export default LeaveApproversTab;
