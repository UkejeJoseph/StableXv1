import { Navigate, Outlet } from 'react-router-dom';

const ProtectedAdminRoute = () => {
    const userInfoString = localStorage.getItem('userInfo');

    if (!userInfoString) {
        return <Navigate to="/web/login" replace />;
    }

    try {
        const userInfo = JSON.parse(userInfoString);

        // Strict check: Must be the platform owner's email
        const isOwner = userInfo.email && userInfo.email.toLowerCase() === 'ukejejoseph1@gmail.com';
        const isAdminRole = userInfo.role === 'admin';

        if (isOwner || isAdminRole) {
            return <Outlet />;
        } else {
            // Not authorized, kick them back to their standard dashboard
            return <Navigate to="/web/dashboard" replace />;
        }
    } catch (error) {
        return <Navigate to="/web/login" replace />;
    }
};

export default ProtectedAdminRoute;
