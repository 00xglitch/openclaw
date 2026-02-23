import { createElement, Fragment, type ReactNode } from "react";

/**
 * Lightweight markdown to React elements.
 * Handles: code fences, inline code, bold, italic, paragraphs.
 * Uses createElement only — no innerHTML.
 */
export function renderMarkdown(text: string): ReactNode {
  const fenceParts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  const elements: ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < fenceParts.length; i++) {
    if (i % 3 === 0) {
      const paragraphs = fenceParts[i].split(/\n{2,}/);
      for (const para of paragraphs) {
        if (!para.trim()) {continue;}
        elements.push(
          createElement("p", { key: key++, className: "msg-markdown-p" }, renderInline(para.trim())),
        );
      }
    } else if (i % 3 === 1) {
      // Language hint (skip)
    } else {
      elements.push(
        createElement(
          "pre",
          { key: key++, className: "bg-zinc-900 rounded-lg px-3 py-2 my-2 overflow-x-auto text-xs" },
          createElement("code", { className: "text-zinc-300" }, fenceParts[i]),
        ),
      );
    }
  }

  return createElement(Fragment, null, ...elements);
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let key = 0;
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(renderLineBreaks(text.slice(lastIndex, match.index), key++));
    }

    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        createElement(
          "code",
          { key: key++, className: "bg-zinc-800 px-1 py-0.5 rounded text-orange-300 text-[0.85em]" },
          token.slice(1, -1),
        ),
      );
    } else if (token.startsWith("**")) {
      nodes.push(createElement("strong", { key: key++, className: "font-semibold" }, token.slice(2, -2)));
    } else if (token.startsWith("*")) {
      nodes.push(createElement("em", { key: key++ }, token.slice(1, -1)));
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(renderLineBreaks(text.slice(lastIndex), key++));
  }

  return nodes;
}

function renderLineBreaks(text: string, baseKey: number): ReactNode {
  const lines = text.split("\n");
  if (lines.length === 1) {return text;}

  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) {nodes.push(createElement("br", { key: `${baseKey}-br-${i}` }));}
    if (line) {nodes.push(line);}
  });
  return createElement(Fragment, { key: baseKey }, ...nodes);
}
