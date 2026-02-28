import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { Loader2 } from "lucide-react";

const ProtectedRoute = () => {
    const { user, isLoading } = useUser();
    const location = useLocation();

    // Determine which login page to show based on current URL
    const isWebMode = location.pathname.startsWith('/web');
    const loginPath = isWebMode ? "/web/login" : "/login";

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to={loginPath} state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
