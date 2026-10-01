import React, { useEffect, useState } from "react";
import "./Documents.css";
import DataTable from "../DataTable";
import DocumentsService from "../../services/DocumentsService";
import MobileBottomNavigation from "../../components/MobileBottomNavigation";



function Documents({ clientId, refreshKey }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId) return;
    const fetchDocs = async () => {
      try {
        setLoading(true);
        const docs = await DocumentsService.listByClient(clientId);
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
  }, [clientId, refreshKey]);

  if (loading) return <div className="documents-loading">Loading documents...</div>;
  if (error) return <div className="documents-error">{error}</div>;

  return (
    <div className="">
      <section className="documents-table-section">
        <DataTable 
          data={documents}
          onDelete={async (docId) => {
            await DocumentsService.remove(docId);
            // refresh list locally
            setDocuments(prev => prev.filter(d => d.id !== docId));
          }}
        />
      </section>
       {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
}

export default Documents;
