/**
 * Centralized API Fetch Utility
 * Automatically handles 401 Unauthorized by attempting to refresh the session
 * and retrying the original request.
 */

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "";
    const fullUrl = url.startsWith("/") ? `${BASE_URL}${url}` : url;
    
    const defaultOptions: RequestInit = {
        credentials: "include", // Ensure cookies are sent
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        ...options,
    };

    let response = await fetch(fullUrl, defaultOptions);
    
    // If 401 Unauthorized and not already trying to refresh, try to refresh the token
    if (response.status === 401 && !url.includes("/api/auth/refresh")) {
        console.warn(`[API] 401 Unauthorized on ${url}. Attempting to refresh token...`);
        
        try {
            const refreshToken = localStorage.getItem("refreshToken");
            
            const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ refreshToken }),
            });
            
            if (refreshRes.ok) {
                console.log("[API] Token refresh successful. Retrying original request...");
                // Retry the original request with the same fullUrl
                response = await fetch(fullUrl, defaultOptions);
            } else {
                console.error("[API] Token refresh failed. User must re-login.");
            }
        } catch (err) {
            console.error("[API] Fatal error during token refresh:", err);
        }
    }

    return response;
}
