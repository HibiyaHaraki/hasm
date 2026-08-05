//! # service.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Service layer for reading and writing HASM model workspace data.

use crate::hasm::definitions::{Experience, Fact, Link, Person};
use crate::hasm::types::{EntitySummary, ModelDatabase, ModelWorkspace, SaveResult};
use crate::logger::init_logger;
use log::{debug, error, info, warn};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const ENTITY_TYPES: [&str; 4] = ["PERSON", "EXPERIENCE", "FACT", "LINK"];
const MAIN_DB_FILENAME: &str = "main.db";
const LEGACY_DB_FILENAME: &str = "hasm.db";

pub fn open_hasm_model(model_root: &str) -> Result<ModelWorkspace, String> {
    init_logger();
    info!("open_hasm_model start: model_root={}", model_root);

    // Step 1. Validate model root and open DB connection.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;

    // Step 2. Sync folder-based entities into DB bootstrap rows.
    sync_directories_to_db(&connection, &root)?;

    // Step 3. Load each entity section list.
    let people = list_people(&connection)?;
    let experiences = list_experiences(&connection)?;
    let facts = list_facts(&connection)?;
    let links = list_links(&connection)?;

    // Step 4. Build section map for frontend workspace payload.
    let mut sections = BTreeMap::new();
    sections.insert("PERSON".to_string(), people);
    sections.insert("EXPERIENCE".to_string(), experiences);
    sections.insert("FACT".to_string(), facts);
    sections.insert("LINK".to_string(), links);

    // Step 5. Build per-entity counts from loaded sections.
    let mut counts = BTreeMap::new();
    for entity_type in ENTITY_TYPES {
        let count = sections.get(entity_type).map(|items| items.len()).unwrap_or(0);
        counts.insert(entity_type.to_string(), count);
    }

    // Step 6. Return normalized model workspace snapshot.
    info!(
        "open_hasm_model success: root={}, PERSON={}, EXPERIENCE={}, FACT={}, LINK={}",
        root.display(),
        counts.get("PERSON").copied().unwrap_or(0),
        counts.get("EXPERIENCE").copied().unwrap_or(0),
        counts.get("FACT").copied().unwrap_or(0),
        counts.get("LINK").copied().unwrap_or(0)
    );
    Ok(ModelWorkspace {
        model_root: root.to_string_lossy().to_string(),
        sections,
        counts,
    })
}

pub fn read_model_database(model_root: &str) -> Result<ModelDatabase, String> {
    init_logger();
    info!("read_model_database start: model_root={}", model_root);

    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    let model = ModelDatabase {
        people: load_people(&connection, &root)?,
        experiences: load_experiences(&connection, &root)?,
        facts: load_facts(&connection, &root)?,
        links: load_links(&connection, &root)?,
    };

    info!(
        "read_model_database success: root={}, PERSON={}, EXPERIENCE={}, FACT={}, LINK={}",
        root.display(),
        model.people.len(),
        model.experiences.len(),
        model.facts.len(),
        model.links.len()
    );

    Ok(model)
}

pub fn save_model_database(model_root: &str, model: &ModelDatabase) -> Result<SaveResult, String> {
    init_logger();
    info!(
        "save_model_database start: model_root={}, PERSON={}, EXPERIENCE={}, FACT={}, LINK={}",
        model_root,
        model.people.len(),
        model.experiences.len(),
        model.facts.len(),
        model.links.len()
    );

    let root = validate_model_root(model_root)?;
    let mut connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    let transaction = connection.transaction().map_err(|error| error.to_string())?;

    for person in &model.people {
        save_person_row(&transaction, &root, person)?;
    }
    for experience in &model.experiences {
        save_experience_row(&transaction, &root, experience)?;
    }
    for fact in &model.facts {
        save_fact_row(&transaction, &root, fact)?;
    }
    for link in &model.links {
        save_link_row(&transaction, &root, link)?;
    }

    transaction.commit().map_err(|error| error.to_string())?;

    info!("save_model_database success: root={}", root.display());
    Ok(SaveResult {
        message: format!(
            "Saved main.db (PERSON={}, EXPERIENCE={}, FACT={}, LINK={})",
            model.people.len(),
            model.experiences.len(),
            model.facts.len(),
            model.links.len()
        ),
    })
}

pub fn get_person_detail(model_root: &str, entity_id: &str) -> Result<Person, String> {
    init_logger();
    info!("get_person_detail start: model_root={}, entity_id={}", model_root, entity_id);

    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query person row and compose detail payload with markdown content.
    let person_id = parse_uuid(entity_id)?;
    let row = connection
        .query_row(
            "SELECT person_id, person_name, person_description_path, birthday, die, link_ids
             FROM person WHERE person_id = ?1",
            [person_id.to_string()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((person_id, person_name, description_path, birthday, die, link_ids)) = row {
        info!("get_person_detail success: entity_id={}", entity_id);
        return Ok(Person {
            person_id: parse_uuid_or_nil(&person_id)?,
            person_name,
            person_description_path: description_path.clone(),
            birthday,
            die,
            link_ids: parse_json_uuid_array(&link_ids),
            markdown: read_markdown(&root, &description_path),
            markdown_path: resolve_markdown_path(&root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    warn!("get_person_detail not found: entity_id={}", entity_id);
    Err(format!("PERSON not found: {entity_id}"))
}

pub fn get_experience_detail(model_root: &str, entity_id: &str) -> Result<Experience, String> {
    init_logger();
    info!(
        "get_experience_detail start: model_root={}, entity_id={}",
        model_root,
        entity_id
    );

    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query experience row and compose detail payload with markdown content.
    let experience_id = parse_uuid(entity_id)?;
    let row = connection
        .query_row(
            "SELECT experience_id, person_id, experience_name, experience_description_path,
                    parent_experience_ids, link_ids
             FROM experience WHERE experience_id = ?1",
            [experience_id.to_string()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((
        experience_id,
        person_id,
        experience_name,
        description_path,
        parent_experience_ids,
        link_ids,
    )) = row
    {
        info!("get_experience_detail success: entity_id={}", entity_id);
        return Ok(Experience {
            experience_id: parse_uuid_or_nil(&experience_id)?,
            person_id: parse_uuid_or_nil(&person_id)?,
            experience_name,
            experience_description_path: description_path.clone(),
            parent_experience_ids: parse_json_uuid_array(&parent_experience_ids),
            link_ids: parse_json_uuid_array(&link_ids),
            markdown: read_markdown(&root, &description_path),
            markdown_path: resolve_markdown_path(&root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    warn!("get_experience_detail not found: entity_id={}", entity_id);
    Err(format!("EXPERIENCE not found: {entity_id}"))
}

pub fn get_fact_detail(model_root: &str, entity_id: &str) -> Result<Fact, String> {
    init_logger();
    info!("get_fact_detail start: model_root={}, entity_id={}", model_root, entity_id);

    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query fact row and compose detail payload with markdown content.
    let fact_id = parse_uuid(entity_id)?;
    let row = connection
        .query_row(
            "SELECT fact_id, fact_description_path, branch_experience_ids, person_ids, link_ids
             FROM fact WHERE fact_id = ?1",
            [fact_id.to_string()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((fact_id, description_path, branch_experience_ids, person_ids, link_ids)) = row {
        info!("get_fact_detail success: entity_id={}", entity_id);
        return Ok(Fact {
            fact_id: parse_uuid_or_nil(&fact_id)?,
            fact_description_path: description_path.clone(),
            branch_experience_ids: parse_json_uuid_array(&branch_experience_ids),
            person_ids: parse_json_uuid_array(&person_ids),
            link_ids: parse_json_uuid_array(&link_ids),
            markdown: read_markdown(&root, &description_path),
            markdown_path: resolve_markdown_path(&root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    warn!("get_fact_detail not found: entity_id={}", entity_id);
    Err(format!("FACT not found: {entity_id}"))
}

pub fn get_link_detail(model_root: &str, entity_id: &str) -> Result<Link, String> {
    init_logger();
    info!("get_link_detail start: model_root={}, entity_id={}", model_root, entity_id);

    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query link row and compose detail payload with markdown content.
    let link_id = parse_uuid(entity_id)?;
    let row = connection
        .query_row(
            "SELECT link_id, link_name, link_type, link_description_path, related_ids
             FROM link WHERE link_id = ?1",
            [link_id.to_string()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((link_id, link_name, link_type, description_path, related_ids)) = row {
        info!("get_link_detail success: entity_id={}", entity_id);
        return Ok(Link {
            link_id: parse_uuid_or_nil(&link_id)?,
            link_name,
            link_type,
            link_description_path: description_path.clone(),
            related_ids: parse_json_uuid_array(&related_ids),
            markdown: read_markdown(&root, &description_path),
            markdown_path: resolve_markdown_path(&root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    warn!("get_link_detail not found: entity_id={}", entity_id);
    Err(format!("LINK not found: {entity_id}"))
}

pub fn save_person_detail(model_root: &str, detail: &Person) -> Result<SaveResult, String> {
    init_logger();
    info!(
        "save_person_detail start: model_root={}, person_id={}",
        model_root,
        detail.person_id
    );

    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Upsert person row into DB and markdown file.
    save_person_row(&connection, &root, detail)?;

    // Step 3. Return save result message.
    info!("save_person_detail success: person_id={}", detail.person_id);
    Ok(SaveResult {
        message: format!("Saved PERSON {}", detail.person_id),
    })
}

pub fn save_experience_detail(model_root: &str, detail: &Experience) -> Result<SaveResult, String> {
    init_logger();
    info!(
        "save_experience_detail start: model_root={}, experience_id={}",
        model_root,
        detail.experience_id
    );

    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Upsert experience row into DB and markdown file.
    save_experience_row(&connection, &root, detail)?;

    // Step 3. Return save result message.
    info!("save_experience_detail success: experience_id={}", detail.experience_id);
    Ok(SaveResult {
        message: format!("Saved EXPERIENCE {}", detail.experience_id),
    })
}

pub fn save_fact_detail(model_root: &str, detail: &Fact) -> Result<SaveResult, String> {
    init_logger();
    info!(
        "save_fact_detail start: model_root={}, fact_id={}",
        model_root,
        detail.fact_id
    );

    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Upsert fact row into DB and markdown file.
    save_fact_row(&connection, &root, detail)?;

    // Step 3. Return save result message.
    info!("save_fact_detail success: fact_id={}", detail.fact_id);
    Ok(SaveResult {
        message: format!("Saved FACT {}", detail.fact_id),
    })
}

pub fn save_link_detail(model_root: &str, detail: &Link) -> Result<SaveResult, String> {
    init_logger();
    info!(
        "save_link_detail start: model_root={}, link_id={}",
        model_root,
        detail.link_id
    );

    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Upsert link row into DB and markdown file.
    save_link_row(&connection, &root, detail)?;

    // Step 3. Return save result message.
    info!("save_link_detail success: link_id={}", detail.link_id);
    Ok(SaveResult {
        message: format!("Saved LINK {}", detail.link_id),
    })
}

fn validate_model_root(model_root: &str) -> Result<PathBuf, String> {
    init_logger();
    debug!("validate_model_root: {}", model_root);

    // Step 1. Validate root existence and directory type.
    let root = PathBuf::from(model_root);
    if !root.exists() {
        error!("Model root does not exist: {}", model_root);
        return Err(format!("Model root does not exist: {model_root}"));
    }
    if !root.is_dir() {
        error!("Model root is not a directory: {}", model_root);
        return Err(format!("Model root is not a directory: {model_root}"));
    }

    // Step 2. Validate required entity folders.
    for entity_type in ENTITY_TYPES {
        let path = root.join(entity_type);
        if !path.exists() {
            error!("Missing required folder: {}", path.display());
            return Err(format!("Missing required folder: {}", path.to_string_lossy()));
        }
    }

    debug!("validate_model_root success: {}", root.display());
    Ok(root)
}

fn open_connection(model_root: &Path) -> Result<Connection, String> {
    init_logger();
    debug!("open_connection start: {}", model_root.display());

    // Step 1. Ensure target main.db exists, optionally bootstrapped from legacy hasm.db.
    let main_db_path = model_root.join(MAIN_DB_FILENAME);
    if !main_db_path.exists() {
        let legacy_db_path = model_root.join(LEGACY_DB_FILENAME);
        if legacy_db_path.exists() {
            info!(
                "main.db missing; copying legacy DB from {} to {}",
                legacy_db_path.display(),
                main_db_path.display()
            );
            fs::copy(&legacy_db_path, &main_db_path).map_err(|error| {
                format!(
                    "Failed to copy {} to {}: {error}",
                    legacy_db_path.display(),
                    main_db_path.display()
                )
            })?;
        }
    }

    // Step 2. Open main.db connection from model root.
    let connection = Connection::open(&main_db_path).map_err(|error| error.to_string())?;

    // Step 3. Ensure required schema exists.
    ensure_schema(&connection)?;
    debug!("open_connection success: {}", main_db_path.display());
    Ok(connection)
}

fn ensure_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS person (
                person_id UUID PRIMARY KEY,
                person_name TEXT NOT NULL DEFAULT '',
                person_description_path TEXT NOT NULL DEFAULT '',
                birthday TEXT NOT NULL DEFAULT '',
                die TEXT NOT NULL DEFAULT '',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS experience (
                experience_id UUID PRIMARY KEY,
                person_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES person(person_id),
                experience_name TEXT NOT NULL DEFAULT '',
                experience_description_path TEXT NOT NULL DEFAULT '',
                parent_experience_ids TEXT NOT NULL DEFAULT '[]',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS fact (
                fact_id UUID PRIMARY KEY,
                fact_description_path TEXT NOT NULL DEFAULT '',
                branch_experience_ids TEXT NOT NULL DEFAULT '[]',
                person_ids TEXT NOT NULL DEFAULT '[]',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS link (
                link_id UUID PRIMARY KEY,
                link_name TEXT NOT NULL DEFAULT '',
                link_type TEXT NOT NULL DEFAULT '',
                link_description_path TEXT NOT NULL DEFAULT '',
                related_ids TEXT NOT NULL DEFAULT '[]'
            );",
        )
        .map_err(|error| error.to_string())
}

fn sync_directories_to_db(connection: &Connection, model_root: &Path) -> Result<(), String> {
    init_logger();
    debug!("sync_directories_to_db start: {}", model_root.display());

    // Step 1. Sync PERSON folders into DB rows when missing.
    let person_ids = read_entity_directories(model_root, "PERSON")?;
    for entity_id in &person_ids {
        let description_path = Person::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO person (person_id, person_name, person_description_path, birthday, die, link_ids)
                 VALUES (?1, '', ?2, '', '', '[]')",
                params![entity_id.to_string(), description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    // Step 2. Sync EXPERIENCE folders into DB rows when missing.
    let experience_ids = read_entity_directories(model_root, "EXPERIENCE")?;
    for entity_id in &experience_ids {
        let description_path = Experience::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO experience (experience_id, person_id, experience_name, experience_description_path, parent_experience_ids, link_ids)
                 VALUES (?1, '00000000-0000-0000-0000-000000000000', '', ?2, '[]', '[]')",
                params![entity_id.to_string(), description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    // Step 3. Sync FACT folders into DB rows when missing.
    let fact_ids = read_entity_directories(model_root, "FACT")?;
    for entity_id in &fact_ids {
        let description_path = Fact::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO fact (fact_id, fact_description_path, branch_experience_ids, person_ids, link_ids)
                 VALUES (?1, ?2, '[]', '[]', '[]')",
                params![entity_id.to_string(), description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    // Step 4. Sync LINK folders into DB rows when missing.
    let link_ids = read_entity_directories(model_root, "LINK")?;
    for entity_id in &link_ids {
        let description_path = Link::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO link (link_id, link_name, link_type, link_description_path, related_ids)
                 VALUES (?1, '', '', ?2, '[]')",
                params![entity_id.to_string(), description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    debug!(
        "sync_directories_to_db success: PERSON={}, EXPERIENCE={}, FACT={}, LINK={}",
        person_ids.len(),
        experience_ids.len(),
        fact_ids.len(),
        link_ids.len()
    );
    Ok(())
}

fn save_person_row(connection: &Connection, model_root: &Path, detail: &Person) -> Result<(), String> {
    debug!("save_person_row: person_id={}", detail.person_id);
    let description_path = sanitize_relative_path(
        &detail.person_description_path,
        Person::default_markdown_path(&detail.person_id),
    );
    write_markdown(model_root, &description_path, &detail.markdown)?;

    connection
        .execute(
            "INSERT INTO person (person_id, person_name, person_description_path, birthday, die, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(person_id) DO UPDATE SET
                person_name = excluded.person_name,
                person_description_path = excluded.person_description_path,
                birthday = excluded.birthday,
                die = excluded.die,
                link_ids = excluded.link_ids",
            params![
                detail.person_id.to_string(),
                detail.person_name,
                description_path,
                detail.birthday,
                detail.die,
                to_json_uuid_array(&detail.link_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn save_experience_row(
    connection: &Connection,
    model_root: &Path,
    detail: &Experience,
) -> Result<(), String> {
    debug!("save_experience_row: experience_id={}", detail.experience_id);
    let description_path = sanitize_relative_path(
        &detail.experience_description_path,
        Experience::default_markdown_path(&detail.experience_id),
    );
    write_markdown(model_root, &description_path, &detail.markdown)?;

    connection
        .execute(
            "INSERT INTO experience (experience_id, person_id, experience_name, experience_description_path,
                                     parent_experience_ids, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(experience_id) DO UPDATE SET
                person_id = excluded.person_id,
                experience_name = excluded.experience_name,
                experience_description_path = excluded.experience_description_path,
                parent_experience_ids = excluded.parent_experience_ids,
                link_ids = excluded.link_ids",
            params![
                detail.experience_id.to_string(),
                detail.person_id.to_string(),
                detail.experience_name,
                description_path,
                to_json_uuid_array(&detail.parent_experience_ids),
                to_json_uuid_array(&detail.link_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn save_fact_row(connection: &Connection, model_root: &Path, detail: &Fact) -> Result<(), String> {
    debug!("save_fact_row: fact_id={}", detail.fact_id);
    let description_path = sanitize_relative_path(
        &detail.fact_description_path,
        Fact::default_markdown_path(&detail.fact_id),
    );
    write_markdown(model_root, &description_path, &detail.markdown)?;

    connection
        .execute(
            "INSERT INTO fact (fact_id, fact_description_path, branch_experience_ids, person_ids, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(fact_id) DO UPDATE SET
                fact_description_path = excluded.fact_description_path,
                branch_experience_ids = excluded.branch_experience_ids,
                person_ids = excluded.person_ids,
                link_ids = excluded.link_ids",
            params![
                detail.fact_id.to_string(),
                description_path,
                to_json_uuid_array(&detail.branch_experience_ids),
                to_json_uuid_array(&detail.person_ids),
                to_json_uuid_array(&detail.link_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn save_link_row(connection: &Connection, model_root: &Path, detail: &Link) -> Result<(), String> {
    debug!("save_link_row: link_id={}", detail.link_id);
    let description_path = sanitize_relative_path(
        &detail.link_description_path,
        Link::default_markdown_path(&detail.link_id),
    );
    write_markdown(model_root, &description_path, &detail.markdown)?;

    connection
        .execute(
            "INSERT INTO link (link_id, link_name, link_type, link_description_path, related_ids)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(link_id) DO UPDATE SET
                link_name = excluded.link_name,
                link_type = excluded.link_type,
                link_description_path = excluded.link_description_path,
                related_ids = excluded.related_ids",
            params![
                detail.link_id.to_string(),
                detail.link_name,
                detail.link_type,
                description_path,
                to_json_uuid_array(&detail.related_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn list_people(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT person_id, person_name, birthday, die
             FROM person ORDER BY COALESCE(NULLIF(person_name, ''), person_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        let (person_id, person_name, birthday, die) = row.map_err(|error| error.to_string())?;
        let person = Person {
            person_id: parse_uuid_or_nil(&person_id)?,
            person_name,
            person_description_path: String::new(),
            birthday,
            die,
            link_ids: Vec::new(),
            markdown: String::new(),
            markdown_path: String::new(),
        };

        items.push(EntitySummary {
            id: person.person_id.to_string(),
            title: person.title(),
            subtitle: person.subtitle(),
        });
    }

    Ok(items)
}

fn list_experiences(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT experience_id, person_id, experience_name
             FROM experience ORDER BY COALESCE(NULLIF(experience_name, ''), experience_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        let (experience_id, person_id, experience_name) = row.map_err(|error| error.to_string())?;
        let experience = Experience {
            experience_id: parse_uuid_or_nil(&experience_id)?,
            person_id: parse_uuid_or_nil(&person_id)?,
            experience_name,
            experience_description_path: String::new(),
            parent_experience_ids: Vec::new(),
            link_ids: Vec::new(),
            markdown: String::new(),
            markdown_path: String::new(),
        };

        items.push(EntitySummary {
            id: experience.experience_id.to_string(),
            title: experience.title(),
            subtitle: experience.subtitle(),
        });
    }

    Ok(items)
}

fn list_facts(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare("SELECT fact_id, person_ids, link_ids FROM fact ORDER BY fact_id")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        let (fact_id, person_ids, link_ids) = row.map_err(|error| error.to_string())?;
        let fact = Fact {
            fact_id: parse_uuid_or_nil(&fact_id)?,
            fact_description_path: String::new(),
            branch_experience_ids: Vec::new(),
            person_ids: parse_json_uuid_array(&person_ids),
            link_ids: parse_json_uuid_array(&link_ids),
            markdown: String::new(),
            markdown_path: String::new(),
        };

        items.push(EntitySummary {
            id: fact.fact_id.to_string(),
            title: fact.title(),
            subtitle: fact.subtitle(),
        });
    }

    Ok(items)
}

fn list_links(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT link_id, link_name, link_type FROM link ORDER BY COALESCE(NULLIF(link_name, ''), link_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        let (link_id, link_name, link_type) = row.map_err(|error| error.to_string())?;
        let link = Link {
            link_id: parse_uuid_or_nil(&link_id)?,
            link_name,
            link_type,
            link_description_path: String::new(),
            related_ids: Vec::new(),
            markdown: String::new(),
            markdown_path: String::new(),
        };

        items.push(EntitySummary {
            id: link.link_id.to_string(),
            title: link.title(),
            subtitle: link.subtitle(),
        });
    }

    Ok(items)
}

fn load_people(connection: &Connection, model_root: &Path) -> Result<Vec<Person>, String> {
    let mut statement = connection
        .prepare(
            "SELECT person_id, person_name, person_description_path, birthday, die, link_ids
             FROM person ORDER BY COALESCE(NULLIF(person_name, ''), person_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut people = Vec::new();
    for row in rows {
        let (person_id, person_name, description_path, birthday, die, link_ids) =
            row.map_err(|error| error.to_string())?;

        people.push(Person {
            person_id: parse_uuid_or_nil(&person_id)?,
            person_name,
            person_description_path: description_path.clone(),
            birthday,
            die,
            link_ids: parse_json_uuid_array(&link_ids),
            markdown: read_markdown(model_root, &description_path),
            markdown_path: resolve_markdown_path(model_root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    Ok(people)
}

fn load_experiences(connection: &Connection, model_root: &Path) -> Result<Vec<Experience>, String> {
    let mut statement = connection
        .prepare(
            "SELECT experience_id, person_id, experience_name, experience_description_path,
                    parent_experience_ids, link_ids
             FROM experience ORDER BY COALESCE(NULLIF(experience_name, ''), experience_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut experiences = Vec::new();
    for row in rows {
        let (
            experience_id,
            person_id,
            experience_name,
            description_path,
            parent_experience_ids,
            link_ids,
        ) = row.map_err(|error| error.to_string())?;

        experiences.push(Experience {
            experience_id: parse_uuid_or_nil(&experience_id)?,
            person_id: parse_uuid_or_nil(&person_id)?,
            experience_name,
            experience_description_path: description_path.clone(),
            parent_experience_ids: parse_json_uuid_array(&parent_experience_ids),
            link_ids: parse_json_uuid_array(&link_ids),
            markdown: read_markdown(model_root, &description_path),
            markdown_path: resolve_markdown_path(model_root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    Ok(experiences)
}

fn load_facts(connection: &Connection, model_root: &Path) -> Result<Vec<Fact>, String> {
    let mut statement = connection
        .prepare(
            "SELECT fact_id, fact_description_path, branch_experience_ids, person_ids, link_ids
             FROM fact ORDER BY fact_id",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut facts = Vec::new();
    for row in rows {
        let (fact_id, description_path, branch_experience_ids, person_ids, link_ids) =
            row.map_err(|error| error.to_string())?;

        facts.push(Fact {
            fact_id: parse_uuid_or_nil(&fact_id)?,
            fact_description_path: description_path.clone(),
            branch_experience_ids: parse_json_uuid_array(&branch_experience_ids),
            person_ids: parse_json_uuid_array(&person_ids),
            link_ids: parse_json_uuid_array(&link_ids),
            markdown: read_markdown(model_root, &description_path),
            markdown_path: resolve_markdown_path(model_root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    Ok(facts)
}

fn load_links(connection: &Connection, model_root: &Path) -> Result<Vec<Link>, String> {
    let mut statement = connection
        .prepare(
            "SELECT link_id, link_name, link_type, link_description_path, related_ids
             FROM link ORDER BY COALESCE(NULLIF(link_name, ''), link_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut links = Vec::new();
    for row in rows {
        let (link_id, link_name, link_type, description_path, related_ids) =
            row.map_err(|error| error.to_string())?;

        links.push(Link {
            link_id: parse_uuid_or_nil(&link_id)?,
            link_name,
            link_type,
            link_description_path: description_path.clone(),
            related_ids: parse_json_uuid_array(&related_ids),
            markdown: read_markdown(model_root, &description_path),
            markdown_path: resolve_markdown_path(model_root, &description_path)
                .to_string_lossy()
                .to_string(),
        });
    }

    Ok(links)
}

fn read_entity_directories(model_root: &Path, entity_type: &str) -> Result<Vec<Uuid>, String> {
    debug!(
        "read_entity_directories start: root={}, entity_type={}",
        model_root.display(),
        entity_type
    );

    // Step 1. Walk the target entity directory.
    let entity_path = model_root.join(entity_type);
    let mut entity_ids = Vec::new();
    let entries = fs::read_dir(&entity_path)
        .map_err(|error| format!("Failed to read {}: {error}", entity_path.display()))?;

    // Step 2. Collect child folder names as UUID entity IDs.
    for entry in entries {
        let entry = entry.map_err(|error| format!("Failed to inspect directory entry: {error}"))?;
        if entry.path().is_dir() {
            let raw_id = entry.file_name().to_string_lossy().to_string();
            let parsed_id = parse_uuid(&raw_id)?;
            entity_ids.push(parsed_id);
        }
    }

    // Step 3. Sort and return deterministic entity ID list.
    entity_ids.sort_by_key(|id| id.to_string());
    debug!(
        "read_entity_directories success: entity_type={}, count={}",
        entity_type,
        entity_ids.len()
    );
    Ok(entity_ids)
}

fn read_markdown(model_root: &Path, relative_path: &str) -> String {
    let path = resolve_markdown_path(model_root, relative_path);
    fs::read_to_string(path).unwrap_or_default()
}

fn write_markdown(model_root: &Path, relative_path: &str, markdown: &str) -> Result<(), String> {
    debug!(
        "write_markdown start: root={}, relative_path={}",
        model_root.display(),
        relative_path
    );

    let path = resolve_markdown_path(model_root, relative_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create markdown directory {}: {error}",
                parent.display()
            )
        })?;
    }
    fs::write(&path, markdown).map_err(|error| {
        error!("write_markdown failed: path={}, error={}", path.display(), error);
        format!("Failed to write {}: {error}", path.display())
    })?;

    debug!("write_markdown success: {}", path.display());
    Ok(())
}

fn resolve_markdown_path(model_root: &Path, relative_path: &str) -> PathBuf {
    let normalized = sanitize_relative_path(relative_path, String::new());
    if normalized.is_empty() {
        model_root.join("main.md")
    } else {
        model_root.join(normalized)
    }
}

fn sanitize_relative_path(value: &str, fallback: String) -> String {
    let normalized = value.trim().replace('\\', "/");
    if normalized.is_empty() {
        fallback
    } else {
        normalized
    }
}

fn parse_uuid(value: &str) -> Result<Uuid, String> {
    Uuid::parse_str(value.trim()).map_err(|error| {
        error!("Invalid UUID '{}': {}", value, error);
        format!("Invalid UUID '{value}': {error}")
    })
}

fn parse_uuid_or_nil(value: &str) -> Result<Uuid, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Ok(Uuid::nil())
    } else {
        parse_uuid(trimmed)
    }
}

fn parse_json_uuid_array(value: &str) -> Vec<Uuid> {
    serde_json::from_str::<Vec<String>>(value)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|raw| Uuid::parse_str(raw.trim()).ok())
        .collect()
}

fn to_json_uuid_array(values: &[Uuid]) -> String {
    let text_values: Vec<String> = values.iter().map(ToString::to_string).collect();
    serde_json::to_string(&text_values).unwrap_or_else(|_| "[]".to_string())
}
