use gtk4::{self, glib, Orientation};
use libadwaita::prelude::*;

use crate::state::SharedClient;

pub struct ConfigView {
    container: gtk4::Box,
}

impl ConfigView {
    pub fn new(client: SharedClient) -> Self {
        let container = gtk4::Box::builder()
            .orientation(Orientation::Vertical)
            .vexpand(true)
            .hexpand(true)
            .build();

        // Toolbar
        let toolbar = gtk4::Box::builder()
            .orientation(Orientation::Horizontal)
            .spacing(8)
            .margin_start(16)
            .margin_end(16)
            .margin_top(8)
            .margin_bottom(4)
            .build();

        let title = gtk4::Label::builder()
            .label("Gateway Configuration")
            .css_classes(vec!["heading".to_string()])
            .halign(gtk4::Align::Start)
            .hexpand(true)
            .build();

        let status_label = gtk4::Label::builder()
            .label("")
            .css_classes(vec!["caption".to_string(), "dim-label".to_string()])
            .valign(gtk4::Align::Center)
            .build();

        let reload_btn = gtk4::Button::builder()
            .label("Reload")
            .css_classes(vec!["flat".to_string()])
            .tooltip_text("Reload config from gateway")
            .build();

        let apply_btn = gtk4::Button::builder()
            .label("Apply")
            .css_classes(vec!["suggested-action".to_string(), "pill".to_string()])
            .tooltip_text("Apply config with hot-reload")
            .sensitive(false)
            .build();

        toolbar.append(&title);
        toolbar.append(&status_label);
        toolbar.append(&reload_btn);
        toolbar.append(&apply_btn);
        container.append(&toolbar);
        container.append(&gtk4::Separator::new(Orientation::Horizontal));

        // Config editor (plain TextView with monospace)
        let editor = gtk4::TextView::builder()
            .monospace(true)
            .wrap_mode(gtk4::WrapMode::WordChar)
            .left_margin(16)
            .right_margin(16)
            .top_margin(12)
            .bottom_margin(12)
            .vexpand(true)
            .build();

        let scroll = gtk4::ScrolledWindow::builder()
            .child(&editor)
            .vexpand(true)
            .hscrollbar_policy(gtk4::PolicyType::Automatic)
            .build();

        container.append(&scroll);

        // Validation result
        let validation_bar = gtk4::Box::builder()
            .orientation(Orientation::Horizontal)
            .spacing(8)
            .margin_start(16)
            .margin_end(16)
            .margin_top(4)
            .margin_bottom(8)
            .build();

        let valid_label = gtk4::Label::builder()
            .label("")
            .css_classes(vec!["caption".to_string()])
            .halign(gtk4::Align::Start)
            .hexpand(true)
            .build();
        validation_bar.append(&valid_label);
        container.append(&validation_bar);

        // Track config hash for conflict detection
        let config_hash = std::rc::Rc::new(std::cell::RefCell::new(String::new()));

        // Load config
        let load_config = {
            let client = client.clone();
            let editor = editor.clone();
            let status_label = status_label.clone();
            let apply_btn = apply_btn.clone();
            let config_hash = config_hash.clone();
            move || {
                if let Some(gw) = client.lock().unwrap().clone() {
                    let ed = editor.clone();
                    let sl = status_label.clone();
                    let ab = apply_btn.clone();
                    let ch = config_hash.clone();
                    glib::spawn_future_local(async move {
                        match gw.request("config.get", serde_json::json!({})).await {
                            Ok(payload) => {
                                if let Some(hash) =
                                    payload.get("hash").and_then(|h| h.as_str())
                                {
                                    *ch.borrow_mut() = hash.to_string();
                                }
                                if let Some(config) = payload.get("config") {
                                    let pretty = serde_json::to_string_pretty(config)
                                        .unwrap_or_else(|_| config.to_string());
                                    ed.buffer().set_text(&pretty);
                                    sl.set_label("Loaded");
                                    ab.set_sensitive(false);
                                } else {
                                    ed.buffer()
                                        .set_text("// No config returned from gateway");
                                    sl.set_label("Empty");
                                }
                            }
                            Err(e) => {
                                ed.buffer()
                                    .set_text(&format!("// Failed to load: {e}"));
                                sl.set_label("Error");
                            }
                        }
                    });
                }
            }
        };

        // Load on startup
        let load = load_config.clone();
        glib::timeout_add_local_once(std::time::Duration::from_secs(2), move || {
            load();
        });

        // Reload button
        let load2 = load_config;
        reload_btn.connect_clicked(move |_| {
            load2();
        });

        // Mark dirty on edit
        let ab2 = apply_btn.clone();
        let sl2 = status_label.clone();
        let vl = valid_label.clone();
        editor.buffer().connect_changed(move |buf| {
            ab2.set_sensitive(true);
            sl2.set_label("Modified");
            // Quick JSON validation
            let text = buf.text(&buf.start_iter(), &buf.end_iter(), false);
            match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(_) => {
                    vl.set_label("Valid JSON");
                    vl.remove_css_class("chip-error");
                    vl.add_css_class("chip-ok");
                }
                Err(e) => {
                    vl.set_label(&format!("Invalid: {e}"));
                    vl.remove_css_class("chip-ok");
                    vl.add_css_class("chip-error");
                }
            }
        });

        // Apply button
        let c2 = client;
        let ed2 = editor;
        let sl3 = status_label;
        let ab3 = apply_btn;
        let ch2 = config_hash;
        ab3.connect_clicked(move |btn| {
            let buf = ed2.buffer();
            let raw = buf
                .text(&buf.start_iter(), &buf.end_iter(), false)
                .to_string();

            // Validate JSON first
            if serde_json::from_str::<serde_json::Value>(&raw).is_err() {
                sl3.set_label("Cannot apply: invalid JSON");
                return;
            }

            btn.set_sensitive(false);
            sl3.set_label("Applying...");

            if let Some(gw) = c2.lock().unwrap().clone() {
                let sl = sl3.clone();
                let btn2 = btn.clone();
                let hash = ch2.borrow().clone();
                glib::spawn_future_local(async move {
                    let params = serde_json::json!({
                        "raw": raw,
                        "baseHash": hash,
                    });
                    match gw.request("config.apply", params).await {
                        Ok(_) => {
                            sl.set_label("Applied successfully");
                            btn2.set_sensitive(false);
                        }
                        Err(e) => {
                            sl.set_label(&format!("Apply failed: {e}"));
                            btn2.set_sensitive(true);
                        }
                    }
                });
            }
        });

        Self { container }
    }

    pub fn widget(&self) -> &gtk4::Box {
        &self.container
    }
}
