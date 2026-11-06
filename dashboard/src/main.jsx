import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registrasi Service Worker PWA Caching secara otomatis
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Versi baru tersedia, siap di-refresh.');
  },
  onOfflineReady() {
    console.log('[PWA] Cache offline aktif. Aplikasi dapat dibuka tanpa kuota hosting.');
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
