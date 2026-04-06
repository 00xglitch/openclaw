use gtk4::{self, glib, Orientation};
use libadwaita as adw;
use libadwaita::prelude::*;

use crate::state::{AppState, SharedClient};

pub struct ControlRoomView {
    container: gtk4::Box,
}

impl ControlRoomView {
    pub fn new(state: AppState, client: SharedClient) -> Self {
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
            .spacing(24)
            .margin_start(32)
            .margin_end(32)
            .margin_top(24)
            .margin_bottom(24)
            .build();

        // Status strip
        let status_cards = gtk4::Box::builder()
            .orientation(Orientation::Horizontal)
            .spacing(12)
            .homogeneous(true)
            .build();

        let health_chip = Self::build_chip("Health", "...");
        let uptime_chip = Self::build_chip("Uptime", "...");
        let version_chip = Self::build_chip("Version", "...");
        let agents_chip = Self::build_chip("Agents", "0");
        let sessions_chip = Self::build_chip("Sessions", "0");

        status_cards.append(&health_chip);
        status_cards.append(&uptime_chip);
        status_cards.append(&version_chip);
        status_cards.append(&agents_chip);
        status_cards.append(&sessions_chip);
        content.append(&status_cards);

        // Quick actions
        let actions_group = adw::PreferencesGroup::builder()
            .title("Quick Actions")
            .build();

        let probe_row = adw::ActionRow::builder()
            .title("Probe Channels")
            .subtitle("Test all channel connections")
            .activatable(true)
            .build();
        probe_row.add_suffix(&gtk4::Image::from_icon_name("go-next-symbolic"));

        let reload_row = adw::ActionRow::builder()
            .title("Reload Config")
            .subtitle("Hot-reload gateway configuration")
            .activatable(true)
            .build();
        reload_row.add_suffix(&gtk4::Image::from_icon_name("go-next-symbolic"));

        let cron_row = adw::ActionRow::builder()
            .title("Run Due Cron Jobs")
            .subtitle("Execute any due scheduled tasks")
            .activatable(true)
            .build();
        cron_row.add_suffix(&gtk4::Image::from_icon_name("go-next-symbolic"));

        actions_group.add(&probe_row);
        actions_group.add(&reload_row);
        actions_group.add(&cron_row);
        content.append(&actions_group);

        // Action result
        let result_label = gtk4::Label::builder()
            .label("")
            .xalign(0.0)
            .wrap(true)
            .visible(false)
            .css_classes(vec!["caption".to_string()])
            .build();
        content.append(&result_label);

        // Agent activity
        let agent_group = adw::PreferencesGroup::builder()
            .title("Agent Activity")
            .description("Recent agent session counts")
            .build();

        let agent_list = gtk4::ListBox::builder()
            .selection_mode(gtk4::SelectionMode::None)
            .css_classes(vec!["boxed-list".to_string()])
            .build();
        content.append(&agent_group);
        content.append(&agent_list);

        let clamp = adw::Clamp::builder()
            .maximum_size(800)
            .child(&content)
            .build();
        scroll.set_child(Some(&clamp));
        container.append(&scroll);

        // Poll state
        let s = state;
        let hc = health_chip;
        let vc = version_chip;
        let ac = agents_chip;
        let sc = sessions_chip;
        let al = agent_list;
        let mut agent_populated = false;
        glib::timeout_add_local(std::time::Duration::from_secs(1), move || {
            if s.is_connected() {
                Self::set_chip_value(&hc, "OK");
                Self::set_chip_value(&vc, &format!("v{}", s.server_version()));
                Self::set_chip_value(&ac, &format!("{}", s.agents().len()));
                Self::set_chip_value(&sc, &format!("{}", s.sessions().len()));

                if !agent_populated {
                    let agents = s.agents();
                    let sessions = s.sessions();
                    for agent in &agents {
                        let id = agent
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("?");
                        let emoji = agent
                            .get("identity")
                            .and_then(|i| i.get("emoji"))
                            .and_then(|e| e.as_str())
                            .unwrap_or("");
                        let name = agent
                            .get("identity")
                            .and_then(|i| i.get("name"))
                            .and_then(|n| n.as_str())
                            .unwrap_or(id);
                        let count = sessions
                            .iter()
                            .filter(|sess| {
                                sess.get("agentId")
                                    .and_then(|v| v.as_str())
                                    == Some(id)
                            })
                            .count();

                        let row = adw::ActionRow::builder()
                            .title(format!("{emoji} {name}"))
                            .subtitle(format!("{count} session(s)"))
                            .build();
                        al.append(&row);
                    }
                    if !agents.is_empty() {
                        agent_populated = true;
                    }
                }
            } else {
                Self::set_chip_value(&hc, "Offline");
            }
            glib::ControlFlow::Continue
        });

        // Wire quick actions
        let c1 = client.clone();
        let rl1 = result_label.clone();
        probe_row.connect_activated(move |_| {
            Self::quick_action(&c1, "channels.status", serde_json::json!({"probe": true}), &rl1);
        });

        let c2 = client.clone();
        let rl2 = result_label.clone();
        reload_row.connect_activated(move |_| {
            Self::quick_action(&c2, "config.get", serde_json::json!({}), &rl2);
        });

        let c3 = client;
        let rl3 = result_label;
        cron_row.connect_activated(move |_| {
            Self::quick_action(&c3, "cron.status", serde_json::json!({}), &rl3);
        });

        Self { container }
    }

    fn build_chip(label: &str, value: &str) -> gtk4::Box {
        let chip = gtk4::Box::builder()
            .orientation(Orientation::Vertical)
            .spacing(2)
            .css_classes(vec!["card".to_string()])
            .build();
        let inner = gtk4::Box::builder()
            .orientation(Orientation::Vertical)
            .spacing(2)
            .margin_start(12)
            .margin_end(12)
            .margin_top(8)
            .margin_bottom(8)
            .build();
        inner.append(
            &gtk4::Label::builder()
                .label(label)
                .css_classes(vec!["caption".to_string(), "dim-label".to_string()])
                .halign(gtk4::Align::Start)
                .build(),
        );
        inner.append(
            &gtk4::Label::builder()
                .label(value)
                .css_classes(vec!["heading".to_string()])
                .halign(gtk4::Align::Start)
                .name("chip-value")
                .build(),
        );
        chip.append(&inner);
        chip
    }

    fn set_chip_value(chip: &gtk4::Box, value: &str) {
        if let Some(inner) = chip.first_child()
            && let Some(inner_box) = inner.downcast_ref::<gtk4::Box>()
            && let Some(first) = inner_box.first_child()
            && let Some(val_label) = first.next_sibling()
            && let Some(label) = val_label.downcast_ref::<gtk4::Label>()
        {
            label.set_label(value);
        }
    }

    fn quick_action(
        client: &SharedClient,
        method: &str,
        params: serde_json::Value,
        result_label: &gtk4::Label,
    ) {
        if let Some(gw) = client.lock().unwrap().clone() {
            let rl = result_label.clone();
            let method = method.to_string();
            rl.set_label("Running...");
            rl.set_visible(true);
            glib::spawn_future_local(async move {
                match gw.request(&method, params).await {
                    Ok(_) => {
                        rl.set_label(&format!("{method}: OK"));
                        rl.add_css_class("chip-ok");
                    }
                    Err(e) => {
                        rl.set_label(&format!("{method}: {e}"));
                        rl.add_css_class("chip-error");
                    }
                }
            });
        }
    }

    pub fn widget(&self) -> &gtk4::Box {
        &self.container
    }
}
