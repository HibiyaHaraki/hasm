import { useLocation, useNavigate } from "react-router-dom";

function ErrorModelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  return <main className="boot-layout"><section className="boot-panel error-panel" role="alert"><p className="sequence-label">HASM / MODEL ERROR</p><h1>Workspace could not load</h1><p>{location.state?.error || "The workspace is unavailable."}</p><button type="button" onClick={() => navigate("/select", { replace: true })}>Choose workspace</button></section></main>;
}

export default ErrorModelPage;