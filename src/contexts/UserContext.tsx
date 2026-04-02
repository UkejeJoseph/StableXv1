import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface User {
    _id: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    role: string;
    kycStatus?: string;
    isVerified?: boolean;
    kycLevel?: number;
    fullName?: string;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    isLoading: boolean;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = async () => {
        try {
            const res = await apiFetch("/api/users/profile");
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else if (res.status === 401 || res.status === 403) {
                // If apiFetch's internal refresh also failed (or it's an explicit forbidden), clear user
                setUser(null);
            } else {
                console.warn(`[UserContext] Profile fetch failed with status ${res.status}`);
            }
        } catch (error) {
            console.error("[UserContext] Failed to fetch user profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    const logout = async () => {
        try {
            await apiFetch("/api/users/logout", { method: "POST" });
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            // Clear identity-related state
            sessionStorage.clear();
            setUser(null);

            const isWeb = window.location.pathname.startsWith('/web');
            window.location.href = isWeb ? "/web/login" : "/login";
        }
    };

    return (
        <UserContext.Provider value={{ user, setUser, isLoading, logout, refreshUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
