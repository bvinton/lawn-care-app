import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerAppServiceWorker } from './lib/appServiceWorker.js';
import { AuthProvider } from './state/AuthContext.jsx';
import './index.css';

registerAppServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
