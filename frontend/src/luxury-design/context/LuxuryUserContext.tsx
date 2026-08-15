import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface LuxuryUserContextType {
    fullUser: any;
    loading: boolean;
    refreshProfile: (force?: boolean) => Promise<void>;
}

const LuxuryUserContext = createContext<LuxuryUserContextType | undefined>(undefined);

// Cache de 60 segundos para evitar cargas repetidas
const CACHE_TTL = 60000;

export function LuxuryUserProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [fullUser, setFullUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const cacheRef = useRef<{ data: any; timestamp: number } | null>(null);
    const fetchingRef = useRef(false); // Previene llamadas simultáneas

    const refreshProfile = useCallback(async (force = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        // Si ya hay una petición en curso, no lanzar otra
        if (fetchingRef.current) return;

        // Verificar caché (a menos que sea forzado)
        if (!force && cacheRef.current) {
            const age = Date.now() - cacheRef.current.timestamp;
            if (age < CACHE_TTL) {
                setFullUser(cacheRef.current.data);
                setLoading(false);
                return;
            }
        }

        fetchingRef.current = true;
        try {
            // Con force (típicamente después de pagar o cambiar de plan) se saltea también la
            // caché de api.get, no solo la de este contexto: si no, el perfil podía volver con
            // los datos de antes del cobro y el cliente veía su plan sin lavados.
            const res = await api.get('/luxury/profile/full', force ? ({ _noCache: true } as any) : undefined);
            const data = res.data.data;
            setFullUser(data);
            cacheRef.current = { data, timestamp: Date.now() };
        } catch (e) {
            console.error('Error fetching full luxury profile', e);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [user]);

    useEffect(() => {
        refreshProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    return (
        <LuxuryUserContext.Provider value={{ fullUser, loading, refreshProfile }}>
            {children}
        </LuxuryUserContext.Provider>
    );
}

export function useLuxuryUser() {
    const context = useContext(LuxuryUserContext);
    if (context === undefined) {
        throw new Error('useLuxuryUser must be used within a LuxuryUserProvider');
    }
    return context;
}
