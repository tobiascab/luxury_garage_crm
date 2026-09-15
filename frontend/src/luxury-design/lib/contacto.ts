import { useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * Canales de contacto del Garage (WhatsApp, Instagram y demás), para mostrarlos en la
 * landing, el inicio y el perfil.
 *
 * Los datos se cargan desde Admin › Configuración › Redes; acá sólo se decide cómo se
 * presentan. Un canal que no esté cargado no aparece: un ícono que no lleva a ningún lado
 * es peor que no tener el ícono.
 */

export interface CanalContacto {
  id: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';
  label: string;
  /** Lo que se lee al lado del ícono: el número o el @usuario, no la URL. */
  detalle: string;
  /** Qué pasa al tocar, dicho como lo diría el cliente ("Escribinos por WhatsApp"). */
  titulo: string;
  href: string;
}

// WhatsApp abre el chat con el saludo ya escrito: el cliente sólo tiene que mandar.
const SALUDO_WHATSAPP = 'Hola Luxury Garage, quería hacerles una consulta.';

const ORDEN: CanalContacto['id'][] = ['whatsapp', 'instagram', 'facebook', 'tiktok'];

function formatearTelefono(digitos: string) {
  // 595982174880 → +595 982 174 880
  const m = digitos.match(/^(595)(\d{3})(\d{3})(\d{3,4})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${digitos}`;
}

function usuarioDe(url: string) {
  try {
    const partes = new URL(url).pathname.split('/').filter(Boolean);
    const ultimo = (partes[partes.length - 1] || '').replace(/^@/, '');
    return ultimo ? `@${ultimo}` : '';
  } catch {
    return '';
  }
}

function armarCanal(id: CanalContacto['id'], url: string): CanalContacto {
  switch (id) {
    case 'whatsapp': {
      const digitos = url.replace(/\D/g, '');
      return {
        id, label: 'WhatsApp',
        detalle: formatearTelefono(digitos),
        titulo: 'Escribinos por WhatsApp',
        href: `https://wa.me/${digitos}?text=${encodeURIComponent(SALUDO_WHATSAPP)}`,
      };
    }
    case 'instagram':
      return { id, label: 'Instagram', detalle: usuarioDe(url), titulo: 'Seguinos en Instagram', href: url };
    case 'tiktok':
      return { id, label: 'TikTok', detalle: usuarioDe(url), titulo: 'Seguinos en TikTok', href: url };
    default:
      return { id, label: 'Facebook', detalle: 'Luxury Garage', titulo: 'Visitanos en Facebook', href: url };
  }
}

// Una sola consulta por carga de página, aunque el pie, el inicio y el perfil la pidan a la vez.
let pedido: Promise<CanalContacto[]> | null = null;

function cargarCanales(): Promise<CanalContacto[]> {
  if (!pedido) {
    pedido = api.get('/settings/redes')
      .then((r: any) => {
        const datos: Record<string, string> = r.data?.data || {};
        return ORDEN.filter((id) => datos[id]).map((id) => armarCanal(id, datos[id]));
      })
      .catch(() => {
        pedido = null; // si falló, que el próximo intento vuelva a preguntar
        return [];
      });
  }
  return pedido;
}

export function useContacto() {
  const [canales, setCanales] = useState<CanalContacto[]>([]);
  useEffect(() => {
    let vivo = true;
    cargarCanales().then((c) => { if (vivo) setCanales(c); });
    return () => { vivo = false; };
  }, []);
  return canales;
}
