import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface LuxuryUserContextType {
    fullUser: any;
    loading: boolean;
    refreshProfile: () => Promise<void>;
}

const LuxuryUserContext = createContext<LuxuryUserContextType | undefined>(undefined);

export function LuxuryUserProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [fullUser, setFullUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const refreshProfile = async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            const res = await api.get('/luxury/profile/full');
            setFullUser(res.data.data);
        } catch (e) {
            console.error('Error fetching full luxury profile', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshProfile();
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
