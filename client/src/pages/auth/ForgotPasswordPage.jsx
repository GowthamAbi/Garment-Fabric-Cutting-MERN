export default function ForgotPasswordPage() {
  return (
    <div className="auth">
      <form>
        <h1>Forgot password</h1>
        <p>Connect your email provider here to send a password-reset link.</p>
        <input type="email" placeholder="Email address" />
        <button className="primary" type="button">
          Send reset link
        </button>
      </form>
    </div>
  );
}
