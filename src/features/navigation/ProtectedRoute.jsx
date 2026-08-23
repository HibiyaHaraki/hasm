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
          path: location.state?.path || window.sessionStorage.getItem("hasm-active-workspace"),
          returnTo: location.pathname,
          redirectReason: "モデルの検証が完了していません。再ロード・検証を実行します。",
          redirectType: "info",
        }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
