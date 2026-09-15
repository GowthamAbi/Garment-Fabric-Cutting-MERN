import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../../api.js";
import Field from "../../components/common/Field.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function LoginPage({ initialMode = false }) {
  const { login } = useAuth();
  const [registerMode, setRegisterMode] = useState(
    initialMode === true || initialMode === "register",
  );
  const [submitting, setSubmitting] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");
  const [forgotMode, setForgotMode] = useState(Boolean(resetToken));
  const [form, setForm] = useState({ name: "", companyName: "", factoryName: "", email: "", password: "", role: "store" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api("/auth/setup-status")
      .then((data) => {
        setSetupRequired(data.setupRequired);
        if (data.setupRequired) setRegisterMode(true);
      })
      .catch(() => undefined);
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const path = registerMode ? "/auth/register" : "/auth/login";
      const loginData = await api(path, {
        method: "POST",
        body: JSON.stringify(form),
      });

      login(loginData);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPasswordRequest(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const data = await api(resetToken ? "/auth/reset-password" : "/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(resetToken
          ? { token: resetToken, password: form.password }
          : { email: form.email }),
      });
      setSuccess(data.message);
      if (resetToken) window.history.replaceState({}, "", "/");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (forgotMode) {
    return (
      <div className="auth">
        <form onSubmit={submitPasswordRequest}>
          <div className="auth-logo"><Sparkles /></div>
          <h1>{resetToken ? "Reset password" : "Forgot password"}</h1>
          <p>{resetToken ? "Enter your new password" : "Enter your registered email"}</p>
          {!resetToken ? (
            <Field label="Email"><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          ) : (
            <Field label="New Password"><input type="password" minLength="6" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
          )}
          {error && <div className="error">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <button className="primary" disabled={submitting}>{submitting ? "Please wait..." : resetToken ? "Reset Password" : "Send Reset Link"}</button>
          <button type="button" className="link" onClick={() => setForgotMode(false)}>Back to Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth">
      <form onSubmit={submit}>
        <div className="auth-logo">
          <Sparkles />
        </div>
        <h1>Accessories Flow</h1>
        <p>{registerMode ? "Create the SaaS Owner account · First setup only" : "Admin, Store and Production users sign in here"}</p>

        {registerMode && (
          <><Field label="Administrator Name">
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </Field><Field label="Company Name"><input required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></Field><Field label="Factory Name"><input required value={form.factoryName} onChange={(event) => setForm({ ...form, factoryName: event.target.value })} /></Field></>
        )}

        <Field label="Email">
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            required
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
          />
        </Field>

        {error && <div className="error">{error}</div>}

        <button className="primary" type="submit" disabled={submitting}>
          {submitting
            ? registerMode
              ? "Register..."
              : "Login..."
            : registerMode
              ? "Register"
              : "Login"}
        </button>

        {setupRequired && <button type="button" className="link" onClick={() => setRegisterMode(!registerMode)}>{registerMode ? "Already registered? Login" : "First-time SaaS Owner Setup"}</button>}
        {!registerMode && (
          <button type="button" className="link" onClick={() => setForgotMode(true)}>Forgot Password?</button>
        )}
        {!registerMode && <div className="login-role-note"><b>One secure login page</b><span>Your email opens the correct workspace</span><small>SaaS Owner · Company Admin · Store · Production</small></div>}
        <button type="button" className="link" onClick={() => { window.location.href = "/privacy"; }}>Privacy Policy</button>
      </form>
    </div>
  );
}
