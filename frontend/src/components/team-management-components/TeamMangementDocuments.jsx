// import React from "react";
// import styles from "./TeamManagementDocuments.module.css";
// import Sidebar from "../../pages/sidebar/Sidebar";
// import DataTable from "../DataTable";

// function TeamManagementDocuments() {
//   return (
//     <div className="">
//       <section className={styles["documents-table-section"]}>
//         <DataTable data={documentsData} />
//       </section>
//     </div>
//   );
// }

// export default TeamManagementDocuments;

import React, { useEffect, useState } from "react";
import styles from "./TeamManagementDocuments.module.css";
import DataTable from "../DataTable";
import DocumentsService from "../../services/EmployeeDocumentService";

function TeamManagementDocuments({ employeeId, refreshKey }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  

 useEffect(() => {
    if (!employeeId) return;
    const fetchDocs = async () => {
      try {
        setLoading(true);
        const docs = await DocumentsService.listByEmployee(employeeId);
        const mapped = docs.map(d => ({
          id: d._id,
          fileName: d.fileName,
          fileSize: `${Math.max(1, Math.round((d.fileSize || 0) / 1024))} KB`,
          fileType: (d.fileType || '').includes('image') ? 'image' : (d.fileType || '').includes('video') ? 'video' : 'document',
          type: d.type || 'Extra',
          uploadedBy: d.uploadedBy || 'Unknown',
          userRole: d.userRole || '',
          filetype: d.fileType || '',
          uploadedDate: d.uploadedDate ? new Date(d.uploadedDate).toLocaleDateString() : '',
        }));
        setDocuments(mapped);
        setError(null);
      } catch (e) {
        setError(e.message || 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [employeeId, refreshKey]);

  if (loading) return <div className="documents-loading">Loading documents...</div>;
  if (error) return <div className="documents-error">{error}</div>;

 

  return (
    <div className={styles.container}>
      <section className={styles["documents-table-section"]}>
        <DataTable 
          data={documents}
          onDelete={async (docId) => {
            await DocumentsService.remove(docId);
            // Refresh list locally
            setDocuments(prev => prev.filter(d => d.id !== docId));
          }}
          // You can add additional props for employee-specific actions
        />
      </section>
    </div>
  );
}

export default TeamManagementDocuments;
