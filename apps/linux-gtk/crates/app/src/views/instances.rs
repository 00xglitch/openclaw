use gtk4::{self, glib, Orientation};
use libadwaita as adw;
use libadwaita::prelude::*;

use crate::state::SharedClient;

pub struct InstancesView {
    container: gtk4::Box,
}

impl InstancesView {
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
            .title("Connected Instances")
            .description("Gateway nodes and connected clients")
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
        container.append(&scroll);

        let c = client;
        let lb = list_box;
        let mut loaded = false;
        glib::timeout_add_local(std::time::Duration::from_secs(2), move || {
            if !loaded
                && let Some(gw) = c.lock().unwrap().clone() {
                    loaded = true;
                    let lb2 = lb.clone();
                    glib::spawn_future_local(async move {
                        match gw.request("node.list", serde_json::json!({})).await {
                            Ok(payload) => {
                                if let Some(nodes) =
                                    payload.get("nodes").and_then(|n| n.as_array())
                                {
                                    for node in nodes {
                                        let id = node
                                            .get("id")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("?");
                                        let name = node
                                            .get("name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or(id);
                                        let status = node
                                            .get("status")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown");

                                        let row = adw::ActionRow::builder()
                                            .title(name)
                                            .subtitle(format!("{id} — {status}"))
                                            .build();

                                        let chip_class = if status == "online" {
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
                                        lb2.append(&row);
                                    }
                                }

                                if lb2.first_child().is_none() {
                                    let row = adw::ActionRow::builder()
                                        .title("No remote nodes")
                                        .subtitle(
                                            "This is a standalone gateway instance",
                                        )
                                        .build();
                                    lb2.append(&row);
                                }
                            }
                            Err(e) => {
                                let row = adw::ActionRow::builder()
                                    .title("Failed to load nodes")
                                    .subtitle(format!("{e}"))
                                    .build();
                                lb2.append(&row);
                            }
                        }
                    });
                }
            glib::ControlFlow::Continue
        });

        Self { container }
    }

    pub fn widget(&self) -> &gtk4::Box {
        &self.container
    }
}
