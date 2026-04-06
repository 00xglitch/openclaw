use gtk4::{self, Orientation};
use libadwaita as adw;
use libadwaita::prelude::*;

use crate::state::SharedClient;
use crate::widgets::status_placeholder;

pub struct SkillsView {
    container: gtk4::Box,
}

impl SkillsView {
    pub fn new(client: SharedClient) -> Self {
        let container = gtk4::Box::builder()
            .orientation(Orientation::Vertical)
            .vexpand(true)
            .hexpand(true)
            .build();

        let scroll = gtk4::ScrolledWindow::builder()
            .vexpand(true)
            .hscrollbar_policy(gtk4::PolicyType::Never)
            .build();

        let content = gtk4::Box::builder()
            .orientation(Orientation::Vertical)
            .spacing(16)
            .margin_start(32)
            .margin_end(32)
            .margin_top(24)
            .margin_bottom(24)
            .build();

        let group = adw::PreferencesGroup::builder()
            .title("Installed Skills")
            .description("Agent skills and capabilities")
            .build();

        let list_box = gtk4::ListBox::builder()
            .selection_mode(gtk4::SelectionMode::None)
            .css_classes(vec!["boxed-list".to_string()])
            .build();

        content.append(&group);
        content.append(&list_box);

        let clamp = adw::Clamp::builder()
            .maximum_size(700)
            .child(&content)
            .build();
        scroll.set_child(Some(&clamp));

        let loading = status_placeholder::loading("Loading skills...");
        container.append(&loading);

        // Load skills via RPC
        let lb = list_box.clone();
        let c = client;
        let container_ref = container.clone();
        let scroll_ref = scroll.clone();
        let mut loaded = false;
        gtk4::glib::timeout_add_local(std::time::Duration::from_secs(2), move || {
            if !loaded
                && let Some(gw) = c.lock().unwrap().clone()
            {
                loaded = true;
                let lb2 = lb.clone();
                let cr = container_ref.clone();
                let sr = scroll_ref.clone();
                gtk4::glib::spawn_future_local(async move {
                    match gw.request("skills.status", serde_json::json!({})).await {
                        Ok(payload) => {
                            let skills = payload
                                .get("skills")
                                .and_then(|s| s.as_array())
                                .cloned()
                                .unwrap_or_default();
                            if skills.is_empty() {
                                let empty = status_placeholder::empty(
                                    "applications-system-symbolic",
                                    "No skills installed",
                                    Some("Skills are loaded from the agent's skills directory"),
                                );
                                status_placeholder::swap_child(&cr, &empty);
                            } else {
                                for skill in &skills {
                                    let name = skill
                                        .get("name")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("unnamed");
                                    let status = skill
                                        .get("status")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("unknown");
                                    let row = adw::ActionRow::builder()
                                        .title(name)
                                        .subtitle(status)
                                        .build();
                                    lb2.append(&row);
                                }
                                status_placeholder::swap_child(&cr, &sr);
                            }
                        }
                        Err(e) => {
                            let err = status_placeholder::error(
                                "Failed to load skills",
                                Some(&format!("{e}")),
                            );
                            status_placeholder::swap_child(&cr, &err);
                        }
                    }
                });
            }
            gtk4::glib::ControlFlow::Continue
        });

        Self { container }
    }

    pub fn widget(&self) -> &gtk4::Box {
        &self.container
    }
}
