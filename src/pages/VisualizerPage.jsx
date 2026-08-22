import { useLocation } from "react-router-dom";

function VisualizerPage() {
  const { state } = useLocation();
  const model = state?.model;
  return <main className="boot-layout"><section className="boot-panel"><p className="sequence-label">HASM / SEQ-03</p><h1>Workspace ready</h1><p>{state?.isReadOnly ? "Opened in Read-Only Mode" : "Workspace verification complete."}</p><p>{model ? `${model.people.length} people, ${model.experiences.length} experiences, ${model.facts.length} facts, ${model.links.length} links` : "No model context available."}</p></section></main>;
}

export default VisualizerPage;