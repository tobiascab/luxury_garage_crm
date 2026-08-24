import { useEffect } from 'react';

/**
 * Las pantallas de acceso —login, alta, recuperar contraseña— van SIEMPRE en claro.
 *
 * El modo oscuro se guarda en localStorage y se aplica como clase `.dark` en el <html>, así que
 * quedaba pegado al cerrar sesión: el cliente volvía al login y lo veía oscuro. Acá se quita
 * mientras la pantalla está montada y se restaura al salir, para no pisarle la preferencia que
 * el usuario eligió para el resto de la app.
 */
export function useModoClaro() {
    useEffect(() => {
        const root = document.documentElement;
        const estabaOscuro = root.classList.contains('dark');
        root.classList.remove('dark');
        return () => {
            if (estabaOscuro) root.classList.add('dark');
        };
    }, []);
}
