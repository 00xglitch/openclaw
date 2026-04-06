use gtk4::{self, glib, Orientation};
use libadwaita as adw;
use libadwaita::prelude::*;

use crate::state::SharedClient;

/// Onboarding view with gateway URL/token entry.
pub struct OnboardingView {
    container: gtk4::Box,
}

impl OnboardingView {
    pub fn new(
        client: SharedClient,
        on_connected: impl Fn() + 'static,
    ) -> Self {
        let container = gtk4::Box::builder()
            .orientation(Orientation::Vertical)
            .valign(gtk4::Align::Center)
            .halign(gtk4::Align::Center)
            .spacing(24)
            .margin_start(48)
            .margin_end(48)
            .margin_top(48)
            .margin_bottom(48)
            .vexpand(true)
            .hexpand(true)
            .build();

        let title = gtk4::Label::builder()
            .label("OpenClaw")
            .css_classes(vec!["title-1".to_string()])
            .build();

        let subtitle = gtk4::Label::builder()
            .label("Connect to your OpenClaw gateway")
            .css_classes(vec!["dim-label".to_string()])
            .build();

        container.append(&title);
        container.append(&subtitle);

        // Connection form
        let form_group = adw::PreferencesGroup::builder()
            .title("Gateway Connection")
            .build();

        let url_row = adw::EntryRow::builder()
            .title("Gateway URL")
            .text("wss://127.0.0.1:18789")
            .build();

        let token_row = adw::PasswordEntryRow::builder()
            .title("Token (optional)")
            .build();

        form_group.add(&url_row);
        form_group.add(&token_row);

        let form_clamp = adw::Clamp::builder()
            .maximum_size(420)
            .child(&form_group)
            .build();

        container.append(&form_clamp);

        // Status
        let status_label = gtk4::Label::builder()
            .label("")
            .css_classes(vec!["dim-label".to_string()])
            .visible(false)
            .build();
        container.append(&status_label);

        // Connect button
        let connect_btn = gtk4::Button::builder()
            .label("Connect")
            .css_classes(vec!["suggested-action".to_string(), "pill".to_string()])
            .halign(gtk4::Align::Center)
            .build();

        container.append(&connect_btn);

        let sl = status_label.clone();
        let on_connected = std::rc::Rc::new(on_connected);
        connect_btn.connect_clicked(move |btn| {
            let url_text = url_row.text().to_string();
            let token_text = token_row.text().to_string();

            if url_text.is_empty() {
                sl.set_label("Please enter a gateway URL");
                sl.set_visible(true);
                return;
            }

            // SAFETY: single-threaded GTK main loop, no concurrent env access
            unsafe {
                std::env::set_var("OPENCLAW_GATEWAY_URL", &url_text);
                if !token_text.is_empty() {
                    std::env::set_var("OPENCLAW_GATEWAY_TOKEN", &token_text);
                }
            }

            btn.set_sensitive(false);
            sl.set_label("Connecting...");
            sl.set_visible(true);
            sl.remove_css_class("error");

            let on_connected = on_connected.clone();
            let sl2 = sl.clone();
            let btn2 = btn.clone();
            let client_check = client.clone();
            glib::timeout_add_local(std::time::Duration::from_secs(3), move || {
                let connected = client_check.lock().unwrap().is_some();
                if connected {
                    (on_connected)();
                } else {
                    sl2.set_label("Connection failed — check URL and try again");
                    sl2.add_css_class("error");
                    btn2.set_sensitive(true);
                }
                glib::ControlFlow::Break
            });
        });

        Self { container }
    }

    pub fn widget(&self) -> &gtk4::Box {
        &self.container
    }
}
