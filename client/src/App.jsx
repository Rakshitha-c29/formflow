import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import PendingApprovals from "./pages/PendingApprovals";
import RequestDetail from "./pages/RequestDetail";
import AdminWorkflows from "./pages/admin/AdminWorkflows";
import AdminUsers from "./pages/admin/AdminUsers";
import AuthProvider from "./context/AuthProvider";
import { ProtectedLayout, RoleRoute } from "./components/RouteGuards";
import { APPROVER_ROLES, ROLES } from "./constants/roles";

import "./App.css";

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>

                <Routes>

                    <Route path="/login" element={<Login />} />

                    <Route path="/register" element={<Register />} />

                    <Route element={<ProtectedLayout />}>

                        <Route path="/dashboard" element={<Dashboard />} />

                        <Route path="/requests/:id" element={<RequestDetail />} />

                        <Route element={<RoleRoute roles={APPROVER_ROLES} />}>
                            <Route path="/approvals" element={<PendingApprovals />} />
                        </Route>

                        <Route element={<RoleRoute roles={[ROLES.ADMIN]} />}>
                            <Route path="/admin/workflows" element={<AdminWorkflows />} />
                            <Route path="/admin/users" element={<AdminUsers />} />
                        </Route>

                    </Route>

                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />

                </Routes>

            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
