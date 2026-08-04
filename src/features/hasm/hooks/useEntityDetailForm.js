// ###################################################
// File Name : useEntityDetailForm.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Detail form state management hook
// Description : Loads entity detail data, tracks draft edits, and saves updates.
// ###################################################

import { useEffect, useMemo, useState } from "react";
import { getEntityDetail, saveEntityDetail } from "../api";
import { ENTITY_DEFINITIONS } from "../definitions";

function useEntityDetailForm({ entityType, modelRoot, entityId, onError }) {
  // Step 1. Define base state for fetched detail, editable draft, and busy flags.
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 2. Resolve the active entity definition (field set + converters).
  const definition = useMemo(() => ENTITY_DEFINITIONS[entityType], [entityType]);

  // Step 3. Load entity detail whenever identity/context changes.
  useEffect(() => {
    if (!modelRoot || !entityType || !entityId || !definition) {
      return;
    }

    let disposed = false;

    async function loadDetail() {
      // Step 3-1. Fetch detail payload and convert it to editable draft shape.
      setLoading(true);
      try {
        const payload = await getEntityDetail(entityType, modelRoot, entityId);
        if (disposed) {
          return;
        }
        setDetail(payload);
        setDraft(definition.toEditableDetail(payload));
      } catch (error) {
        if (!disposed) {
          onError(String(error));
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    // Step 3-2. Start load and register cleanup guard.
    loadDetail();
    return () => {
      disposed = true;
    };
  }, [definition, entityType, entityId, modelRoot, onError]);

  async function saveDraft() {
    // Step 4. Convert draft to save payload, persist it, and then reload latest detail.
    if (!draft || !definition) {
      return "";
    }

    setSaving(true);
    try {
      const payload = definition.toSavePayload(draft);
      const result = await saveEntityDetail(entityType, modelRoot, payload);
      const updated = await getEntityDetail(entityType, modelRoot, entityId);
      setDetail(updated);
      setDraft(definition.toEditableDetail(updated));
      return result.message || "Saved";
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(key, value) {
    // Step 5. Apply one-field updates to the in-memory editable draft.
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return {
    definition,
    detail,
    draft,
    loading,
    saving,
    updateDraft,
    saveDraft,
  };
}

export default useEntityDetailForm;