import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../constants/roles";
import Navbar from "./Navbar";

// Logged-in pages: navbar + page. Waits for the user to be refreshed from the server.
export function ProtectedLayout() {
    const { user, loading } = useAuth();

    if (!localStorage.getItem("token")) {
        return <Navigate to="/login" replace />;
    }

    if (loading || !user) {
        return (
            <main className="page">
                <div className="loading">Loading FormFlow...</div>
            </main>
        );
    }

    return (
        <>
            <Navbar />
            <Outlet />
        </>
    );
}

// Hides pages a role cannot use. This is a convenience only:
// the API returns 403 for these actions regardless of what the UI shows.
export function RoleRoute({ roles }) {
    const { user } = useAuth();

    if (!roles.includes(user.role)) {
        return (
            <main className="page">
                <div className="empty-state">
                    <h3>You don't have access to this page</h3>
                    <p>
                        This page is for {roles.map(roleLabel).join(" or ")} users.
                        You are signed in as {roleLabel(user.role)}.
                    </p>
                    <p className="empty-action">
                        <Link to="/dashboard">Back to dashboard</Link>
                    </p>
                </div>
            </main>
        );
    }

    return <Outlet />;
}
