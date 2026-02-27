import { Navigate, Outlet, useLocation } from "react-router-dom";

const ProtectedRoute = () => {
    const userInfo = localStorage.getItem("userInfo");
    const location = useLocation();

    if (!userInfo) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
