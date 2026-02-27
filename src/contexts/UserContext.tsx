import React, { createContext, useContext, useState, useEffect } from 'react';

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
            const res = await fetch("/api/users/profile", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    const logout = async () => {
        try {
            await fetch("/api/users/logout", { method: "POST", credentials: "include" });
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            // Clear everything regardless of API result
            localStorage.removeItem('userInfo');
            localStorage.removeItem('webUserInfo');
            localStorage.removeItem('stablex_secure_balances');
            localStorage.removeItem('stablex_theme');
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
