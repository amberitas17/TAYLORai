import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.react = undefined;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.render = undefined;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = undefined;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = undefined;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = undefined;
}

const updateSW = registerSW({
  onNeedRefresh() {
    if (window.confirm('A new version of TAYLOR is available. Refresh now?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('TAYLOR is ready to work offline.');
  },
});

const root = document.getElementById('root');
const splash = document.createElement('div');
splash.id = 'taylor-splash';
splash.innerHTML = '<div class="taylor-splash-card"><div class="taylor-splash-ring"></div><p>Initializing TAYLOR</p></div>';
document.body.insertBefore(splash, root);

setTimeout(() => {
  splash.style.opacity = '0';
  splash.style.pointerEvents = 'none';
  setTimeout(() => splash.remove(), 400);
}, 1200);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.ready.then(() => {
      console.log('Service worker ready');
    });
  });
}

if (window.matchMedia('(display-mode: standalone)').matches) {
  document.documentElement.classList.add('pwa-standalone');
}

document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('keydown', (event) => {
  if (event.key === 'F11') {
    event.preventDefault();
  }
});

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
