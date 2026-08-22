//! SEQ-03 graph layout command. Rendering remains owned by the React Three.js adapter.

use crate::hasm::service;
use crate::hasm::types::{LayoutFilterRequest, Line3dGeometry, ModelDatabase, Node3dGeometry, RenderPayload, VisualizerDemoPayload};
use log::info;
use rusqlite::Connection;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
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
    let mut branch_positions = HashMap::new();
    let mut first_commit_z = HashMap::new();

    for (index, experience) in model.experiences.iter().enumerate() {
        let x = index as f32 * 6.0;
        let y = experience.parent_experience_ids.len() as f32 * 2.0;
        branch_positions.insert(experience.experience_id, [x, y]);
        nodes.push(Node3dGeometry { id: experience.experience_id.to_string(), entity_type: "EXPERIENCE".to_string(), label: experience.experience_name.clone(), x, y, z: 0.0 });
    }

    let mut facts = model.facts.iter().collect::<Vec<_>>();
    facts.sort_by(|left, right| left.occurred_at.cmp(&right.occurred_at).then_with(|| left.fact_id.cmp(&right.fact_id)));
    let earliest_time = facts.first().and_then(|fact| time_key(&fact.occurred_at)).unwrap_or(0);
    let mut maximum_z = z_step;
    for (index, fact) in facts.iter().enumerate() {
        let z = fact_z(&filter.time_scale_mode, index, time_key(&fact.occurred_at).unwrap_or(earliest_time), earliest_time, z_step);
        maximum_z = maximum_z.max(z);
        let branch_id = fact.experience_ids.first().copied();
        let [x, y] = branch_id.and_then(|id| branch_positions.get(&id).copied()).unwrap_or([0.0, 0.0]);
        if let Some(id) = branch_id { first_commit_z.entry(id).or_insert(z); }
        nodes.push(Node3dGeometry { id: fact.fact_id.to_string(), entity_type: "FACT".to_string(), label: fact.fact_name.clone(), x, y, z });
    }

    for experience in &model.experiences {
        let [x, y] = branch_positions.get(&experience.experience_id).copied().unwrap_or([0.0, 0.0]);
        lines.push(Line3dGeometry { id: format!("branch-{}", experience.experience_id), line_type: "BRANCH".to_string(), from: [x, y, 0.0], to: [x, y, maximum_z + z_step] });
        let join_z = first_commit_z.get(&experience.experience_id).copied().unwrap_or(z_step);
        for parent_id in &experience.parent_experience_ids {
            if let Some([parent_x, parent_y]) = branch_positions.get(parent_id) {
                lines.push(Line3dGeometry { id: format!("join-{parent_id}-{}", experience.experience_id), line_type: "BRANCH_JOIN".to_string(), from: [*parent_x, *parent_y, join_z], to: [x, y, join_z] });
            }
        }
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

fn time_key(value: &str) -> Option<i64> {
    let mut parts = value.split(|character: char| !character.is_ascii_digit());
    let year = parts.next()?.parse::<i64>().ok()?;
    let month = parts.next()?.parse::<i64>().ok()?;
    let day = parts.next()?.parse::<i64>().ok()?;
    Some(year * 372 + month * 31 + day)
}

fn fact_z(mode: &str, index: usize, time: i64, earliest_time: i64, z_step: f32) -> f32 {
    let delta = (time - earliest_time).max(0) as f32;
    match mode {
        "Logarithmic" => (delta + 1.0).log10().max(1.0) * z_step,
        "SequentialIndex" => (index as f32 + 1.0) * z_step,
        _ => (delta / 30.0).max(1.0) * z_step,
    }
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
            facts: vec![Fact { fact_id, fact_name: "Publication".to_string(), occurred_at: "2026-01-15".to_string(), fact_description_path: "FACT/x/main.md".to_string(), experience_ids: vec![experience_id], person_ids: vec![], link_ids: vec![], markdown: String::new(), markdown_path: String::new() }],
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

    #[test]
    fn sorts_facts_by_time_and_connects_parent_branches_to_children() {
        let parent_id = Uuid::parse_str("22222222-2222-2222-2222-222222222221").unwrap();
        let child_id = Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap();
        let early_id = Uuid::parse_str("33333333-3333-3333-3333-333333333331").unwrap();
        let late_id = Uuid::parse_str("33333333-3333-3333-3333-333333333332").unwrap();
        let model = ModelDatabase {
            people: vec![],
            experiences: vec![experience(parent_id, "Root", vec![]), experience(child_id, "Child", vec![parent_id])],
            facts: vec![fact(late_id, "Late", "2025-01-15", child_id), fact(early_id, "Early", "2023-01-15", parent_id)],
            links: vec![],
        };
        let payload = calculate_layout(&model, &LayoutFilterRequest { time_scale_mode: "SequentialIndex".to_string(), z_scale_factor: 1.0 });
        let early = payload.nodes_3d.iter().find(|node| node.id == early_id.to_string()).unwrap();
        let late = payload.nodes_3d.iter().find(|node| node.id == late_id.to_string()).unwrap();
        assert!(early.z < late.z);
        assert!(payload.lines_3d.iter().any(|line| line.line_type == "BRANCH_JOIN" && line.from[2] == line.to[2]));
    }

    #[test]
    fn creates_a_populated_development_demo_package() {
        let demo = create_visualizer_demo_workspace().unwrap();
        assert_eq!(demo.model.experiences.len(), 3);
        assert_eq!(demo.model.facts.len(), 5);
        assert!(PathBuf::from(&demo.path).join("hasm.db").is_file());
        assert!(PathBuf::from(&demo.path).join("FACT/33333333-3333-3333-3333-333333333335/main.md").is_file());
        fs::remove_dir_all(demo.path).unwrap();
    }

    fn experience(experience_id: Uuid, name: &str, parent_experience_ids: Vec<Uuid>) -> crate::hasm::definitions::Experience {
        crate::hasm::definitions::Experience { experience_id, person_id: Uuid::nil(), experience_name: name.to_string(), experience_description_path: String::new(), parent_experience_ids, link_ids: vec![], markdown: String::new(), markdown_path: String::new() }
    }

    fn fact(fact_id: Uuid, name: &str, occurred_at: &str, experience_id: Uuid) -> Fact {
        Fact { fact_id, fact_name: name.to_string(), occurred_at: occurred_at.to_string(), fact_description_path: String::new(), experience_ids: vec![experience_id], person_ids: vec![], link_ids: vec![], markdown: String::new(), markdown_path: String::new() }
    }
}

#[tauri::command]
pub fn create_visualizer_demo_workspace() -> Result<VisualizerDemoPayload, String> {
    let root = std::env::temp_dir().join(format!(
        "hasm-visualizer-demo-{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos()
    ));
    let person_id = "11111111-1111-1111-1111-111111111111";
    let root_experience_id = "22222222-2222-2222-2222-222222222221";
    let research_experience_id = "22222222-2222-2222-2222-222222222222";
    let writing_experience_id = "22222222-2222-2222-2222-222222222223";
    let facts = [
        ("33333333-3333-3333-3333-333333333331", "Foundation", "2022-01-10", root_experience_id),
        ("33333333-3333-3333-3333-333333333332", "First experiment", "2023-04-20", research_experience_id),
        ("33333333-3333-3333-3333-333333333333", "Draft completed", "2024-02-12", writing_experience_id),
        ("33333333-3333-3333-3333-333333333334", "Peer review", "2024-08-03", research_experience_id),
        ("33333333-3333-3333-3333-333333333335", "Publication", "2025-01-15", writing_experience_id),
    ];

    write_demo_entity(&root, "PERSON", person_id, "Ada", "A person anchoring the development graph.")?;
    write_demo_entity(&root, "EXPERIENCE", root_experience_id, "Life stream", "Root timeline branch.")?;
    write_demo_entity(&root, "EXPERIENCE", research_experience_id, "Research", "Research branches from the life stream.")?;
    write_demo_entity(&root, "EXPERIENCE", writing_experience_id, "Writing", "Writing merges research work into publication.")?;
    for (id, name, occurred_at, _) in facts { write_demo_entity(&root, "FACT", id, name, &format!("Occurred at {occurred_at}."))?; }
    write_demo_entity(&root, "LINK", "44444444-4444-4444-4444-444444444444", "Supports", "Relationship metadata.")?;

    let connection = Connection::open(root.join("hasm.db")).map_err(|error| error.to_string())?;
    connection.execute_batch(&format!(
        "CREATE TABLE person (person_id TEXT PRIMARY KEY, person_name TEXT, person_description_path TEXT, birthday TEXT, die TEXT, link_ids TEXT);
         CREATE TABLE experience (experience_id TEXT PRIMARY KEY, person_id TEXT, experience_name TEXT, experience_description_path TEXT, parent_experience_ids TEXT, link_ids TEXT);
         CREATE TABLE fact (fact_id TEXT PRIMARY KEY, fact_name TEXT, occurred_at TEXT, fact_description_path TEXT, experience_ids TEXT, person_ids TEXT, link_ids TEXT);
         CREATE TABLE link (link_id TEXT PRIMARY KEY, link_name TEXT, link_type TEXT, link_description_path TEXT, related_ids TEXT);
         INSERT INTO person VALUES ('{person_id}', 'Ada', 'PERSON/{person_id}/main.md', '1815-12-10', '', '[]');
         INSERT INTO experience VALUES ('{root_experience_id}', '{person_id}', 'Life stream', 'EXPERIENCE/{root_experience_id}/main.md', '[]', '[]');
         INSERT INTO experience VALUES ('{research_experience_id}', '{person_id}', 'Research', 'EXPERIENCE/{research_experience_id}/main.md', '[\"{root_experience_id}\"]', '[]');
         INSERT INTO experience VALUES ('{writing_experience_id}', '{person_id}', 'Writing', 'EXPERIENCE/{writing_experience_id}/main.md', '[\"{root_experience_id}\", \"{research_experience_id}\"]', '[]');
         INSERT INTO link VALUES ('44444444-4444-4444-4444-444444444444', 'Supports', 'relationship', 'LINK/44444444-4444-4444-4444-444444444444/main.md', '[]');"
    )).map_err(|error| error.to_string())?;
    for (id, name, occurred_at, experience_id) in facts {
        connection.execute(
            "INSERT INTO fact VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, name, occurred_at, format!("FACT/{id}/main.md"), format!("[\"{experience_id}\"]"), format!("[\"{person_id}\"]"), "[]"],
        ).map_err(|error| error.to_string())?;
    }
    let model = service::read_model_database(&root.to_string_lossy())?;
    info!("[SEQ-MD-03][DEMO] populated visualizer workspace created");
    Ok(VisualizerDemoPayload { path: root.to_string_lossy().to_string(), model })
}

fn write_demo_entity(root: &PathBuf, entity_type: &str, id: &str, title: &str, body: &str) -> Result<(), String> {
    let directory = root.join(entity_type).join(id);
    fs::create_dir_all(directory.join("assets")).map_err(|error| error.to_string())?;
    fs::write(directory.join("main.md"), format!("# {title}\n\n{body}\n")).map_err(|error| error.to_string())
}