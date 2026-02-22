import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import "../components/confirm-dialog.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadCronJobs, loadCronStatus } from "../controllers/cron.js";
import type { CronJob, CronStatusSummary } from "../types/dashboard.js";

type CronRunEntry = {
  id?: string;
  jobId?: string;
  startedAtMs?: number;
  durationMs?: number;
  status?: string;
  error?: string;
  sessionKey?: string;
};

@customElement("cron-view")
export class CronView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private jobs: CronJob[] = [];
  @state() private status: CronStatusSummary | null = null;
  @state() private selectedJobId: string | null = null;
  @state() private runs: CronRunEntry[] = [];
  @state() private error = "";
  @state() private filterText = "";
  @state() private deleteConfirmId: string | null = null;
  @state() private editingJobId: string | null = null;
  @state() private editForm = {
    name: "",
    scheduleKind: "every" as "every" | "at" | "cron",
    everyMs: "3600000",
    cronExpr: "",
    payloadText: "",
    enabled: true,
  };

  // New job form
  @state() private showForm = false;
  @state() private formName = "";
  @state() private formScheduleKind: "every" | "at" | "cron" = "every";
  @state() private formEveryMs = "3600000";
  @state() private formCronExpr = "0 * * * *";
  @state() private formPayloadKind: "systemEvent" | "agentTurn" = "systemEvent";
  @state() private formPayloadText = "";
  @state() private formEnabled = true;

  private lastConnectedState: boolean | null = null;

  override updated(): void {
    const connected = this.gateway?.connected ?? false;
    if (connected && this.lastConnectedState !== true) {
      void this.refresh();
    }
    this.lastConnectedState = connected;
  }

  private async refresh(): Promise<void> {
    if (!this.gateway?.connected || this.loading) {
      return;
    }
    this.loading = true;
    this.error = "";
    try {
      const [jobs, status] = await Promise.allSettled([
        loadCronJobs(this.gateway.request, { includeDisabled: true }),
        loadCronStatus(this.gateway.request),
      ]);
      if (jobs.status === "fulfilled") {
        this.jobs = jobs.value;
      }
      if (status.status === "fulfilled") {
        this.status = status.value;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async toggleJob(job: CronJob): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("cron.update", { id: job.id, enabled: !job.enabled });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async runJobNow(jobId: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("cron.run", { id: jobId });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private confirmRemoveJob(jobId: string): void {
    this.deleteConfirmId = jobId;
  }

  private async removeJob(jobId: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("cron.remove", { id: jobId });
      if (this.selectedJobId === jobId) {
        this.selectedJobId = null;
      }
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private startEditing(job: CronJob): void {
    if (this.editingJobId === job.id) {
      this.editingJobId = null;
      return;
    }
    this.editingJobId = job.id;
    const scheduleKind = job.schedule.kind;
    this.editForm = {
      name: job.name,
      scheduleKind,
      everyMs: scheduleKind === "every" ? String(job.schedule.everyMs) : "3600000",
      cronExpr: scheduleKind === "cron" ? job.schedule.expr : "",
      payloadText: job.payload.kind === "systemEvent" ? job.payload.text : job.payload.message,
      enabled: job.enabled,
    };
  }

  private async updateJob(): Promise<void> {
    if (!this.gateway?.connected || !this.editingJobId) {
      return;
    }
    const updates: Record<string, unknown> = {
      id: this.editingJobId,
      name: this.editForm.name,
      enabled: this.editForm.enabled,
    };
    switch (this.editForm.scheduleKind) {
      case "every":
        updates.schedule = { kind: "every", everyMs: Number(this.editForm.everyMs) };
        break;
      case "cron":
        updates.schedule = { kind: "cron", expr: this.editForm.cronExpr };
        break;
      case "at":
        updates.schedule = { kind: "at", at: new Date().toISOString() };
        break;
    }
    try {
      await this.gateway.request("cron.update", updates);
      this.editingJobId = null;
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private get filteredJobs(): CronJob[] {
    if (!this.filterText.trim()) {
      return this.jobs;
    }
    const q = this.filterText.toLowerCase();
    return this.jobs.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        (job.agentId ?? "").toLowerCase().includes(q) ||
        this.formatSchedule(job).toLowerCase().includes(q),
    );
  }

  private async loadRuns(jobId: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    this.selectedJobId = jobId;
    try {
      const result = await this.gateway.request<{ runs: CronRunEntry[] }>("cron.runs", {
        id: jobId,
        limit: 20,
      });
      this.runs = result?.runs ?? [];
    } catch {
      this.runs = [];
    }
  }

  private async addJob(): Promise<void> {
    if (!this.gateway?.connected || !this.formName.trim()) {
      return;
    }
    let schedule: Record<string, unknown>;
    switch (this.formScheduleKind) {
      case "every":
        schedule = { kind: "every", everyMs: Number(this.formEveryMs) };
        break;
      case "cron":
        schedule = { kind: "cron", expr: this.formCronExpr };
        break;
      default:
        schedule = { kind: "at", at: new Date().toISOString() };
    }
    const payload =
      this.formPayloadKind === "systemEvent"
        ? { kind: "systemEvent", text: this.formPayloadText }
        : { kind: "agentTurn", message: this.formPayloadText };

    try {
      await this.gateway.request("cron.add", {
        name: this.formName,
        schedule,
        payload,
        enabled: this.formEnabled,
      });
      this.showForm = false;
      this.formName = "";
      this.formPayloadText = "";
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private formatSchedule(job: CronJob): string {
    const s = job.schedule;
    if (s.kind === "every") {
      return `Every ${(s.everyMs / 1000 / 60).toFixed(0)}m`;
    }
    if (s.kind === "cron") {
      return `Cron: ${s.expr}`;
    }
    if (s.kind === "at") {
      return `At: ${s.at}`;
    }
    return "Unknown";
  }

  private formatTime(ms?: number): string {
    if (!ms) {
      return "—";
    }
    return new Date(ms).toLocaleString();
  }

  override render() {
    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("loader", { className: "icon-sm" })} Cron</h2>
          <div class="view-actions">
            <button class="btn-ghost" @click=${() => {
              this.showForm = !this.showForm;
            }}>
              ${icon("plus", { className: "icon-xs" })} New Job
            </button>
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        <div class="view-toolbar" style="margin-bottom:0.75rem;">
          <input type="text" class="view-search" placeholder="Filter by name, agent, or schedule..."
            .value=${this.filterText}
            @input=${(e: Event) => {
              this.filterText = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        <!-- Status Card -->
        ${
          this.status
            ? html`
          <div class="glass-dashboard-card" style="margin-bottom:1rem;">
            <div class="stats-row">
              <div class="stat-card">
                <div class="stat-label">Scheduler</div>
                <div class="stat-value ${this.status.enabled ? "stat-value--ok" : "stat-value--warn"}">
                  ${this.status.enabled ? "Running" : "Stopped"}
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Jobs</div>
                <div class="stat-value">${this.status.jobs}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Next Wake</div>
                <div class="stat-value">${this.status.nextWakeAtMs ? this.formatTime(this.status.nextWakeAtMs) : "—"}</div>
              </div>
            </div>
          </div>
        `
            : nothing
        }

        <!-- New Job Form -->
        ${
          this.showForm
            ? html`
          <div class="glass-dashboard-card" style="margin-bottom:1rem;">
            <div class="card-header">
              <h3 class="card-header__title">New Cron Job</h3>
            </div>
            <div class="cron-form">
              <label>Name <input type="text" .value=${this.formName} @input=${(e: Event) => {
                this.formName = (e.target as HTMLInputElement).value;
              }} placeholder="my-job" /></label>
              <label>Schedule
                <select .value=${this.formScheduleKind} @change=${(e: Event) => {
                  this.formScheduleKind = (e.target as HTMLSelectElement).value as
                    | "every"
                    | "at"
                    | "cron";
                }}>
                  <option value="every">Every (interval)</option>
                  <option value="cron">Cron expression</option>
                  <option value="at">At (one-time)</option>
                </select>
              </label>
              ${
                this.formScheduleKind === "every"
                  ? html`
                <label>Interval (ms) <input type="number" .value=${this.formEveryMs} @input=${(
                  e: Event,
                ) => {
                  this.formEveryMs = (e.target as HTMLInputElement).value;
                }} /></label>
              `
                  : nothing
              }
              ${
                this.formScheduleKind === "cron"
                  ? html`
                <label>Cron expr <input type="text" .value=${this.formCronExpr} @input=${(
                  e: Event,
                ) => {
                  this.formCronExpr = (e.target as HTMLInputElement).value;
                }} placeholder="0 * * * *" /></label>
                <div class="muted" style="font-size:0.75rem;">
                  Every minute: * * * * * · Every hour: 0 * * * * · Daily at midnight: 0 0 * * * · Every Monday: 0 0 * * 1
                </div>
              `
                  : nothing
              }
              <label>Payload type
                <select .value=${this.formPayloadKind} @change=${(e: Event) => {
                  this.formPayloadKind = (e.target as HTMLSelectElement).value as
                    | "systemEvent"
                    | "agentTurn";
                }}>
                  <option value="systemEvent">System Event</option>
                  <option value="agentTurn">Agent Turn</option>
                </select>
              </label>
              <label>Payload text <textarea rows="2" .value=${this.formPayloadText} @input=${(
                e: Event,
              ) => {
                this.formPayloadText = (e.target as HTMLTextAreaElement).value;
              }} placeholder="Message or event text"></textarea></label>
              <label class="view-checkbox"><input type="checkbox" .checked=${this.formEnabled} @change=${(
                e: Event,
              ) => {
                this.formEnabled = (e.target as HTMLInputElement).checked;
              }} /> Enabled</label>
              <div style="display:flex;gap:8px;">
                <button class="btn-primary" @click=${() => void this.addJob()}>Create</button>
                <button class="btn-ghost" @click=${() => {
                  this.showForm = false;
                }}>Cancel</button>
              </div>
            </div>
          </div>
        `
            : nothing
        }

        <!-- Jobs List -->
        ${
          this.loading && this.jobs.length === 0
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Loading...</div>`
            : nothing
        }

        <div class="cron-jobs">
          ${this.filteredJobs.map(
            (job) => html`
            <div class="glass-dashboard-card cron-job-card ${this.selectedJobId === job.id ? "cron-job-card--selected" : ""}">
              <div class="cron-job-header">
                <div class="cron-job-info">
                  <span class="cron-job-name" style="cursor:pointer;text-decoration:underline dotted;" @click=${() => this.startEditing(job)}>${job.name}</span>
                  <span class="chip ${job.enabled ? "chip--success" : "chip--muted"}">${job.enabled ? "enabled" : "disabled"}</span>
                  ${
                    job.state.lastStatus
                      ? html`
                    <span class="chip ${job.state.lastStatus === "ok" ? "chip--success" : job.state.lastStatus === "error" ? "chip--warn" : "chip--muted"}">
                      ${job.state.lastStatus}
                    </span>
                  `
                      : nothing
                  }
                  ${job.agentId ? html`<span class="chip">${job.agentId}</span>` : nothing}
                </div>
                <div class="cron-job-actions">
                  <button class="btn-ghost-sm" @click=${() => void this.toggleJob(job)} title="${job.enabled ? "Disable" : "Enable"}">
                    ${job.enabled ? icon("eyeOff", { className: "icon-xs" }) : icon("eye", { className: "icon-xs" })}
                  </button>
                  <button class="btn-ghost-sm" @click=${() => void this.runJobNow(job.id)} title="Run now">
                    ${icon("zap", { className: "icon-xs" })}
                  </button>
                  <button class="btn-ghost-sm" @click=${() => void this.loadRuns(job.id)} title="View runs">
                    ${icon("clock", { className: "icon-xs" })}
                  </button>
                  <button class="btn-ghost-sm" @click=${() => this.confirmRemoveJob(job.id)} title="Delete">
                    ${icon("x", { className: "icon-xs" })}
                  </button>
                </div>
              </div>
              <div class="cron-job-meta muted" style="font-size:0.82rem;">
                ${this.formatSchedule(job)}
                ${job.state.nextRunAtMs ? ` · Next: ${this.formatTime(job.state.nextRunAtMs)}` : ""}
                ${job.state.lastRunAtMs ? ` · Last: ${this.formatTime(job.state.lastRunAtMs)}` : ""}
                ${job.state.lastError ? html` · <span style="color:var(--warn)">${job.state.lastError}</span>` : nothing}
              </div>
              ${
                this.editingJobId === job.id
                  ? html`
                <div class="cron-form" style="margin-top:0.75rem;border-top:1px solid var(--border);padding-top:0.75rem;">
                  <label>Name <input type="text" .value=${this.editForm.name} @input=${(
                    e: Event,
                  ) => {
                    this.editForm = {
                      ...this.editForm,
                      name: (e.target as HTMLInputElement).value,
                    };
                  }} /></label>
                  <label>Schedule
                    <select .value=${this.editForm.scheduleKind} @change=${(e: Event) => {
                      this.editForm = {
                        ...this.editForm,
                        scheduleKind: (e.target as HTMLSelectElement).value as
                          | "every"
                          | "at"
                          | "cron",
                      };
                    }}>
                      <option value="every">Every (interval)</option>
                      <option value="cron">Cron expression</option>
                      <option value="at">At (one-time)</option>
                    </select>
                  </label>
                  ${
                    this.editForm.scheduleKind === "every"
                      ? html`
                    <label>Interval (ms) <input type="number" .value=${this.editForm.everyMs} @input=${(
                      e: Event,
                    ) => {
                      this.editForm = {
                        ...this.editForm,
                        everyMs: (e.target as HTMLInputElement).value,
                      };
                    }} /></label>
                  `
                      : nothing
                  }
                  ${
                    this.editForm.scheduleKind === "cron"
                      ? html`
                    <label>Cron expr <input type="text" .value=${this.editForm.cronExpr} @input=${(
                      e: Event,
                    ) => {
                      this.editForm = {
                        ...this.editForm,
                        cronExpr: (e.target as HTMLInputElement).value,
                      };
                    }} placeholder="0 * * * *" /></label>
                    <div class="muted" style="font-size:0.75rem;">
                      Every minute: * * * * * · Every hour: 0 * * * * · Daily at midnight: 0 0 * * * · Every Monday: 0 0 * * 1
                    </div>
                  `
                      : nothing
                  }
                  <label>Payload text <textarea rows="2" .value=${this.editForm.payloadText} @input=${(
                    e: Event,
                  ) => {
                    this.editForm = {
                      ...this.editForm,
                      payloadText: (e.target as HTMLTextAreaElement).value,
                    };
                  }}></textarea></label>
                  <label class="view-checkbox"><input type="checkbox" .checked=${this.editForm.enabled} @change=${(
                    e: Event,
                  ) => {
                    this.editForm = {
                      ...this.editForm,
                      enabled: (e.target as HTMLInputElement).checked,
                    };
                  }} /> Enabled</label>
                  <div style="display:flex;gap:8px;">
                    <button class="btn-primary" @click=${() => void this.updateJob()}>Update</button>
                    <button class="btn-ghost" @click=${() => {
                      this.editingJobId = null;
                    }}>Cancel</button>
                  </div>
                </div>
              `
                  : nothing
              }
            </div>
          `,
          )}

          ${
            this.jobs.length === 0 && !this.loading
              ? html`
                  <div class="glass-dashboard-card">
                    <p class="muted">No cron jobs configured.</p>
                  </div>
                `
              : nothing
          }
        </div>

        <!-- Run History -->
        ${
          this.selectedJobId && this.runs.length > 0
            ? html`
          <div class="glass-dashboard-card" style="margin-top:1rem;">
            <div class="card-header">
              <span class="card-header__prefix">${icon("clock", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Run History</h3>
            </div>
            <div class="view-table-wrap">
              <table class="view-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Session</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.runs.map(
                    (r) => html`
                    <tr>
                      <td class="muted">${this.formatTime(r.startedAtMs)}</td>
                      <td>${r.durationMs != null ? `${r.durationMs}ms` : "—"}</td>
                      <td><span class="chip ${r.status === "ok" ? "chip--success" : "chip--warn"}">${r.status ?? "—"}</span></td>
                      <td class="muted">${r.sessionKey ?? "—"}</td>
                      <td style="color:var(--warn)">${r.error ?? ""}</td>
                    </tr>
                  `,
                  )}
                </tbody>
              </table>
            </div>
          </div>
        `
            : nothing
        }

        <confirm-dialog
          .open=${this.deleteConfirmId !== null}
          title="Delete Cron Job"
          message="Are you sure you want to delete this cron job? This action cannot be undone."
          confirmLabel="Delete"
          confirmVariant="danger"
          @confirm=${() => {
            if (this.deleteConfirmId) {
              void this.removeJob(this.deleteConfirmId);
            }
            this.deleteConfirmId = null;
          }}
          @cancel=${() => {
            this.deleteConfirmId = null;
          }}
        ></confirm-dialog>
      </div>
    `;
  }
}
