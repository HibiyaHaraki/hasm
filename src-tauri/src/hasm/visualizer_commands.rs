//! SEQ-03 graph layout command. Rendering remains owned by the React Three.js adapter.

use crate::hasm::types::{LayoutFilterRequest, Line3dGeometry, ModelDatabase, Node3dGeometry, RenderPayload};
use log::info;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn compute_visualizer_layout(
    app: AppHandle,
    model: ModelDatabase,
    filter: LayoutFilterRequest,
) -> Result<RenderPayload, String> {
    if model.people.is_empty() && model.experiences.is_empty() && model.facts.is_empty() && model.links.is_empty() {
        return Err("ERR_NO_ACTIVE_MODEL".to_string());
    }

    emit_progress(&app, 0, 4, "Positioning EXPERIENCE branches")?;
    let payload = calculate_layout(&model, &filter);
    emit_progress(&app, 4, 4, "3D layout ready")?;
    info!("[SEQ-MD-03][LAYOUT] graph layout calculated");
    Ok(payload)
}

fn calculate_layout(model: &ModelDatabase, filter: &LayoutFilterRequest) -> RenderPayload {
    let z_step = z_step(&filter.time_scale_mode, filter.z_scale_factor);
    let mut nodes = Vec::new();
    let mut lines = Vec::new();

    for (index, experience) in model.experiences.iter().enumerate() {
        let x = index as f32 * 6.0;
        nodes.push(Node3dGeometry { id: experience.experience_id.to_string(), entity_type: "EXPERIENCE".to_string(), label: experience.experience_name.clone(), x, y: 0.0, z: 0.0 });
        lines.push(Line3dGeometry { id: format!("branch-{}", experience.experience_id), line_type: "BRANCH".to_string(), from: [x, 0.0, -z_step], to: [x, 0.0, z_step * (model.facts.len().max(1) as f32 + 1.0)] });
    }

    for (index, fact) in model.facts.iter().enumerate() {
        let experience_index = model.experiences.iter().position(|experience| fact.experience_ids.contains(&experience.experience_id)).unwrap_or(0);
        let x = experience_index as f32 * 6.0;
        let z = (index as f32 + 1.0) * z_step;
        nodes.push(Node3dGeometry { id: fact.fact_id.to_string(), entity_type: "FACT".to_string(), label: fact.fact_name.clone(), x, y: 0.0, z });
    }

    for (index, person) in model.people.iter().enumerate() {
        nodes.push(Node3dGeometry { id: person.person_id.to_string(), entity_type: "PERSON".to_string(), label: person.person_name.clone(), x: -5.0, y: index as f32 * 2.0, z: 0.0 });
    }

    for (index, link) in model.links.iter().enumerate() {
        let source = nodes.get(index % nodes.len()).map(|node| [node.x, node.y, node.z]).unwrap_or([0.0, 0.0, 0.0]);
        let target = nodes.get((index + 1) % nodes.len()).map(|node| [node.x, node.y, node.z]).unwrap_or([0.0, 0.0, z_step]);
        lines.push(Line3dGeometry { id: link.link_id.to_string(), line_type: "LINK".to_string(), from: source, to: target });
    }

    RenderPayload { nodes_3d: nodes, lines_3d: lines, warnings: Vec::new() }
}

fn z_step(mode: &str, scale: f32) -> f32 {
    let normalized_scale = scale.max(0.1);
    match mode {
        "Logarithmic" => 2.0 * normalized_scale,
        "SequentialIndex" => 3.0 * normalized_scale,
        _ => 4.0 * normalized_scale,
    }
}

fn emit_progress(app: &AppHandle, current: usize, total: usize, message: &str) -> Result<(), String> {
    app.emit("visualizer-layout-progress", serde_json::json!({
        "current": current,
        "total": total,
        "percentage": current as f32 / total as f32 * 100.0,
        "message": message,
    })).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hasm::definitions::{Experience, Fact};
    use uuid::Uuid;

    #[test]
    fn calculates_commit_graph_geometry_for_each_scale_mode() {
        let experience_id = Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap();
        let fact_id = Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap();
        let model = ModelDatabase {
            people: vec![],
            experiences: vec![Experience { experience_id, person_id: Uuid::nil(), experience_name: "Research".to_string(), experience_description_path: "EXPERIENCE/x/main.md".to_string(), parent_experience_ids: vec![], link_ids: vec![], markdown: String::new(), markdown_path: String::new() }],
            facts: vec![Fact { fact_id, fact_name: "Publication".to_string(), fact_description_path: "FACT/x/main.md".to_string(), experience_ids: vec![experience_id], person_ids: vec![], link_ids: vec![], markdown: String::new(), markdown_path: String::new() }],
            links: vec![],
        };
        let linear = calculate_layout(&model, &LayoutFilterRequest { time_scale_mode: "Linear".to_string(), z_scale_factor: 1.0 });
        let logarithmic = calculate_layout(&model, &LayoutFilterRequest { time_scale_mode: "Logarithmic".to_string(), z_scale_factor: 1.0 });
        let sequential = calculate_layout(&model, &LayoutFilterRequest { time_scale_mode: "SequentialIndex".to_string(), z_scale_factor: 1.0 });
        assert_eq!(linear.nodes_3d.len(), 2);
        assert_eq!(linear.nodes_3d[1].z, 4.0);
        assert_eq!(logarithmic.nodes_3d[1].z, 2.0);
        assert_eq!(sequential.nodes_3d[1].z, 3.0);
    }
}