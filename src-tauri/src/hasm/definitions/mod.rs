//! # mod.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Aggregate exports for HASM entity detail definitions.

mod experience;
mod fact;
mod link;
mod person;

pub use experience::ExperienceDetail;
pub use fact::FactDetail;
pub use link::LinkDetail;
pub use person::PersonDetail;