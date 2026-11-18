import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  MAX_FILE_SIZE_BYTES,
  type AccessPolicy,
  type AnalysisResult,
  type ApiError,
  type ClusterId,
  type CreateItemInput,
  type CreateSessionInput,
  type DemoState,
  type ItemKind,
  type OpinionItem,
  type Session,
} from "@bmps/contracts";
import { createFallbackState } from "./demo-state.js";

type ConnectionState = "connecting" | "connected" | "local";
type ViewMode = "map" | "feed";
type InsightTab = "analysis" | "activity";
type ToastTone = "success" | "error" | "info";

type IconName =
  | "activity"
  | "arrow"
  | "check"
  | "chevron"
  | "clock"
  | "download"
  | "external"
  | "file"
  | "globe"
  | "heart"
  | "help"
  | "layers"
  | "link"
  | "list"
  | "lock"
  | "map"
  | "menu"
  | "message"
  | "more"
  | "panel"
  | "plus"
  | "reset"
  | "search"
  | "send"
  | "share"
  | "sparkles"
  | "text"
  | "trash"
  | "upload"
  | "users"
  | "x";

const CLUSTERS: Array<{
  id: ClusterId;
  label: string;
  eyebrow: string;
  color: string;
  number: string;
}> = [
  { id: "discover", label: "문제 발견", eyebrow: "OBSERVE", color: "#ee6c5f", number: "01" },
  { id: "experience", label: "핵심 경험", eyebrow: "IMAGINE", color: "#3976e8", number: "02" },
  { id: "action", label: "실행 아이디어", eyebrow: "MAKE", color: "#16a085", number: "03" },
];

function makeId(prefix: string): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${randomPart}`;
}

function formatFileSize(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_048_576) return `${Math.round(size / 1_024)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "방금 전";
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`;
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function cloneState(state: DemoState): DemoState {
  return structuredClone(state);
}

function touchState(state: DemoState): DemoState {
  state.generatedAt = new Date().toISOString();
  return state;
}

function addSessionLocally(state: DemoState, input: CreateSessionInput): DemoState {
  const next = cloneState(state);
  next.sessions.unshift({
    id: makeId("session"),
    title: input.title,
    topic: input.topic,
    accessPolicy: input.accessPolicy,
    hostId: next.currentParticipant.id,
    accent: ["#6c5ce7", "#16a085", "#ee8b3a", "#3976e8"][next.sessions.length % 4]!,
    createdAt: new Date().toISOString(),
    participants: [{ ...next.currentParticipant }],
    items: [],
    analyses: [],
    cursor: 1,
  });
  return touchState(next);
}

function addItemLocally(state: DemoState, sessionId: string, input: CreateItemInput): DemoState {
  const next = cloneState(state);
  const session = next.sessions.find((entry) => entry.id === sessionId);
  if (!session) return state;
  const participant = next.currentParticipant;
  const file = input.kind === "FILE"
    ? {
        ...input.file,
        previewable: input.file.mimeType.startsWith("image/") || input.file.mimeType === "application/pdf",
      }
    : null;
  session.items.push({
    id: makeId("item"),
    sessionId,
    kind: input.kind,
    authorId: participant.id,
    authorName: participant.name,
    authorColor: participant.color,
    content: input.content,
    url: input.kind === "LINK" ? input.url : null,
    file,
    cluster: input.cluster ?? "action",
    createdAt: new Date().toISOString(),
    reactions: { agree: 0, curious: 0 },
  });
  session.cursor += 1;
  return touchState(next);
}

function deleteItemLocally(state: DemoState, sessionId: string, itemId: string): DemoState {
  const next = cloneState(state);
  const session = next.sessions.find((entry) => entry.id === sessionId);
  if (!session) return state;
  session.items = session.items.filter((entry) => entry.id !== itemId);
  session.cursor += 1;
  return touchState(next);
}

function analyseLocally(state: DemoState, sessionId: string): DemoState {
  const next = cloneState(state);
  const session = next.sessions.find((entry) => entry.id === sessionId);
  if (!session || session.items.length === 0) return state;

  const strongest = [...session.items].sort((a, b) => b.reactions.agree - a.reactions.agree).slice(0, 3);
  const actionItems = session.items.filter((entry) => entry.cluster === "action");
  const candidateItems = actionItems.length >= 2 ? actionItems.slice(-3) : strongest;
  const analysis: AnalysisResult = {
    id: makeId("analysis"),
    sessionId,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    snapshotItemIds: session.items.map((entry) => entry.id),
    flowSummary: `${session.items.length}개 의견에서 문제 발견, 경험 구상, 실행 제안의 흐름이 보입니다. 공감이 모인 의견을 가장 작은 현장 실험으로 좁혀볼 수 있습니다.`,
    linkCandidates: candidateItems.length >= 2
      ? [
          {
            id: makeId("link"),
            itemIds: candidateItems.map((entry) => entry.id),
            label: "참여자가 함께 주목한 실행 신호",
            rationale: "비슷한 목적의 의견이 반복되고 반응도 높아 하나의 실험 가설로 연결할 수 있습니다.",
            confidence: 88,
          },
        ]
      : [],
    directions: [
      {
        id: makeId("direction"),
        title: "2주 안에 검증하는 작은 실험",
        description: "가장 반응이 높은 제안 하나를 선택하고 관찰할 지표를 정해 짧게 실행합니다.",
        score: 91,
      },
      {
        id: makeId("direction"),
        title: "참여자 공동 프로토타입",
        description: "연결된 의견을 한 장의 시나리오로 묶고 참여자가 우선순위를 정합니다.",
        score: 83,
      },
      {
        id: makeId("direction"),
        title: "빈틈을 찾는 추가 인터뷰",
        description: "의견이 갈리는 지점을 질문으로 바꾸고 다음 참여자에게 확인합니다.",
        score: 76,
      },
    ],
    prompt: {
      id: makeId("prompt"),
      question: "가장 작은 현장 실험부터 구체화할까요?",
      options: ["좋아요", "조금 더 논의", "다른 방향"],
      votes: { "좋아요": 0, "조금 더 논의": 0, "다른 방향": 0 },
      currentParticipantVote: null,
    },
  };
  session.analyses.push(analysis);
  session.cursor += 1;
  return touchState(next);
}

function voteLocally(state: DemoState, analysisId: string, option: string): DemoState {
  const next = cloneState(state);
  for (const session of next.sessions) {
    const analysis = session.analyses.find((entry) => entry.id === analysisId);
    if (!analysis) continue;
    const previous = analysis.prompt.currentParticipantVote;
    if (previous) analysis.prompt.votes[previous] = Math.max(0, (analysis.prompt.votes[previous] ?? 1) - 1);
    analysis.prompt.votes[option] = (analysis.prompt.votes[option] ?? 0) + 1;
    analysis.prompt.currentParticipantVote = option;
    session.cursor += 1;
    break;
  }
  return touchState(next);
}

function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  let content: ReactNode;
  switch (name) {
    case "plus":
      content = <><path d="M12 5v14M5 12h14" /></>;
      break;
    case "search":
      content = <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>;
      break;
    case "users":
      content = <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>;
      break;
    case "share":
      content = <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>;
      break;
    case "map":
      content = <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>;
      break;
    case "list":
      content = <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>;
      break;
    case "sparkles":
      content = <><path d="m12 3-1.2 3.1a4 4 0 0 1-2.3 2.3L5.5 9.5l3 1.2a4 4 0 0 1 2.3 2.3l1.2 3.1 1.2-3.1a4 4 0 0 1 2.3-2.3l3-1.2-3-1.1a4 4 0 0 1-2.3-2.3L12 3Z" /><path d="m19 16-.5 1.3a2 2 0 0 1-1.1 1.1l-1.4.5 1.4.5a2 2 0 0 1 1.1 1.1L19 22l.5-1.5a2 2 0 0 1 1.1-1.1l1.4-.5-1.4-.5a2 2 0 0 1-1.1-1.1L19 16Z" /></>;
      break;
    case "lock":
      content = <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>;
      break;
    case "globe":
      content = <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>;
      break;
    case "reset":
      content = <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>;
      break;
    case "menu":
      content = <><path d="M4 7h16M4 12h16M4 17h16" /></>;
      break;
    case "x":
      content = <><path d="m6 6 12 12M18 6 6 18" /></>;
      break;
    case "text":
      content = <><path d="M5 4h14M12 4v16M8 20h8" /></>;
      break;
    case "link":
      content = <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>;
      break;
    case "file":
      content = <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>;
      break;
    case "send":
      content = <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>;
      break;
    case "trash":
      content = <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" /></>;
      break;
    case "heart":
      content = <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></>;
      break;
    case "help":
      content = <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.3c-1 .6-1.7 1.1-1.7 2.2M12 17h.01" /></>;
      break;
    case "clock":
      content = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>;
      break;
    case "activity":
      content = <><path d="M3 12h4l2-6 4 12 2-6h6" /></>;
      break;
    case "panel":
      content = <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>;
      break;
    case "chevron":
      content = <><path d="m9 18 6-6-6-6" /></>;
      break;
    case "upload":
      content = <><path d="M12 16V3M7 8l5-5 5 5" /><path d="M20 15v5H4v-5" /></>;
      break;
    case "external":
      content = <><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>;
      break;
    case "download":
      content = <><path d="M12 3v13M7 11l5 5 5-5M5 21h14" /></>;
      break;
    case "check":
      content = <><path d="m5 12 4 4L19 6" /></>;
      break;
    case "message":
      content = <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></>;
      break;
    case "arrow":
      content = <><path d="M5 12h14M14 7l5 5-5 5" /></>;
      break;
    case "layers":
      content = <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>;
      break;
    case "more":
      content = <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>;
      break;
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {content}
    </svg>
  );
}

export function App() {
  const [data, setData] = useState<DemoState>(() => createFallbackState());
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [selectedSessionId, setSelectedSessionId] = useState("session-festival");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [insightTab, setInsightTab] = useState<InsightTab>("analysis");
  const [insightOpen, setInsightOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<OpinionItem | null>(null);
  const [search, setSearch] = useState("");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (message: string, tone: ToastTone = "success") => {
    setToast({ message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3_200);
  };

  useEffect(() => {
    let active = true;
    fetch("/api/state")
      .then(async (response) => {
        if (!response.ok) throw new Error("Demo API unavailable");
        return response.json() as Promise<DemoState>;
      })
      .then((next) => {
        if (!active) return;
        setData(next);
        setConnection("connected");
      })
      .catch(() => {
        if (!active) return;
        setConnection("local");
      });
    return () => {
      active = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!data.sessions.some((session) => session.id === selectedSessionId) && data.sessions[0]) {
      setSelectedSessionId(data.sessions[0].id);
    }
  }, [data.sessions, selectedSessionId]);

  const session = data.sessions.find((entry) => entry.id === selectedSessionId) ?? data.sessions[0];
  const latestAnalysis = session?.analyses[session.analyses.length - 1] ?? null;
  const selectedItem = session?.items.find((entry) => entry.id === selectedItemId) ?? null;
  const filteredItems = useMemo(() => {
    if (!session) return [];
    const query = search.trim().toLocaleLowerCase("ko-KR");
    if (!query) return session.items;
    return session.items.filter((entry) =>
      [entry.content, entry.authorName, entry.url ?? "", entry.file?.name ?? ""]
        .some((value) => value.toLocaleLowerCase("ko-KR").includes(query)),
    );
  }, [search, session]);

  async function mutate(
    endpoint: string,
    init: RequestInit,
    localFallback: (current: DemoState) => DemoState,
  ): Promise<DemoState> {
    if (connection === "connected") {
      try {
        const response = await fetch(endpoint, {
          ...init,
          headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        });
        const payload = (await response.json()) as DemoState | ApiError;
        if (!response.ok) {
          throw new Error("message" in payload ? payload.message : "요청을 처리하지 못했습니다.");
        }
        const next = payload as DemoState;
        setData(next);
        return next;
      } catch (error) {
        if (error instanceof Error && !error.message.includes("fetch")) {
          notify(error.message, "error");
          throw error;
        }
        setConnection("local");
        notify("서버 연결이 끊겨 로컬 데모 모드로 전환했습니다.", "info");
      }
    }

    const next = localFallback(data);
    setData(next);
    return next;
  }

  if (!session) {
    return <div className="fatal-empty">표시할 세션이 없습니다.</div>;
  }

  const onlineCount = session.participants.filter((participant) => participant.online).length;

  const selectSession = (id: string) => {
    setSelectedSessionId(id);
    setSelectedItemId(null);
    setSearch("");
    setMobileSidebarOpen(false);
  };

  const handleCreateSession = async (input: CreateSessionInput) => {
    const next = await mutate(
      "/api/sessions",
      { method: "POST", body: JSON.stringify(input) },
      (current) => addSessionLocally(current, input),
    );
    const created = next.sessions[0];
    if (created) selectSession(created.id);
    setCreateSessionOpen(false);
    notify("새 세션을 만들었습니다.");
  };

  const handleAddItem = async (input: CreateItemInput): Promise<boolean> => {
    try {
      const next = await mutate(
        `/api/sessions/${session.id}/items`,
        { method: "POST", body: JSON.stringify(input) },
        (current) => addItemLocally(current, session.id, input),
      );
      const updatedSession = next.sessions.find((entry) => entry.id === session.id);
      const created = updatedSession?.items[updatedSession.items.length - 1];
      if (created) setSelectedItemId(created.id);
      notify("의견이 맵에 추가되었습니다.");
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("이 의견을 삭제할까요? 데모 초기화로 다시 복원할 수 있습니다.")) return;
    try {
      await mutate(
        `/api/sessions/${session.id}/items/${itemId}`,
        { method: "DELETE" },
        (current) => deleteItemLocally(current, session.id, itemId),
      );
      if (selectedItemId === itemId) setSelectedItemId(null);
      notify("의견을 삭제했습니다.", "info");
    } catch {
      // The API error is already shown by mutate.
    }
  };

  const handleAnalyse = async () => {
    if (session.items.length === 0) {
      notify("분석할 의견을 먼저 추가해 주세요.", "error");
      return;
    }
    setIsAnalysing(true);
    setInsightOpen(true);
    setInsightTab("analysis");
    await new Promise((resolve) => setTimeout(resolve, 850));
    try {
      await mutate(
        `/api/sessions/${session.id}/analyses`,
        { method: "POST" },
        (current) => analyseLocally(current, session.id),
      );
      notify("새 분석이 준비되었습니다.");
    } catch {
      // The API error is already shown by mutate.
    } finally {
      setIsAnalysing(false);
    }
  };

  const handleVote = async (analysisId: string, option: string) => {
    try {
      await mutate(
        `/api/analyses/${analysisId}/reactions`,
        { method: "POST", body: JSON.stringify({ option }) },
        (current) => voteLocally(current, analysisId, option),
      );
      notify("의견을 반영했습니다.");
    } catch {
      // The API error is already shown by mutate.
    }
  };

  const handleInvite = async () => {
    const link = `${window.location.origin}/join/${session.id}`;
    try {
      await navigator.clipboard.writeText(link);
      notify("초대 링크를 복사했습니다.");
    } catch {
      notify(`초대 링크: ${link}`, "info");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("추가한 데모 내용을 지우고 처음 상태로 되돌릴까요?")) return;
    try {
      const next = await mutate(
        "/api/reset",
        { method: "POST" },
        () => createFallbackState(),
      );
      setSelectedSessionId(next.sessions[0]?.id ?? "session-festival");
      setSelectedItemId(null);
      notify("데모 데이터를 초기화했습니다.", "info");
    } catch {
      // The API error is already shown by mutate.
    }
  };

  return (
    <div className={`app-frame ${mobileSidebarOpen ? "sidebar-is-open" : ""}`}>
      <aside className="sidebar" aria-label="세션 탐색">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>BMPS</strong>
            <span>Think better, together.</span>
          </div>
        </div>

        <div className="sidebar-section-heading">
          <span>워크스페이스</span>
          <button className="icon-button sidebar-add" onClick={() => setCreateSessionOpen(true)} aria-label="새 세션 만들기">
            <Icon name="plus" size={16} />
          </button>
        </div>

        <nav className="session-list">
          {data.sessions.map((entry) => {
            const active = entry.id === session.id;
            const latest = entry.items[entry.items.length - 1];
            return (
              <button
                className={`session-nav-item ${active ? "active" : ""}`}
                key={entry.id}
                onClick={() => selectSession(entry.id)}
              >
                <span className="session-accent" style={{ background: entry.accent }} />
                <span className="session-nav-copy">
                  <strong>{entry.title}</strong>
                  <span>{latest ? formatTime(latest.createdAt) : "아직 의견 없음"}</span>
                </span>
                <span className="session-count">{entry.items.length}</span>
              </button>
            );
          })}
        </nav>

        <button className="new-session-button" onClick={() => setCreateSessionOpen(true)}>
          <Icon name="plus" size={17} />
          새 브레인스토밍
        </button>

        <div className="demo-guide">
          <span className="demo-guide-label"><Icon name="sparkles" size={13} /> 빠른 시연</span>
          <strong>의견을 하나 추가해 보세요</strong>
          <p>AI가 기존 의견과 연결해 다음 방향을 제안합니다.</p>
          <span className="demo-step"><b>1</b> 추가 <i /> <b>2</b> 분석 <i /> <b>3</b> 투표</span>
        </div>

        <div className="sidebar-footer">
          <div className="connection-row">
            <span className={`connection-dot ${connection}`} />
            <span>{connection === "connected" ? "데모 서버 연결됨" : connection === "connecting" ? "연결 확인 중" : "로컬 데모 모드"}</span>
          </div>
          <div className="profile-row">
            <span className="avatar current" style={{ background: data.currentParticipant.color }}>나</span>
            <span className="profile-copy"><strong>{data.currentParticipant.name}</strong><small>익명 참여자</small></span>
            <button className="icon-button dark" onClick={handleReset} aria-label="데모 초기화" title="데모 초기화">
              <Icon name="reset" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setMobileSidebarOpen(false)} />

      <main className="workspace">
        <header className="topbar">
          <div className="title-group">
            <button className="icon-button mobile-menu" onClick={() => setMobileSidebarOpen(true)} aria-label="세션 메뉴 열기">
              <Icon name="menu" />
            </button>
            <div>
              <div className="title-line">
                <h1>{session.title}</h1>
                <span className={`access-badge ${session.accessPolicy.toLowerCase()}`}>
                  <Icon name={session.accessPolicy === "PUBLIC" ? "globe" : "lock"} size={12} />
                  {session.accessPolicy === "PUBLIC" ? "공개" : "링크 전용"}
                </span>
              </div>
              <p>{session.topic}</p>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="save-state"><Icon name="check" size={14} /> 모든 변경사항 저장됨</div>
            <div className="participant-stack" aria-label={`${onlineCount}명 온라인`}>
              {session.participants.slice(0, 4).map((participant) => (
                <span className="avatar" key={participant.id} style={{ background: participant.color }} title={participant.name}>
                  {participant.initials}
                </span>
              ))}
              {session.participants.length > 4 && <span className="avatar overflow">+{session.participants.length - 4}</span>}
            </div>
            <span className="online-copy"><b>{onlineCount}</b>명 참여 중</span>
            <button className="primary-button invite-button" onClick={handleInvite}>
              <Icon name="share" size={16} /> 초대
            </button>
          </div>
        </header>

        <div className="view-toolbar">
          <div className="segmented-control" aria-label="보기 방식">
            <button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}>
              <Icon name="map" size={16} /> 마인드맵
            </button>
            <button className={viewMode === "feed" ? "active" : ""} onClick={() => setViewMode("feed")}>
              <Icon name="list" size={16} /> 타임라인
            </button>
          </div>
          <div className="toolbar-divider" />
          <label className="search-box">
            <Icon name="search" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="의견 검색" aria-label="의견 검색" />
            {search && <button onClick={() => setSearch("")} aria-label="검색어 지우기"><Icon name="x" size={13} /></button>}
          </label>
          <div className="toolbar-spacer" />
          <span className="item-total"><b>{session.items.length}</b>개의 의견</span>
          <button
            className={`panel-toggle ${insightOpen ? "active" : ""}`}
            onClick={() => setInsightOpen((open) => !open)}
            aria-pressed={insightOpen}
          >
            <Icon name="panel" size={16} /> 인사이트 패널
          </button>
        </div>

        <div className={`workspace-grid ${insightOpen ? "" : "insight-closed"}`}>
          <section className="board-panel" aria-label="브레인스토밍 보드">
            <div className="board-heading">
              <div>
                <span className="eyebrow"><span className="live-pulse" /> LIVE BOARD</span>
                <h2>{viewMode === "map" ? "아이디어가 연결되는 흐름" : "모든 의견을 시간순으로"}</h2>
              </div>
              <div className="board-heading-actions">
                <span className="last-update"><Icon name="clock" size={14} /> 방금 동기화</span>
                <button className="analyse-button compact" onClick={handleAnalyse} disabled={isAnalysing || session.items.length === 0}>
                  <Icon name="sparkles" size={15} /> {isAnalysing ? "분석 중…" : "AI로 다시 분석"}
                </button>
              </div>
            </div>

            <div className="board-content">
              {viewMode === "map" ? (
                <MindMap
                  session={session}
                  items={filteredItems}
                  selectedItemId={selectedItemId}
                  currentParticipantId={data.currentParticipant.id}
                  onSelect={setSelectedItemId}
                  onDelete={handleDeleteItem}
                  onPreview={setPreviewItem}
                />
              ) : (
                <FeedView
                  session={session}
                  items={filteredItems}
                  selectedItemId={selectedItemId}
                  currentParticipantId={data.currentParticipant.id}
                  onSelect={setSelectedItemId}
                  onDelete={handleDeleteItem}
                  onPreview={setPreviewItem}
                />
              )}
            </div>

            <Composer sessionId={session.id} onSubmit={handleAddItem} />
          </section>

          {insightOpen && (
            <InsightPanel
              session={session}
              analysis={latestAnalysis}
              selectedItem={selectedItem}
              tab={insightTab}
              isAnalysing={isAnalysing}
              onTabChange={setInsightTab}
              onAnalyse={handleAnalyse}
              onVote={handleVote}
              onSelectItem={setSelectedItemId}
              onClose={() => setInsightOpen(false)}
            />
          )}
        </div>
      </main>

      {createSessionOpen && (
        <CreateSessionModal onClose={() => setCreateSessionOpen(false)} onCreate={handleCreateSession} />
      )}
      {previewItem?.file && (
        <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

interface ItemViewProps {
  session: Session;
  items: OpinionItem[];
  selectedItemId: string | null;
  currentParticipantId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (item: OpinionItem) => void;
}

function MindMap(props: ItemViewProps) {
  const { session, items, selectedItemId, currentParticipantId, onSelect, onDelete, onPreview } = props;
  if (session.items.length === 0) {
    return (
      <div className="board-empty">
        <div className="empty-orbit"><span /><span /><span /><Icon name="sparkles" size={26} /></div>
        <span className="empty-kicker">첫 번째 생각을 기다리고 있어요</span>
        <h3>작은 의견 하나에서 시작해 보세요</h3>
        <p>아래 입력창에 생각을 남기면 이 공간에 연결 지도가 만들어집니다.</p>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="search-empty"><Icon name="search" size={24} /><strong>일치하는 의견이 없습니다</strong><span>다른 검색어를 입력해 보세요.</span></div>;
  }

  return (
    <div className="map-viewport">
      <div className="map-canvas">
        <div className="topic-node">
          <span className="topic-node-icon"><Icon name="layers" size={18} /></span>
          <div><small>OUR QUESTION</small><strong>{session.topic}</strong></div>
          <span className="topic-node-count">{session.items.length}</span>
        </div>
        <svg className="map-connectors" viewBox="0 0 1000 145" preserveAspectRatio="none" aria-hidden="true">
          <path d="M500 10 C500 86 168 44 168 142" />
          <path d="M500 10 C500 70 500 70 500 142" />
          <path d="M500 10 C500 86 832 44 832 142" />
          <circle cx="168" cy="142" r="4" />
          <circle cx="500" cy="142" r="4" />
          <circle cx="832" cy="142" r="4" />
        </svg>
        <div className="cluster-grid">
          {CLUSTERS.map((cluster) => {
            const entries = items.filter((entry) => entry.cluster === cluster.id);
            return (
              <section className="cluster-column" key={cluster.id} style={{ "--cluster-color": cluster.color } as React.CSSProperties}>
                <div className="cluster-heading">
                  <span className="cluster-number">{cluster.number}</span>
                  <span className="cluster-title"><small>{cluster.eyebrow}</small><strong>{cluster.label}</strong></span>
                  <span className="cluster-count">{entries.length}</span>
                </div>
                <div className="idea-stack">
                  {entries.map((entry) => (
                    <IdeaCard
                      item={entry}
                      key={entry.id}
                      compact
                      selected={entry.id === selectedItemId}
                      canDelete={entry.authorId === currentParticipantId || session.hostId === currentParticipantId}
                      onSelect={() => onSelect(entry.id)}
                      onDelete={() => onDelete(entry.id)}
                      onPreview={() => onPreview(entry)}
                    />
                  ))}
                  {entries.length === 0 && <div className="cluster-empty"><Icon name="plus" size={15} /> 의견을 추가해 보세요</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeedView(props: ItemViewProps) {
  const { session, items, selectedItemId, currentParticipantId, onSelect, onDelete, onPreview } = props;
  if (session.items.length === 0) {
    return (
      <div className="board-empty feed-empty">
        <div className="empty-orbit"><span /><span /><span /><Icon name="message" size={26} /></div>
        <h3>아직 등록된 의견이 없습니다</h3>
        <p>아래에서 첫 의견을 작성해 주세요.</p>
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="search-empty"><Icon name="search" size={24} /><strong>일치하는 의견이 없습니다</strong></div>;
  }
  return (
    <div className="feed-view">
      <div className="feed-date"><span>오늘</span></div>
      {[...items].reverse().map((entry) => (
        <div className="feed-row" key={entry.id}>
          <span className="avatar feed-avatar" style={{ background: entry.authorColor }}>{entry.authorName.slice(-1)}</span>
          <div className="feed-copy">
            <span><strong>{entry.authorName}</strong><small>{formatTime(entry.createdAt)}</small></span>
            <IdeaCard
              item={entry}
              selected={entry.id === selectedItemId}
              canDelete={entry.authorId === currentParticipantId || session.hostId === currentParticipantId}
              onSelect={() => onSelect(entry.id)}
              onDelete={() => onDelete(entry.id)}
              onPreview={() => onPreview(entry)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface IdeaCardProps {
  item: OpinionItem;
  selected: boolean;
  compact?: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPreview: () => void;
}

function IdeaCard({ item, selected, compact = false, canDelete, onSelect, onDelete, onPreview }: IdeaCardProps) {
  return (
    <article
      className={`idea-card ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      <div className="idea-card-top">
        <span className="idea-author"><i style={{ background: item.authorColor }} />{item.authorName}</span>
        <span className={`kind-pill ${item.kind.toLowerCase()}`}>
          <Icon name={item.kind === "TEXT" ? "text" : item.kind === "LINK" ? "link" : "file"} size={11} />
          {item.kind === "TEXT" ? "의견" : item.kind === "LINK" ? "링크" : "파일"}
        </span>
      </div>
      <p className="idea-content">{item.content || (item.file ? item.file.name : "설명 없는 파일")}</p>
      {item.url && (
        <a className="link-preview" href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          <span className="link-favicon"><Icon name="globe" size={14} /></span>
          <span><small>REFERENCE</small><strong>{getDomain(item.url)}</strong></span>
          <Icon name="external" size={13} />
        </a>
      )}
      {item.file && (
        <button className="file-preview" onClick={(event) => { event.stopPropagation(); onPreview(); }}>
          <span className="file-type">{item.file.name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE"}</span>
          <span><strong>{item.file.name}</strong><small>{formatFileSize(item.file.size)} · {item.file.previewable ? "미리보기" : "다운로드"}</small></span>
          <Icon name={item.file.previewable ? "chevron" : "download"} size={14} />
        </button>
      )}
      <div className="idea-card-footer">
        <span>{formatTime(item.createdAt)}</span>
        <span className="idea-reactions">
          {item.reactions.agree > 0 && <span><Icon name="heart" size={12} /> {item.reactions.agree}</span>}
          {item.reactions.curious > 0 && <span><Icon name="help" size={12} /> {item.reactions.curious}</span>}
        </span>
        {canDelete && (
          <button className="delete-idea" aria-label="의견 삭제" title="의견 삭제" onClick={(event) => { event.stopPropagation(); onDelete(); }}>
            <Icon name="trash" size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

function Composer({ sessionId, onSubmit }: { sessionId: string; onSubmit: (input: CreateItemInput) => Promise<boolean> }) {
  const [mode, setMode] = useState<ItemKind>("TEXT");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [cluster, setCluster] = useState<ClusterId>("action");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContent("");
    setUrl("");
    setFile(null);
    setError(null);
  }, [sessionId]);

  const switchMode = (nextMode: ItemKind) => {
    setMode(nextMode);
    setError(null);
    if (nextMode !== "FILE") setFile(null);
  };

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setError("파일은 20 MB 이하만 올릴 수 있습니다.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(selected);
    setError(null);
  };

  const canSubmit = mode === "TEXT"
    ? content.trim().length > 0
    : mode === "LINK"
      ? content.trim().length > 0 && /^https?:\/\//i.test(url)
      : file !== null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    let input: CreateItemInput;
    if (mode === "TEXT") {
      input = { kind: "TEXT", content: content.trim(), cluster };
    } else if (mode === "LINK") {
      input = { kind: "LINK", content: content.trim(), url: url.trim(), cluster };
    } else {
      if (!file) {
        setSubmitting(false);
        return;
      }
      input = {
        kind: "FILE",
        content: content.trim(),
        cluster,
        file: { name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" },
      };
    }
    const success = await onSubmit(input);
    if (success) {
      setContent("");
      setUrl("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setSubmitting(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form className="composer" ref={formRef} onSubmit={submit}>
      <div className="composer-modes" aria-label="의견 형식">
        <button type="button" className={mode === "TEXT" ? "active" : ""} onClick={() => switchMode("TEXT")}><Icon name="text" size={14} /> 텍스트</button>
        <button type="button" className={mode === "LINK" ? "active" : ""} onClick={() => switchMode("LINK")}><Icon name="link" size={14} /> 링크</button>
        <button type="button" className={mode === "FILE" ? "active" : ""} onClick={() => switchMode("FILE")}><Icon name="file" size={14} /> 파일</button>
      </div>
      <div className="composer-main">
        <span className="avatar composer-avatar">나</span>
        <div className="composer-fields">
          {mode === "LINK" && (
            <div className="url-input-row"><Icon name="link" size={15} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https:// 참고 링크 주소" aria-label="링크 주소" /></div>
          )}
          {mode === "FILE" && !file && (
            <button type="button" className="file-drop-button" onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload" size={18} /> <span><strong>파일 선택</strong><small>모든 형식 · 최대 20 MB</small></span>
            </button>
          )}
          {mode === "FILE" && file && (
            <div className="selected-file">
              <span className="selected-file-icon"><Icon name="file" size={17} /></span>
              <span><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span>
              <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="파일 선택 취소"><Icon name="x" size={14} /></button>
            </div>
          )}
          <input ref={fileInputRef} className="visually-hidden" type="file" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "TEXT" ? "생각을 자유롭게 남겨보세요…" : mode === "LINK" ? "이 링크를 공유하는 이유를 적어주세요…" : "파일에 대한 설명을 덧붙여 주세요 (선택)"}
            rows={mode === "TEXT" ? 2 : 1}
            aria-label="의견 내용"
          />
          {error && <span className="composer-error">{error}</span>}
        </div>
        <button type="submit" className="send-button" disabled={!canSubmit || submitting} aria-label="의견 보내기">
          {submitting ? <span className="button-spinner" /> : <Icon name="send" size={18} />}
        </button>
      </div>
      <div className="composer-footer">
        <label>연결 위치
          <select value={cluster} onChange={(event) => setCluster(event.target.value as ClusterId)}>
            {CLUSTERS.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
          </select>
        </label>
        <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd>로 보내기</span>
      </div>
    </form>
  );
}

interface InsightPanelProps {
  session: Session;
  analysis: AnalysisResult | null;
  selectedItem: OpinionItem | null;
  tab: InsightTab;
  isAnalysing: boolean;
  onTabChange: (tab: InsightTab) => void;
  onAnalyse: () => void;
  onVote: (analysisId: string, option: string) => void;
  onSelectItem: (itemId: string) => void;
  onClose: () => void;
}

function InsightPanel(props: InsightPanelProps) {
  const { session, analysis, selectedItem, tab, isAnalysing, onTabChange, onAnalyse, onVote, onSelectItem, onClose } = props;
  return (
    <aside className="insight-panel" aria-label="인사이트 패널">
      <div className="insight-header">
        <div className="insight-tabs">
          <button className={tab === "analysis" ? "active" : ""} onClick={() => onTabChange("analysis")}>
            <Icon name="sparkles" size={15} /> AI 인사이트
          </button>
          <button className={tab === "activity" ? "active" : ""} onClick={() => onTabChange("activity")}>
            <Icon name="activity" size={15} /> 활동
          </button>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="인사이트 패널 닫기"><Icon name="x" size={17} /></button>
      </div>

      {tab === "analysis" ? (
        <div className="insight-scroll">
          {selectedItem && (
            <div className="selected-context">
              <span style={{ background: selectedItem.authorColor }} />
              <div><small>선택한 의견</small><strong>{selectedItem.content || selectedItem.file?.name}</strong></div>
              <button onClick={() => onSelectItem(selectedItem.id)} aria-label="선택 의견으로 이동"><Icon name="arrow" size={14} /></button>
            </div>
          )}

          {isAnalysing ? (
            <AnalysisSkeleton />
          ) : analysis ? (
            <>
              <div className="analysis-hero">
                <span className="ai-orb"><Icon name="sparkles" size={18} /></span>
                <div><span>BMPS SYNTHESIS</span><strong>{analysis.snapshotItemIds.length}개 의견 분석 완료</strong><small>{formatTime(analysis.createdAt)}</small></div>
              </div>

              <section className="insight-section summary-section">
                <div className="section-label"><span>요약</span><i /></div>
                <p>{analysis.flowSummary}</p>
              </section>

              <section className="insight-section">
                <div className="section-title-row">
                  <div className="section-label"><span>연결 가능성</span><i /></div>
                  <small>{analysis.linkCandidates.length}개 발견</small>
                </div>
                {analysis.linkCandidates.length > 0 ? analysis.linkCandidates.map((candidate) => (
                  <div className="connection-card" key={candidate.id}>
                    <div className="connection-card-top">
                      <div className="linked-dots">
                        {candidate.itemIds.slice(0, 3).map((itemId, index) => {
                          const linkedItem = session.items.find((entry) => entry.id === itemId);
                          return <button key={itemId} style={{ background: linkedItem?.authorColor ?? "#8892a8", zIndex: 4 - index }} onClick={() => onSelectItem(itemId)} aria-label="연결 의견 선택">{index + 1}</button>;
                        })}
                      </div>
                      <span className="confidence">{candidate.confidence}% 일치</span>
                    </div>
                    <strong>{candidate.label}</strong>
                    <p>{candidate.rationale}</p>
                    <button className="text-action" onClick={() => candidate.itemIds[0] && onSelectItem(candidate.itemIds[0])}>연결된 의견 보기 <Icon name="arrow" size={13} /></button>
                  </div>
                )) : <div className="mini-empty">의견이 더 모이면 연결 후보를 찾을 수 있어요.</div>}
              </section>

              <section className="insight-section direction-section">
                <div className="section-title-row">
                  <div className="section-label"><span>추천 방향</span><i /></div>
                  <small>실행 가능성 순</small>
                </div>
                <div className="direction-list">
                  {analysis.directions.map((direction, index) => (
                    <div className={`direction-card ${index === 0 ? "best" : ""}`} key={direction.id}>
                      <span className="direction-rank">{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{direction.title}</strong><p>{direction.description}</p></div>
                      <span className="direction-score">{direction.score}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="vote-card">
                <span className="vote-eyebrow"><Icon name="message" size={13} /> 함께 결정하기</span>
                <strong>{analysis.prompt.question}</strong>
                <div className="vote-options">
                  {analysis.prompt.options.map((option) => {
                    const selected = analysis.prompt.currentParticipantVote === option;
                    return (
                      <button className={selected ? "selected" : ""} key={option} onClick={() => onVote(analysis.id, option)}>
                        <span>{selected && <Icon name="check" size={12} />}{option}</span>
                        <b>{analysis.prompt.votes[option] ?? 0}</b>
                      </button>
                    );
                  })}
                </div>
              </section>

              <button className="analyse-button full" onClick={onAnalyse}>
                <Icon name="sparkles" size={16} /> 현재 의견으로 다시 분석
              </button>
              <p className="analysis-note"><Icon name="lock" size={11} /> 분석 결과는 제안이며, 참여자의 확인을 거쳐 반영됩니다.</p>
            </>
          ) : (
            <div className="analysis-empty">
              <div className="analysis-empty-visual"><Icon name="sparkles" size={25} /><span /><span /></div>
              <span>AI SYNTHESIS</span>
              <h3>흩어진 생각을<br />하나의 흐름으로</h3>
              <p>현재 {session.items.length}개 의견의 연결점과 실행 방향을 찾아드릴게요.</p>
              <button className="analyse-button full" onClick={onAnalyse} disabled={session.items.length === 0}>
                <Icon name="sparkles" size={16} /> 지금 분석하기
              </button>
            </div>
          )}
        </div>
      ) : (
        <ActivityView session={session} />
      )}
    </aside>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="analysis-loading">
      <div className="thinking-orb"><Icon name="sparkles" size={22} /><span /><span /></div>
      <strong>의견 사이의 연결을 찾고 있어요</strong>
      <p>반복되는 주제와 실행 가능한 방향을 정리합니다.</p>
      <div className="skeleton-lines"><i /><i /><i /></div>
      <div className="skeleton-card"><i /><i /><i /></div>
    </div>
  );
}

function ActivityView({ session }: { session: Session }) {
  const activities = [
    ...session.items.map((entry) => ({ id: entry.id, time: entry.createdAt, title: `${entry.authorName}님이 의견을 추가했어요`, detail: entry.content || entry.file?.name || "파일", color: entry.authorColor, icon: entry.kind === "FILE" ? "file" as const : entry.kind === "LINK" ? "link" as const : "message" as const })),
    ...session.analyses.map((entry) => ({ id: entry.id, time: entry.createdAt, title: "AI 분석이 완료되었어요", detail: `${entry.snapshotItemIds.length}개 의견에서 방향 후보를 찾았습니다.`, color: "#6c5ce7", icon: "sparkles" as const })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

  return (
    <div className="activity-scroll">
      <section className="people-section">
        <div className="section-title-row"><strong>참여자</strong><small>{session.participants.filter((entry) => entry.online).length}명 온라인</small></div>
        <div className="people-grid">
          {session.participants.map((participant) => (
            <div className="person-chip" key={participant.id}>
              <span className="avatar" style={{ background: participant.color }}>{participant.initials}</span>
              <span><strong>{participant.name}</strong><small>{participant.online ? "지금 참여 중" : "오프라인"}</small></span>
              <i className={participant.online ? "online" : ""} />
            </div>
          ))}
        </div>
      </section>
      <section className="activity-section">
        <div className="section-title-row"><strong>최근 활동</strong><small>자동 업데이트</small></div>
        <div className="activity-list">
          {activities.map((activity) => (
            <div className="activity-item" key={activity.id}>
              <span className="activity-icon" style={{ color: activity.color, background: `${activity.color}14` }}><Icon name={activity.icon} size={14} /></span>
              <div><strong>{activity.title}</strong><p>{activity.detail}</p><small>{formatTime(activity.time)}</small></div>
            </div>
          ))}
          {activities.length === 0 && <div className="mini-empty">아직 활동이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}

function CreateSessionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: CreateSessionInput) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [policy, setPolicy] = useState<AccessPolicy>("LINK_ONLY");
  const [submitting, setSubmitting] = useState(false);
  const valid = title.trim().length >= 2 && topic.trim().length >= 2;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({ title: title.trim(), topic: topic.trim(), accessPolicy: policy });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal-card create-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-session-title">
        <div className="modal-header">
          <div><span className="modal-kicker">NEW WORKSPACE</span><h2 id="create-session-title">새 브레인스토밍 시작</h2><p>하나의 질문에서 함께 생각을 확장합니다.</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="x" /></button>
        </div>
        <label className="field-label">세션 이름<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 새로운 서비스 아이디어" maxLength={60} /></label>
        <label className="field-label">함께 풀 질문<textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="예: 혼자 사는 사람의 저녁 시간을 어떻게 더 즐겁게 만들까?" rows={3} maxLength={140} /></label>
        <fieldset className="access-fieldset">
          <legend>참여 방식</legend>
          <button type="button" className={policy === "LINK_ONLY" ? "selected" : ""} onClick={() => setPolicy("LINK_ONLY")}>
            <span className="policy-icon"><Icon name="lock" size={17} /></span><span><strong>링크 전용</strong><small>초대 링크를 받은 사람만 참여</small></span>{policy === "LINK_ONLY" && <Icon name="check" size={16} />}
          </button>
          <button type="button" className={policy === "PUBLIC" ? "selected" : ""} onClick={() => setPolicy("PUBLIC")}>
            <span className="policy-icon"><Icon name="globe" size={17} /></span><span><strong>공개 세션</strong><small>누구나 찾아서 참여</small></span>{policy === "PUBLIC" && <Icon name="check" size={16} />}
          </button>
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>취소</button>
          <button type="submit" className="primary-button" disabled={!valid || submitting}>{submitting ? "만드는 중…" : "세션 만들기"}<Icon name="arrow" size={15} /></button>
        </div>
      </form>
    </div>
  );
}

function FilePreviewModal({ item, onClose }: { item: OpinionItem; onClose: () => void }) {
  const file = item.file;
  if (!file) return null;
  return (
    <div className="modal-backdrop file-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-card file-modal" role="dialog" aria-modal="true" aria-label={`${file.name} 미리보기`}>
        <div className="file-modal-toolbar">
          <div><span className="file-type small">{file.name.split(".").pop()?.toUpperCase()}</span><span><strong>{file.name}</strong><small>{formatFileSize(file.size)} · 안전 검사 완료</small></span></div>
          <div><button className="secondary-button"><Icon name="download" size={15} /> 내려받기</button><button className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="x" /></button></div>
        </div>
        {file.previewable ? (
          <div className="document-preview">
            <div className="document-page">
              <div className="doc-brand">BMPS · FIELD NOTE</div>
              <h3>현장 인터뷰 인사이트</h3>
              <p className="doc-lead">지역 축제 참여자와 상인 인터뷰에서 반복해서 등장한 핵심 내용을 정리했습니다.</p>
              <div className="doc-rule" />
              <div className="doc-stat-row"><span><b>12</b>명 인터뷰</span><span><b>3</b>개 공통 주제</span><span><b>8</b>개 실행 단서</span></div>
              <h4>반복해서 등장한 이야기</h4>
              <div className="doc-quote">“낮에 한 번 보고 끝나는 행사가 아니라, 저녁에도 다시 오고 싶은 이유가 있었으면 해요.”</div>
              <div className="doc-lines"><i /><i /><i /><i /></div>
            </div>
            <span className="preview-notice"><Icon name="check" size={13} /> 샌드박스된 데모 미리보기</span>
          </div>
        ) : (
          <div className="download-only"><span><Icon name="download" size={30} /></span><h3>이 파일은 바로 표시할 수 없습니다</h3><p>안전하게 내려받은 뒤 기기에서 열어 주세요.</p><button className="primary-button"><Icon name="download" size={16} /> 파일 내려받기</button></div>
        )}
      </div>
    </div>
  );
}

function Toast({ message, tone, onClose }: { message: string; tone: ToastTone; onClose: () => void }) {
  return (
    <div className={`toast ${tone}`} role="status">
      <span className="toast-icon"><Icon name={tone === "error" ? "x" : tone === "info" ? "activity" : "check"} size={15} /></span>
      <span>{message}</span>
      <button onClick={onClose} aria-label="알림 닫기"><Icon name="x" size={14} /></button>
    </div>
  );
}
