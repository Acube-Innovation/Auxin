import React, { useState } from "react";
import "./DataTable.css";
import FileIcon from "./FileIcon";
import TypeBadge from "./TypeBadge";
import SortIcon from "./SortIcon";
import TrashIcon from "./TrashIcon";
import DeleteModal from "./delete-modal/DeleteModal";

function DataTable({ data, onDelete }) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const handleDelete = (id) => {
    const item = data.find(item => item.id === id);
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (onDelete && itemToDelete?.id) {
        await onDelete(itemToDelete.id);
      }
    } finally {
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  return (
    <div className="data-table-container">
      <div className="table-wrapper">
        <div className="table-columns">
          {/* File Name Column */}
          <div className="table-column file-name-column">
            <div className="table-header">
              <div className="table-header-cell">
                <div className="header-content">
                  <div className="header-text">File Name</div>
                  <SortIcon />
                </div>
              </div>
            </div>
            {data.map((item) => (
              <div key={item.id} className="table-cell file-cell">
                <FileIcon type={item.fileType} />
                <div className="file-info">
                  <div className="file-name">{item.fileName}</div>
                  <div className="file-size">{item.fileSize}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Type Column */}
          <div className="table-column type-column">
            <div className="table-header">
              <div className="table-header-cell">
                <div className="header-content">
                  <div className="header-text">Type</div>
                  <SortIcon />
                </div>
              </div>
            </div>
            {data.map((item) => (
              <div key={item.id} className="table-cell type-cell">
                <TypeBadge type={item.type} />
              </div>
            ))}
          </div>

          {/* Uploaded by Column */}
          <div className="table-column uploaded-by-column">
            <div className="table-header">
              <div className="table-header-cell">
                <div className="header-content">
                  <div className="header-text">Uploaded by</div>
                  <SortIcon />
                </div>
              </div>
            </div>
            {data.map((item) => (
              <div key={item.id} className="table-cell uploaded-by-cell">
                <div className="user-info">
                  <div className="user-name">{item.uploadedBy}</div>
                  <div className="user-role">{item.userRole}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filetype Column */}
          <div className="table-column filetype-column">
            <div className="table-header">
              <div className="table-header-cell">
                <div className="header-content">
                  <div className="header-text">Filetype</div>
                  <SortIcon />
                </div>
              </div>
            </div>
            {data.map((item) => (
              <div key={item.id} className="table-cell filetype-cell">
                <div className="filetype-info">
                  <div className="filetype-text">{item.filetype}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Uploaded Date Column */}
          <div className="table-column uploaded-date-column">
            <div className="table-header">
              <div className="table-header-cell">
                <div className="header-content">
                  <div className="header-text">Uploaded Date</div>
                  <SortIcon />
                </div>
              </div>
            </div>
            {data.map((item) => (
              <div key={item.id} className="table-cell uploaded-date-cell">
                <div className="date-info">
                  <div className="date-text">{item.uploadedDate}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions Column */}
          <div className="table-column actions-column">
            <div className="table-header">
              <div className="table-header-cell"></div>
            </div>
            {data.map((item) => (
              <div key={item.id} className="table-cell actions-cell">
                <button
                  className="delete-button"
                  onClick={() => handleDelete(item.id)}
                  aria-label="Delete item"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${itemToDelete?.fileName}?`}
        description={`Are you sure you want to delete "${itemToDelete?.fileName}"? This action cannot be undone.`}
      />
    </div>
  );
}

export default DataTable;
