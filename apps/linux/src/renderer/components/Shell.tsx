import { type ReactNode } from "react";
import { BottomNav } from "./BottomNav.js";
import { StatusBar } from "./StatusBar.js";
import { InfoBar } from "./InfoBar.js";
import { AgentOrb, type VoicePhase } from "./AgentOrb.js";
import type { View } from "../hooks/useNavigation.js";
import type { AgentInfo, SessionInfo } from "../lib/protocol-types.js";
import type { HealthState } from "../hooks/useHealth.js";

type Props = {
  view: View;
  onNavigate: (view: View) => void;
  connected: boolean;
  agentName: string;
  agentEmoji?: string | null;
  agentAvatar: string | null;
  agents: AgentInfo[];
  defaultAgentId: string | null;
  sessions: SessionInfo[];
  currentSessionKey: string;
  onSwitchSession: (key: string) => void;
  onSwitchAgent: (agentId: string) => void;
  onNewSession?: () => void;
  voiceMode: boolean;
  voicePhase: VoicePhase;
  micLevel?: number;
  onVoiceToggle: () => void;
  onStopSpeaking: () => void;
  onStopRecording?: () => void;
  onHandyTrigger: () => void;
  onMenu: () => void;
  healthState: HealthState;
  sessionCount: number;
  nodeCount: number;
  children: ReactNode;
};

export function Shell({
  view,
  onNavigate,
  connected,
  agentName,
  agentEmoji,
  agentAvatar,
  agents,
  defaultAgentId,
  sessions,
  currentSessionKey,
  onSwitchSession,
  onSwitchAgent,
  onNewSession,
  voiceMode,
  voicePhase,
  micLevel,
  onVoiceToggle,
  onStopSpeaking,
  onStopRecording,
  onHandyTrigger,
  onMenu,
  healthState,
  sessionCount,
  nodeCount,
  children,
}: Props) {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 relative">
      <StatusBar
        connected={connected}
        agentName={agentName}
        agentEmoji={agentEmoji}
        agents={agents}
        defaultAgentId={defaultAgentId}
        sessions={sessions}
        currentSessionKey={currentSessionKey}
        onSwitchSession={onSwitchSession}
        onSwitchAgent={onSwitchAgent}
        onNewSession={onNewSession}
        onMenu={onMenu}
      />

      <InfoBar
        {...healthState}
        sessionCount={sessionCount}
        nodeCount={nodeCount}
        onNavigate={onNavigate}
      />

      <div className="flex-1 overflow-hidden">{children}</div>

      <BottomNav active={view} onNavigate={onNavigate} />

      <AgentOrb
        voiceMode={voiceMode}
        phase={voicePhase}
        agentEmoji={agentEmoji}
        agentAvatar={agentAvatar}
        agentName={agentName}
        micLevel={micLevel}
        onToggle={onVoiceToggle}
        onStopSpeaking={onStopSpeaking}
        onStopRecording={onStopRecording}
        onHandyTrigger={onHandyTrigger}
      />
    </div>
  );
}
