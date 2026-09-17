import { useParams } from "react-router-dom";

function EntityDetailPlaceholderPage() {
  const { entityType, entityId } = useParams();
  return (
    <main className="boot-layout">
      <section className="boot-panel">
        <h1>Entity detail</h1>
        <p>{entityType}: {entityId}</p>
      </section>
    </main>
  )
}

export default EntityDetailPlaceholderPage;