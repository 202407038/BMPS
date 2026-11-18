import type { AnalysisResult, DemoState, OpinionItem, Participant, Session } from "@bmps/contracts";

const current: Participant = {
  id: "participant-you",
  name: "익명 여우",
  initials: "나",
  color: "#6c5ce7",
  online: true,
};

const people: Participant[] = [
  current,
  { id: "p-mint", name: "익명 민트", initials: "민", color: "#16a085", online: true },
  { id: "p-blue", name: "익명 파랑", initials: "파", color: "#3976e8", online: true },
  { id: "p-coral", name: "익명 산호", initials: "산", color: "#ee6c5f", online: true },
  { id: "p-lemon", name: "익명 레몬", initials: "레", color: "#d39b16", online: true },
];

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function textItem(
  id: string,
  author: Participant,
  content: string,
  cluster: OpinionItem["cluster"],
  minutes: number,
  agree: number,
): OpinionItem {
  return {
    id,
    sessionId: "session-festival",
    kind: "TEXT",
    authorId: author.id,
    authorName: author.name,
    authorColor: author.color,
    content,
    url: null,
    file: null,
    cluster,
    createdAt: ago(minutes),
    reactions: { agree, curious: 0 },
  };
}

function fallbackAnalysis(): AnalysisResult {
  return {
    id: "analysis-fallback",
    sessionId: "session-festival",
    status: "COMPLETED",
    createdAt: ago(7),
    snapshotItemIds: ["idea-1", "idea-2", "idea-3", "idea-4", "idea-5", "idea-6"],
    flowSummary:
      "방문 동기를 만드는 야간 콘텐츠와 지역 상점의 지속 가능한 참여 구조가 핵심 축으로 모였습니다. 주민이 직접 이야기를 만드는 방식이 두 축을 연결합니다.",
    linkCandidates: [
      {
        id: "fallback-link-1",
        itemIds: ["idea-1", "idea-3", "idea-6"],
        label: "야간 방문 동기 × 로컬 미식",
        rationale: "약한 저녁 방문 이유를 지역 음식과 산책 경험으로 보완할 수 있습니다.",
        confidence: 92,
      },
      {
        id: "fallback-link-2",
        itemIds: ["idea-2", "idea-4"],
        label: "주민 이야기 × 지속 가능성",
        rationale: "주민의 이야기를 축제 자산으로 쌓으면 일회성 콘텐츠 의존도를 낮출 수 있습니다.",
        confidence: 84,
      },
    ],
    directions: [
      {
        id: "fallback-direction-1",
        title: "골목의 밤, 2주 파일럿",
        description: "금·토 저녁에 상점 8곳과 조명 산책, 한정 메뉴를 묶어 작은 실험부터 시작합니다.",
        score: 94,
      },
      {
        id: "fallback-direction-2",
        title: "주민이 만드는 오디오 지도",
        description: "인터뷰를 1분 음성 이야기로 편집해 장소마다 QR로 연결합니다.",
        score: 86,
      },
      {
        id: "fallback-direction-3",
        title: "다회용 축제 키트",
        description: "간판과 안내물을 모듈화해 다음 행사에서도 반복 사용합니다.",
        score: 78,
      },
    ],
    prompt: {
      id: "fallback-prompt",
      question: "첫 실험은 ‘골목의 밤’ 파일럿으로 좁혀볼까요?",
      options: ["좋아요", "조금 더 논의", "다른 방향"],
      votes: { "좋아요": 4, "조금 더 논의": 1, "다른 방향": 0 },
      currentParticipantVote: null,
    },
  };
}

export function createFallbackState(): DemoState {
  const items: OpinionItem[] = [
    textItem("idea-1", people[2]!, "저녁 시간대에는 축제장을 다시 찾을 이유가 약해요.", "discover", 48, 5),
    {
      id: "idea-2",
      sessionId: "session-festival",
      kind: "FILE",
      authorId: people[3]!.id,
      authorName: people[3]!.name,
      authorColor: people[3]!.color,
      content: "상인과 주민 12명의 공통 의견을 정리했어요.",
      url: null,
      file: {
        name: "현장 인터뷰 요약.pdf",
        size: 2_840_320,
        mimeType: "application/pdf",
        previewable: true,
      },
      cluster: "discover",
      createdAt: ago(35),
      reactions: { agree: 4, curious: 2 },
    },
    textItem("idea-3", people[4]!, "해가 진 뒤 골목을 잇는 조명 산책 코스는 어때요?", "experience", 29, 6),
    textItem("idea-4", current, "상점마다 도장을 모으면 마지막 광장에서 작은 선물을 줘요.", "experience", 24, 3),
    textItem("idea-5", people[1]!, "주민 목소리로 동네 이야기를 들려주는 오디오 지도를 만들어요.", "experience", 19, 5),
    textItem("idea-6", people[2]!, "금·토 저녁, 상점 8곳만 모아 2주간 먼저 시험해요.", "action", 9, 7),
  ];

  const otherSessions: Session[] = [
    {
      id: "session-campus",
      title: "캠퍼스 이동 경험",
      topic: "처음 방문한 사람도 헤매지 않는 캠퍼스 길 찾기",
      accessPolicy: "PUBLIC",
      hostId: people[1]!.id,
      accent: "#1a9a78",
      createdAt: ago(1_400),
      participants: people.slice(0, 4).map((person) => ({ ...person })),
      items: [],
      analyses: [],
      cursor: 1,
    },
    {
      id: "session-side-project",
      title: "사이드 프로젝트 아이디어",
      topic: "이번 달 안에 검증할 수 있는 작은 제품 찾기",
      accessPolicy: "LINK_ONLY",
      hostId: current.id,
      accent: "#ee8b3a",
      createdAt: ago(2_800),
      participants: [{ ...current }],
      items: [],
      analyses: [],
      cursor: 1,
    },
  ];

  return {
    currentParticipant: { ...current },
    generatedAt: new Date().toISOString(),
    sessions: [
      {
        id: "session-festival",
        title: "지역 축제 리브랜딩",
        topic: "주민과 방문객이 다시 찾는 지속 가능한 동네 축제 만들기",
        accessPolicy: "LINK_ONLY",
        hostId: current.id,
        accent: "#6c5ce7",
        createdAt: ago(220),
        participants: people.map((person) => ({ ...person })),
        items,
        analyses: [fallbackAnalysis()],
        cursor: 10,
      },
      ...otherSessions,
    ],
  };
}
