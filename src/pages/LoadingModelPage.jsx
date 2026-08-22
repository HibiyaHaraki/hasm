import { useLocation } from "react-router-dom";

function LoadingModelPage() {
  const location = useLocation();
  const path = location.state?.path;
  return (
    <main className="boot-layout">
      <section className="boot-panel">
        <p className="sequence-label">HASM / SEQ-02</p>
        <h1>Workspace accepted</h1>
        <p>{path ? `Preparing ${path}` : "No workspace path was supplied."}</p>
      </section>
    </main>
  );
}

export default LoadingModelPage;