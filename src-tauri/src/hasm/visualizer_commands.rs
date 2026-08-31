//! SEQ-03 graph layout command. Rendering remains owned by the React Three.js adapter.

use crate::hasm::service;
use crate::hasm::types::{LayoutFilterRequest, Line3dGeometry, ModelDatabase, Node3dGeometry, RenderPayload, VisualizerDemoPayload};
use log::info;
use rusqlite::Connection;
use std::collections::{HashMap, HashSet};
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
    let branch_positions = calculate_branch_positions(model);
    let mut experience_fact_zs: HashMap<_, Vec<f32>> = HashMap::new();
    let person_name_by_id: HashMap<_, _> = model.people.iter().map(|person| (person.person_id, person.person_name.clone())).collect();
    let linked_entity_ids = collect_linked_entity_ids(model);
    let fact_ids = model.facts.iter().map(|fact| fact.fact_id).collect::<HashSet<_>>();
    let mut direct_fact_positions = HashMap::new();

    for experience in &model.experiences {
        let [x, y] = branch_positions.get(&experience.experience_id).copied().unwrap_or([0.0, 0.0]);
        let person_name = person_name_by_id.get(&experience.person_id).cloned();
        nodes.push(Node3dGeometry {
            id: experience.experience_id.to_string(),
            entity_type: "EXPERIENCE".to_string(),
            label: experience.experience_name.clone(),
            x,
            y,
            z: 0.0,
            person_name,
            is_direct_fact: None,
            parent_experience_ids: Some(experience.parent_experience_ids.iter().map(ToString::to_string).collect()),
            linked_entity_ids: Some(linked_entity_ids.get(&experience.experience_id).cloned().unwrap_or_default()),
        });
    }

    let mut facts = model.facts.iter().collect::<Vec<_>>();
    facts.sort_by(|left, right| left.occurred_at.cmp(&right.occurred_at).then_with(|| left.fact_id.cmp(&right.fact_id)));
    let earliest_time = facts.first().and_then(|fact| time_key(&fact.occurred_at)).unwrap_or(0);
    for (index, fact) in facts.iter().enumerate() {
        let z = fact_z(&filter.time_scale_mode, index, time_key(&fact.occurred_at).unwrap_or(earliest_time), earliest_time, z_step);
        let mut reflected_experiences = HashSet::new();
        for experience_id in &fact.experience_ids {
            collect_experience_and_ancestors(*experience_id, model, &mut reflected_experiences);
        }
        for experience_id in reflected_experiences {
            if let Some([x, y]) = branch_positions.get(&experience_id).copied() {
                experience_fact_zs.entry(experience_id).or_default().push(z);
                let is_direct_fact = fact.experience_ids.contains(&experience_id);
                if is_direct_fact {
                    direct_fact_positions.entry(fact.fact_id).or_insert([x, y, z]);
                }
                let parent_experience_ids = model.experiences.iter()
                    .find(|experience| experience.experience_id == experience_id)
                    .map(|experience| experience.parent_experience_ids.iter().map(ToString::to_string).collect());
                nodes.push(Node3dGeometry {
                    id: fact.fact_id.to_string(),
                    entity_type: "FACT".to_string(),
                    label: fact.fact_name.clone(),
                    x,
                    y,
                    z,
                    person_name: None,
                    is_direct_fact: Some(is_direct_fact),
                    parent_experience_ids,
                    linked_entity_ids: Some(linked_entity_ids.get(&fact.fact_id).cloned().unwrap_or_default()),
                });
            }
        }
    }

    for experience in &model.experiences {
        let [x, y] = branch_positions.get(&experience.experience_id).copied().unwrap_or([0.0, 0.0]);
        let Some(fact_zs) = experience_fact_zs.get(&experience.experience_id) else {
            continue;
        };
        let first_fact_z = fact_zs.iter().copied().reduce(f32::min).unwrap_or(z_step);
        let last_fact_z = fact_zs.iter().copied().reduce(f32::max).unwrap_or(first_fact_z);
        lines.push(Line3dGeometry { id: format!("branch-{}", experience.experience_id), line_type: "BRANCH".to_string(), from: [x, y, first_fact_z], to: [x, y, last_fact_z], control_points: None });
        for parent_id in &experience.parent_experience_ids {
            if let Some([parent_x, parent_y]) = branch_positions.get(parent_id) {
                let branch_control = midpoint_control([*parent_x, *parent_y, first_fact_z], [x, y, first_fact_z]);
                lines.push(Line3dGeometry { id: format!("branch-{parent_id}-{}", experience.experience_id), line_type: "BRANCH_OUT".to_string(), from: [*parent_x, *parent_y, first_fact_z], to: [x, y, first_fact_z], control_points: Some(vec![branch_control]) });
                let merge_control = midpoint_control([x, y, last_fact_z], [*parent_x, *parent_y, last_fact_z]);
                lines.push(Line3dGeometry { id: format!("merge-{}-{parent_id}", experience.experience_id), line_type: "BRANCH_MERGE".to_string(), from: [x, y, last_fact_z], to: [*parent_x, *parent_y, last_fact_z], control_points: Some(vec![merge_control]) });
            }
        }
    }

    for link in &model.links {
        let [source_id, target_id, ..] = link.related_ids.as_slice() else {
            continue;
        };
        if !fact_ids.contains(source_id) || !fact_ids.contains(target_id) {
            continue;
        }
        let (Some(source), Some(target)) = (direct_fact_positions.get(source_id), direct_fact_positions.get(target_id)) else {
            continue;
        };
        lines.push(Line3dGeometry { id: link.link_id.to_string(), line_type: "LINK".to_string(), from: *source, to: *target, control_points: None });
    }

    RenderPayload { nodes_3d: nodes, lines_3d: lines, warnings: Vec::new() }
}

fn collect_linked_entity_ids(model: &ModelDatabase) -> HashMap<uuid::Uuid, Vec<String>> {
    let mut linked_ids = HashMap::<uuid::Uuid, Vec<String>>::new();
    for link in &model.links {
        for entity_id in &link.related_ids {
            let related = linked_ids.entry(*entity_id).or_default();
            for related_id in link.related_ids.iter().filter(|related_id| *related_id != entity_id).map(ToString::to_string) {
                if !related.contains(&related_id) {
                    related.push(related_id);
                }
            }
        }
    }
    linked_ids
}

fn calculate_branch_positions(model: &ModelDatabase) -> HashMap<uuid::Uuid, [f32; 2]> {
    const GENERATION_GAP: f32 = 6.0;
    const SIBLING_GAP: f32 = 4.0;
    let mut depths = HashMap::new();
    for experience in &model.experiences {
        experience_depth(experience.experience_id, model, &mut depths, &mut HashSet::new());
    }

    let mut ordered_ids = model.experiences.iter().map(|experience| experience.experience_id).collect::<Vec<_>>();
    ordered_ids.sort_by_key(|id| depths.get(id).copied().unwrap_or(0));
    let mut positions = HashMap::new();
    let mut lanes_by_depth: HashMap<usize, Vec<f32>> = HashMap::new();

    for experience_id in ordered_ids {
        let Some(experience) = model.experiences.iter().find(|item| item.experience_id == experience_id) else {
            continue;
        };
        let depth = depths.get(&experience_id).copied().unwrap_or(0);
        let parent_lanes = experience.parent_experience_ids.iter().filter_map(|parent_id| positions.get(parent_id).map(|position: &[f32; 2]| position[1])).collect::<Vec<_>>();
        let parent_center = if parent_lanes.is_empty() { 0.0 } else { parent_lanes.iter().sum::<f32>() / parent_lanes.len() as f32 };
        let sibling_ids = model.experiences.iter().filter(|item| item.parent_experience_ids.iter().any(|parent_id| experience.parent_experience_ids.contains(parent_id))).map(|item| item.experience_id).collect::<Vec<_>>();
        let sibling_index = sibling_ids.iter().position(|id| *id == experience_id).unwrap_or(0);
        let desired_y = parent_center + (sibling_index as f32 - (sibling_ids.len().saturating_sub(1) as f32 / 2.0)) * SIBLING_GAP;
        let y = nearest_available_lane(desired_y, lanes_by_depth.entry(depth).or_default(), SIBLING_GAP);
        positions.insert(experience_id, [depth as f32 * GENERATION_GAP, y]);
    }

    positions
}

fn experience_depth(experience_id: uuid::Uuid, model: &ModelDatabase, depths: &mut HashMap<uuid::Uuid, usize>, visiting: &mut HashSet<uuid::Uuid>) -> usize {
    if let Some(depth) = depths.get(&experience_id) {
        return *depth;
    }
    if !visiting.insert(experience_id) {
        return 0;
    }
    let depth = model.experiences.iter().find(|experience| experience.experience_id == experience_id)
        .map(|experience| experience.parent_experience_ids.iter().map(|parent_id| experience_depth(*parent_id, model, depths, visiting) + 1).max().unwrap_or(0))
        .unwrap_or(0);
    visiting.remove(&experience_id);
    depths.insert(experience_id, depth);
    depth
}

fn nearest_available_lane(desired_y: f32, occupied_lanes: &mut Vec<f32>, gap: f32) -> f32 {
    for step in 0..=occupied_lanes.len() {
        let offset = step as f32 * gap;
        for candidate in [desired_y + offset, desired_y - offset] {
            if occupied_lanes.iter().all(|lane| (candidate - lane).abs() >= gap) {
                occupied_lanes.push(candidate);
                return candidate;
            }
        }
    }
    unreachable!("a free lane is always available beyond the occupied lanes")
}

fn collect_experience_and_ancestors(experience_id: uuid::Uuid, model: &ModelDatabase, collected: &mut HashSet<uuid::Uuid>) {
    if !collected.insert(experience_id) {
        return;
    }
    if let Some(experience) = model.experiences.iter().find(|experience| experience.experience_id == experience_id) {
        for parent_id in &experience.parent_experience_ids {
            collect_experience_and_ancestors(*parent_id, model, collected);
        }
    }
}

fn midpoint_control(from: [f32; 3], to: [f32; 3]) -> [f32; 3] {
    let dx = to[0] - from[0];
    let dy = to[1] - from[1];
    [
        (from[0] + to[0]) / 2.0 - dy * 0.18,
        (from[1] + to[1]) / 2.0 + dx * 0.18,
        from[2],
    ]
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
    use crate::hasm::definitions::{Experience, Fact, Link};
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
        assert!(payload.lines_3d.iter().any(|line| line.line_type == "BRANCH_OUT" && line.control_points.is_some()));
        assert!(payload.lines_3d.iter().any(|line| line.line_type == "BRANCH_MERGE" && line.control_points.is_some()));
        assert_eq!(payload.nodes_3d.iter().filter(|node| node.id == late_id.to_string()).count(), 2);
        let parent_branch = payload.lines_3d.iter().find(|line| line.id == format!("branch-{parent_id}")).unwrap();
        let child_branch = payload.lines_3d.iter().find(|line| line.id == format!("branch-{child_id}")).unwrap();
        assert_eq!(parent_branch.from[2], early.z);
        assert_eq!(parent_branch.to[2], late.z);
        assert_eq!(child_branch.from[2], late.z);
        assert_eq!(child_branch.to[2], late.z);
    }

    #[test]
    fn places_related_experiences_in_generations_with_separate_sibling_lanes() {
        let root_id = Uuid::parse_str("22222222-2222-2222-2222-222222222221").unwrap();
        let first_child_id = Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap();
        let second_child_id = Uuid::parse_str("22222222-2222-2222-2222-222222222223").unwrap();
        let grandchild_id = Uuid::parse_str("22222222-2222-2222-2222-222222222224").unwrap();
        let model = ModelDatabase {
            people: vec![],
            experiences: vec![
                experience(root_id, "Root", vec![]),
                experience(first_child_id, "First child", vec![root_id]),
                experience(second_child_id, "Second child", vec![root_id]),
                experience(grandchild_id, "Grandchild", vec![first_child_id]),
            ],
            facts: vec![],
            links: vec![],
        };

        let positions = calculate_branch_positions(&model);
        assert_eq!(positions[&root_id][0], 0.0);
        assert_eq!(positions[&first_child_id][0], 6.0);
        assert_eq!(positions[&second_child_id][0], 6.0);
        assert_eq!(positions[&grandchild_id][0], 12.0);
        assert_ne!(positions[&first_child_id][1], positions[&second_child_id][1]);
        assert!((positions[&first_child_id][1] + positions[&second_child_id][1]).abs() < f32::EPSILON);
    }

    #[test]
    fn marks_direct_facts_and_only_emits_fact_to_fact_links() {
        let parent_id = Uuid::parse_str("22222222-2222-2222-2222-222222222221").unwrap();
        let child_id = Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap();
        let first_fact_id = Uuid::parse_str("33333333-3333-3333-3333-333333333331").unwrap();
        let second_fact_id = Uuid::parse_str("33333333-3333-3333-3333-333333333332").unwrap();
        let model = ModelDatabase {
            people: vec![],
            experiences: vec![experience(parent_id, "Parent", vec![]), experience(child_id, "Child", vec![parent_id])],
            facts: vec![fact(first_fact_id, "First", "2024-01-01", child_id), fact(second_fact_id, "Second", "2024-02-01", parent_id)],
            links: vec![
                link("FACT link", vec![first_fact_id, second_fact_id]),
                link("EXPERIENCE link", vec![first_fact_id, parent_id]),
            ],
        };

        let payload = calculate_layout(&model, &LayoutFilterRequest { time_scale_mode: "SequentialIndex".to_string(), z_scale_factor: 1.0 });
        let first_fact_nodes = payload.nodes_3d.iter().filter(|node| node.id == first_fact_id.to_string()).collect::<Vec<_>>();
        assert!(first_fact_nodes.iter().any(|node| node.is_direct_fact == Some(true)));
        assert!(first_fact_nodes.iter().any(|node| node.is_direct_fact == Some(false)));
        assert_eq!(payload.lines_3d.iter().filter(|line| line.line_type == "LINK").count(), 1);
        assert!(first_fact_nodes[0].linked_entity_ids.as_ref().unwrap().contains(&second_fact_id.to_string()));
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

    #[test]
    fn attaches_owning_person_name_to_experience_nodes_and_skips_person_lines() {
        let person_id = Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
        let experience_id = Uuid::parse_str("22222222-2222-2222-2222-222222222225").unwrap();
        let model = ModelDatabase {
            people: vec![crate::hasm::definitions::Person { person_id, person_name: "Ada".to_string(), person_description_path: String::new(), birthday: String::new(), die: String::new(), link_ids: vec![], markdown: String::new(), markdown_path: String::new() }],
            experiences: vec![crate::hasm::definitions::Experience { experience_id, person_id, experience_name: "Life stream".to_string(), experience_description_path: String::new(), parent_experience_ids: vec![], link_ids: vec![], markdown: String::new(), markdown_path: String::new() }],
            facts: vec![],
            links: vec![],
        };
        let payload = calculate_layout(&model, &LayoutFilterRequest { time_scale_mode: "SequentialIndex".to_string(), z_scale_factor: 1.0 });
        let experience_node = payload.nodes_3d.iter().find(|node| node.id == experience_id.to_string()).unwrap();
        assert_eq!(experience_node.person_name.as_deref(), Some("Ada"));
        assert!(!payload.nodes_3d.iter().any(|node| node.entity_type == "PERSON"));
        assert!(!payload.lines_3d.iter().any(|line| line.line_type == "PERSON_LIFELINE" || line.line_type == "PERSON_EXPERIENCE_BRANCH"));
    }

    fn experience(experience_id: Uuid, name: &str, parent_experience_ids: Vec<Uuid>) -> crate::hasm::definitions::Experience {
        crate::hasm::definitions::Experience { experience_id, person_id: Uuid::nil(), experience_name: name.to_string(), experience_description_path: String::new(), parent_experience_ids, link_ids: vec![], markdown: String::new(), markdown_path: String::new() }
    }

    fn fact(fact_id: Uuid, name: &str, occurred_at: &str, experience_id: Uuid) -> Fact {
        Fact { fact_id, fact_name: name.to_string(), occurred_at: occurred_at.to_string(), fact_description_path: String::new(), experience_ids: vec![experience_id], person_ids: vec![], link_ids: vec![], markdown: String::new(), markdown_path: String::new() }
    }

    fn link(name: &str, related_ids: Vec<Uuid>) -> Link {
        Link { link_id: Uuid::nil(), link_name: name.to_string(), link_type: "references".to_string(), link_description_path: String::new(), related_ids, markdown: String::new(), markdown_path: String::new() }
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