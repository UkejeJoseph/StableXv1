import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { Loader2 } from 'lucide-react';

const ProtectedAdminRoute = () => {
    const { user, isLoading } = useUser();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/web/login" replace />;
    }

    // Strict check: Must have admin role verified from server response
    if (user.role === 'admin') {
        return <Outlet />;
    } else {
        // Not authorized, kick them back to their standard dashboard
        return <Navigate to="/web/dashboard" replace />;
    }
};

export default ProtectedAdminRoute;
