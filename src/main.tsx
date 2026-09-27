import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import { ChromeRedirectScreen } from './components/ChromeRedirectScreen.tsx';
import { isRestrictedBrowser } from './lib/browserDetect.ts';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (isRestrictedBrowser()) {
  root.render(
    <StrictMode>
      <ChromeRedirectScreen />
    </StrictMode>
  );
} else {
  root.render(
    <StrictMode>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>
  );
}
