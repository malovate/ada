// ============================================================
// src/main.jsx — The App's Ignition Key
// ============================================================
// This is the very first JavaScript that runs.
// Its only job: mount the React app into the HTML page.
//
// 'document.getElementById("root")' finds the <div id="root">
// in index.html — the empty container we defined.
//
// ReactDOM.createRoot() takes that div and hands it to React.
// .render(<App />) fills it with our entire component tree.
//
// After this runs, React owns that div completely.
// ============================================================

// import React, { StrictMode } from 'react';
import { StrictMode } from 'react';
// 'StrictMode' is a development helper.
// It runs certain checks twice to catch bugs early.
// It has NO effect in production builds.

import { createRoot } from 'react-dom/client';
// 'createRoot' is the modern React 18 way to mount an app.
// The older way was ReactDOM.render() — this replaced it.

import './styles/global.css';
// Importing a CSS file in JavaScript — Vite handles this.
// Vite sees this import and injects the CSS into the page automatically.

import App from './App';

// Mount the app.
// This is the bridge between the HTML world and the React world.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
