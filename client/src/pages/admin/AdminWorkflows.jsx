import { useState } from "react";
import api, { getApiError } from "../../services/api";
import { useApiGet } from "../../hooks/useApiGet";
import { ROLE_VALUES, roleLabel } from "../../constants/roles";
import { sortSteps } from "../../utils/requests";

const emptyStep = () => ({ name: "", approverRole: "manager" });

const emptyForm = () => ({
    name: "",
    description: "",
    steps: [emptyStep()],
});

function AdminWorkflows() {
    const { data, loading, error: loadError, reload: loadWorkflows, setData } = useApiGet(
        "/workflows",
        "Could not load workflows."
    );
    const workflows = data?.workflows || [];

    const [message, setMessage] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

    const toggleActive = async (workflow) => {
        setTogglingId(workflow._id);
        setMessage(null);

        try {
            const response = await api.patch(`/workflows/${workflow._id}/status`, {
                isActive: !workflow.isActive,
            });

            setData((previous) => ({
                ...previous,
                workflows: previous.workflows.map((w) =>
                    w._id === workflow._id ? response.data.workflow : w
                ),
            }));
            setMessage({ type: "success", text: `${workflow.name}: ${response.data.message.toLowerCase()}.` });
        } catch (err) {
            setMessage({ type: "error", text: getApiError(err, "Could not update the workflow.").message });
        } finally {
            setTogglingId(null);
        }
    };

    const updateStep = (index, field, value) => {
        setForm((current) => ({
            ...current,
            steps: current.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
        }));
    };

    const addStep = () => {
        setForm((current) => ({ ...current, steps: [...current.steps, emptyStep()] }));
    };

    const removeStep = (index) => {
        setForm((current) => ({ ...current, steps: current.steps.filter((_, i) => i !== index) }));
    };

    const closeCreate = () => {
        setShowCreate(false);
        setForm(emptyForm());
        setCreateError(null);
    };

    const createWorkflow = async (e) => {
        e.preventDefault();

        setCreating(true);
        setCreateError(null);

        try {
            // Steps run in the order shown, so number them by position
            await api.post("/workflows", {
                name: form.name,
                description: form.description,
                steps: form.steps.map((step, index) => ({ ...step, stepNumber: index + 1 })),
            });

            setMessage({ type: "success", text: `Workflow "${form.name}" created.` });
            closeCreate();
            loadWorkflows();
        } catch (err) {
            setCreateError(getApiError(err, "Could not create the workflow."));
        } finally {
            setCreating(false);
        }
    };

    return (
        <main className="page">

            <div className="dashboard-header">
                <div>
                    <p className="eyebrow">ADMIN</p>

                    <h1>Workflows</h1>

                    <p className="subtitle">
                        Define approval paths. Changes only affect requests submitted afterwards.
                    </p>
                </div>

                <button className="primary-btn small" onClick={() => setShowCreate(true)}>
                    + New Workflow
                </button>
            </div>

            {message && (
                <div className={message.type === "success" ? "success-message" : "error-message"}>
                    {message.text}
                </div>
            )}

            <section className="dashboard-section">
                {loading && !data ? (

                    <div className="loading">Loading workflows...</div>

                ) : loadError ? (

                    <div className="empty-state">
                        <h3>Could not load workflows</h3>
                        <p>{loadError.message}</p>
                        <button className="secondary-btn spaced" onClick={loadWorkflows}>
                            Try again
                        </button>
                    </div>

                ) : workflows.length === 0 ? (

                    <div className="empty-state">
                        <h3>No workflows yet</h3>
                        <p>Create a workflow so employees can submit requests.</p>
                    </div>

                ) : (

                    <div className="workflow-grid">
                        {workflows.map((workflow) => (
                            <div
                                className={`workflow-card ${workflow.isActive ? "" : "inactive"}`}
                                key={workflow._id}
                            >
                                <div className="workflow-card-top">
                                    <div className="workflow-icon">WF</div>

                                    <span className={`status ${workflow.isActive ? "approved" : "inactive"}`}>
                                        {workflow.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>

                                <h3>{workflow.name}</h3>

                                {workflow.description && <p>{workflow.description}</p>}

                                <ol className="mini-steps">
                                    {sortSteps(workflow.steps).map((step) => (
                                        <li key={step.stepNumber}>
                                            {step.name}
                                            <span className={`role-badge ${step.approverRole}`}>
                                                {roleLabel(step.approverRole)}
                                            </span>
                                        </li>
                                    ))}
                                </ol>

                                <button
                                    className="secondary-btn full"
                                    onClick={() => toggleActive(workflow)}
                                    disabled={togglingId === workflow._id}
                                >
                                    {togglingId === workflow._id
                                        ? "Saving..."
                                        : workflow.isActive ? "Deactivate" : "Activate"}
                                </button>
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
                                <h2>New Workflow</h2>
                                <p>Steps are approved in the order listed.</p>
                            </div>

                            <button className="close-btn" onClick={closeCreate}>×</button>
                        </div>

                        {createError && (
                            <div className="error-message">
                                {createError.errors.length > 1 ? (
                                    <ul className="error-list">
                                        {createError.errors.map((text) => <li key={text}>{text}</li>)}
                                    </ul>
                                ) : (
                                    createError.message
                                )}
                            </div>
                        )}

                        <form onSubmit={createWorkflow}>
                            <label htmlFor="wf-name">Name</label>
                            <input
                                id="wf-name"
                                value={form.name}
                                placeholder="e.g. Leave Request"
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />

                            <label htmlFor="wf-description">Description</label>
                            <textarea
                                id="wf-description"
                                rows="3"
                                value={form.description}
                                placeholder="What is this workflow for?"
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />

                            <label>Approval steps</label>

                            {form.steps.map((step, index) => (
                                <div className="step-row" key={index}>
                                    <span className="step-marker">{index + 1}</span>

                                    <input
                                        aria-label={`Step ${index + 1} name`}
                                        value={step.name}
                                        placeholder="Step name, e.g. Manager review"
                                        onChange={(e) => updateStep(index, "name", e.target.value)}
                                        required
                                    />

                                    <select
                                        aria-label={`Step ${index + 1} approver role`}
                                        value={step.approverRole}
                                        onChange={(e) => updateStep(index, "approverRole", e.target.value)}
                                    >
                                        {ROLE_VALUES.map((role) => (
                                            <option key={role} value={role}>{roleLabel(role)}</option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        className="close-btn"
                                        aria-label={`Remove step ${index + 1}`}
                                        onClick={() => removeStep(index)}
                                        disabled={form.steps.length === 1}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}

                            <button type="button" className="secondary-btn" onClick={addStep}>
                                + Add step
                            </button>

                            <button className="primary-btn" type="submit" disabled={creating}>
                                {creating ? "Creating..." : "Create Workflow"}
                            </button>
                        </form>

                    </div>
                </div>
            )}

        </main>
    );
}

export default AdminWorkflows;
