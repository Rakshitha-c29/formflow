import { Link, useNavigate } from "react-router-dom";

function Navbar() {
    const navigate = useNavigate();

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    return (
        <nav className="navbar">
            <Link to="/dashboard" className="logo">
                Form<span>Flow</span>
            </Link>

            <div className="nav-links">
                <Link to="/dashboard">Dashboard</Link>

                <button onClick={logout} className="logout-btn">
                    Logout
                </button>
            </div>
        </nav>
    );
}

export default Navbar;