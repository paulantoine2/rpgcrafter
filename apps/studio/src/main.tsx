import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { watchSystemTheme } from '@/lib/system-theme';
import { applyStudioInterface, readStudioInterface } from '@/lib/studio-interface';

applyStudioInterface(readStudioInterface());
watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider><App /></TooltipProvider>
  </StrictMode>,
);
