import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * This page handles the redirect from Google OAuth.
 * It extracts the user data from the URL params and stores it in localStorage.
 */
export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const data = searchParams.get("data");
        const error = searchParams.get("error");

        if (error) {
            console.error("[AUTH CALLBACK] Google auth failed:", error);
            navigate("/web/login?error=google_auth_failed");
            return;
        }

        if (data) {
            try {
                const userData = JSON.parse(decodeURIComponent(data));
                console.log("[AUTH CALLBACK] ✅ Google auth successful");

                // User data is now managed by the backend session cookie
                // No need to store in localStorage

                // Redirect to dashboard
                navigate("/web/dashboard");
            } catch (err) {
                console.error("[AUTH CALLBACK] Failed to parse auth data");
                navigate("/web/login?error=parse_failed");
            }
        } else {
            navigate("/web/login");
        }
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Completing Google sign-in...</p>
            </div>
        </div>
    );
}
