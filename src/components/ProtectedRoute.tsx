import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

const ProtectedRoute = () => {
    const { user, isLoading } = useUser();
    const location = useLocation();
    const isWebMode = location.pathname.startsWith('/web');

    const loginPath = isWebMode ? "/web/login" : "/login";

    if (isLoading) {
        return null; // or a loading spinner
    }

    if (!user) {
        return <Navigate to={loginPath} state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
