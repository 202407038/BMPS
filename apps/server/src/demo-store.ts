import type {
  AnalysisResult,
  ClusterId,
  CreateItemInput,
  CreateSessionInput,
  DemoState,
  OpinionItem,
  Participant,
  Session,
} from "@bmps/contracts";

const CURRENT_PARTICIPANT: Participant = {
  id: "participant-you",
  name: "익명 여우",
  initials: "나",
  color: "#6c5ce7",
  online: true,
};

const PARTICIPANTS: Participant[] = [
  CURRENT_PARTICIPANT,
  { id: "participant-mint", name: "익명 민트", initials: "민", color: "#16a085", online: true },
  { id: "participant-blue", name: "익명 파랑", initials: "파", color: "#3976e8", online: true },
  { id: "participant-coral", name: "익명 산호", initials: "산", color: "#ee6c5f", online: true },
  { id: "participant-lemon", name: "익명 레몬", initials: "레", color: "#d39b16", online: true },
  { id: "participant-lilac", name: "익명 라일락", initials: "라", color: "#9b59b6", online: false },
];

const minutesAgo = (minutes: number, now = Date.now()) =>
  new Date(now - minutes * 60_000).toISOString();

function item(
  id: string,
  sessionId: string,
  kind: OpinionItem["kind"],
  author: Participant,
  content: string,
  cluster: ClusterId,
  createdAt: string,
  extras: Partial<Pick<OpinionItem, "url" | "file" | "reactions">> = {},
): OpinionItem {
  return {
    id,
    sessionId,
    kind,
    authorId: author.id,
    authorName: author.name,
    authorColor: author.color,
    content,
    url: extras.url ?? null,
    file: extras.file ?? null,
    cluster,
    createdAt,
    reactions: extras.reactions ?? { agree: 0, curious: 0 },
  };
}

function initialFestivalAnalysis(now: number): AnalysisResult {
  return {
    id: "analysis-festival-1",
    sessionId: "session-festival",
    status: "COMPLETED",
    createdAt: minutesAgo(7, now),
    snapshotItemIds: ["idea-1", "idea-2", "idea-3", "idea-4", "idea-5", "idea-6", "idea-7", "idea-8"],
    flowSummary:
      "방문 동기를 만드는 야간 콘텐츠와 지역 상점의 지속 가능한 참여 구조가 핵심 축으로 모였습니다. 주민이 직접 이야기를 만드는 방식이 두 축을 자연스럽게 연결합니다.",
    linkCandidates: [
      {
        id: "link-1",
        itemIds: ["idea-1", "idea-4", "idea-8"],
        label: "야간 방문 동기 × 로컬 미식",
        rationale: "저녁 시간대의 약한 방문 이유를 지역 음식과 야시장 경험으로 보완할 수 있습니다.",
        confidence: 92,
      },
      {
        id: "link-2",
        itemIds: ["idea-3", "idea-6", "idea-7"],
        label: "주민 이야기 × 재사용 가능한 콘텐츠",
        rationale: "주민 인터뷰를 축제 자산으로 축적하면 일회성 장식 의존도를 낮출 수 있습니다.",
        confidence: 84,
      },
    ],
    directions: [
      {
        id: "direction-1",
        title: "골목의 밤, 2주 파일럿",
        description: "금·토 저녁에 상점 8곳과 조명 산책, 한정 메뉴를 묶어 작은 실험부터 시작합니다.",
        score: 94,
      },
      {
        id: "direction-2",
        title: "주민이 만드는 오디오 지도",
        description: "인터뷰를 1분 음성 이야기로 편집해 장소마다 QR로 연결합니다.",
        score: 86,
      },
      {
        id: "direction-3",
        title: "다회용 축제 키트",
        description: "간판과 안내물을 모듈화해 다음 행사에서도 반복 사용할 수 있게 만듭니다.",
        score: 78,
      },
    ],
    prompt: {
      id: "prompt-festival-1",
      question: "첫 실험은 ‘골목의 밤’ 파일럿으로 좁혀볼까요?",
      options: ["좋아요", "조금 더 논의", "다른 방향"],
      votes: { "좋아요": 4, "조금 더 논의": 1, "다른 방향": 0 },
      currentParticipantVote: null,
    },
  };
}

export function createDemoState(): DemoState {
  const now = Date.now();
  const festivalItems: OpinionItem[] = [
    item(
      "idea-1",
      "session-festival",
      "TEXT",
      PARTICIPANTS[2]!,
      "저녁 시간대에는 축제장을 다시 찾을 이유가 약해요.",
      "discover",
      minutesAgo(48, now),
      { reactions: { agree: 5, curious: 1 } },
    ),
    item(
      "idea-2",
      "session-festival",
      "LINK",
      PARTICIPANTS[1]!,
      "작은 상점들이 함께 만든 성수 야시장 사례",
      "discover",
      minutesAgo(41, now),
      {
        url: "https://www.seoul.go.kr/",
        reactions: { agree: 2, curious: 3 },
      },
    ),
    item(
      "idea-3",
      "session-festival",
      "FILE",
      PARTICIPANTS[3]!,
      "상인과 주민 12명의 공통 의견을 정리했어요.",
      "discover",
      minutesAgo(35, now),
      {
        file: {
          name: "현장 인터뷰 요약.pdf",
          size: 2_840_320,
          mimeType: "application/pdf",
          previewable: true,
        },
        reactions: { agree: 4, curious: 2 },
      },
    ),
    item(
      "idea-4",
      "session-festival",
      "TEXT",
      PARTICIPANTS[4]!,
      "해가 진 뒤 골목을 잇는 조명 산책 코스는 어때요?",
      "experience",
      minutesAgo(29, now),
      { reactions: { agree: 6, curious: 2 } },
    ),
    item(
      "idea-5",
      "session-festival",
      "TEXT",
      PARTICIPANTS[0]!,
      "상점마다 도장을 모으면 마지막 광장에서 작은 선물을 주고 싶어요.",
      "experience",
      minutesAgo(24, now),
      { reactions: { agree: 3, curious: 1 } },
    ),
    item(
      "idea-6",
      "session-festival",
      "TEXT",
      PARTICIPANTS[1]!,
      "주민의 목소리로 동네 이야기를 들려주는 오디오 지도를 만들어요.",
      "experience",
      minutesAgo(19, now),
      { reactions: { agree: 5, curious: 4 } },
    ),
    item(
      "idea-7",
      "session-festival",
      "TEXT",
      PARTICIPANTS[3]!,
      "일회용 현수막 대신 매년 다시 쓰는 모듈 간판을 제작해요.",
      "action",
      minutesAgo(14, now),
      { reactions: { agree: 4, curious: 0 } },
    ),
    item(
      "idea-8",
      "session-festival",
      "TEXT",
      PARTICIPANTS[2]!,
      "금·토 저녁, 상점 8곳만 모아 2주간 먼저 시험해 볼 수 있어요.",
      "action",
      minutesAgo(9, now),
      { reactions: { agree: 7, curious: 1 } },
    ),
  ];

  const campusParticipants = [PARTICIPANTS[0]!, PARTICIPANTS[1]!, PARTICIPANTS[4]!, PARTICIPANTS[5]!];
  const campusItems: OpinionItem[] = [
    item(
      "campus-idea-1",
      "session-campus",
      "TEXT",
      PARTICIPANTS[4]!,
      "강의실을 처음 찾을 때 건물 이름보다 랜드마크가 더 도움이 돼요.",
      "discover",
      minutesAgo(180, now),
      { reactions: { agree: 3, curious: 0 } },
    ),
    item(
      "campus-idea-2",
      "session-campus",
      "TEXT",
      PARTICIPANTS[0]!,
      "비 오는 날에는 지붕이 있는 경로를 우선 추천하면 좋겠어요.",
      "experience",
      minutesAgo(150, now),
      { reactions: { agree: 4, curious: 1 } },
    ),
    item(
      "campus-idea-3",
      "session-campus",
      "LINK",
      PARTICIPANTS[1]!,
      "접근성 경로를 잘 보여주는 지도 사례입니다.",
      "discover",
      minutesAgo(115, now),
      { url: "https://www.openstreetmap.org/", reactions: { agree: 2, curious: 2 } },
    ),
    item(
      "campus-idea-4",
      "session-campus",
      "TEXT",
      PARTICIPANTS[5]!,
      "학생들이 직접 ‘길 찾기 어려운 지점’을 지도에 표시하게 해요.",
      "action",
      minutesAgo(90, now),
      { reactions: { agree: 4, curious: 2 } },
    ),
  ];

  return {
    currentParticipant: { ...CURRENT_PARTICIPANT },
    generatedAt: new Date(now).toISOString(),
    sessions: [
      {
        id: "session-festival",
        title: "지역 축제 리브랜딩",
        topic: "주민과 방문객이 다시 찾는 지속 가능한 동네 축제 만들기",
        accessPolicy: "LINK_ONLY",
        hostId: CURRENT_PARTICIPANT.id,
        accent: "#6c5ce7",
        createdAt: minutesAgo(220, now),
        participants: PARTICIPANTS.map((participant) => ({ ...participant })),
        items: festivalItems,
        analyses: [initialFestivalAnalysis(now)],
        cursor: 14,
      },
      {
        id: "session-campus",
        title: "캠퍼스 이동 경험",
        topic: "처음 방문한 사람도 헤매지 않는 캠퍼스 길 찾기",
        accessPolicy: "PUBLIC",
        hostId: PARTICIPANTS[1]!.id,
        accent: "#1a9a78",
        createdAt: minutesAgo(1_400, now),
        participants: campusParticipants.map((participant) => ({ ...participant })),
        items: campusItems,
        analyses: [],
        cursor: 6,
      },
      {
        id: "session-side-project",
        title: "사이드 프로젝트 아이디어",
        topic: "이번 달 안에 검증할 수 있는 작은 제품 찾기",
        accessPolicy: "LINK_ONLY",
        hostId: CURRENT_PARTICIPANT.id,
        accent: "#ee8b3a",
        createdAt: minutesAgo(2_800, now),
        participants: [{ ...CURRENT_PARTICIPANT }],
        items: [],
        analyses: [],
        cursor: 1,
      },
    ],
  };
}

export class DemoError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createGeneratedAnalysis(session: Session): AnalysisResult {
  const now = new Date().toISOString();
  const grouped = new Map<ClusterId, OpinionItem[]>();
  for (const entry of session.items) {
    const entries = grouped.get(entry.cluster) ?? [];
    entries.push(entry);
    grouped.set(entry.cluster, entries);
  }

  const clusterNames: Record<ClusterId, string> = {
    discover: "문제 발견",
    experience: "핵심 경험",
    action: "실행 아이디어",
  };
  const populated = (["discover", "experience", "action"] as const).filter(
    (cluster) => (grouped.get(cluster)?.length ?? 0) > 0,
  );

  const linkCandidates = populated
    .map((cluster, index) => {
      const entries = grouped.get(cluster) ?? [];
      if (entries.length < 2) return null;
      return {
        id: `link-${crypto.randomUUID()}`,
        itemIds: entries.slice(-3).map((entry) => entry.id),
        label: `${clusterNames[cluster]}에서 발견한 공통 신호`,
        rationale: `${entries.length}개 의견이 같은 맥락을 가리킵니다. 반복된 표현을 하나의 실험 가설로 묶을 수 있습니다.`,
        confidence: Math.max(72, 94 - index * 7),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .slice(0, 2);

  const tailoredDirections = session.id === "session-campus"
    ? [
        ["날씨를 반영한 길 찾기", "비·더위·야간 조건에 따라 가장 편안한 경로를 먼저 제안합니다.", 91],
        ["학생 참여형 불편 지도", "헤매는 지점을 학생이 표시하고 다음 안내 개선에 바로 반영합니다.", 85],
        ["랜드마크 중심 안내", "건물 번호 대신 눈에 보이는 장소를 기준으로 짧은 안내 문구를 만듭니다.", 79],
      ] as const
    : [
        ["가장 작은 현장 실험", "반응이 많은 아이디어 하나를 골라 2주 안에 관찰 가능한 실험으로 바꿉니다.", 90],
        ["참여자 공동 프로토타입", "서로 연결된 의견을 한 화면에 묶고 참여자가 우선순위를 직접 정합니다.", 83],
        ["다음 인터뷰 질문", "의견 사이의 빈틈을 확인할 질문 세 개를 만들고 다음 참여자에게 묻습니다.", 76],
      ] as const;

  const firstDirection = tailoredDirections[0][0];
  return {
    id: `analysis-${crypto.randomUUID()}`,
    sessionId: session.id,
    status: "COMPLETED",
    createdAt: now,
    snapshotItemIds: session.items.map((entry) => entry.id),
    flowSummary: `${session.items.length}개 의견은 ${populated.map((cluster) => clusterNames[cluster]).join(", ")}의 흐름으로 정리됩니다. 참여자 반응이 높은 아이디어를 작은 실험으로 좁히는 단계입니다.`,
    linkCandidates,
    directions: tailoredDirections.map(([title, description, score], index) => ({
      id: `direction-${crypto.randomUUID()}-${index}`,
      title,
      description,
      score,
    })),
    prompt: {
      id: `prompt-${crypto.randomUUID()}`,
      question: `다음 단계로 ‘${firstDirection}’을 구체화할까요?`,
      options: ["좋아요", "조금 더 논의", "다른 방향"],
      votes: { "좋아요": 0, "조금 더 논의": 0, "다른 방향": 0 },
      currentParticipantVote: null,
    },
  };
}

export class DemoStore {
  private state: DemoState = createDemoState();

  getState(): DemoState {
    return clone(this.state);
  }

  reset(): DemoState {
    this.state = createDemoState();
    return this.getState();
  }

  createSession(input: CreateSessionInput): DemoState {
    if (this.state.sessions.length >= 20) {
      throw new DemoError("ACTIVE_SESSION_CAPACITY_REACHED", "활성 세션은 최대 20개까지 만들 수 있습니다.", 409);
    }

    const session: Session = {
      id: `session-${crypto.randomUUID()}`,
      title: input.title,
      topic: input.topic,
      accessPolicy: input.accessPolicy,
      hostId: this.state.currentParticipant.id,
      accent: ["#6c5ce7", "#1a9a78", "#ee8b3a", "#3976e8"][this.state.sessions.length % 4]!,
      createdAt: new Date().toISOString(),
      participants: [{ ...this.state.currentParticipant }],
      items: [],
      analyses: [],
      cursor: 1,
    };
    this.state.sessions.unshift(session);
    this.touch();
    return this.getState();
  }

  createItem(sessionId: string, input: CreateItemInput): DemoState {
    const session = this.findSession(sessionId);
    const current = this.state.currentParticipant;
    const file = input.kind === "FILE"
      ? {
          ...input.file,
          previewable: input.file.mimeType.startsWith("image/") || input.file.mimeType === "application/pdf",
        }
      : null;

    const newItem: OpinionItem = {
      id: `item-${crypto.randomUUID()}`,
      sessionId,
      kind: input.kind,
      authorId: current.id,
      authorName: current.name,
      authorColor: current.color,
      content: input.content,
      url: input.kind === "LINK" ? input.url : null,
      file,
      cluster: input.cluster,
      createdAt: new Date().toISOString(),
      reactions: { agree: 0, curious: 0 },
    };

    session.items.push(newItem);
    if (!session.participants.some((participant) => participant.id === current.id)) {
      session.participants.push({ ...current });
    }
    session.cursor += 1;
    this.touch();
    return this.getState();
  }

  deleteItem(sessionId: string, itemId: string): DemoState {
    const session = this.findSession(sessionId);
    const itemIndex = session.items.findIndex((entry) => entry.id === itemId);
    if (itemIndex < 0) {
      throw new DemoError("ITEM_NOT_FOUND", "삭제할 의견을 찾지 못했습니다.", 404);
    }
    const target = session.items[itemIndex]!;
    const actorId = this.state.currentParticipant.id;
    if (target.authorId !== actorId && session.hostId !== actorId) {
      throw new DemoError("ITEM_DELETE_FORBIDDEN", "작성자 또는 세션 방장만 삭제할 수 있습니다.", 403);
    }
    session.items.splice(itemIndex, 1);
    session.cursor += 1;
    this.touch();
    return this.getState();
  }

  analyse(sessionId: string): DemoState {
    const session = this.findSession(sessionId);
    if (session.items.length === 0) {
      throw new DemoError("ANALYSIS_INPUT_EMPTY", "분석할 의견을 먼저 추가해 주세요.", 422);
    }
    session.analyses.push(createGeneratedAnalysis(session));
    session.cursor += 1;
    this.touch();
    return this.getState();
  }

  react(analysisId: string, option: string): DemoState {
    const analysis = this.state.sessions
      .flatMap((session) => session.analyses)
      .find((entry) => entry.id === analysisId);
    if (!analysis) {
      throw new DemoError("ANALYSIS_NOT_FOUND", "분석 결과를 찾지 못했습니다.", 404);
    }
    if (!analysis.prompt.options.includes(option)) {
      throw new DemoError("VALIDATION_ERROR", "선택할 수 없는 응답입니다.");
    }

    const previousVote = analysis.prompt.currentParticipantVote;
    if (previousVote) {
      analysis.prompt.votes[previousVote] = Math.max(0, (analysis.prompt.votes[previousVote] ?? 1) - 1);
    }
    analysis.prompt.votes[option] = (analysis.prompt.votes[option] ?? 0) + 1;
    analysis.prompt.currentParticipantVote = option;
    this.findSession(analysis.sessionId).cursor += 1;
    this.touch();
    return this.getState();
  }

  private findSession(sessionId: string): Session {
    const session = this.state.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      throw new DemoError("SESSION_NOT_AVAILABLE", "세션을 찾을 수 없습니다.", 404);
    }
    return session;
  }

  private touch() {
    this.state.generatedAt = new Date().toISOString();
  }
}
