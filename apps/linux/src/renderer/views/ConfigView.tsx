type Props = {
  loading: boolean;
  saving: boolean;
  applying: boolean;
  error: string | null;
  success: string | null;
  raw: string;
  setRaw: (v: string) => void;
  dirty: boolean;
  valid: boolean | null;
  issues: Array<{ path: string; message: string }>;
  save: () => void;
  apply: () => void;
  reload: () => void;
};

export function ConfigView(props: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-medium">Config</span>
        <span className="text-[10px] text-zinc-600">raw JSON</span>
        <div className="flex-1" />
        {props.dirty && <span className="text-[10px] text-orange-400">unsaved</span>}
        {props.valid === false && <span className="text-[10px] text-red-400">invalid</span>}
        {props.valid === true && !props.dirty && <span className="text-[10px] text-green-500">valid</span>}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/50">
        <button
          onClick={props.save}
          disabled={props.saving || !props.dirty}
          className="text-xs px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-white transition-colors"
        >
          {props.saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={props.apply}
          disabled={props.applying || !props.dirty}
          className="text-xs px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded text-zinc-200 transition-colors"
        >
          {props.applying ? "Applying..." : "Apply"}
        </button>
        <button
          onClick={props.reload}
          disabled={props.loading}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-2"
        >
          {props.loading ? "\u23F3" : "\u21BB Reload"}
        </button>
      </div>

      {/* Messages */}
      {props.error && <div className="mx-3 mt-2 text-xs text-red-400 bg-red-950/30 rounded px-2 py-1">{props.error}</div>}
      {props.success && <div className="mx-3 mt-2 text-xs text-green-400 bg-green-950/30 rounded px-2 py-1">{props.success}</div>}

      {/* Validation issues */}
      {props.issues.length > 0 && (
        <div className="mx-3 mt-2 space-y-1">
          {props.issues.map((issue, i) => (
            <div key={i} className="text-[10px] text-yellow-400 bg-yellow-950/20 rounded px-2 py-1">
              <span className="text-yellow-500 font-mono">{issue.path}</span>: {issue.message}
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {props.loading ? (
        <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">Loading config...</div>
      ) : (
        <textarea
          value={props.raw}
          onChange={(e) => props.setRaw(e.target.value)}
          className="flex-1 bg-zinc-950 text-zinc-200 font-mono text-[11px] leading-relaxed p-3 resize-none focus:outline-none border-none"
          spellCheck={false}
          wrap="off"
        />
      )}
    </div>
  );
}
