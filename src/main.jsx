import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './cleanup.css';
import './snapshot.css';
createRoot(document.getElementById('root')).render(<App/>);
