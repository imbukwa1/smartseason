import { useEffect, useMemo, useState } from "react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const emptyFieldForm = {
  name: "",
  crop_type: "",
  planting_date: "",
  stage: "planted",
  assigned_agent: "",
};

const initialSummary = {
  total_fields: 0,
  by_status: {
    active: 0,
    at_risk: 0,
    completed: 0,
  },
  recent_updates: [],
};

const stages = ["planted", "growing", "ready", "harvested"];

function formatStatus(status) {
  return status.replace("_", " ");
}

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toFieldPayload(form) {
  return {
    name: form.name.trim(),
    crop_type: form.crop_type.trim(),
    planting_date: form.planting_date,
    stage: form.stage,
    assigned_agent: form.assigned_agent ? Number(form.assigned_agent) : null,
  };
}

function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data;

  if (!data) {
    return fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.detail) {
    return data.detail;
  }

  const firstFieldError = Object.entries(data).find(([, value]) => value?.length);
  if (firstFieldError) {
    const [field, messages] = firstFieldError;
    return `${field}: ${Array.isArray(messages) ? messages.join(" ") : messages}`;
  }

  return fallback;
}

function fieldToForm(field) {
  return {
    name: field.name,
    crop_type: field.crop_type,
    planting_date: field.planting_date,
    stage: field.stage,
    assigned_agent: field.assigned_agent ?? "",
  };
}

function FieldForm({ agents, form, onCancel, onChange, onSubmit, submitLabel, title }) {
  return (
    <form className="field-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <h2>{title}</h2>
      </div>

      <label>
        Name
        <input
          onChange={(event) => onChange("name", event.target.value)}
          required
          value={form.name}
        />
      </label>

      <label>
        Crop Type
        <input
          onChange={(event) => onChange("crop_type", event.target.value)}
          required
          value={form.crop_type}
        />
      </label>

      <label>
        Planting Date
        <input
          onChange={(event) => onChange("planting_date", event.target.value)}
          required
          type="date"
          value={form.planting_date}
        />
      </label>

      <label>
        Stage
        <select
          onChange={(event) => onChange("stage", event.target.value)}
          value={form.stage}
        >
          {stages.map((stage) => (
            <option key={stage} value={stage}>
              {formatStatus(stage)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Assign Agent
        <select
          onChange={(event) => onChange("assigned_agent", event.target.value)}
          value={form.assigned_agent}
        >
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.email || agent.username}
            </option>
          ))}
        </select>
      </label>

      <div className="form-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(initialSummary);
  const [fields, setFields] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedUpdates, setSelectedUpdates] = useState([]);
  const [newForm, setNewForm] = useState(emptyFieldForm);
  const [editForm, setEditForm] = useState(emptyFieldForm);
  const [showNewField, setShowNewField] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    const [dashboardResponse, fieldsResponse, agentsResponse] = await Promise.all([
      api.get("/dashboard/"),
      api.get("/fields/"),
      api.get("/agents/"),
    ]);

    setSummary(dashboardResponse.data);
    setFields(fieldsResponse.data);
    setAgents(agentsResponse.data);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        await loadDashboard();
      } catch {
        if (isMounted) {
          setError("Unable to load dashboard data.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      { label: "Total Fields", value: summary.total_fields },
      { label: "Active", value: summary.by_status.active },
      { label: "At Risk", value: summary.by_status.at_risk },
      { label: "Completed", value: summary.by_status.completed },
    ],
    [summary],
  );

  function updateNewForm(field, value) {
    setNewForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function refreshAfterChange(fieldId) {
    await loadDashboard();

    if (fieldId) {
      const { data: fieldData } = await api.get(`/fields/${fieldId}/`);

      setSelectedField(fieldData);
      setEditForm(fieldToForm(fieldData));
      setSelectedUpdates(fieldData.updates ?? []);
    }
  }

  async function createField(event) {
    event.preventDefault();
    setError("");

    let createdField = null;

    try {
      const { data } = await api.post("/fields/", toFieldPayload(newForm));
      createdField = data;
      setNewForm(emptyFieldForm);
      setShowNewField(false);
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Unable to create field."));
      return;
    }

    try {
      await refreshAfterChange();
    } catch (apiError) {
      setFields((current) => [createdField, ...current]);
      setError(getApiErrorMessage(apiError, "Field created, but dashboard refresh failed."));
    }
  }

  async function openField(field) {
    setError("");
    setDetailLoading(true);

    try {
      const { data: fieldData } = await api.get(`/fields/${field.id}/`);

      setSelectedField(fieldData);
      setEditForm(fieldToForm(fieldData));
      setSelectedUpdates(fieldData.updates ?? []);
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Unable to load field details."));
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateField(event) {
    event.preventDefault();

    if (!selectedField) {
      return;
    }

    setError("");

    try {
      await api.patch(`/fields/${selectedField.id}/`, toFieldPayload(editForm));
      await refreshAfterChange(selectedField.id);
    } catch {
      setError("Unable to update field.");
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Dashboard</h1>
          <p className="muted">{user?.email}</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setShowNewField(true)}>
            New Field
          </button>
          <button className="secondary-button" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <section className="content-block">Loading dashboard...</section>
      ) : (
        <>
          <section className="summary-grid">
            {cards.map((card) => (
              <article className="summary-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          <section className="content-block">
            <div className="section-heading">
              <h2>Fields</h2>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Crop</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Assigned Agent</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.length ? (
                    fields.map((field) => (
                      <tr
                        className="clickable-row"
                        key={field.id}
                        onClick={() => openField(field)}
                      >
                        <td>{field.name}</td>
                        <td>{field.crop_type}</td>
                        <td>{formatStatus(field.stage)}</td>
                        <td>
                          <span className={`status-badge status-${field.status}`}>
                            {formatStatus(field.status)}
                          </span>
                        </td>
                        <td>{field.assigned_agent_username ?? "Unassigned"}</td>
                        <td>{formatDate(field.updated_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="empty-state" colSpan="6">
                        No fields yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="content-block detail-block">
            <div className="section-heading">
              <h2>Field Detail</h2>
            </div>

            {detailLoading ? (
              <p className="muted">Loading field details...</p>
            ) : selectedField ? (
              <div className="detail-grid">
                <FieldForm
                  agents={agents}
                  form={editForm}
                  onCancel={() => {
                    setSelectedField(null);
                    setSelectedUpdates([]);
                  }}
                  onChange={updateEditForm}
                  onSubmit={updateField}
                  submitLabel="Save Changes"
                  title={selectedField.name}
                />

                <section className="history-panel">
                  <h3>Update History</h3>
                  {selectedUpdates.length ? (
                    <div className="updates-feed compact">
                      {selectedUpdates.map((update) => (
                        <article className="update-item" key={update.id}>
                          <div>
                            <strong>{formatStatus(update.new_stage)}</strong>
                            <p>{update.notes}</p>
                          </div>
                          <div className="update-meta">
                            <span>{update.agent_username}</span>
                            <span>{formatDate(update.created_at)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No updates recorded for this field.</p>
                  )}
                </section>
              </div>
            ) : (
              <p className="muted">Select a field row to view and edit details.</p>
            )}
          </section>

          <section className="content-block">
            <div className="section-heading">
              <h2>Recent Updates</h2>
            </div>

            {summary.recent_updates.length ? (
              <div className="updates-feed">
                {summary.recent_updates.map((update, index) => (
                  <article className="update-item" key={`${update.field_name}-${index}`}>
                    <div>
                      <strong>{update.field_name}</strong>
                      <p>{update.notes}</p>
                    </div>
                    <div className="update-meta">
                      <span>{update.agent}</span>
                      <span>{formatDate(update.date)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No recent updates.</p>
            )}
          </section>
        </>
      )}

      {showNewField ? (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <FieldForm
              agents={agents}
              form={newForm}
              onCancel={() => setShowNewField(false)}
              onChange={updateNewForm}
              onSubmit={createField}
              submitLabel="Create Field"
              title="New Field"
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default Dashboard;
