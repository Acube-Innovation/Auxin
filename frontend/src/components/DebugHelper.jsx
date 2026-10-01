import React from 'react';

const DebugHelper = ({ title, data, visible = false }) => {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: '#1a1a1a',
      color: '#00ff00',
      padding: '10px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      maxWidth: '300px',
      maxHeight: '400px',
      overflow: 'auto',
      zIndex: 9999,
      border: '1px solid #333'
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#ffff00' }}>{title}</h4>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default DebugHelper;
