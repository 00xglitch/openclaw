import { html, type TemplateResult } from "lit";

type IconName =
  | "shield"
  | "link"
  | "refresh"
  | "sun"
  | "moon"
  | "alert"
  | "key"
  | "spark"
  | "activity";

type IconOptions = {
  className?: string;
  title?: string;
};

function wrap(path: TemplateResult, opts?: IconOptions): TemplateResult {
  return html`
    <svg
      class="icon ${opts?.className ?? ""}"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden=${opts?.title ? "false" : "true"}
      role="img"
    >
      ${opts?.title ? html`<title>${opts.title}</title>` : null}
      ${path}
    </svg>
  `;
}

export function icon(name: IconName, opts?: IconOptions): TemplateResult {
  switch (name) {
    case "shield":
      return wrap(
        html`
          <path
            d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        `,
        opts,
      );
    case "link":
      return wrap(
        html`
          <path d="M10.5 13.5l3-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          <path
            d="M8.2 15.8l-1.8 1.8a3.2 3.2 0 104.5 4.5l1.8-1.8"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M15.8 8.2l1.8-1.8a3.2 3.2 0 10-4.5-4.5l-1.8 1.8"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        `,
        opts,
      );
    case "refresh":
      return wrap(
        html`
          <path
            d="M20 5v5h-5"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M4 19v-5h5"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M6.7 9.2A7 7 0 0118.8 7M17.3 14.8A7 7 0 015.2 17"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        `,
        opts,
      );
    case "sun":
      return wrap(
        html`
          <circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        `,
        opts,
      );
    case "moon":
      return wrap(
        html`
          <path
            d="M19.2 14.7A8.4 8.4 0 119.3 4.8a6.7 6.7 0 009.9 9.9z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        `,
        opts,
      );
    case "alert":
      return wrap(
        html`
          <path d="M12 3l9 16H3L12 3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
          <path d="M12 9v4.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          <circle cx="12" cy="16.5" r="1" fill="currentColor" />
        `,
        opts,
      );
    case "key":
      return wrap(
        html`
          <circle cx="8" cy="12" r="3" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M11 12h10M17 12v2M20 12v2"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        `,
        opts,
      );
    case "spark":
      return wrap(
        html`
          <path
            d="M12 2l1.8 4.8L19 8.6l-4 3.1 1.2 5.3L12 14.2 7.8 17l1.2-5.3-4-3.1 5.2-1.8L12 2z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        `,
        opts,
      );
    case "activity":
      return wrap(
        html`
          <path
            d="M3 12h4l2-4 4 8 2-4h6"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        `,
        opts,
      );
  }
}
