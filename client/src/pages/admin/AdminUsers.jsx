import { useState } from "react";
import api, { getApiError } from "../../services/api";
import { useApiGet } from "../../hooks/useApiGet";
import { useAuth } from "../../context/AuthContext";
import { ROLE_VALUES, roleLabel } from "../../constants/roles";

function AdminUsers() {
    const { user: currentUser } = useAuth();

    const { data, loading, error: loadError, reload: loadUsers, setData } = useApiGet(
        "/users",
        "Could not load users."
    );
    const users = data?.users || [];

    // Unsaved role choices, keyed by user id
    const [selectedRoles, setSelectedRoles] = useState({});
    const [savingId, setSavingId] = useState(null);
    const [message, setMessage] = useState(null);

    const saveRole = async (user) => {
        const role = selectedRoles[user._id];

        setSavingId(user._id);
        setMessage(null);

        try {
            const response = await api.patch(`/users/${user._id}/role`, { role });

            setData((previous) => ({
                ...previous,
                users: previous.users.map((u) =>
                    u._id === user._id ? { ...u, role: response.data.user.role } : u
                ),
            }));
            setSelectedRoles((current) => {
                const next = { ...current };
                delete next[user._id];
                return next;
            });
            setMessage({
                type: "success",
                text: `${user.name} is now ${roleLabel(role)}. This applies to their next request, no re-login needed.`,
            });
        } catch (err) {
            setMessage({ type: "error", text: getApiError(err, "Could not change the role.").message });
        } finally {
            setSavingId(null);
        }
    };

    return (
        <main className="page">

            <div className="dashboard-header">
                <div>
                    <p className="eyebrow">ADMIN</p>

                    <h1>Users</h1>

                    <p className="subtitle">
                        Change a user's role. Approvers act on workflow steps assigned to their role.
                    </p>
                </div>
            </div>

            {message && (
                <div className={message.type === "success" ? "success-message" : "error-message"}>
                    {message.text}
                </div>
            )}

            <section className="dashboard-section">
                {loading && !data ? (

                    <div className="loading">Loading users...</div>

                ) : loadError ? (

                    <div className="empty-state">
                        <h3>Could not load users</h3>
                        <p>{loadError.message}</p>
                        <button className="secondary-btn spaced" onClick={loadUsers}>
                            Try again
                        </button>
                    </div>

                ) : users.length === 0 ? (

                    <div className="empty-state">
                        <h3>No users found</h3>
                        <p>Users appear here after they register.</p>
                    </div>

                ) : (

                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>

                            <tbody>
                                {users.map((user) => {
                                    const isSelf = user._id === currentUser.id;
                                    const selected = selectedRoles[user._id] ?? user.role;
                                    const changed = selected !== user.role;

                                    return (
                                        <tr key={user._id}>
                                            <td>
                                                {user.name}
                                                {isSelf && <span className="muted"> (you)</span>}
                                            </td>

                                            <td className="muted">{user.email}</td>

                                            <td>
                                                <select
                                                    aria-label={`Role for ${user.name}`}
                                                    value={selected}
                                                    disabled={isSelf || savingId === user._id}
                                                    title={isSelf ? "You cannot change your own role" : undefined}
                                                    onChange={(e) =>
                                                        setSelectedRoles({ ...selectedRoles, [user._id]: e.target.value })
                                                    }
                                                >
                                                    {ROLE_VALUES.map((role) => (
                                                        <option key={role} value={role}>{roleLabel(role)}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td className="table-action">
                                                <button
                                                    className="primary-btn small"
                                                    onClick={() => saveRole(user)}
                                                    disabled={!changed || savingId === user._id}
                                                >
                                                    {savingId === user._id ? "Saving..." : "Save"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                )}
            </section>

        </main>
    );
}

export default AdminUsers;
