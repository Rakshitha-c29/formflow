import { useState } from "react";
import { Link } from "react-router-dom";
import { useApiGet } from "../hooks/useApiGet";
import { useAuth } from "../context/AuthContext";
import { ROLES, roleLabel } from "../constants/roles";
import { formatDate, getCurrentStep } from "../utils/requests";
import Pagination from "../components/Pagination";

function PendingApprovals() {
    const { user } = useAuth();
    const isAdmin = user.role === ROLES.ADMIN;

    const [page, setPage] = useState(1);

    const { data, loading, error, reload } = useApiGet(
        `/requests/pending?page=${page}`,
        "Could not load pending approvals.",
        { keepPrevious: true }
    );
    const requests = data?.requests || [];

    return (
        <main className="page">

            <div className="dashboard-header">
                <div>
                    <p className="eyebrow">APPROVALS</p>

                    <h1>Pending Approvals</h1>

                    <p className="subtitle">
                        {isAdmin
                            ? "Every pending request. Only the role assigned to the current step can approve or reject it."
                            : `Requests waiting on the ${roleLabel(user.role)} step.`}
                    </p>
                </div>

                <button
                    className="secondary-btn"
                    onClick={reload}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {loading && !data ? (

                <div className="loading">Loading pending approvals...</div>

            ) : error ? (

                <div className="empty-state">
                    <h3>Could not load approvals</h3>
                    <p>{error.message}</p>
                    <button className="secondary-btn spaced" onClick={reload}>
                        Try again
                    </button>
                </div>

            ) : requests.length === 0 && page > 1 ? (

                <div className="empty-state">
                    <h3>No requests on this page</h3>
                    <p>Requests may have been approved since you opened this list.</p>
                    <button className="secondary-btn spaced" onClick={() => setPage(1)}>
                        Back to page 1
                    </button>
                </div>

            ) : requests.length === 0 ? (

                <div className="empty-state">
                    <h3>Nothing waiting for you</h3>
                    <p>
                        When a request reaches a step assigned to your role, it will appear here.
                    </p>
                </div>

            ) : (

                <div className="request-list">
                    {requests.map((request) => {
                        const step = getCurrentStep(request);

                        return (
                            <Link
                                to={`/requests/${request._id}`}
                                className="request-card clickable"
                                key={request._id}
                            >
                                <div>
                                    <h3>{request.title}</h3>

                                    <p>
                                        {request.submittedBy?.name || "Unknown user"}
                                        {" · "}
                                        {request.workflow?.name || "Deleted workflow"}
                                        {" · "}
                                        {formatDate(request.createdAt)}
                                    </p>
                                </div>

                                <div className="request-meta">
                                    <span>
                                        Step {request.currentStep}
                                        {step && `: ${step.name}`}
                                    </span>

                                    {step && (
                                        <span className={`role-badge ${step.approverRole}`}>
                                            {roleLabel(step.approverRole)}
                                        </span>
                                    )}

                                    <span className={`status ${request.status}`}>
                                        {request.status}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

            )}

            {!error && (
                <Pagination
                    page={page}
                    totalPages={data?.totalPages}
                    total={data?.total}
                    loading={loading}
                    onPageChange={setPage}
                    itemLabel="pending"
                />
            )}

        </main>
    );
}

export default PendingApprovals;
