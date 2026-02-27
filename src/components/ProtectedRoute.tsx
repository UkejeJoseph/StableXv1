import { Navigate, Outlet, useLocation } from "react-router-dom";

const ProtectedRoute = () => {
    const location = useLocation();
    const isWebMode = location.pathname.startsWith('/web');

    const storageKey = isWebMode ? "webUserInfo" : "userInfo";
    const loginPath = isWebMode ? "/web/login" : "/login";

    const userInfo = localStorage.getItem(storageKey);

    if (!userInfo) {
        return <Navigate to={loginPath} state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
