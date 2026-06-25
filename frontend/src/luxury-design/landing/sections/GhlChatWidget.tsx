/**
 * GhlChatWidget — Chat Widget nativo de GoHighLevel (LeadConnector) para la
 * landing pública.
 *
 * Monta el custom element <chat-widget location-id={...}> y carga el loader
 * oficial de LeadConnector una sola vez (guard contra doble carga, robusto
 * frente al StrictMode de React y a re-montajes de la sección).
 *
 * Requiere la env var VITE_GHL_CHAT_LOCATION_ID. Si falta, no renderiza nada
 * (return null) y avisa por consola.
 */
import React, { useEffect } from 'react';

// El loader inyecta un custom element propio: lo declaramos para TS/JSX.
// Con el runtime `react-jsx`, TS resuelve los intrinsics desde React.JSX.
declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'chat-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                'location-id'?: string;
            };
        }
    }
}

const LOADER_SRC = 'https://widgets.leadconnectorhq.com/loader.js';
const RESOURCES_URL = 'https://widgets.leadconnectorhq.com/chat-widget/loader.js';

export default function GhlChatWidget() {
    const locationId = import.meta.env.VITE_GHL_CHAT_LOCATION_ID as string | undefined;

    useEffect(() => {
        if (!locationId) return;

        // Guard: cargar el loader una sola vez aunque la sección se re-monte.
        if (document.querySelector(`script[src="${LOADER_SRC}"]`)) return;

        const script = document.createElement('script');
        script.src = LOADER_SRC;
        script.async = true;
        script.setAttribute('data-resources-url', RESOURCES_URL);
        script.setAttribute('data-widget-id', locationId);
        document.body.appendChild(script);

        // No removemos el script en cleanup: el widget debe persistir mientras
        // el usuario navega la landing y volver a inyectarlo duplicaría el chat.
    }, [locationId]);

    if (!locationId) {
        console.warn(
            '[GhlChatWidget] Falta VITE_GHL_CHAT_LOCATION_ID; el chat de GoHighLevel no se montará.'
        );
        return null;
    }

    return <chat-widget location-id={locationId} />;
}
