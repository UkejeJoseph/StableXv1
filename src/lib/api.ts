/**
 * Centralized API Fetch Utility
 * Automatically handles 401 Unauthorized by attempting to refresh the session
 * and retrying the original request.
 */

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultOptions: RequestInit = {
        credentials: "include", // Ensure cookies are sent
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        ...options,
    };

    let response = await fetch(url, defaultOptions);

    // If 401 Unauthorized, try to refresh the token
    if (response.status === 401) {
        console.warn(`[API] 401 Unauthorized on ${url}. Attempting to refresh token...`);

        try {
            const refreshRes = await fetch("/api/auth/refresh", {
                method: "POST",
                credentials: "include",
            });

            if (refreshRes.ok) {
                console.log("[API] Token refresh successful. Retrying original request...");
                // Retry the original request
                response = await fetch(url, defaultOptions);
            } else {
                console.error("[API] Token refresh failed. User must re-login.");
                // Let the 401 bubble up or handle logout if needed
            }
        } catch (err) {
            console.error("[API] Fatal error during token refresh:", err);
        }
    }

    return response;
}
