import { Navigate, Outlet, useLocation } from "react-router-dom";

function hasActiveWorkspace(location) {
  const statePath = location.state?.path;
  const savedPath = window.sessionStorage.getItem("hasm-active-workspace");
  return Boolean(statePath || savedPath);
}

function isModelVerified(location) {
  if (location.state?.isVerified === false) {
    return false;
  }
  return true;
}

// [SEQ-MD-07][REQ-07-RULE-001][REQ-07-RULE-002] Barrier 1 route protection implementing the Route
// Protection Evaluation Matrix with redirection reason metadata in location.state.
// [REQ-07-FUNC-101][REQ-07-FUNC-102] Unloaded workspace -> /select with a warning redirectReason.
// [REQ-07-FUNC-103][REQ-07-FUNC-104] Unverified model -> /loading-model with returnTo and an info redirectReason.
function ProtectedRoute({ requireVerified = false }) {
  const location = useLocation();

  if (!hasActiveWorkspace(location)) {
    return (
      <Navigate
        to="/select"
        replace
        state={{
          from: location.pathname,
          redirectReason: "HASMモデルが選択されていません。先にワークスペースを選択してください。",
          redirectType: "warning",
        }}
      />
    );
  }

  if (requireVerified && !isModelVerified(location)) {
    return (
      <Navigate
        to="/loading-model"
        replace
        state={{
          ...location.state,
          path: location.state?.path || window.sessionStorage.getItem("hasm-active-workspace"),
          returnTo: location.pathname,
          redirectReason: "Reloading and verifying the workspace before returning to visualization.",
          redirectType: "info",
        }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
