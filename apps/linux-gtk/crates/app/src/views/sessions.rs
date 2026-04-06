use gtk4::{self, Orientation};
use libadwaita as adw;
use libadwaita::prelude::*;

use crate::state::AppState;
use crate::widgets::status_placeholder;

pub struct SessionsView {
    container: gtk4::Box,
}

impl SessionsView {
    pub fn new(state: AppState) -> Self {
        let container = gtk4::Box::builder()
            .orientation(Orientation::Vertical)
            .vexpand(true)
            .hexpand(true)
            .build();

        // Initial state: loading spinner until the gateway snapshot arrives.
        let loading = status_placeholder::loading("Loading sessions...");
        container.append(&loading);

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
            .title("Active Sessions")
            .description("Current chat sessions across all agents")
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

        let s = state;
        let lb = list_box;
        let container_ref = container.clone();
        let scroll_ref = scroll.clone();
        let mut populated = false;
        gtk4::glib::timeout_add_local(std::time::Duration::from_secs(1), move || {
            if !populated && s.is_connected() {
                let sessions = s.sessions();
                if sessions.is_empty() {
                    // Empty state: libadwaita StatusPage (GNOME HIG pattern).
                    let empty = status_placeholder::empty(
                        "view-list-symbolic",
                        "No active sessions",
                        Some("Start a chat to create your first session"),
                    );
                    status_placeholder::swap_child(&container_ref, &empty);
                } else {
                    for sess in &sessions {
                        let key = sess
                            .get("key")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let agent = sess
                            .get("agentId")
                            .and_then(|v| v.as_str())
                            .unwrap_or("default");

                        let row = adw::ActionRow::builder()
                            .title(key)
                            .subtitle(format!("Agent: {agent}"))
                            .build();
                        lb.append(&row);
                    }
                    status_placeholder::swap_child(&container_ref, &scroll_ref);
                }
                populated = true;
            }
            gtk4::glib::ControlFlow::Continue
        });

        Self { container }
    }

    pub fn widget(&self) -> &gtk4::Box {
        &self.container
    }
}
