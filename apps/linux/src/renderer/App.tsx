import { useState, useCallback, useEffect, useRef } from "react";
import { useOnboarding } from "./hooks/useOnboarding.js";
import { useGateway } from "./hooks/useGateway.js";
import { useTts } from "./hooks/useTts.js";
import { useAutoSend } from "./hooks/useAutoSend.js";
import { useDashboard } from "./hooks/useDashboard.js";
import { useNavigation } from "./hooks/useNavigation.js";
import { useToast } from "./hooks/useToast.js";
import { useVoiceInput } from "./hooks/useVoiceInput.js";
import { useFeed } from "./hooks/useFeed.js";
import { useCron } from "./hooks/useCron.js";
import { useSearch } from "./hooks/useSearch.js";
import { useLogs, useDebugRpc } from "./hooks/useLogs.js";
import { useUsage } from "./hooks/useUsage.js";
import { useAgentManager } from "./hooks/useAgentManager.js";
import { useConfig } from "./hooks/useConfig.js";
import { useHealth } from "./hooks/useHealth.js";
import { useChannels } from "./hooks/useChannels.js";
import { useSkills } from "./hooks/useSkills.js";
import { isAudioPlaying } from "./lib/audio-player.js";
import { getStoredConfig } from "./lib/config-store.js";
import { Shell } from "./components/Shell.js";
import { ToastContainer } from "./components/Toast.js";
import { DashboardDrawer } from "./components/DashboardDrawer.js";
import type { VoicePhase } from "./components/AgentOrb.js";
import { ChatView } from "./views/ChatView.js";
import { KanbanView } from "./views/KanbanView.js";
import { CalendarView } from "./views/CalendarView.js";
import { SearchView } from "./views/SearchView.js";
import { SettingsView } from "./views/SettingsView.js";
import { MoreView } from "./views/MoreView.js";
import { LogsView } from "./views/LogsView.js";
import { UsageView } from "./views/UsageView.js";
import { AgentsView } from "./views/AgentsView.js";
import { ConfigView } from "./views/ConfigView.js";
import { ChannelsView } from "./views/ChannelsView.js";
import { SkillsView } from "./views/SkillsView.js";
import { AboutView } from "./views/AboutView.js";
import { SessionsView } from "./views/SessionsView.js";
import { OnboardingShell } from "./components/onboarding/OnboardingShell.js";
import { WelcomeStep } from "./components/onboarding/WelcomeStep.js";
import { ConnectStep } from "./components/onboarding/ConnectStep.js";
import { ReadyStep } from "./components/onboarding/ReadyStep.js";
import { ConnectingScreen } from "./screens/ConnectingScreen.js";
import { DisconnectedScreen } from "./screens/DisconnectedScreen.js";

export function App() {
  const onboarding = useOnboarding();
  const [onboardAgentName, setOnboardAgentName] = useState("Assistant");

  if (!onboarding.complete) {
    return (
      <OnboardingShell step={onboarding.step} totalSteps={3}>
        {onboarding.step === 0 && <WelcomeStep onNext={onboarding.nextStep} />}
        {onboarding.step === 1 && (
          <ConnectStep
            onNext={(name) => {
              setOnboardAgentName(name);
              onboarding.nextStep();
            }}
            onBack={onboarding.prevStep}
          />
        )}
        {onboarding.step === 2 && (
          <ReadyStep agentName={onboardAgentName} onFinish={onboarding.finish} />
        )}
      </OnboardingShell>
    );
  }

  return <ConnectedApp onResetConnection={onboarding.restart} />;
}

function ConnectedApp({ onResetConnection }: { onResetConnection: () => void }) {
  const gateway = useGateway();
  const dashboard = useDashboard(gateway.request, gateway.connected);
  const { view, navigate } = useNavigation();
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [connectTimeout, setConnectTimeout] = useState(false);
  const prevMessageCountRef = useRef(0);

  const { speakMessage, stop: stopTts } = useTts(voiceMode);

  // Voice-to-text: mic → transcription → auto-send
  const handleTranscription = useCallback(
    (text: string) => {
      stopTts();
      gateway.sendMessage(text);
    },
    [gateway.sendMessage, stopTts],
  );

  const handleVoiceError = useCallback(
    (message: string) => {
      showToast(message, "error");
    },
    [showToast],
  );

  const voiceInput = useVoiceInput({
    onTranscription: handleTranscription,
    onError: handleVoiceError,
  });

  // Data hooks — only poll when the respective view is active
  const feed = useFeed(gateway.request, gateway.connected && view === "board");
  const cron = useCron(gateway.request, gateway.connected && view === "calendar");
  const search = useSearch(gateway.request, gateway.connected && view === "search");
  const logs = useLogs(gateway.request, gateway.connected && view === "logs");
  const debugRpc = useDebugRpc(gateway.request);
  const usage = useUsage(gateway.request, gateway.connected && view === "usage");
  const agentManager = useAgentManager(gateway.request, gateway.connected && view === "agents");
  const config = useConfig(gateway.request, gateway.connected && view === "config");

  // New hooks
  const health = useHealth(gateway.request, gateway.connected);
  const channels = useChannels(gateway.request, gateway.connected && view === "channels");
  const skills = useSkills(gateway.request, gateway.connected && view === "skills");

  // Connection timeout — show disconnected screen after 10s
  useEffect(() => {
    if (gateway.connected) {
      setConnectTimeout(false);
      return;
    }
    const t = setTimeout(() => setConnectTimeout(true), 10_000);
    return () => clearTimeout(t);
  }, [gateway.connected]);

  // Auto-speak new assistant messages
  useEffect(() => {
    if (!voiceMode) {return;}
    if (gateway.messages.length > prevMessageCountRef.current) {
      const last = gateway.messages[gateway.messages.length - 1];
      if (last?.role === "assistant") {
        speakMessage(last);
      }
    }
    prevMessageCountRef.current = gateway.messages.length;
  }, [gateway.messages, voiceMode, speakMessage]);

  // Track speaking state
  useEffect(() => {
    if (!voiceMode) {return;}
    const interval = setInterval(() => {
      setSpeaking(isAudioPlaying());
    }, 200);
    return () => clearInterval(interval);
  }, [voiceMode]);

  // Auto-start recording when voice mode is enabled
  useEffect(() => {
    if (voiceMode && !voiceInput.recording && !voiceInput.transcribing && !speaking && !gateway.sending) {
      voiceInput.startRecording();
    }
  }, [voiceMode, voiceInput.recording, voiceInput.transcribing, speaking, gateway.sending]);

  // Show toast on gateway errors
  useEffect(() => {
    if (gateway.error) {
      showToast(gateway.error, "error");
    }
  }, [gateway.error, showToast]);


  const handleSend = useCallback(
    (text: string) => {
      stopTts();
      gateway.sendMessage(text);
    },
    [gateway.sendMessage, stopTts],
  );

  const handleAutoSend = useCallback(
    (text: string) => {
      stopTts();
      gateway.sendMessage(text);
    },
    [gateway.sendMessage, stopTts],
  );

  const clearRef = useRef<() => void>(() => {});
  const { onInput } = useAutoSend(voiceMode, handleAutoSend, clearRef.current, stopTts);

  const handleHandyTrigger = useCallback(() => {
    window.openclawBridge.handyTrigger().catch(() => {});
  }, []);

  const handleNewSession = useCallback(() => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    gateway.switchSession(`session:${id}`);
    navigate("chat");
  }, [gateway.switchSession, navigate]);

  // Menu IPC events from Electron app menu / tray
  useEffect(() => {
    window.openclawBridge.onMenuNavigate((v) => {
      navigate(v as import("./hooks/useNavigation.js").View);
    });
    window.openclawBridge.onMenuNewSession(() => {
      handleNewSession();
    });
  }, [navigate, handleNewSession]);

  const handleVoiceToggle = useCallback(() => {
    setVoiceMode((v) => {
      if (v) {
        // Turning off — stop any recording
        voiceInput.stopRecording();
        stopTts();
      }
      return !v;
    });
  }, [voiceInput.stopRecording, stopTts]);

  // Derive voice phase
  const voicePhase: VoicePhase = !voiceMode
    ? "idle"
    : speaking
      ? "speaking"
      : voiceInput.recording
        ? "recording"
        : voiceInput.transcribing || (gateway.sending && !gateway.streamText)
          ? "thinking"
          : "listening";

  // Show connecting screen
  if (!gateway.connected && !connectTimeout) {
    const cfg = getStoredConfig();
    return (
      <div className="flex flex-col h-screen bg-zinc-950">
        <ConnectingScreen gatewayUrl={cfg.gatewayUrl} onCancel={onResetConnection} />
      </div>
    );
  }

  // Show disconnected screen
  if (!gateway.connected && connectTimeout) {
    const cfg = getStoredConfig();
    return (
      <div className="flex flex-col h-screen bg-zinc-950">
        <DisconnectedScreen
          message={gateway.error ?? `Could not reach gateway at ${cfg.gatewayUrl}`}
          onRetry={() => {
            setConnectTimeout(false);
            window.location.reload();
          }}
          onReconfigure={onResetConnection}
        />
      </div>
    );
  }

  const storedConfig = getStoredConfig();

  // Connected — Shell with view routing
  return (
    <>
      <Shell
        view={view}
        onNavigate={navigate}
        connected={gateway.connected}
        agentName={gateway.agentName}
        agentEmoji={gateway.agentEmoji}
        agentAvatar={gateway.agentAvatar}
        agents={dashboard.agents}
        defaultAgentId={dashboard.defaultAgentId}
        sessions={dashboard.sessions}
        currentSessionKey={gateway.sessionKey}
        onSwitchSession={gateway.switchSession}
        onSwitchAgent={gateway.switchAgent}
        onNewSession={handleNewSession}
        voiceMode={voiceMode}
        voicePhase={voicePhase}
        micLevel={voiceInput.level}
        onVoiceToggle={handleVoiceToggle}
        onStopSpeaking={stopTts}
        onStopRecording={voiceInput.stopRecording}
        onHandyTrigger={handleHandyTrigger}
        onMenu={dashboard.toggle}
        healthState={health}
        sessionCount={dashboard.sessions.length}
        nodeCount={dashboard.nodes.length}
      >
        {view === "chat" && (
          <ChatView
            messages={gateway.messages}
            streamText={gateway.streamText}
            sending={gateway.sending}
            agentName={gateway.agentName}
            error={gateway.error}
            connected={gateway.connected}
            voiceMode={voiceMode}
            onSend={handleSend}
            onInputEvent={voiceMode ? onInput : undefined}
            onClearRef={(fn) => { clearRef.current = fn; }}
          />
        )}
        {view === "board" && (
          <KanbanView
            agents={dashboard.agents}
            sessions={dashboard.sessions}
            feedEntries={feed.data ?? []}
            loading={dashboard.loading}
            onRefresh={dashboard.refresh}
          />
        )}
        {view === "calendar" && (
          <CalendarView jobs={cron.data ?? []} loading={cron.loading} onRefresh={cron.refresh} />
        )}
        {view === "search" && (
          <SearchView
            query={search.query}
            results={search.results}
            loading={search.loading}
            onQueryChange={search.setQuery}
          />
        )}
        {view === "more" && (
          <MoreView
            onNavigate={navigate}
            request={gateway.request}
            connected={gateway.connected}
          />
        )}
        {view === "settings" && (
          <SettingsView
            onResetConnection={onResetConnection}
            request={gateway.request}
            connected={gateway.connected}
          />
        )}
        {view === "logs" && <LogsView logs={logs} debug={debugRpc} />}
        {view === "usage" && <UsageView {...usage} />}
        {view === "agents" && <AgentsView {...agentManager} />}
        {view === "config" && <ConfigView {...config} />}
        {view === "channels" && (
          <ChannelsView
            channels={channels.channels}
            loading={channels.loading}
            error={channels.error}
            onLogin={channels.login}
            onLogout={channels.logout}
            onRefresh={channels.refresh}
          />
        )}
        {view === "skills" && (
          <SkillsView
            skills={skills.skills}
            loading={skills.loading}
            error={skills.error}
            onInstall={skills.install}
            onRefresh={skills.refresh}
          />
        )}
        {view === "sessions" && (
          <SessionsView
            sessions={dashboard.sessions}
            currentSessionKey={gateway.sessionKey}
            onSwitchSession={(key) => { gateway.switchSession(key); navigate("chat"); }}
            onNewSession={handleNewSession}
          />
        )}
        {view === "about" && (
          <AboutView
            health={health.health}
            gatewayUrl={storedConfig.gatewayUrl}
          />
        )}
      </Shell>

      <DashboardDrawer
        open={dashboard.open}
        tab={dashboard.tab}
        agents={dashboard.agents}
        defaultAgentId={dashboard.defaultAgentId}
        sessions={dashboard.sessions}
        nodes={dashboard.nodes}
        loading={dashboard.loading}
        currentSessionKey={gateway.sessionKey}
        onTabChange={dashboard.setTab}
        onClose={dashboard.close}
        onRefresh={dashboard.refresh}
        onSelectSession={(key) => { gateway.switchSession(key); dashboard.close(); }}
        onSelectAgent={(id) => { gateway.switchAgent(id); dashboard.close(); }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
