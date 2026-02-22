import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { icon } from "./icons.js";

@customElement("json-viewer")
export class JsonViewer extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false }) data: unknown = null;
  @property({ type: Boolean }) expanded = false;
  @property({ type: Number }) maxDepth = 3;

  @state() private _collapsed = new Set<string>();

  override connectedCallback() {
    super.connectedCallback();
    if (!this.expanded) {
      // Start collapsed at root level — user clicks to expand
    }
  }

  private _togglePath(path: string) {
    if (this._collapsed.has(path)) {
      this._collapsed.delete(path);
    } else {
      this._collapsed.add(path);
    }
    this.requestUpdate();
  }

  private _renderValue(value: unknown, depth: number, path: string): unknown {
    if (value === null) {
      return html`
        <span class="json-value json-value--null">null</span>
      `;
    }

    if (value === undefined) {
      return html`
        <span class="json-value json-value--null">undefined</span>
      `;
    }

    if (typeof value === "boolean") {
      return html`<span class="json-value json-value--boolean">${String(value)}</span>`;
    }

    if (typeof value === "number") {
      return html`<span class="json-value json-value--number">${value}</span>`;
    }

    if (typeof value === "string") {
      return html`<span class="json-value json-value--string">"${value}"</span>`;
    }

    if (Array.isArray(value)) {
      return this._renderArray(value, depth, path);
    }

    if (typeof value === "object") {
      return this._renderObject(value as Record<string, unknown>, depth, path);
    }

    return html`<span class="json-value">${JSON.stringify(value)}</span>`;
  }

  private _renderObject(obj: Record<string, unknown>, depth: number, path: string): unknown {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return html`
        <span class="json-value json-value--bracket">{}</span>
      `;
    }

    const isCollapsed =
      depth >= this.maxDepth
        ? !this._collapsed.has(path) // past maxDepth: collapsed by default, click to expand
        : this._collapsed.has(path); // within maxDepth: expanded by default, click to collapse

    const chevron = isCollapsed ? "chevronRight" : "chevronDown";

    return html`
      <span class="json-toggle" @click=${() => this._togglePath(path)}>
        ${icon(chevron, { className: "icon-xs" })}
        <span class="json-value json-value--bracket">{</span>
        ${
          isCollapsed
            ? html`<span class="json-collapsed-hint">${keys.length} keys</span><span class="json-value json-value--bracket">}</span>`
            : nothing
        }
      </span>
      ${
        !isCollapsed
          ? html`
            <div class="json-children" style="padding-left: ${(depth + 1) * 16}px">
              ${keys.map(
                (key) => html`
                  <div class="json-entry">
                    <span class="json-key">${key}</span><span class="json-colon">: </span>${this._renderValue(obj[key], depth + 1, `${path}.${key}`)}
                  </div>
                `,
              )}
            </div>
            <div style="padding-left: ${depth * 16}px">
              <span class="json-value json-value--bracket">}</span>
            </div>
          `
          : nothing
      }
    `;
  }

  private _renderArray(arr: unknown[], depth: number, path: string): unknown {
    if (arr.length === 0) {
      return html`
        <span class="json-value json-value--bracket">[]</span>
      `;
    }

    const isCollapsed =
      depth >= this.maxDepth ? !this._collapsed.has(path) : this._collapsed.has(path);

    const chevron = isCollapsed ? "chevronRight" : "chevronDown";

    return html`
      <span class="json-toggle" @click=${() => this._togglePath(path)}>
        ${icon(chevron, { className: "icon-xs" })}
        <span class="json-value json-value--bracket">[</span>
        ${
          isCollapsed
            ? html`<span class="json-collapsed-hint">${arr.length} items</span><span class="json-value json-value--bracket">]</span>`
            : nothing
        }
      </span>
      ${
        !isCollapsed
          ? html`
            <div class="json-children" style="padding-left: ${(depth + 1) * 16}px">
              ${arr.map(
                (item, i) => html`
                  <div class="json-entry">
                    <span class="json-key json-key--index">${i}</span><span class="json-colon">: </span>${this._renderValue(item, depth + 1, `${path}[${i}]`)}
                  </div>
                `,
              )}
            </div>
            <div style="padding-left: ${depth * 16}px">
              <span class="json-value json-value--bracket">]</span>
            </div>
          `
          : nothing
      }
    `;
  }

  override render() {
    return html`
      <div class="json-viewer">
        ${this._renderValue(this.data, 0, "$")}
      </div>
    `;
  }
}
