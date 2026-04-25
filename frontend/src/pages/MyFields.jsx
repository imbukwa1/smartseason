import { useEffect, useMemo, useState } from "react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const initialSummary = {
  total_fields: 0,
  by_status: {
    active: 0,
    at_risk: 0,
    completed: 0,
  },
};

const emptyUpdateForm = {
  new_stage: "planted",
  notes: "",
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

function MyFields() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(initialSummary);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [updateForm, setUpdateForm] = useState(emptyUpdateForm);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadMyFields() {
    const [dashboardResponse, fieldsResponse] = await Promise.all([
      api.get("/dashboard/"),
      api.get("/fields/"),
    ]);

    setSummary(dashboardResponse.data);
    setFields(fieldsResponse.data);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        await loadMyFields();
      } catch {
        if (isMounted) {
          setError("Unable to load your fields.");
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
      { label: "My Fields", value: summary.total_fields },
      { label: "Active", value: summary.by_status.active },
      { label: "At Risk", value: summary.by_status.at_risk },
      { label: "Completed", value: summary.by_status.completed },
    ],
    [summary],
  );

  async function refreshField(fieldId) {
    const [fieldResponse, updatesResponse] = await Promise.all([
      api.get(`/fields/${fieldId}/`),
      api.get(`/fields/${fieldId}/updates/`),
    ]);

    setSelectedField(fieldResponse.data);
    setUpdateForm({
      new_stage: fieldResponse.data.stage,
      notes: "",
    });
    setUpdates(updatesResponse.data);
  }

  async function openField(field) {
    setError("");
    setDetailLoading(true);

    try {
      await refreshField(field.id);
    } catch {
      setError("Unable to load field details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitUpdate(event) {
    event.preventDefault();

    if (!selectedField) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api.post(`/fields/${selectedField.id}/updates/`, updateForm);
      await loadMyFields();
      await refreshField(selectedField.id);
    } catch {
      setError("Unable to submit update.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Agent</p>
          <h1>My Fields</h1>
          <p className="muted">{user?.email}</p>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Logout
        </button>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <section className="content-block">Loading your fields...</section>
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
              <h2>Assigned Fields</h2>
            </div>

            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Crop</th>
                    <th>Stage</th>
                    <th>Status</th>
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="empty-state" colSpan="4">
                        No fields assigned yet.
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
                <section className="read-only-panel">
                  <h3>{selectedField.name}</h3>
                  <dl className="field-facts">
                    <div>
                      <dt>Crop</dt>
                      <dd>{selectedField.crop_type}</dd>
                    </div>
                    <div>
                      <dt>Planting Date</dt>
                      <dd>{selectedField.planting_date}</dd>
                    </div>
                    <div>
                      <dt>Stage</dt>
                      <dd>{formatStatus(selectedField.stage)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span className={`status-badge status-${selectedField.status}`}>
                          {formatStatus(selectedField.status)}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <form className="field-form update-form" onSubmit={submitUpdate}>
                    <div className="form-heading">
                      <h2>Submit Update</h2>
                    </div>

                    <label>
                      New Stage
                      <select
                        onChange={(event) =>
                          setUpdateForm((current) => ({
                            ...current,
                            new_stage: event.target.value,
                          }))
                        }
                        value={updateForm.new_stage}
                      >
                        {stages.map((stage) => (
                          <option key={stage} value={stage}>
                            {formatStatus(stage)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Notes
                      <textarea
                        onChange={(event) =>
                          setUpdateForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        required
                        rows="4"
                        value={updateForm.notes}
                      />
                    </label>

                    <button disabled={submitting} type="submit">
                      {submitting ? "Submitting..." : "Submit Update"}
                    </button>
                  </form>
                </section>

                <section className="history-panel">
                  <h3>Update History</h3>
                  {updates.length ? (
                    <div className="updates-feed compact">
                      {updates.map((update) => (
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
              <p className="muted">Select a field row to view details and submit an update.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default MyFields;
