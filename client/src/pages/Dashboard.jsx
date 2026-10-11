import { useState } from "react";
import { Link } from "react-router-dom";
import api, { getApiError } from "../services/api";
import { useApiGet } from "../hooks/useApiGet";
import { useAuth } from "../context/AuthContext";
import { ROLES, roleLabel } from "../constants/roles";
import { getCurrentStep } from "../utils/requests";
import Pagination from "../components/Pagination";

function Dashboard() {
    const { user } = useAuth();

    const [page, setPage] = useState(1);

    const requestsQuery = useApiGet(
        `/requests?page=${page}`,
        "Could not load your requests.",
        { keepPrevious: true }
    );
    // Card totals come from the server, not from the page of requests currently loaded
    const statsQuery = useApiGet("/requests/stats", "Could not load your totals.");
    const workflowsQuery = useApiGet("/workflows", "Could not load workflows.");

    const requests = requestsQuery.data?.requests || [];
    const stats = statsQuery.data?.stats;
    const workflows = workflowsQuery.data?.workflows || [];
    const loadError = requestsQuery.error || statsQuery.error || workflowsQuery.error;

    const [message, setMessage] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [showCreate, setShowCreate] = useState(false);

    const [form, setForm] = useState({
        workflowId: "",
        title: "",
        description: "",
    });

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const createRequest = async (e) => {
        e.preventDefault();

        setMessage("");
        setSubmitError("");
        setSubmitting(true);

        try {
            await api.post("/requests", form);

            setMessage("Request submitted successfully.");

            setForm({
                workflowId: "",
                title: "",
                description: "",
            });

            setShowCreate(false);

            // The new request is the newest, so show page 1
            setPage(1);
            requestsQuery.reload();
            statsQuery.reload();
        } catch (error) {
            setSubmitError(getApiError(error, "Could not submit request.").message);
        } finally {
            setSubmitting(false);
        }
    };

    const closeCreate = () => {
        setShowCreate(false);
        setSubmitError("");
    };

    const firstLoad =
        (requestsQuery.loading && !requestsQuery.data) ||
        (statsQuery.loading && !statsQuery.data) ||
        (workflowsQuery.loading && !workflowsQuery.data);

    if (firstLoad && !loadError) {
        return (
            <main className="page">
                <div className="loading">
                    Loading FormFlow...
                </div>
            </main>
        );
    }

    return (
        <main className="page">

            <div className="dashboard-header">

                <div>
                    <p className="eyebrow">
                        WORKFLOW MANAGEMENT
                    </p>

                    <h1>Dashboard</h1>

                    <p className="subtitle">
                        Track requests and manage your workflow.
                    </p>
                </div>

                <button
                    className="primary-btn small"
                    onClick={() => setShowCreate(true)}
                >
                    + New Request
                </button>

            </div>

            {message && (
                <div className="success-message">
                    {message}
                </div>
            )}

            {loadError && (
                <div className="error-message">
                    {loadError.message}{" "}
                    <button
                        className="secondary-btn"
                        onClick={() => {
                            requestsQuery.reload();
                            statsQuery.reload();
                            workflowsQuery.reload();
                        }}
                    >
                        Try again
                    </button>
                </div>
            )}

            <section className="stats-grid">

                <div className="stat-card">
                    <span>My Requests</span>
                    <strong>{stats?.total ?? "—"}</strong>
                </div>

                <div className="stat-card">
                    <span>Pending</span>
                    <strong>{stats?.pending ?? "—"}</strong>
                </div>

                <div className="stat-card">
                    <span>Approved</span>
                    <strong>{stats?.approved ?? "—"}</strong>
                </div>

                <div className="stat-card">
                    <span>Workflows</span>
                    <strong>{workflows.length}</strong>
                </div>

            </section>

            <section className="dashboard-section">

                <div className="section-header">
                    <h2>My Requests</h2>

                    <p>
                        Requests you have submitted.
                    </p>
                </div>

                {requests.length === 0 ? (

                    <div className="empty-state">
                        {page > 1 ? (
                            <>
                                <h3>No requests on this page</h3>
                                <p>Go back to an earlier page.</p>
                            </>
                        ) : (
                            <>
                                <h3>No requests yet</h3>
                                <p>Create your first workflow request.</p>
                            </>
                        )}
                    </div>

                ) : (

                    <div className="request-list">

                        {requests.map((request) => (

                            <Link
                                to={`/requests/${request._id}`}
                                className="request-card clickable"
                                key={request._id}
                            >

                                <div>
                                    <h3>
                                        {request.title}
                                    </h3>

                                    <p>
                                        {request.description}
                                    </p>
                                </div>

                                <div className="request-meta">

                                    <span
                                        className={`status ${request.status}`}
                                    >
                                        {request.status}
                                    </span>

                                    {request.status === "pending" && (
                                        <span>
                                            Step {request.currentStep}
                                            {getCurrentStep(request) &&
                                                ` · waiting on ${roleLabel(getCurrentStep(request).approverRole)}`}
                                        </span>
                                    )}

                                </div>

                            </Link>

                        ))}

                    </div>

                )}

                <Pagination
                    page={page}
                    totalPages={requestsQuery.data?.totalPages}
                    total={requestsQuery.data?.total}
                    loading={requestsQuery.loading}
                    onPageChange={setPage}
                    itemLabel="requests"
                />

            </section>

            <section className="dashboard-section">

                <div className="section-header">
                    <h2>Available Workflows</h2>

                    <p>
                        Workflows available for submitting requests.
                    </p>
                </div>

                {workflows.length === 0 ? (

                    <div className="empty-state">
                        <h3>No workflows available</h3>

                        <p>
                            {user.role === ROLES.ADMIN ? (
                                <Link to="/admin/workflows">Create one in Workflows.</Link>
                            ) : (
                                "Ask an admin to create one."
                            )}
                        </p>
                    </div>

                ) : (

                    <div className="workflow-grid">

                        {workflows.map((workflow) => (

                            <div
                                className="workflow-card"
                                key={workflow._id}
                            >

                                <div className="workflow-icon">
                                    WF
                                </div>

                                <h3>
                                    {workflow.name}
                                </h3>

                                <p>
                                    {workflow.description}
                                </p>

                                <span>
                                    {workflow.steps?.length || 0}
                                    {" "}approval steps
                                </span>

                            </div>

                        ))}

                    </div>

                )}

            </section>

            {showCreate && (

                <div className="modal-overlay">

                    <div className="modal">

                        <div className="modal-header">

                            <div>
                                <h2>New Request</h2>

                                <p>
                                    Submit a request for approval.
                                </p>
                            </div>

                            <button
                                className="close-btn"
                                onClick={closeCreate}
                            >
                                ×
                            </button>

                        </div>

                        {submitError && (
                            <div className="error-message">
                                {submitError}
                            </div>
                        )}

                        <form onSubmit={createRequest}>

                            <label>
                                Workflow
                            </label>

                            <select
                                name="workflowId"
                                value={form.workflowId}
                                onChange={handleChange}
                                required
                            >

                                <option value="">
                                    Select workflow
                                </option>

                                {workflows.map((workflow) => (

                                    <option
                                        key={workflow._id}
                                        value={workflow._id}
                                    >
                                        {workflow.name}
                                    </option>

                                ))}

                            </select>

                            <label>
                                Title
                            </label>

                            <input
                                name="title"
                                placeholder="e.g. Leave Request"
                                value={form.title}
                                onChange={handleChange}
                                required
                            />

                            <label>
                                Description
                            </label>

                            <textarea
                                name="description"
                                placeholder="Describe your request..."
                                rows="5"
                                value={form.description}
                                onChange={handleChange}
                                required
                            />

                            <button
                                className="primary-btn"
                                type="submit"
                                disabled={submitting}
                            >
                                {submitting ? "Submitting..." : "Submit Request"}
                            </button>

                        </form>

                    </div>

                </div>

            )}

        </main>
    );
}

export default Dashboard;