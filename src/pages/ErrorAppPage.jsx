import { useLocation, useNavigate } from "react-router-dom";

function ErrorAppPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const message = location.state?.error || "The HASM application could not complete startup validation.";
  return (
    <main className="boot-layout">
      <section className="boot-panel error-panel" role="alert">
        <p className="sequence-label">HASM / STARTUP ERROR</p>
        <h1>Application validation failed</h1>
        <p>{message}</p>
        <button type="button" onClick={() => navigate("/", { replace: true })}>Retry</button>
      </section>
    </main>
  );
}

export default ErrorAppPage;