import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

/**
 * This page handles the redirect from Google OAuth.
 * It extracts the user data from the URL params and stores it in localStorage.
 */
export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const { setUser } = useUser();

    useEffect(() => {
        const data = searchParams.get("data");
        const token = searchParams.get("token");
        const error = searchParams.get("error");

        if (error) {
            console.error("[AUTH CALLBACK] Google auth failed:", error);
            navigate("/web/login?error=google_auth_failed");
            return;
        }

        if (token) {
            localStorage.setItem("token", token);
        }

        if (data) {
            try {
                const userData = JSON.parse(decodeURIComponent(data));
                console.log("[AUTH CALLBACK] ✅ Google auth successful");

                if (userData.refreshToken) {
                    localStorage.setItem("refreshToken", userData.refreshToken);
                }

                setUser(userData);
                if (userData.role === 'admin') {
                    navigate("/web/admin");
                } else {
                    navigate("/web/dashboard");
                }
            } catch (err) {
                console.error("[AUTH CALLBACK] Failed to parse auth data");
                navigate("/web/login?error=parse_failed");
            }
        } else if (token) {
            // We don't have role here, so we have to go to dashboard or wait for UserContext to refresh
            navigate("/web/dashboard");
        } else {
            navigate("/web/login");
        }
    }, [searchParams, navigate, setUser]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Completing Google sign-in...</p>
            </div>
        </div>
    );
}
