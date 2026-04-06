use gtk4::{self, Orientation};
use libadwaita as adw;
use libadwaita::prelude::*;

use crate::state::SharedClient;
use crate::widgets::status_placeholder;

pub struct CronView {
    container: gtk4::Box,
}

impl CronView {
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
            .title("Scheduled Jobs")
            .description("Cron-style scheduled tasks")
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

        let loading = status_placeholder::loading("Loading scheduled jobs...");
        container.append(&loading);

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
                    match gw.request("cron.list", serde_json::json!({})).await {
                        Ok(payload) => {
                            let jobs = payload
                                .get("jobs")
                                .and_then(|j| j.as_array())
                                .cloned()
                                .unwrap_or_default();
                            if jobs.is_empty() {
                                let empty = status_placeholder::empty(
                                    "alarm-symbolic",
                                    "No scheduled jobs",
                                    Some("Configure cron jobs in ~/.openclaw/cron/jobs.json"),
                                );
                                status_placeholder::swap_child(&cr, &empty);
                            } else {
                                for job in &jobs {
                                    let id = job
                                        .get("id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("--");
                                    let schedule = job
                                        .get("schedule")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("--");
                                    let agent = job
                                        .get("agentId")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("default");
                                    let enabled = job
                                        .get("enabled")
                                        .and_then(|v| v.as_bool())
                                        .unwrap_or(true);

                                    let row = adw::ActionRow::builder()
                                        .title(id)
                                        .subtitle(format!("{schedule} | Agent: {agent}"))
                                        .build();

                                    let status = if enabled { "Active" } else { "Disabled" };
                                    let chip_class = if enabled { "chip-ok" } else { "chip-error" };
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
                                status_placeholder::swap_child(&cr, &sr);
                            }
                        }
                        Err(e) => {
                            let err = status_placeholder::error(
                                "Failed to load cron jobs",
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
