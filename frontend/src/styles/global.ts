import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  /* Google Fonts import */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  /* CSS Reset */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 14px; -webkit-font-smoothing: antialiased; }

  body {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0a0a0a;
    color: #fafafa;
    line-height: 1.5;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

  /* Keyframes */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* Selection */
  ::selection { background: rgba(99,102,241,0.3); color: #fff; }

  a { color: #818cf8; text-decoration: none; }
  a:hover { color: #a5b4fc; }
`;
