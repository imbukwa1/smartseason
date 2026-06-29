import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  confirm_password: "",
};

function getErrorMessages(error) {
  const data = error.response?.data;

  if (!data || typeof data === "string") {
    return ["Registration failed. Please check your details and try again."];
  }

  return Object.values(data)
    .flat()
    .map((message) => String(message));
}

function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, register, user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const passwordChecks = useMemo(
    () => [
      { label: "At least 8 characters", met: form.password.length >= 8 },
      { label: "One uppercase letter", met: /[A-Z]/.test(form.password) },
      { label: "One lowercase letter", met: /[a-z]/.test(form.password) },
      { label: "One number", met: /\d/.test(form.password) },
    ],
    [form.password],
  );

  if (isAuthenticated && user) {
    return <Navigate to={user.role === "admin" ? "/dashboard" : "/my-fields"} replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);

    try {
      const currentUser = await register(form);
      navigate(currentUser.role === "admin" ? "/dashboard" : "/my-fields", {
        replace: true,
      });
    } catch (error) {
      setErrors(getErrorMessages(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="login-form" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">SmartSeason</p>
          <h1>Create account</h1>
        </div>

        <div className="form-grid">
          <label>
            First name
            <input
              autoComplete="given-name"
              name="first_name"
              onChange={handleChange}
              required
              type="text"
              value={form.first_name}
            />
          </label>

          <label>
            Last name
            <input
              autoComplete="family-name"
              name="last_name"
              onChange={handleChange}
              required
              type="text"
              value={form.last_name}
            />
          </label>
        </div>

        <label>
          Email
          <input
            autoComplete="email"
            name="email"
            onChange={handleChange}
            required
            type="email"
            value={form.email}
          />
        </label>

        <label>
          Password
          <input
            autoComplete="new-password"
            name="password"
            onChange={handleChange}
            required
            type="password"
            value={form.password}
          />
        </label>

        <ul className="password-rules">
          {passwordChecks.map((check) => (
            <li className={check.met ? "rule-met" : ""} key={check.label}>
              {check.label}
            </li>
          ))}
        </ul>

        <label>
          Confirm password
          <input
            autoComplete="new-password"
            name="confirm_password"
            onChange={handleChange}
            required
            type="password"
            value={form.confirm_password}
          />
        </label>

        {errors.length ? (
          <div className="form-error">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        <button disabled={submitting} type="submit">
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}

export default Register;
