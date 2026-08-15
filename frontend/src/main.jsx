import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './admin.css'

import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

/**
 * Actualización de la app instalada.
 *
 * Antes esto preguntaba con un confirm() si quería actualizar. El problema: cada publicación
 * renombra los archivos de la app, así que quien decía que no —o ni llegaba a ver el cartel,
 * cosa habitual en el celular— se quedaba con la versión vieja pidiendo archivos que ya no
 * existen. Al cambiar de módulo eso daba pantalla en blanco hasta volver a entrar.
 *
 * Ahora la versión nueva se prepara sola y se aplica en el próximo cambio de módulo, que es
 * el momento en que no se interrumpe nada: no se corta un pago ni un formulario a medias.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Deja lista la versión nueva; App.jsx recarga al navegar (ver aplicarActualizacionPendiente).
    window.__actualizacionPendiente = true
    updateSW(false)
  },
  onRegisteredSW(_swUrl, registro) {
    // Buscar versiones nuevas cada media hora mientras la app está abierta.
    if (registro) setInterval(() => registro.update().catch(() => {}), 30 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
