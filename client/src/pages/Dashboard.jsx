import { useEffect, useState } from "react";
import api from "../services/api";

function Dashboard() {
    const [requests, setRequests] = useState([]);
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    const [showCreate, setShowCreate] = useState(false);

    const [form, setForm] = useState({
        workflowId: "",
        title: "",
        description: "",
    });

    const loadData = async () => {
        try {
            const requestsResponse = await api.get("/requests");
            const workflowsResponse = await api.get("/workflows");

            setRequests(
                requestsResponse.data.requests || []
            );

            setWorkflows(
                workflowsResponse.data.workflows || []
            );
        } catch (error) {
            console.error("Dashboard error:", error);

            setMessage(
                error.response?.data?.message ||
                "Could not load dashboard data."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const createRequest = async (e) => {
        e.preventDefault();

        setMessage("");

        try {
            await api.post("/requests", form);

            setMessage("Request submitted successfully.");

            setForm({
                workflowId: "",
                title: "",
                description: "",
            });

            setShowCreate(false);

            await loadData();
        } catch (error) {
            setMessage(
                error.response?.data?.message ||
                "Could not submit request."
            );
        }
    };

    if (loading) {
        return (
            <main className="page">
                <div className="loading">
                    Loading FormFlow...
                </div>
            </main>
        );
    }

    const pendingCount = requests.filter(
        (request) => request.status === "pending"
    ).length;

    const approvedCount = requests.filter(
        (request) => request.status === "approved"
    ).length;

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

            <section className="stats-grid">

                <div className="stat-card">
                    <span>My Requests</span>
                    <strong>{requests.length}</strong>
                </div>

                <div className="stat-card">
                    <span>Pending</span>
                    <strong>{pendingCount}</strong>
                </div>

                <div className="stat-card">
                    <span>Approved</span>
                    <strong>{approvedCount}</strong>
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
                        <h3>No requests yet</h3>

                        <p>
                            Create your first workflow request.
                        </p>
                    </div>

                ) : (

                    <div className="request-list">

                        {requests.map((request) => (

                            <div
                                className="request-card"
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

                                    <span>
                                        Step {request.currentStep}
                                    </span>

                                </div>

                            </div>

                        ))}

                    </div>

                )}

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
                            Create a workflow from the backend first.
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
                                onClick={() =>
                                    setShowCreate(false)
                                }
                            >
                                ×
                            </button>

                        </div>

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
                            >
                                Submit Request
                            </button>

                        </form>

                    </div>

                </div>

            )}

        </main>
    );
}

export default Dashboard;