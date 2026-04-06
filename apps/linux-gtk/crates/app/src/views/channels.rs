use gtk4::{self, Orientation};
use gtk4::prelude::*;
use libadwaita as adw;
use libadwaita::prelude::*;

use crate::state::AppState;
use crate::widgets::status_placeholder;

pub struct ChannelsView {
    container: gtk4::Box,
}

impl ChannelsView {
    pub fn new(state: AppState) -> Self {
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
            .title("Messaging Channels")
            .description("Connected messaging platforms")
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

        // Initial loading state (swapped out once the snapshot arrives).
        let loading = status_placeholder::loading("Loading channels...");
        container.append(&loading);

        let s = state;
        let lb = list_box;
        let container_ref = container.clone();
        let scroll_ref = scroll.clone();
        let mut populated = false;
        gtk4::glib::timeout_add_local(std::time::Duration::from_secs(1), move || {
            if !populated && s.is_connected() {
                let channels = s.channels();
                if channels.is_empty() {
                    let empty = status_placeholder::empty(
                        "network-transmit-symbolic",
                        "No channels configured",
                        Some("Add Telegram, WhatsApp, or Discord channels in the gateway config"),
                    );
                    status_placeholder::swap_child(&container_ref, &empty);
                } else {
                    for ch in &channels {
                        let name = ch
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let status = ch
                            .get("status")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");

                        let row = adw::ActionRow::builder()
                            .title(name)
                            .subtitle(status)
                            .build();

                        let chip_class = if status == "connected" {
                            "chip-ok"
                        } else {
                            "chip-error"
                        };
                        let chip = gtk4::Label::builder()
                            .label(status)
                            .css_classes(vec![
                                "status-chip".to_string(),
                                chip_class.to_string(),
                            ])
                            .valign(gtk4::Align::Center)
                            .build();
                        row.add_suffix(&chip);
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
