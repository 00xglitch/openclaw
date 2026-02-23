import { useState, useCallback, useEffect, useRef } from "react";
import type { AgentInfo, AgentFileEntry, AgentIdentityFull, SkillStatusReport } from "../lib/protocol-types.js";

export type AgentPanel = "overview" | "files" | "skills";

export function useAgentManager(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<AgentPanel>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Files state
  const [files, setFiles] = useState<AgentFileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileDraft, setFileDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Identity state
  const [identity, setIdentity] = useState<AgentIdentityFull | null>(null);

  // Skills state
  const [skills, setSkills] = useState<SkillStatusReport | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");

  const requestRef = useRef(request);
  requestRef.current = request;
  const loadedRef = useRef(false);

  // Load agents list
  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestRef.current<{ defaultId?: string; agents?: AgentInfo[] }>("agents.list", {});
      const list = res.agents ?? [];
      setAgents(list);
      setDefaultId(res.defaultId ?? null);
      if (!selectedId && list.length > 0) {
        setSelectedId(res.defaultId ?? list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (enabled && !loadedRef.current) {
      loadedRef.current = true;
      loadAgents();
    }
    if (!enabled) {loadedRef.current = false;}
  }, [enabled, loadAgents]);

  // Load identity when agent changes
  useEffect(() => {
    if (!enabled || !selectedId) {return;}
    setIdentity(null);
    requestRef.current<AgentIdentityFull>("agent.identity.get", { agentId: selectedId })
      .then(setIdentity)
      .catch(() => {});
  }, [enabled, selectedId]);

  // Load files when files panel is active
  const loadFiles = useCallback(async () => {
    if (!selectedId) {return;}
    setFilesLoading(true);
    try {
      const res = await requestRef.current<{ files?: AgentFileEntry[] }>("agents.files.list", { agentId: selectedId });
      setFiles(res.files ?? []);
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (enabled && panel === "files" && selectedId) {loadFiles();}
  }, [enabled, panel, selectedId, loadFiles]);

  // Open file
  const openFile = useCallback(async (name: string) => {
    if (!selectedId) {return;}
    setActiveFile(name);
    try {
      const res = await requestRef.current<{ file?: { content?: string } }>("agents.files.get", { agentId: selectedId, name });
      const content = res.file?.content ?? "";
      setFileContent(content);
      setFileDraft(content);
    } catch {
      setFileContent("");
      setFileDraft("");
    }
  }, [selectedId]);

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedId || !activeFile) {return;}
    setSaving(true);
    try {
      await requestRef.current("agents.files.set", { agentId: selectedId, name: activeFile, content: fileDraft });
      setFileContent(fileDraft);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [selectedId, activeFile, fileDraft, loadFiles]);

  // Load skills
  const loadSkills = useCallback(async () => {
    if (!selectedId) {return;}
    setSkillsLoading(true);
    try {
      const res = await requestRef.current<SkillStatusReport>("skills.status", { agentId: selectedId });
      setSkills(res);
    } catch {
      setSkills(null);
    } finally {
      setSkillsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (enabled && panel === "skills" && selectedId) {loadSkills();}
  }, [enabled, panel, selectedId, loadSkills]);

  const selectAgent = useCallback((id: string) => {
    setSelectedId(id);
    setActiveFile(null);
    setFileContent("");
    setFileDraft("");
    setFiles([]);
    setSkills(null);
  }, []);

  return {
    agents,
    defaultId,
    selectedId,
    selectAgent,
    panel,
    setPanel,
    loading,
    error,
    // Identity
    identity,
    // Files
    files,
    filesLoading,
    activeFile,
    fileContent,
    fileDraft,
    setFileDraft,
    openFile,
    saveFile,
    saving,
    fileDirty: fileDraft !== fileContent,
    closeFile: () => { setActiveFile(null); setFileContent(""); setFileDraft(""); },
    // Skills
    skills,
    skillsLoading,
    skillFilter,
    setSkillFilter,
    // Actions
    refresh: loadAgents,
  };
}
