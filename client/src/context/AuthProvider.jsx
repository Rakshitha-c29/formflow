import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { AuthContext } from "./AuthContext";

// Login returns { id }, the profile endpoint returns a document with { _id }
const normalizeUser = (user) =>
    user && {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
    };

const readStoredUser = () => {
    try {
        return normalizeUser(JSON.parse(localStorage.getItem("user")));
    } catch {
        return null;
    }
};

function AuthProvider({ children }) {
    const [user, setUser] = useState(readStoredUser);
    const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));

    // The stored user can be stale (e.g. an admin changed the role),
    // so refresh it from the server once per page load
    useEffect(() => {
        if (!localStorage.getItem("token")) return;

        api.get("/auth/profile")
            .then((response) => {
                const fresh = normalizeUser(response.data.user);
                localStorage.setItem("user", JSON.stringify(fresh));
                setUser(fresh);
            })
            .catch(() => {
                // A 401 is handled by the API interceptor; other errors keep the stored user
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback((token, loggedInUser) => {
        const normalized = normalizeUser(loggedInUser);

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(normalized));
        setUser(normalized);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, logout }),
        [user, loading, login, logout]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default AuthProvider;
