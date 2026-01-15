// ============================================================================
// BOWLING TRACKER - REACT ENTRY POINT
// File: frontend/src/index.js
// ============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

// ============================================================================
// CREATE ROOT AND RENDER APP
// ============================================================================

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
