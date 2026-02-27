import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

const ProtectedAdminRoute = () => {
    const { user, isLoading } = useUser();

    if (isLoading) {
        return null;
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
