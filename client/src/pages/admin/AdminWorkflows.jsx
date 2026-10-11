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

const MESSAGE_CLASSES = {
    success: "success-message",
    warning: "warning-message",
    error: "error-message",
};

function AdminWorkflows() {
    const { data, loading, error: loadError, reload: loadWorkflows, setData } = useApiGet(
        "/workflows",
        "Could not load workflows."
    );
    const workflows = data?.workflows || [];

    const [message, setMessage] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // null when closed, { id: null } when creating, { id, name } when editing
    const [formTarget, setFormTarget] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const isEditing = Boolean(formTarget?.id);

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

    const openCreate = () => {
        setForm(emptyForm());
        setFormError(null);
        setFormTarget({ id: null });
    };

    const openEdit = (workflow) => {
        setForm({
            name: workflow.name,
            description: workflow.description || "",
            steps: sortSteps(workflow.steps).map(({ name, approverRole }) => ({ name, approverRole })),
        });
        setFormError(null);
        setFormTarget({ id: workflow._id, name: workflow.name });
    };

    const closeForm = () => {
        setFormTarget(null);
        setFormError(null);
    };

    const saveWorkflow = async (e) => {
        e.preventDefault();

        setSaving(true);
        setFormError(null);

        // Steps run in the order shown, so number them by position
        const payload = {
            name: form.name,
            description: form.description,
            steps: form.steps.map((step, index) => ({ ...step, stepNumber: index + 1 })),
        };

        try {
            if (isEditing) {
                const response = await api.put(`/workflows/${formTarget.id}`, payload);

                setData((previous) => ({
                    ...previous,
                    workflows: previous.workflows.map((w) =>
                        w._id === formTarget.id ? response.data.workflow : w
                    ),
                }));
                setMessage({ type: "success", text: response.data.message });
            } else {
                await api.post("/workflows", payload);

                setMessage({ type: "success", text: `Workflow "${form.name}" created.` });
                loadWorkflows();
            }

            closeForm();
        } catch (err) {
            setFormError(getApiError(err, "Could not save the workflow."));
        } finally {
            setSaving(false);
        }
    };

    const deleteWorkflow = async (workflow) => {
        if (!window.confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return;

        setDeletingId(workflow._id);
        setMessage(null);

        try {
            await api.delete(`/workflows/${workflow._id}`);

            setData((previous) => ({
                ...previous,
                workflows: previous.workflows.filter((w) => w._id !== workflow._id),
            }));
            setMessage({ type: "success", text: `Workflow "${workflow.name}" deleted.` });
        } catch (err) {
            const { status, message: text } = getApiError(err, "Could not delete the workflow.");

            // 409: requests still use it; the server's message suggests deactivating instead
            setMessage({ type: status === 409 ? "warning" : "error", text });
        } finally {
            setDeletingId(null);
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

                <button className="primary-btn small" onClick={openCreate}>
                    + New Workflow
                </button>
            </div>

            {message && (
                <div className={`${MESSAGE_CLASSES[message.type]} page-message`}>
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

                                <div className="card-actions">
                                    <button
                                        className="secondary-btn"
                                        onClick={() => openEdit(workflow)}
                                        disabled={deletingId === workflow._id}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        className="secondary-btn danger"
                                        onClick={() => deleteWorkflow(workflow)}
                                        disabled={deletingId === workflow._id}
                                    >
                                        {deletingId === workflow._id ? "Deleting..." : "Delete"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                )}
            </section>

            {formTarget && (
                <div className="modal-overlay">
                    <div className="modal">

                        <div className="modal-header">
                            <div>
                                <h2>{isEditing ? `Edit ${formTarget.name}` : "New Workflow"}</h2>
                                <p>
                                    Steps are approved in the order listed.
                                    {isEditing && " Requests already submitted keep their original steps."}
                                </p>
                            </div>

                            <button className="close-btn" onClick={closeForm}>×</button>
                        </div>

                        {formError && (
                            <div className="error-message">
                                {formError.errors.length > 1 ? (
                                    <ul className="error-list">
                                        {formError.errors.map((text) => <li key={text}>{text}</li>)}
                                    </ul>
                                ) : (
                                    formError.message
                                )}
                            </div>
                        )}

                        <form onSubmit={saveWorkflow}>
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

                            <button className="primary-btn" type="submit" disabled={saving}>
                                {saving
                                    ? "Saving..."
                                    : isEditing ? "Save Changes" : "Create Workflow"}
                            </button>
                        </form>

                    </div>
                </div>
            )}

        </main>
    );
}

export default AdminWorkflows;
