import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { APPROVER_ROLES, ROLES, roleLabel } from "../constants/roles";

function Navbar() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Links are shown by role for convenience; the backend enforces access
    const isApprover = APPROVER_ROLES.includes(user.role);
    const isAdmin = user.role === ROLES.ADMIN;

    return (
        <nav className="navbar">
            <Link to="/dashboard" className="logo">
                Form<span>Flow</span>
            </Link>

            <div className="nav-links">
                <NavLink to="/dashboard">Dashboard</NavLink>

                {isApprover && (
                    <NavLink to="/approvals">Approvals</NavLink>
                )}

                {isAdmin && (
                    <>
                        <NavLink to="/admin/workflows">Workflows</NavLink>
                        <NavLink to="/admin/users">Users</NavLink>
                    </>
                )}

                <span className="user-chip">
                    {user.name}
                    <span className={`role-badge ${user.role}`}>
                        {roleLabel(user.role)}
                    </span>
                </span>

                <button onClick={handleLogout} className="logout-btn">
                    Logout
                </button>
            </div>
        </nav>
    );
}

export default Navbar;
