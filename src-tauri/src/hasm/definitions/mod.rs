//! # mod.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Aggregate exports for HASM entity definitions.

mod experience;
mod fact;
mod link;
mod person;

pub use experience::Experience;
pub use fact::Fact;
pub use link::Link;
pub use person::Person;

pub fn validate_external_links(links: &[String]) -> Result<(), String> {
    for (index, value) in links.iter().enumerate() {
        let absolute = value.split_once("://").is_some_and(|(scheme, _)| {
            scheme.eq_ignore_ascii_case("http") || scheme.eq_ignore_ascii_case("https")
        });
        let valid = tauri::Url::parse(value).is_ok_and(|url| {
            matches!(url.scheme(), "http" | "https")
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
        });
        if !absolute || !valid || value.chars().any(char::is_whitespace) {
            return Err(format!("ERR_INVALID_EXTERNAL_LINK: Link {} must be an absolute HTTP(S) URL without credentials or whitespace", index + 1));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_external_links;

    #[test]
    fn validates_external_url_arrays_without_logging_contents() {
        assert!(validate_external_links(&[]).is_ok());
        assert!(validate_external_links(&[
            "https://x.com/person/status/123".into(),
            "https://www.google.com/maps/place/Tokyo".into(),
            "http://example.org/path?q=hello%20world#part".into(),
        ]).is_ok());
        for invalid in ["", "example.com", "https:example.com", "javascript:alert(1)", "file:///C:/secret",
            "https://user:password@example.org", "https://example.org/has space", " https://example.org"] {
            assert!(validate_external_links(&[invalid.into()]).unwrap_err().contains("ERR_INVALID_EXTERNAL_LINK"));
        }
    }
}