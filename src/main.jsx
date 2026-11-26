import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './lib/install.js' // 앱 설치 신호를 일찍부터 받아 두려고 처음에 불러와요

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 서비스 워커 등록: 인터넷이 끊겨도 앱 화면이 열리게 해요. (public/sw.js)
// 개발 서버(npm run dev)에서는 코드 수정이 바로 보이도록 등록하지 않고, 배포된 사이트에서만 써요.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('서비스 워커를 등록하지 못했어요:', error)
    })
  })
}
