import { z } from "zod";

export const CONTRACT_VERSION = "0.2.0-demo" as const;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const accessPolicies = ["PUBLIC", "LINK_ONLY"] as const;
export const itemKinds = ["TEXT", "LINK", "FILE"] as const;
export const clusterIds = ["discover", "experience", "action"] as const;

export type AccessPolicy = (typeof accessPolicies)[number];
export type ItemKind = (typeof itemKinds)[number];
export type ClusterId = (typeof clusterIds)[number];

export interface Participant {
  id: string;
  name: string;
  initials: string;
  color: string;
  online: boolean;
}

export interface FileMeta {
  name: string;
  size: number;
  mimeType: string;
  previewable: boolean;
}

export interface ItemReactionSummary {
  agree: number;
  curious: number;
}

export interface OpinionItem {
  id: string;
  sessionId: string;
  kind: ItemKind;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  url: string | null;
  file: FileMeta | null;
  cluster: ClusterId;
  createdAt: string;
  reactions: ItemReactionSummary;
}

export interface LinkCandidate {
  id: string;
  itemIds: string[];
  label: string;
  rationale: string;
  confidence: number;
}

export interface DirectionCandidate {
  id: string;
  title: string;
  description: string;
  score: number;
}

export interface ConfirmationPrompt {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  currentParticipantVote: string | null;
}

export interface AnalysisResult {
  id: string;
  sessionId: string;
  status: "COMPLETED";
  createdAt: string;
  snapshotItemIds: string[];
  flowSummary: string;
  linkCandidates: LinkCandidate[];
  directions: DirectionCandidate[];
  prompt: ConfirmationPrompt;
}

export interface Session {
  id: string;
  title: string;
  topic: string;
  accessPolicy: AccessPolicy;
  hostId: string;
  accent: string;
  createdAt: string;
  participants: Participant[];
  items: OpinionItem[];
  analyses: AnalysisResult[];
  cursor: number;
}

export interface DemoState {
  currentParticipant: Participant;
  sessions: Session[];
  generatedAt: string;
}

export const createSessionInputSchema = z.object({
  title: z.string().trim().min(2, "세션 이름은 2자 이상 입력해 주세요.").max(60),
  topic: z.string().trim().min(2, "논의할 주제를 입력해 주세요.").max(140),
  accessPolicy: z.enum(accessPolicies),
});

const baseItemFields = {
  content: z.string().trim().max(1_000),
  cluster: z.enum(clusterIds).default("action"),
};

export const createItemInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEXT"),
    content: baseItemFields.content.min(1, "의견을 입력해 주세요."),
    cluster: baseItemFields.cluster,
  }),
  z.object({
    kind: z.literal("LINK"),
    content: baseItemFields.content.min(1, "링크 설명을 입력해 주세요."),
    url: z.url("올바른 주소를 입력해 주세요.").refine(
      (value) => value.startsWith("https://") || value.startsWith("http://"),
      "HTTP(S) 주소만 사용할 수 있습니다.",
    ),
    cluster: baseItemFields.cluster,
  }),
  z.object({
    kind: z.literal("FILE"),
    content: baseItemFields.content,
    file: z.object({
      name: z.string().trim().min(1).max(255),
      size: z.number().int().nonnegative().max(MAX_FILE_SIZE_BYTES, "파일은 20 MB 이하여야 합니다."),
      mimeType: z.string().max(120),
    }),
    cluster: baseItemFields.cluster,
  }),
]);

export const reactionInputSchema = z.object({
  option: z.string().trim().min(1).max(80),
});

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export type CreateItemInput = z.infer<typeof createItemInputSchema>;
export type ReactionInput = z.infer<typeof reactionInputSchema>;

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}
