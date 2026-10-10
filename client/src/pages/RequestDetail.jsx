import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { getApiError } from "../services/api";
import { useApiGet } from "../hooks/useApiGet";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../constants/roles";
import { formatDate, getCurrentStep, idOf, sortSteps } from "../utils/requests";

const COMMENT_MAX = 500;

// Where each step stands, derived from the history and the current position
const describeStep = (request, step) => {
    const entry = request.approvalHistory.find((h) => h.stepNumber === step.stepNumber);

    if (entry) return { state: entry.action, entry };

    if (request.status === "pending" && step.stepNumber === request.currentStep) {
        return { state: "current" };
    }

    return { state: request.status === "rejected" ? "not-reached" : "upcoming" };
};

const STEP_STATE_LABELS = {
    approved: "Approved",
    rejected: "Rejected",
    current: "Awaiting action",
    upcoming: "Upcoming",
    "not-reached": "Not reached",
};

// Explains, for display only, why the action panel is hidden. The API makes the real decision.
const whyCannotAct = (request, currentStep, user) => {
    if (request.status !== "pending") return `This request was ${request.status}.`;
    if (idOf(request.submittedBy) === user.id) return "You submitted this request, so you cannot approve or reject it.";
    if (!currentStep) return "This request has no active step.";
    if (currentStep.approverRole !== user.role) {
        return `Waiting for ${roleLabel(currentStep.approverRole)} to act on step ${currentStep.stepNumber}.`;
    }
    return null;
};

function RequestDetail() {
    const { id } = useParams();
    const { user } = useAuth();

    const {
        data,
        loading,
        error: loadError,
        reload: loadRequest,
        setData,
    } = useApiGet(`/requests/${id}`, "Could not load this request.");
    const request = data?.request;

    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [success, setSuccess] = useState("");

    const reload = () => {
        setActionError(null);
        setSuccess("");
        loadRequest();
    };

    const act = async (action) => {
        setSubmitting(action);
        setActionError(null);
        setSuccess("");

        try {
            const response = await api.patch(`/requests/${id}/action`, {
                action,
                comment: comment.trim() || undefined,
            });

            setSuccess(response.data.message);
            setComment("");

            // Apply the new position immediately so the action panel closes,
            // then re-fetch so the new history entry shows populated names
            const { status, currentStep } = response.data.request;
            setData((previous) => ({ ...previous, request: { ...previous.request, status, currentStep } }));
            loadRequest();
        } catch (err) {
            setActionError(getApiError(err, "Could not complete this action."));
        } finally {
            setSubmitting(null);
        }
    };

    if (loading && !request && !loadError) {
        return (
            <main className="page">
                <div className="loading">Loading request...</div>
            </main>
        );
    }

    if (loadError && !request) {
        const title =
            loadError.status === 403 ? "You don't have access to this request"
                : loadError.status === 404 ? "Request not found"
                    : loadError.status === 400 ? "Invalid request link"
                        : "Could not load this request";

        return (
            <main className="page">
                <Link to="/dashboard" className="back-link">← Back to dashboard</Link>

                <div className="empty-state">
                    <h3>{title}</h3>
                    <p>{loadError.message}</p>
                    {loadError.status >= 500 || !loadError.status ? (
                        <button className="secondary-btn spaced" onClick={loadRequest}>
                            Try again
                        </button>
                    ) : null}
                </div>
            </main>
        );
    }

    const currentStep = getCurrentStep(request);
    const blockedReason = whyCannotAct(request, currentStep, user);
    const steps = sortSteps(request.steps);

    return (
        <main className="page">

            <Link to="/dashboard" className="back-link">← Back to dashboard</Link>

            <div className="dashboard-header">
                <div>
                    <p className="eyebrow">
                        {(request.workflow?.name || "Deleted workflow").toUpperCase()}
                    </p>

                    <h1>{request.title}</h1>

                    <p className="subtitle">
                        Submitted by {request.submittedBy?.name || "Unknown user"} on{" "}
                        {formatDate(request.createdAt)}
                    </p>
                </div>

                <span className={`status large ${request.status}`}>
                    {request.status}
                </span>
            </div>

            {success && <div className="success-message">{success}</div>}

            <section className="stats-grid">
                <div className="stat-card">
                    <span>Status</span>
                    <strong className="stat-text">{request.status}</strong>
                </div>

                <div className="stat-card">
                    <span>Current step</span>
                    <strong className="stat-text">
                        {request.status === "pending" && currentStep
                            ? `${currentStep.stepNumber}. ${currentStep.name}`
                            : "—"}
                    </strong>
                </div>

                <div className="stat-card">
                    <span>Required role</span>
                    <strong className="stat-text">
                        {request.status === "pending" && currentStep
                            ? roleLabel(currentStep.approverRole)
                            : "—"}
                    </strong>
                </div>

                <div className="stat-card">
                    <span>Actions taken</span>
                    <strong>{request.approvalHistory.length}</strong>
                </div>
            </section>

            <div className="detail-grid">

                <div>
                    <section className="panel">
                        <h2>Description</h2>
                        <p className="description-text">{request.description}</p>
                    </section>

                    <section className="panel">
                        <h2>Approval steps</h2>

                        <ol className="steps-list">
                            {steps.map((step) => {
                                const { state, entry } = describeStep(request, step);

                                return (
                                    <li className={`step-item ${state}`} key={step.stepNumber}>
                                        <span className="step-marker">{step.stepNumber}</span>

                                        <div className="step-body">
                                            <strong>{step.name}</strong>

                                            <span className="step-sub">
                                                <span className={`role-badge ${step.approverRole}`}>
                                                    {roleLabel(step.approverRole)}
                                                </span>
                                                {entry?.actedBy?.name && ` by ${entry.actedBy.name}`}
                                            </span>
                                        </div>

                                        <span className={`step-state ${state}`}>
                                            {STEP_STATE_LABELS[state]}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>

                    <section className="panel">
                        <h2>Approval history</h2>

                        {request.approvalHistory.length === 0 ? (
                            <p className="muted">No one has acted on this request yet.</p>
                        ) : (
                            <ul className="history-list">
                                {request.approvalHistory.map((entry) => {
                                    const step = steps.find((s) => s.stepNumber === entry.stepNumber);

                                    return (
                                        <li key={entry._id}>
                                            <div className="history-head">
                                                <span className={`status ${entry.action}`}>
                                                    {entry.action}
                                                </span>

                                                <strong>{entry.actedBy?.name || "Unknown user"}</strong>

                                                <span className="muted">
                                                    Step {entry.stepNumber}
                                                    {step && `: ${step.name}`}
                                                    {" · "}
                                                    {formatDate(entry.actedAt)}
                                                </span>
                                            </div>

                                            {entry.comment && (
                                                <p className="history-comment">"{entry.comment}"</p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>

                <aside>
                    <section className="panel">
                        <h2>Your action</h2>

                        {actionError?.status === 409 && (
                            <div className="warning-message">
                                <strong>Someone else acted on this request first.</strong>
                                <p>{actionError.message}</p>
                                <button className="secondary-btn" onClick={reload}>
                                    Reload request
                                </button>
                            </div>
                        )}

                        {actionError?.status === 403 && (
                            <div className="error-message">
                                <strong>Not allowed.</strong>
                                <p>{actionError.message}</p>
                                <button className="secondary-btn" onClick={reload}>
                                    Reload request
                                </button>
                            </div>
                        )}

                        {actionError && ![403, 409].includes(actionError.status) && (
                            <div className="error-message">
                                {actionError.errors.length > 1 ? (
                                    <ul className="error-list">
                                        {actionError.errors.map((message) => (
                                            <li key={message}>{message}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    actionError.message
                                )}
                            </div>
                        )}

                        {blockedReason ? (

                            <p className="muted">{blockedReason}</p>

                        ) : (

                            <div className="action-form">
                                <label htmlFor="comment">Comment (optional)</label>

                                <textarea
                                    id="comment"
                                    rows="4"
                                    maxLength={COMMENT_MAX}
                                    placeholder="Add context for the submitter and later approvers..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    disabled={Boolean(submitting)}
                                />

                                <span className="char-count">
                                    {comment.length}/{COMMENT_MAX}
                                </span>

                                <div className="action-buttons">
                                    <button
                                        className="approve-btn"
                                        onClick={() => act("approved")}
                                        disabled={Boolean(submitting)}
                                    >
                                        {submitting === "approved" ? "Approving..." : "Approve"}
                                    </button>

                                    <button
                                        className="reject-btn"
                                        onClick={() => act("rejected")}
                                        disabled={Boolean(submitting)}
                                    >
                                        {submitting === "rejected" ? "Rejecting..." : "Reject"}
                                    </button>
                                </div>
                            </div>

                        )}
                    </section>
                </aside>

            </div>

        </main>
    );
}

export default RequestDetail;
