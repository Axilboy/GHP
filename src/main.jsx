import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { runSplash } from './splash';
import { RuntimeGuards } from './runtimeGuards';
import { initOpenPanel } from './openPanel';
import './fonts.css';
import './styles.css';
import './assets/covers.generated.css';

initOpenPanel();
createRoot(document.getElementById('root')).render(<StrictMode><RuntimeGuards><App /></RuntimeGuards></StrictMode>);
runSplash();
