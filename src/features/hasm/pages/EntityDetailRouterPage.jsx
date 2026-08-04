// ###################################################
// File Name : EntityDetailRouterPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Entity detail page router
// Description : Routes selected entity type to the matching detail page.
// ###################################################

import ExperienceDetailPage from "./details/ExperienceDetailPage";
import FactDetailPage from "./details/FactDetailPage";
import LinkDetailPage from "./details/LinkDetailPage";
import PersonDetailPage from "./details/PersonDetailPage";

function EntityDetailRouterPage(props) {
  if (props.entityType === "PERSON") {
    return <PersonDetailPage {...props} />;
  }
  if (props.entityType === "EXPERIENCE") {
    return <ExperienceDetailPage {...props} />;
  }
  if (props.entityType === "FACT") {
    return <FactDetailPage {...props} />;
  }
  if (props.entityType === "LINK") {
    return <LinkDetailPage {...props} />;
  }

  return (
    <section className="detail-page card-surface">
      <p className="eyebrow">Unknown Entity</p>
      <h2>Unsupported entity type: {props.entityType}</h2>
      <button type="button" onClick={props.onBack}>
        Back
      </button>
    </section>
  );
}

export default EntityDetailRouterPage;