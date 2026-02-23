import type { AgentInfo, AgentFileEntry, AgentIdentityFull, SkillStatusReport } from "../lib/protocol-types.js";
import type { AgentPanel } from "../hooks/useAgentManager.js";

type Props = {
  agents: AgentInfo[];
  defaultId: string | null;
  selectedId: string | null;
  selectAgent: (id: string) => void;
  panel: AgentPanel;
  setPanel: (p: AgentPanel) => void;
  loading: boolean;
  error: string | null;
  identity: AgentIdentityFull | null;
  files: AgentFileEntry[];
  filesLoading: boolean;
  activeFile: string | null;
  fileContent: string;
  fileDraft: string;
  setFileDraft: (v: string) => void;
  openFile: (name: string) => void;
  saveFile: () => void;
  saving: boolean;
  fileDirty: boolean;
  closeFile: () => void;
  skills: SkillStatusReport | null;
  skillsLoading: boolean;
  skillFilter: string;
  setSkillFilter: (v: string) => void;
  refresh: () => void;
};

const panels: { key: AgentPanel; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "files", label: "Files" },
  { key: "skills", label: "Skills" },
];

function OverviewPanel({ identity, agent, defaultId }: { identity: AgentIdentityFull | null; agent: AgentInfo | undefined; defaultId: string | null }) {
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3 bg-zinc-900 rounded-lg p-3 border border-zinc-800">
        <span className="text-3xl">{identity?.emoji ?? agent?.identity?.emoji ?? "\uD83E\uDD16"}</span>
        <div>
          <div className="text-sm font-semibold text-zinc-200">{identity?.name ?? agent?.identity?.name ?? agent?.id}</div>
          <div className="text-[11px] text-zinc-500">ID: {agent?.id}{agent?.id === defaultId ? " (default)" : ""}</div>
        </div>
      </div>
      {identity?.theme && (
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase mb-1">Theme</div>
          <div className="text-xs text-zinc-300">{identity.theme}</div>
        </div>
      )}
      {identity?.instructions && (
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase mb-1">Instructions</div>
          <div className="text-xs text-zinc-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{identity.instructions}</div>
        </div>
      )}
    </div>
  );
}

function FilesPanel(props: Props) {
  if (props.activeFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
          <button onClick={props.closeFile} className="text-zinc-500 hover:text-zinc-300 text-xs">\u2190</button>
          <span className="text-xs text-zinc-300 font-mono truncate flex-1">{props.activeFile}</span>
          {props.fileDirty && <span className="text-[10px] text-orange-400">modified</span>}
          <button
            onClick={props.saveFile}
            disabled={props.saving || !props.fileDirty}
            className="text-xs px-2 py-0.5 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-white transition-colors"
          >
            {props.saving ? "..." : "Save"}
          </button>
        </div>
        <textarea
          value={props.fileDraft}
          onChange={(e) => props.setFileDraft(e.target.value)}
          className="flex-1 bg-zinc-950 text-zinc-200 font-mono text-[11px] leading-relaxed p-3 resize-none focus:outline-none"
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1">
      {props.filesLoading && <div className="text-xs text-zinc-600">Loading files...</div>}
      {!props.filesLoading && props.files.length === 0 && (
        <div className="text-xs text-zinc-600">No agent files</div>
      )}
      {props.files.map((f) => (
        <button
          key={f.name}
          onClick={() => props.openFile(f.name)}
          className="w-full text-left flex items-center gap-2 px-3 py-2 rounded bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/50 transition-colors"
        >
          <span className="text-zinc-500 text-xs">\uD83D\uDCC4</span>
          <span className="text-xs text-zinc-300 font-mono truncate flex-1">{f.name}</span>
          {f.size != null && <span className="text-[10px] text-zinc-600">{f.size}B</span>}
        </button>
      ))}
    </div>
  );
}

function SkillsPanel(props: Props) {
  const all = [
    ...(props.skills?.eligible ?? []),
    ...(props.skills?.missing ?? []),
    ...(props.skills?.blocked ?? []),
  ];
  const lower = props.skillFilter.toLowerCase();
  const filtered = lower ? all.filter((s) => s.name.toLowerCase().includes(lower)) : all;

  return (
    <div className="p-3 space-y-2">
      <input
        type="text"
        placeholder="Filter skills..."
        value={props.skillFilter}
        onChange={(e) => props.setSkillFilter(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
      />
      {props.skillsLoading && <div className="text-xs text-zinc-600">Loading skills...</div>}
      {!props.skillsLoading && filtered.length === 0 && (
        <div className="text-xs text-zinc-600">No skills found</div>
      )}
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {filtered.map((s) => (
          <div key={s.name} className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-900/50 border border-zinc-800/50">
            <span className={`w-2 h-2 rounded-full shrink-0 ${s.enabled ? "bg-green-500" : "bg-zinc-600"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-300 truncate">{s.name}</div>
              {s.description && <div className="text-[10px] text-zinc-600 truncate">{s.description}</div>}
            </div>
            {s.version && <span className="text-[10px] text-zinc-700">{s.version}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentsView(props: Props) {
  const selectedAgent = props.agents.find((a) => a.id === props.selectedId);

  return (
    <div className="flex flex-col h-full">
      {/* Agent selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-800 overflow-x-auto">
        {props.agents.map((a) => {
          const isActive = a.id === props.selectedId;
          return (
            <button
              key={a.id}
              onClick={() => props.selectAgent(a.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0 transition-colors border ${
                isActive
                  ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <span>{a.identity?.emoji ?? "\uD83E\uDD16"}</span>
              <span>{a.identity?.name ?? a.name ?? a.id}</span>
            </button>
          );
        })}
        <button onClick={props.refresh} className="text-xs text-zinc-600 hover:text-zinc-400 px-1 shrink-0" title="Refresh">
          {props.loading ? "\u23F3" : "\u21BB"}
        </button>
      </div>

      {/* Panel tabs */}
      <div className="flex border-b border-zinc-800">
        {panels.map((p) => (
          <button
            key={p.key}
            onClick={() => props.setPanel(p.key)}
            className={`flex-1 text-xs py-2 transition-colors ${
              props.panel === p.key
                ? "text-orange-400 border-b-2 border-orange-400"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {props.error && <div className="mx-3 mt-2 text-xs text-red-400 bg-red-950/30 rounded px-2 py-1">{props.error}</div>}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {props.panel === "overview" && <OverviewPanel identity={props.identity} agent={selectedAgent} defaultId={props.defaultId} />}
        {props.panel === "files" && <FilesPanel {...props} />}
        {props.panel === "skills" && <SkillsPanel {...props} />}
      </div>
    </div>
  );
}
