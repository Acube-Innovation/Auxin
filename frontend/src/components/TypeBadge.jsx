import React from "react";
import "./TypeBadge.css";

function TypeBadge({ type }) {
  const getBadgeClass = () => {
    return type === "Important" ? "type-badge important" : "type-badge extra";
  };

  return (
    <div className={getBadgeClass()}>
      <div className="badge-text">{type}</div>
    </div>
  );
}

export default TypeBadge;
