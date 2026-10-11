import axios from "axios";

// Set VITE_API_URL in client/.env for other environments (see .env.example)
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// A 401 on login/register means bad credentials and is shown on that form.
// Anywhere else it means the session is no longer valid.
const AUTH_ATTEMPT_URLS = ["/auth/login", "/auth/register"];

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthAttempt = AUTH_ATTEMPT_URLS.includes(error.config?.url);

        if (error.response?.status === 401 && !isAuthAttempt) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");

            if (window.location.pathname !== "/login") {
                window.location.assign("/login?expired=1");
            }
        }

        return Promise.reject(error);
    }
);

// Normalizes an Axios error into what the UI needs to display
export const getApiError = (error, fallback) => ({
    status: error.response?.status,
    message: error.response?.data?.message || fallback,
    errors: error.response?.data?.errors || [],
});

export default api;
