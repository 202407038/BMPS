import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
  type Participant,
  type Session,
} from "@bmps/contracts";
import { createFallbackState } from "./demo-state.js";

type Stage = 1 | 2 | 3;
type ConnectionState = "connecting" | "connected" | "local";
type ToastTone = "success" | "error" | "info";
type IconName =
  | "arrow"
  | "check"
  | "close"
  | "external"
  | "file"
  | "globe"
  | "link"
  | "lock"
  | "plus"
  | "reset"
  | "send"
  | "share"
  | "sparkles"
  | "text"
  | "trash"
  | "upload";

const STAGES: Array<{ id: Stage; label: string }> = [
  { id: 1, label: "마인드맵 동시 작성" },
  { id: 2, label: "AI 분석" },
  { id: 3, label: "선택지 제안 · 결정" },
];

const CLUSTERS: Array<{
  id: ClusterId;
  label: string;
  color: string;
  fill: string;
}> = [
  { id: "discover", label: "문제 발견", color: "#4d91e8", fill: "#edf5ff" },
  { id: "experience", label: "핵심 경험", color: "#2faa78", fill: "#eaf8f1" },
  { id: "action", label: "실행 아이디어", color: "#ee8b32", fill: "#fff3e8" },
];

const NODE_POSITIONS = [
  { x: 230, y: 102 },
  { x: 600, y: 70 },
  { x: 970, y: 102 },
  { x: 220, y: 414 },
  { x: 600, y: 440 },
  { x: 970, y: 414 },
] as const;

const MAP_SIZE = { width: 1_200, height: 520 } as const;
const MAP_CENTER = { x: 600, y: 272 } as const;
const RELATION_COLORS = ["#ffd861", "#8adfc9", "#aebcf8"] as const;
const DISADVANTAGES = [
  "여러 참여 주체를 조율해 첫 실행까지 시간이 필요해요.",
  "다른 핵심 의견이 초기 실험에서 빠질 수 있어요.",
  "현장 운영 부담과 초기 제작 비용을 확인해야 해요.",
] as const;

function makeId(prefix: string): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${randomPart}`;
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
    accent: ["#4771f3", "#2faa78", "#ee8b32"][next.sessions.length % 3]!,
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
    authorId: next.currentParticipant.id,
    authorName: next.currentParticipant.name,
    authorColor: next.currentParticipant.color,
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

  const strongest = [...session.items]
    .sort((a, b) => b.reactions.agree - a.reactions.agree)
    .slice(0, 3);
  const actionItems = session.items.filter((entry) => entry.cluster === "action");
  const linkedItems = actionItems.length >= 2 ? actionItems.slice(-3) : strongest;

  const analysis: AnalysisResult = {
    id: makeId("analysis"),
    sessionId,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    snapshotItemIds: session.items.map((entry) => entry.id),
    flowSummary: `${session.items.length}개 의견에서 문제 발견, 경험 구상, 실행 제안의 흐름이 보입니다. 공감이 모인 의견을 가장 작은 현장 실험으로 좁혀볼 수 있습니다.`,
    linkCandidates: linkedItems.length >= 2
      ? [
          {
            id: makeId("link"),
            itemIds: linkedItems.map((entry) => entry.id),
            label: "함께 주목한 실행 신호",
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
    if (previous) {
      analysis.prompt.votes[previous] = Math.max(0, (analysis.prompt.votes[previous] ?? 1) - 1);
    }
    analysis.prompt.votes[option] = (analysis.prompt.votes[option] ?? 0) + 1;
    analysis.prompt.currentParticipantVote = option;
    session.cursor += 1;
    break;
  }
  return touchState(next);
}

function formatFileSize(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_048_576) return `${Math.round(size / 1_024)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getItemLabel(item: OpinionItem): string {
  if (item.content.trim()) return item.content;
  if (item.kind === "FILE" && item.file) return item.file.name;
  if (item.kind === "LINK" && item.url) return getDomain(item.url);
  return "내용 없는 의견";
}

function clusterFor(id: ClusterId) {
  return CLUSTERS.find((entry) => entry.id === id) ?? CLUSTERS[2]!;
}

function participantInitial(participant: Participant | undefined, item: OpinionItem): string {
  if (participant?.initials) return participant.initials.slice(0, 1);
  return item.authorName.replace(/^익명\s*/, "").slice(0, 1) || "참";
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  let content: ReactNode;
  switch (name) {
    case "plus":
      content = <path d="M12 5v14M5 12h14" />;
      break;
    case "share":
      content = <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>;
      break;
    case "reset":
      content = <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>;
      break;
    case "sparkles":
      content = <><path d="m12 3-1.2 3.1a4 4 0 0 1-2.3 2.3L5.5 9.5l3 1.2a4 4 0 0 1 2.3 2.3l1.2 3.1 1.2-3.1a4 4 0 0 1 2.3-2.3l3-1.2-3-1.1a4 4 0 0 1-2.3-2.3L12 3Z" /><path d="m19 16-.5 1.3a2 2 0 0 1-1.1 1.1l-1.4.5 1.4.5a2 2 0 0 1 1.1 1.1L19 22l.5-1.5a2 2 0 0 1 1.1-1.1l1.4-.5-1.4-.5a2 2 0 0 1-1.1-1.1L19 16Z" /></>;
      break;
    case "text":
      content = <><path d="M5 4h14M12 4v16M8 20h8" /></>;
      break;
    case "link":
      content = <><path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>;
      break;
    case "file":
      content = <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>;
      break;
    case "send":
      content = <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>;
      break;
    case "close":
      content = <path d="m6 6 12 12M18 6 6 18" />;
      break;
    case "trash":
      content = <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" /></>;
      break;
    case "upload":
      content = <><path d="M12 16V3M7 8l5-5 5 5" /><path d="M20 15v5H4v-5" /></>;
      break;
    case "external":
      content = <><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>;
      break;
    case "check":
      content = <path d="m5 12 4 4L19 6" />;
      break;
    case "arrow":
      content = <><path d="M5 12h14M14 7l5 5-5 5" /></>;
      break;
    case "lock":
      content = <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>;
      break;
    case "globe":
      content = <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>;
      break;
  }

  return (
    <svg
      aria-hidden="true"
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

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function useDialogFocus<T extends HTMLElement>(onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((element) => element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null);

    const focusFrame = window.requestAnimationFrame(() => {
      if (dialog.contains(document.activeElement)) return;
      const preferred = dialog.querySelector<HTMLElement>("[autofocus]");
      (preferred ?? getFocusable()[0] ?? dialog).focus();
    });

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return dialogRef;
}

export function App() {
  const [data, setData] = useState<DemoState>(() => createFallbackState());
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [selectedSessionId, setSelectedSessionId] = useState("session-festival");
  const [stage, setStage] = useState<Stage>(1);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [votingOption, setVotingOption] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<OpinionItem | null>(null);
  const [previewItem, setPreviewItem] = useState<OpinionItem | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);

  const commitData = (next: DemoState) => {
    dataRef.current = next;
    setData(next);
  };

  const notify = (message: string, tone: ToastTone = "success") => {
    setToast({ message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3_200);
  };

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let active = true;
    fetch("/api/state")
      .then(async (response) => {
        if (!response.ok) throw new Error("Demo API unavailable");
        return response.json() as Promise<DemoState>;
      })
      .then((next) => {
        if (!active) return;
        commitData(next);
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
    if (!data.sessions.some((entry) => entry.id === selectedSessionId) && data.sessions[0]) {
      setSelectedSessionId(data.sessions[0].id);
    }
  }, [data.sessions, selectedSessionId]);

  const session = data.sessions.find((entry) => entry.id === selectedSessionId) ?? data.sessions[0];
  const visibleItems = useMemo(() => session?.items.slice(-6) ?? [], [session]);
  const latestAnalysis = session?.analyses[session.analyses.length - 1] ?? null;

  async function mutate(
    endpoint: string,
    init: RequestInit,
    localFallback: (current: DemoState) => DemoState,
  ): Promise<DemoState> {
    if (connection === "connected") {
      let response: Response | null = null;
      try {
        response = await fetch(endpoint, {
          ...init,
          headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        });
      } catch {
        setConnection("local");
        notify("서버 연결이 끊겨 로컬 데모 모드로 전환했습니다.", "info");
      }

      if (response) {
        let payload: DemoState | ApiError;
        try {
          payload = await response.json() as DemoState | ApiError;
        } catch {
          const message = "서버 응답을 읽지 못했습니다.";
          notify(message, "error");
          throw new Error(message);
        }
        if (!response.ok) {
          const message = "message" in payload ? payload.message : "요청을 처리하지 못했습니다.";
          notify(message, "error");
          throw new Error(message);
        }
        const next = payload as DemoState;
        commitData(next);
        return next;
      }
    }

    const next = localFallback(dataRef.current);
    commitData(next);
    return next;
  }

  if (!session) {
    return <div className="fatal-empty">표시할 세션이 없습니다.</div>;
  }

  const onlineCount = session.participants.filter((participant) => participant.online).length;

  const selectSession = (id: string) => {
    setSelectedSessionId(id);
    setStage(1);
    setDetailItem(null);
  };

  const handleCreateSession = async (input: CreateSessionInput): Promise<boolean> => {
    try {
      const next = await mutate(
        "/api/sessions",
        { method: "POST", body: JSON.stringify(input) },
        (current) => addSessionLocally(current, input),
      );
      const created = next.sessions[0];
      if (created) selectSession(created.id);
      setCreateSessionOpen(false);
      setComposerOpen(true);
      notify("새 브레인스토밍을 만들었습니다.");
      return true;
    } catch {
      return false;
    }
  };

  const handleAddItem = async (input: CreateItemInput): Promise<boolean> => {
    try {
      await mutate(
        `/api/sessions/${session.id}/items`,
        { method: "POST", body: JSON.stringify(input) },
        (current) => addItemLocally(current, session.id, input),
      );
      notify("의견을 마인드맵에 추가했습니다.");
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteItem = async (itemId: string): Promise<boolean> => {
    if (!window.confirm("이 의견을 삭제할까요? 데모 초기화로 다시 복원할 수 있습니다.")) return false;
    try {
      await mutate(
        `/api/sessions/${session.id}/items/${itemId}`,
        { method: "DELETE" },
        (current) => deleteItemLocally(current, session.id, itemId),
      );
      notify("의견을 삭제했습니다.", "info");
      return true;
    } catch {
      return false;
    }
  };

  const handleAnalyse = async () => {
    if (session.items.length === 0) {
      notify("분석할 의견을 먼저 추가해 주세요.", "error");
      return;
    }
    if (isAnalysing) return;
    setIsAnalysing(true);
    await new Promise((resolve) => setTimeout(resolve, 850));
    try {
      await mutate(
        `/api/sessions/${session.id}/analyses`,
        { method: "POST" },
        (current) => analyseLocally(current, session.id),
      );
      notify("AI가 의견 사이의 연결과 선택지를 정리했습니다.");
    } catch {
      // mutate already displays the API error.
    } finally {
      setIsAnalysing(false);
    }
  };

  const handleVote = async (analysisId: string, option: string) => {
    if (votingOption) return;
    setVotingOption(option);
    try {
      await mutate(
        `/api/analyses/${analysisId}/reactions`,
        { method: "POST", body: JSON.stringify({ option }) },
        (current) => voteLocally(current, analysisId, option),
      );
      notify("선택을 투표에 반영했습니다.");
    } catch {
      // mutate already displays the API error.
    } finally {
      setVotingOption(null);
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
      const next = await mutate("/api/reset", { method: "POST" }, () => createFallbackState());
      setSelectedSessionId(next.sessions[0]?.id ?? "session-festival");
      setStage(1);
      setDetailItem(null);
      notify("데모 데이터를 초기화했습니다.", "info");
    } catch {
      // mutate already displays the API error.
    }
  };

  return (
    <div className="brainstorm-app">
      <header className="app-header">
        <div className="header-left">
          <div className="brand-line">
            <h1>AI 브레인스토밍</h1>
            <span className="brand-tag">BMPS</span>
          </div>
          <div className="session-tools">
            <label className="visually-hidden" htmlFor="session-select">브레인스토밍 세션</label>
            <span className="session-select-wrap">
              <i style={{ background: session.accent }} />
              <select id="session-select" value={session.id} onChange={(event) => selectSession(event.target.value)}>
                {data.sessions.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}
              </select>
            </span>
            <button className="tool-icon" onClick={() => setCreateSessionOpen(true)} aria-label="새 세션 만들기" title="새 세션">
              <Icon name="plus" size={15} />
            </button>
            <button className="tool-icon" onClick={handleInvite} aria-label="초대 링크 복사" title="초대 링크 복사">
              <Icon name="share" size={14} />
            </button>
            <button className="tool-icon" onClick={handleReset} aria-label="데모 초기화" title="데모 초기화">
              <Icon name="reset" size={14} />
            </button>
            <span className={`connection-state ${connection}`} title={connection === "connected" ? "데모 서버 연결됨" : connection === "connecting" ? "연결 확인 중" : "로컬 데모 모드"}>
              <i />
              {connection === "connected" ? "연결됨" : connection === "connecting" ? "연결 중" : "로컬"}
            </span>
            <span className="tool-divider" />
            {stage === 1 ? (
              <button className="context-action" onClick={() => setComposerOpen(true)}>
                <Icon name="plus" size={15} /> 의견 추가
              </button>
            ) : (
              <button className="context-action analyse" onClick={handleAnalyse} disabled={isAnalysing || session.items.length === 0}>
                <Icon name="sparkles" size={15} /> {isAnalysing ? "분석 중…" : latestAnalysis ? "다시 분석" : "AI 분석"}
              </button>
            )}
          </div>
        </div>

        <nav className="stage-stepper" aria-label="브레인스토밍 단계">
          {STAGES.map((entry) => (
            <button
              key={entry.id}
              className={stage === entry.id ? "active" : ""}
              onClick={() => setStage(entry.id)}
              aria-current={stage === entry.id ? "step" : undefined}
            >
              <b>{entry.id}</b>
              <span>{entry.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="stage-main">
        {stage === 1 || stage === 2 ? (
          <MindMapStage
            key={`${session.id}-${stage}`}
            stage={stage}
            session={session}
            items={visibleItems}
            analysis={latestAnalysis}
            onlineCount={onlineCount}
            isAnalysing={isAnalysing}
            onOpenComposer={() => setComposerOpen(true)}
            onOpenItem={setDetailItem}
          />
        ) : (
          <DecisionStage
            session={session}
            analysis={latestAnalysis}
            isAnalysing={isAnalysing}
            votingOption={votingOption}
            onAnalyse={handleAnalyse}
            onVote={handleVote}
          />
        )}
      </main>

      {composerOpen && (
        <IdeaComposerModal
          session={session}
          onClose={() => setComposerOpen(false)}
          onSubmit={handleAddItem}
        />
      )}
      {createSessionOpen && (
        <CreateSessionModal
          onClose={() => setCreateSessionOpen(false)}
          onCreate={handleCreateSession}
        />
      )}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          session={session}
          currentParticipantId={data.currentParticipant.id}
          onClose={() => setDetailItem(null)}
          onDelete={async () => {
            const deleted = await handleDeleteItem(detailItem.id);
            if (deleted) setDetailItem(null);
          }}
          onPreview={() => {
            setDetailItem(null);
            setPreviewItem(detailItem);
          }}
        />
      )}
      {previewItem?.file && (
        <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

interface MindMapStageProps {
  stage: 1 | 2;
  session: Session;
  items: OpinionItem[];
  analysis: AnalysisResult | null;
  onlineCount: number;
  isAnalysing: boolean;
  onOpenComposer: () => void;
  onOpenItem: (item: OpinionItem) => void;
}

interface MapRelation {
  id: string;
  label: string;
  confidence: number;
  indices: number[];
  color: string;
  path: string;
  x: number;
  y: number;
}

function MindMapStage({
  stage,
  session,
  items,
  analysis,
  onlineCount,
  isAnalysing,
  onOpenComposer,
  onOpenItem,
}: MindMapStageProps) {
  const relations: MapRelation[] = stage === 2 && analysis
    ? analysis.linkCandidates.slice(0, 3).flatMap((candidate, relationIndex) => {
        const indices = [...new Set(candidate.itemIds
          .map((itemId) => items.findIndex((item) => item.id === itemId))
          .filter((index) => index >= 0))];
        if (indices.length < 2) return [];
        const points = indices.map((index) => NODE_POSITIONS[index]!);
        const averageX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
        const averageY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
        const closeToTopic = Math.abs(averageX - MAP_CENTER.x) < 230 && Math.abs(averageY - MAP_CENTER.y) < 105;
        const labelOffset = closeToTopic
          ? [{ x: -110, y: 0 }, { x: 0, y: -92 }, { x: 110, y: 0 }][relationIndex % 3]!
          : { x: 0, y: 0 };
        return [{
          id: candidate.id,
          label: candidate.label,
          confidence: candidate.confidence,
          indices,
          color: RELATION_COLORS[relationIndex % RELATION_COLORS.length]!,
          path: points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
          x: averageX + labelOffset.x,
          y: averageY + labelOffset.y,
        }];
      })
    : [];

  const cursorIndices = [...new Set([0, Math.min(2, items.length - 1), items.length - 1])]
    .filter((index) => index >= 0 && index < items.length)
    .slice(0, 3);

  const caption = stage === 1
    ? `${onlineCount}명이 같은 마인드맵에 동시에 접속해 아이디어를 추가 중`
    : isAnalysing
      ? "AI가 비슷한 의견을 찾아 묶는 중..."
      : analysis
        ? `AI가 ${analysis.linkCandidates.length}개의 의견 관계와 ${analysis.directions.length}개의 방향을 찾았어요`
        : "AI 분석을 실행하면 비슷한 의견의 연결이 나타나요";

  return (
    <section className={`mindmap-stage stage-${stage}`} aria-labelledby="map-topic">
      <div className="map-plane">
        <svg className="idea-lines" viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} preserveAspectRatio="none" aria-hidden="true">
          {items.map((item, index) => {
            const position = NODE_POSITIONS[index];
            if (!position) return null;
            return (
              <line
                key={item.id}
                x1={MAP_CENTER.x}
                y1={MAP_CENTER.y}
                x2={position.x}
                y2={position.y}
                stroke={clusterFor(item.cluster).color}
              />
            );
          })}
          {relations.map((relation) => (
            <path
              className="relation-path"
              d={relation.path}
              key={relation.id}
              stroke={relation.color}
            />
          ))}
        </svg>

        <div className={`topic-node ${session.title.length > 8 ? "wide" : ""}`} id="map-topic" title={session.topic}>
          <span>{session.title}</span>
        </div>

        {items.map((item, index) => {
          const position = NODE_POSITIONS[index];
          if (!position) return null;
          const palette = clusterFor(item.cluster);
          const relation = relations.find((entry) => entry.indices.includes(index));
          const kindIcon: IconName = item.kind === "LINK" ? "link" : item.kind === "FILE" ? "file" : "text";
          return (
            <button
              className={`idea-node ${relation ? "related" : ""}`}
              key={item.id}
              onClick={() => onOpenItem(item)}
              style={{
                left: `${(position.x / MAP_SIZE.width) * 100}%`,
                top: `${(position.y / MAP_SIZE.height) * 100}%`,
                "--node-color": palette.color,
                "--node-fill": palette.fill,
                "--relation-color": relation?.color ?? "transparent",
              } as CSSProperties}
              aria-label={`${palette.label}, ${getItemLabel(item)}, ${item.authorName}`}
              title={`${getItemLabel(item)} · ${item.authorName}`}
            >
              {item.kind !== "TEXT" && <Icon name={kindIcon} size={16} />}
              <span>{getItemLabel(item)}</span>
            </button>
          );
        })}

        {stage === 2 && relations.map((relation) => (
          <span
            className="relation-label"
            key={`${relation.id}-label`}
            style={{
              left: `${(relation.x / MAP_SIZE.width) * 100}%`,
              top: `${(relation.y / MAP_SIZE.height) * 100}%`,
              "--relation-color": relation.color,
            } as CSSProperties}
            title={`${relation.label} · ${relation.confidence}% 일치`}
          >
            {relation.label}
            <small>{relation.confidence}%</small>
          </span>
        ))}

        {cursorIndices.map((index) => {
          const item = items[index]!;
          const position = NODE_POSITIONS[index]!;
          const participant = session.participants.find((entry) => entry.id === item.authorId);
          const cursorColor = clusterFor(item.cluster).color;
          return (
            <div
              className={`collab-cursor ${stage === 2 ? "muted" : ""}`}
              key={`cursor-${item.id}`}
              style={{
                left: `${Math.min(96, (position.x / MAP_SIZE.width) * 100 + (index % 2 === 0 ? 7 : 5))}%`,
                top: `${Math.min(91, (position.y / MAP_SIZE.height) * 100 + 7)}%`,
                color: cursorColor,
              }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 25 31"><path d="M2 1.5 22 18l-8.2 1 4.4 8.8-4.8 2.2-4.2-9-6.4 5.5Z" /></svg>
              <span style={{ background: cursorColor }}>{participantInitial(participant, item)}</span>
            </div>
          );
        })}

        {items.length === 0 && stage === 1 && (
          <button className="empty-add" onClick={onOpenComposer}>
            <Icon name="plus" size={16} /> 첫 의견 추가하기
          </button>
        )}

        {stage === 2 && isAnalysing && (
          <div className="analysis-pulse" aria-hidden="true"><Icon name="sparkles" size={22} /></div>
        )}
      </div>

      <p className="stage-caption" aria-live="polite">
        {stage === 2 && isAnalysing && <span className="inline-spinner" />}
        <span>{caption}</span>
        {stage === 1 && <b>({items.length}/6)</b>}
      </p>
    </section>
  );
}

interface DecisionStageProps {
  session: Session;
  analysis: AnalysisResult | null;
  isAnalysing: boolean;
  votingOption: string | null;
  onAnalyse: () => void;
  onVote: (analysisId: string, option: string) => void;
}

function DecisionStage({ session, analysis, isAnalysing, votingOption, onAnalyse, onVote }: DecisionStageProps) {
  if (!analysis) {
    return (
      <section className="decision-stage decision-empty">
        <div className="decision-empty-card">
          <span><Icon name="sparkles" size={28} /></span>
          <h2>선택지를 만들 분석 결과가 필요해요</h2>
          <p>현재 의견을 분석하면 실행 가능한 방향 3개와 장단점을 비교할 수 있습니다.</p>
          <button className="primary-action" onClick={onAnalyse} disabled={isAnalysing || session.items.length === 0}>
            {isAnalysing ? <span className="inline-spinner light" /> : <Icon name="sparkles" size={17} />}
            {isAnalysing ? "분석 중…" : "AI 분석 시작"}
          </button>
        </div>
      </section>
    );
  }

  const directions = analysis.directions.slice(0, 3);

  return (
    <section className="decision-stage" aria-labelledby="decision-title">
      <h2 className="visually-hidden" id="decision-title">AI 추천 선택지 비교 및 투표</h2>
      <div className="decision-grid">
        {directions.map((direction, index) => {
          const option = analysis.prompt.options[index] ?? `선택지 ${index + 1}`;
          const voteCount = analysis.prompt.votes[option] ?? 0;
          const selected = analysis.prompt.currentParticipantVote === option;
          const voters = Array.from(
            { length: Math.min(voteCount, 3) },
            (_, voterIndex) => session.participants[(index * 2 + voterIndex) % Math.max(1, session.participants.length)],
          ).filter((participant): participant is Participant => Boolean(participant));
          const isRecommended = index === 0;

          return (
            <article className={`decision-card ${isRecommended ? "recommended" : ""} ${selected ? "selected" : ""}`} key={direction.id}>
              <div className="card-badges">
                <span className="option-number">선택지 {index + 1}</span>
                <span className="badge-spacer" />
                {isRecommended && <span className="recommend-badge"><Icon name="sparkles" size={13} /> AI 추천</span>}
                {selected && <span className="selected-badge"><Icon name="check" size={14} /> 내 선택</span>}
              </div>

              <h3>{direction.title}</h3>
              <div className="participation-summary">
                <div className="avatar-stack" aria-label={`${voteCount}표`}>
                  {voters.map((participant, voterIndex) => (
                    <span className="participant-avatar" style={{ background: participant.color }} key={`${participant.id}-${voterIndex}`} title={participant.name}>
                      {participant.initials.slice(0, 1)}
                    </span>
                  ))}
                </div>
                <span>{voteCount > 0 ? `의견 ${voteCount}명 참여` : "첫 투표를 기다리는 중"}</span>
                <small>실행 점수 {direction.score}</small>
              </div>

              <div className="card-rule" />
              <dl className="pros-cons">
                <div>
                  <dt className="pro">장점</dt>
                  <dd>{direction.description}</dd>
                </div>
                <div>
                  <dt className="con">단점</dt>
                  <dd>{DISADVANTAGES[index] ?? "실행 전에 범위와 필요한 자원을 확인해야 해요."}</dd>
                </div>
              </dl>

              <button
                className="vote-button"
                onClick={() => onVote(analysis.id, option)}
                disabled={votingOption !== null}
                aria-pressed={selected}
                aria-label={`${direction.title}, ${option}에 투표`}
              >
                <span>{selected ? <Icon name="check" size={15} /> : null}{votingOption === option ? "반영 중…" : selected ? "선택됨" : `${option} · 투표`}</span>
                <b>{voteCount}표</b>
              </button>
            </article>
          );
        })}
      </div>
      <p className="stage-caption decision-caption">AI가 선택지와 장단점을 정리하면, 팀원이 투표로 결정해요</p>
    </section>
  );
}

interface IdeaComposerModalProps {
  session: Session;
  onClose: () => void;
  onSubmit: (input: CreateItemInput) => Promise<boolean>;
}

function IdeaComposerModal({ session, onClose, onSubmit }: IdeaComposerModalProps) {
  const [mode, setMode] = useState<ItemKind>("TEXT");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [cluster, setCluster] = useState<ClusterId>("action");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useDialogFocus<HTMLFormElement>(onClose);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urlValid = /^https?:\/\/\S+$/i.test(url.trim());
  const canSubmit = mode === "TEXT"
    ? content.trim().length > 0
    : mode === "LINK"
      ? content.trim().length > 0 && urlValid
      : file !== null;

  const chooseMode = (next: ItemKind) => {
    setMode(next);
    setError(null);
    if (next !== "FILE") setFile(null);
  };

  const chooseFile = (selected: File | null) => {
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "LINK" && !urlValid) {
      setError("http:// 또는 https://로 시작하는 링크를 입력해 주세요.");
      return;
    }
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

    const successful = await onSubmit(input);
    setSubmitting(false);
    if (successful) onClose();
  };

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal-card composer-modal" ref={formRef} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="composer-title" tabIndex={-1}>
        <ModalHeader kicker={session.title} title="마인드맵에 의견 추가" description={session.topic} onClose={onClose} titleId="composer-title" />

        <fieldset className="mode-picker">
          <legend className="visually-hidden">의견 형식</legend>
          {(["TEXT", "LINK", "FILE"] as ItemKind[]).map((entry) => {
            const label = entry === "TEXT" ? "텍스트" : entry === "LINK" ? "링크" : "파일";
            const icon: IconName = entry === "TEXT" ? "text" : entry === "LINK" ? "link" : "file";
            return (
              <button type="button" className={mode === entry ? "active" : ""} onClick={() => chooseMode(entry)} aria-pressed={mode === entry} key={entry}>
                <Icon name={icon} size={15} /> {label}
              </button>
            );
          })}
        </fieldset>

        {mode === "LINK" && (
          <label className="field-label" htmlFor="idea-url">
            참고 링크
            <input
              id="idea-url"
              type="url"
              value={url}
              onChange={(event) => { setUrl(event.target.value); setError(null); }}
              onBlur={() => { if (url && !urlValid) setError("http:// 또는 https://로 시작하는 링크를 입력해 주세요."); }}
              placeholder="https://example.com"
              autoFocus
            />
          </label>
        )}

        {mode === "FILE" && (
          <div className="file-field">
            <span className="field-title">첨부 파일</span>
            <input
              className="visually-hidden"
              id="idea-file"
              ref={fileInputRef}
              type="file"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="selected-file">
                <span><Icon name="file" size={18} /></span>
                <div><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></div>
                <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="파일 선택 취소"><Icon name="close" size={15} /></button>
              </div>
            ) : (
              <label className="file-picker" htmlFor="idea-file">
                <Icon name="upload" size={22} />
                <span><strong>파일 선택</strong><small>모든 형식 · 최대 20 MB</small></span>
              </label>
            )}
          </div>
        )}

        <label className="field-label" htmlFor="idea-content">
          {mode === "TEXT" ? "의견" : "설명"}
          <textarea
            id="idea-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={mode === "TEXT" ? "축제를 다시 찾게 만들 아이디어를 적어보세요." : mode === "LINK" ? "이 링크가 논의에 필요한 이유를 적어주세요." : "파일의 핵심 내용을 덧붙여 주세요. (선택)"}
            rows={3}
            maxLength={1_000}
            autoFocus={mode === "TEXT"}
          />
        </label>

        <label className="field-label compact-field" htmlFor="idea-cluster">
          연결 위치
          <select id="idea-cluster" value={cluster} onChange={(event) => setCluster(event.target.value as ClusterId)}>
            {CLUSTERS.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
          </select>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd>로 추가</span>
          <button type="button" className="secondary-action" onClick={onClose}>취소</button>
          <button type="submit" className="primary-action" disabled={!canSubmit || submitting}>
            {submitting ? <span className="inline-spinner light" /> : <Icon name="send" size={16} />}
            {submitting ? "추가 중…" : "의견 추가"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateSessionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: CreateSessionInput) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>("LINK_ONLY");
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose);
  const valid = title.trim().length >= 2 && topic.trim().length >= 2;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    await onCreate({ title: title.trim(), topic: topic.trim(), accessPolicy });
    setSubmitting(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form ref={dialogRef} className="modal-card create-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-title" tabIndex={-1}>
        <ModalHeader kicker="BMPS · NEW SESSION" title="새 브레인스토밍" description="하나의 질문에서 함께 생각을 확장합니다." onClose={onClose} titleId="create-title" />
        <label className="field-label" htmlFor="session-title">세션 이름<input id="session-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} placeholder="예: 지역 축제 리브랜딩" /></label>
        <label className="field-label" htmlFor="session-topic">함께 풀 질문<textarea id="session-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={140} rows={3} placeholder="예: 주민과 방문객이 다시 찾는 축제를 어떻게 만들까?" /></label>
        <fieldset className="access-options">
          <legend>참여 방식</legend>
          <label className={accessPolicy === "LINK_ONLY" ? "selected" : ""}>
            <input className="visually-hidden" type="radio" name="access" checked={accessPolicy === "LINK_ONLY"} onChange={() => setAccessPolicy("LINK_ONLY")} />
            <span><Icon name="lock" size={17} /></span><strong>링크 전용<small>초대받은 사람만 참여</small></strong>{accessPolicy === "LINK_ONLY" && <Icon name="check" size={16} />}
          </label>
          <label className={accessPolicy === "PUBLIC" ? "selected" : ""}>
            <input className="visually-hidden" type="radio" name="access" checked={accessPolicy === "PUBLIC"} onChange={() => setAccessPolicy("PUBLIC")} />
            <span><Icon name="globe" size={17} /></span><strong>공개 세션<small>누구나 찾아서 참여</small></strong>{accessPolicy === "PUBLIC" && <Icon name="check" size={16} />}
          </label>
        </fieldset>
        <div className="modal-actions simple">
          <button type="button" className="secondary-action" onClick={onClose}>취소</button>
          <button type="submit" className="primary-action" disabled={!valid || submitting}>{submitting ? "만드는 중…" : "세션 만들기"}<Icon name="arrow" size={15} /></button>
        </div>
      </form>
    </div>
  );
}

function ModalHeader({ kicker, title, description, onClose, titleId }: { kicker: string; title: string; description: string; onClose: () => void; titleId: string }) {
  return (
    <div className="modal-header">
      <div><span>{kicker}</span><h2 id={titleId}>{title}</h2><p>{description}</p></div>
      <button type="button" className="close-button" onClick={onClose} aria-label="닫기"><Icon name="close" size={19} /></button>
    </div>
  );
}

interface ItemDetailModalProps {
  item: OpinionItem;
  session: Session;
  currentParticipantId: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onPreview: () => void;
}

function ItemDetailModal({ item, session, currentParticipantId, onClose, onDelete, onPreview }: ItemDetailModalProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const palette = clusterFor(item.cluster);
  const canDelete = item.authorId === currentParticipantId || session.hostId === currentParticipantId;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="modal-card detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1}>
        <div className="detail-top">
          <span className="detail-cluster" style={{ color: palette.color, background: palette.fill }}>{palette.label}</span>
          <button className="close-button" onClick={onClose} aria-label="닫기"><Icon name="close" size={19} /></button>
        </div>
        <h2 id="detail-title">{getItemLabel(item)}</h2>
        {item.content && item.kind !== "TEXT" && <p className="detail-description">{item.content}</p>}
        <div className="detail-meta"><span style={{ background: item.authorColor }}>{item.authorName.slice(-1)}</span><strong>{item.authorName}</strong><small>{formatTime(item.createdAt)}</small></div>
        {item.url && <a className="resource-row" href={item.url} target="_blank" rel="noreferrer"><Icon name="link" size={18} /><span><small>참고 링크</small><strong>{getDomain(item.url)}</strong></span><Icon name="external" size={16} /></a>}
        {item.file && <button className="resource-row" onClick={onPreview}><Icon name="file" size={18} /><span><small>{formatFileSize(item.file.size)}</small><strong>{item.file.name}</strong></span><span>{item.file.previewable ? "미리보기" : "정보 보기"}</span></button>}
        <div className="detail-actions">
          <button className="secondary-action" onClick={onClose}>닫기</button>
          {canDelete && <button className="danger-action" onClick={() => void onDelete()}><Icon name="trash" size={15} /> 의견 삭제</button>}
        </div>
      </div>
    </div>
  );
}

function FilePreviewModal({ item, onClose }: { item: OpinionItem; onClose: () => void }) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const file = item.file;
  if (!file) return null;
  const extension = file.name.split(".").pop()?.toUpperCase() || "FILE";
  return (
    <div className="modal-backdrop preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="modal-card preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" tabIndex={-1}>
        <div className="preview-toolbar">
          <span className="file-extension">{extension.slice(0, 4)}</span>
          <div><h2 id="preview-title">{file.name}</h2><p>{formatFileSize(file.size)} · {file.mimeType}</p></div>
          <button className="close-button" onClick={onClose} aria-label="미리보기 닫기"><Icon name="close" size={20} /></button>
        </div>
        {file.previewable ? (
          <div className="preview-canvas">
            <article className="preview-sheet">
              <span>BMPS · FIELD NOTE</span>
              <h3>지역 축제 현장 인터뷰</h3>
              <p>주민과 방문객이 다시 찾는 지속 가능한 동네 축제를 위한 공통 의견을 정리했습니다.</p>
              <hr />
              <div className="preview-stats"><span><b>12</b>명 인터뷰</span><span><b>3</b>개 공통 주제</span><span><b>8</b>개 실행 단서</span></div>
              <h4>반복해서 등장한 이야기</h4>
              <blockquote>“낮에 한 번 보고 끝나는 행사가 아니라, 저녁에도 다시 오고 싶은 이유가 있었으면 해요.”</blockquote>
            </article>
          </div>
        ) : (
          <div className="preview-unavailable"><span><Icon name="file" size={31} /></span><h3>미리보기를 지원하지 않는 형식입니다</h3><p>파일 이름, 크기, 형식 메타데이터만 안전하게 표시합니다.</p></div>
        )}
      </div>
    </div>
  );
}

function Toast({ message, tone, onClose }: { message: string; tone: ToastTone; onClose: () => void }) {
  return (
    <div className={`toast ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span><Icon name={tone === "error" ? "close" : tone === "info" ? "sparkles" : "check"} size={15} /></span>
      <p>{message}</p>
      <button onClick={onClose} aria-label="알림 닫기"><Icon name="close" size={14} /></button>
    </div>
  );
}
