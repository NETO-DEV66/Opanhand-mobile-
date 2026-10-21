import { http, delay, HttpResponse, passthrough } from "msw";
import type { DirectConversationInfo } from "#/api/agent-server-adapter";
import type { AppConversation } from "#/api/conversation-service/agent-server-conversation-service.types";
import {
  ExecutionStatus,
  type OpenHandsEvent,
} from "#/types/agent-server/core";
import {
  TABLE_DEMO_CONVERSATION_ID,
  TABLE_DEMO_EVENTS,
} from "#/fixtures/table-demo-conversation";
import {
  CANVAS_DEMO_CONVERSATION_ID,
  CANVAS_DEMO_EVENTS,
  CANVAS_DEMO_FILE_PATH,
  CANVAS_DEMO_MARKDOWN,
} from "#/fixtures/canvas-demo-conversation";
import { runLocalAgentTurn } from "#/local-runtime/agent";
import { readJson, writeJson } from "#/local-runtime/persistence";
import {
  listLocalEvents,
  localEventCount,
} from "#/local-runtime/conversation-store";

/** Map from conversation id → events returned by GET /events/search */
const CONVERSATION_EVENTS: Record<string, unknown[]> = {
  [TABLE_DEMO_CONVERSATION_ID]: TABLE_DEMO_EVENTS,
  [CANVAS_DEMO_CONVERSATION_ID]: CANVAS_DEMO_EVENTS,
};

const now = Date.now();
const PAGINATION_LOCAL_CONVERSATION_ID = "pagination-local";
const PAGINATION_CLOUD_CONVERSATION_ID = "pagination-cloud";
const PAGINATION_EVENT_COUNT = 100;
const PAGINATION_PAGE_DELAY_MS = 500;
const PAGINATION_BASE_TIME = Date.UTC(2026, 4, 13, 0, 0, 0);

type MockConversation = DirectConversationInfo & {
  selected_repository?: string | null;
  selected_branch?: string | null;
  git_provider?: string | null;
};

type CloudProxyEnvelope = {
  method?: string;
  path?: string;
};

const conversations: MockConversation[] = [
  {
    id: "1",
    title: "My New Project",
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    execution_status: "waiting_for_confirmation",
    // User-authored tags so the layouts menu's Tag Filters section and the
    // card chips have something to show in mock mode.
    tags: { project: "vault", work: "" },
  },
  {
    id: "2",
    title: "Repo Testing",
    created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    execution_status: "idle",
    selected_repository: "octocat/hello-world",
    git_provider: "github",
  },
  {
    id: "3",
    title: "Another Project",
    created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    execution_status: "idle",
    selected_repository: "octocat/earth",
    selected_branch: "main",
  },
  // Conversation whose sandbox has been removed (MISSING). The conversation
  // history is still readable but the sandbox cannot be resumed — the chat
  // input is replaced with a read-only archived banner.
  {
    id: "4",
    title: "Archived Project",
    created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    execution_status: "idle",
    sandbox_status: "MISSING",
  },
  // Conversation whose sandbox encountered an unrecoverable error. Same
  // read-only treatment but with the "Sandbox error" variant of the banner.
  {
    id: "5",
    title: "Errored Project",
    created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    execution_status: "idle",
    sandbox_status: "ERROR",
  },
  {
    id: PAGINATION_LOCAL_CONVERSATION_ID,
    title: "Local pagination fixture",
    created_at: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
    execution_status: "idle",
    workspace: { working_dir: "/workspace/project" },
  },
  {
    id: TABLE_DEMO_CONVERSATION_ID,
    title: "Wide table demo",
    created_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    execution_status: "idle",
    workspace: { working_dir: "/workspace/project" },
  },
  {
    id: CANVAS_DEMO_CONVERSATION_ID,
    title: "Generated canvas demo",
    created_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    execution_status: "idle",
    workspace: { working_dir: "/workspace/project" },
  },
];

const CONVERSATIONS = new Map<string, MockConversation>(
  conversations.map((conversation) => [conversation.id, conversation]),
);

/**
 * Conversations this session created, mirrored to `localStorage`.
 *
 * The seeded fixtures are re-created on every boot, but a conversation the
 * user actually started only exists in this map — without persisting it, a
 * reload would lose the conversation and the chat log attached to it.
 */
const CREATED_CONVERSATIONS_KEY = "openhands-mock-created-conversations";

function loadCreatedConversations(): void {
  const stored = readJson<Record<string, MockConversation>>(
    CREATED_CONVERSATIONS_KEY,
    {},
  );
  for (const [id, conversation] of Object.entries(stored)) {
    if (conversation && typeof conversation.id === "string") {
      CONVERSATIONS.set(id, conversation);
    }
  }
}

function saveCreatedConversations(): void {
  const created: Record<string, MockConversation> = {};
  for (const [id, conversation] of CONVERSATIONS) {
    // Fixtures are rebuilt from code on every boot; only user-made entries
    // need to be written back.
    if (!SEEDED_CONVERSATION_IDS.has(id)) created[id] = conversation;
  }
  writeJson(CREATED_CONVERSATIONS_KEY, created);
}

const SEEDED_CONVERSATION_IDS = new Set(
  conversations.map((conversation) => conversation.id),
);

loadCreatedConversations();

const paginationEventsByConversation = new Map<string, OpenHandsEvent[]>([
  [
    PAGINATION_LOCAL_CONVERSATION_ID,
    createPaginationEvents("Local pagination message"),
  ],
  [
    PAGINATION_CLOUD_CONVERSATION_ID,
    createPaginationEvents("Cloud pagination message"),
  ],
]);

function createPaginationEvent(
  index: number,
  messagePrefix: string,
): OpenHandsEvent {
  return {
    id: `${messagePrefix.toLowerCase().replaceAll(" ", "-")}-${index}`,
    timestamp: new Date(PAGINATION_BASE_TIME + index * 60_000).toISOString(),
    source: "agent",
    llm_message: {
      role: "assistant",
      content: [{ type: "text", text: `${messagePrefix} ${index}` }],
    },
    activated_skills: [],
    extended_content: [],
  };
}

function createPaginationEvents(messagePrefix: string): OpenHandsEvent[] {
  return Array.from({ length: PAGINATION_EVENT_COUNT }, (_, index) =>
    createPaginationEvent(index + 1, messagePrefix),
  );
}

function searchPaginationEvents(
  events: OpenHandsEvent[],
  searchParams: URLSearchParams,
) {
  const limit = Number(searchParams.get("limit") ?? "100");
  const timestampLt = searchParams.get("timestamp__lt");
  const sortOrder = searchParams.get("sort_order");
  const filtered = timestampLt
    ? events.filter((event) => (event.timestamp ?? "") < timestampLt)
    : events;
  const sorted = [...filtered].sort((a, b) =>
    sortOrder === "TIMESTAMP_DESC"
      ? (b.timestamp ?? "").localeCompare(a.timestamp ?? "")
      : (a.timestamp ?? "").localeCompare(b.timestamp ?? ""),
  );

  return {
    items: sorted.slice(0, limit),
    next_page_id: sorted.length > limit ? "next-page" : null,
  };
}

async function maybeReturnPaginationEvents(
  conversationId: string,
  searchParams: URLSearchParams,
) {
  const events = paginationEventsByConversation.get(conversationId);
  if (!events) return null;
  if (searchParams.has("timestamp__lt")) {
    await delay(PAGINATION_PAGE_DELAY_MS);
  }
  return searchPaginationEvents(events, searchParams);
}

function createCloudPaginationConversation(): AppConversation {
  const createdAt = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();
  const updatedAt = createdAt;

  return {
    id: PAGINATION_CLOUD_CONVERSATION_ID,
    created_by_user_id: null,
    selected_repository: null,
    selected_branch: null,
    git_provider: null,
    title: "Cloud pagination fixture",
    trigger: null,
    pr_number: [],
    llm_model: "openhands/claude-haiku-4-5-20251001",
    metrics: null,
    created_at: createdAt,
    updated_at: updatedAt,
    execution_status: ExecutionStatus.IDLE,
    conversation_url: null,
    session_api_key: null,
    sandbox_id: null,
    workspace: { working_dir: "/workspace/project" },
    public: false,
    sub_conversation_ids: [],
  };
}

const CLOUD_PAGINATION_CONVERSATION = createCloudPaginationConversation();

function createConversationResponse(
  conversation: MockConversation,
): DirectConversationInfo {
  return {
    id: conversation.id,
    title: conversation.title ?? null,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    execution_status: conversation.execution_status ?? "idle",
    sandbox_status: conversation.sandbox_status ?? null,
    metrics: conversation.metrics ?? null,
    agent: conversation.agent ?? null,
    workspace: conversation.workspace ?? null,
    tags: conversation.tags ?? null,
  };
}

function listConversationResponses(ids?: string[] | null) {
  if (!ids || ids.length === 0) {
    return Array.from(CONVERSATIONS.values()).map(createConversationResponse);
  }

  return ids.map((id) => {
    const conversation = CONVERSATIONS.get(id);
    return conversation ? createConversationResponse(conversation) : null;
  });
}

export const CONVERSATION_HANDLERS = [
  http.get("*/api/conversations/search", async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const items = Array.from(CONVERSATIONS.values())
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, limit)
      .map(createConversationResponse);

    return HttpResponse.json({ items, next_page_id: null });
  }),

  http.get("*/api/conversations", async ({ request }) => {
    const url = new URL(request.url);
    // Axios serializes arrays as `ids[]=a&ids[]=b` (bracket notation).
    // Fall back to plain `ids` to support both formats.
    const ids =
      url.searchParams.getAll("ids[]").length > 0
        ? url.searchParams.getAll("ids[]")
        : url.searchParams.getAll("ids");
    return HttpResponse.json(listConversationResponses(ids));
  }),

  http.get("*/api/conversations/:conversationId", async ({ params }) => {
    const conversationId = params.conversationId as string;
    const conversation = CONVERSATIONS.get(conversationId);
    if (conversation) {
      return HttpResponse.json(createConversationResponse(conversation));
    }
    return HttpResponse.json(null, { status: 404 });
  }),

  http.post("*/api/conversations", async ({ request }) => {
    await delay();
    const body = (await request.json().catch(() => null)) as {
      initial_message?: {
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
      } | null;
    } | null;
    const conversation: MockConversation = {
      id: `${Math.floor(Math.random() * 100000)}`,
      title: "New Conversation",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      execution_status: "idle",
    };
    CONVERSATIONS.set(conversation.id, conversation);
    saveCreatedConversations();

    // A conversation created with an initial message must produce an answer:
    // on a real backend the sandbox runs it on boot. Run the local turn after
    // the response so the client has the conversation id before events land.
    const initial = body?.initial_message;
    if (initial?.role === "user") {
      const text = (initial.content ?? [])
        .filter((part) => part?.type === "text")
        .map((part) => part.text ?? "")
        .join("");
      if (text.trim()) {
        void runLocalAgentTurn(conversation.id, text);
      }
    }

    return HttpResponse.json(createConversationResponse(conversation), {
      status: 201,
    });
  }),

  http.patch(
    "/api/conversations/:conversationId",
    async ({ params, request }) => {
      const conversationId = params.conversationId as string;
      const conversation = CONVERSATIONS.get(conversationId);

      if (conversation) {
        const body = (await request.json()) as {
          title?: string;
          tags?: Record<string, string>;
        } | null;
        // PATCH replaces the complete tags map (agent-server semantics);
        // title-only and tags-only patches both persist.
        if (body?.title || body?.tags) {
          CONVERSATIONS.set(conversationId, {
            ...conversation,
            ...(body.title ? { title: body.title } : {}),
            ...(body.tags ? { tags: body.tags } : {}),
            updated_at: new Date().toISOString(),
          });
          saveCreatedConversations();
          return HttpResponse.json(null, { status: 200 });
        }
      }
      return HttpResponse.json(null, { status: 404 });
    },
  ),

  http.delete("*/api/conversations/:conversationId", async ({ params }) => {
    const conversationId = params.conversationId as string;
    if (CONVERSATIONS.has(conversationId)) {
      CONVERSATIONS.delete(conversationId);
      saveCreatedConversations();
      return HttpResponse.json(null, { status: 200 });
    }
    return HttpResponse.json(null, { status: 404 });
  }),

  http.get(
    "*/api/conversations/:conversationId/events/count",
    async ({ params }) =>
      HttpResponse.json(localEventCount(params.conversationId as string)),
  ),

  http.get(
    "*/api/conversations/:conversationId/events/search",
    async ({ params, request }) => {
      const conversationId = params.conversationId as string;
      const searchParams = new URL(request.url).searchParams;
      const paginationPage = await maybeReturnPaginationEvents(
        conversationId,
        searchParams,
      );
      if (paginationPage) return HttpResponse.json(paginationPage);

      // Live local-runtime turns come first: they are the authoritative tail
      // for a conversation this build actually ran.
      const localEvents = listLocalEvents(conversationId);
      const staticEvents = CONVERSATION_EVENTS[conversationId] as
        | OpenHandsEvent[]
        | undefined;

      if (localEvents.length > 0 || staticEvents) {
        return HttpResponse.json(
          searchPaginationEvents(
            [...(staticEvents ?? []), ...localEvents],
            searchParams,
          ),
        );
      }

      return HttpResponse.json({ items: [], next_page_id: null });
    },
  ),

  // The direct-to-runtime path: the socket posts a user message here when it
  // is not connected yet, and the local runtime answers it in-process.
  http.post(
    "*/api/conversations/:conversationId/events",
    async ({ params, request }) => {
      const conversationId = params.conversationId as string;
      const body = (await request.json()) as {
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
      } | null;

      if (body?.role === "user") {
        const text = (body.content ?? [])
          .filter((part) => part?.type === "text")
          .map((part) => part.text ?? "")
          .join("");
        void runLocalAgentTurn(conversationId, text);
      }
      return HttpResponse.json({ ok: true });
    },
  ),

  // The generated-canvas fixture behaves like a real workspace artifact:
  // after the chat chip opens the Files drawer, its static-session URL serves
  // the same Markdown bytes carried by the file-editor observation.
  http.get(
    "*/api/conversations/:conversationId/workspace/*",
    ({ params, request }) => {
      const conversationId = params.conversationId?.toString();
      const url = new URL(request.url);
      if (
        conversationId === CANVAS_DEMO_CONVERSATION_ID &&
        url.pathname.endsWith(`/${CANVAS_DEMO_FILE_PATH}`)
      ) {
        return HttpResponse.text(CANVAS_DEMO_MARKDOWN, {
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }
      // Leave every other workspace-file GET on its previous bypass behavior
      // so this fixture handler does not force 404s for unrelated mocks.
      return passthrough();
    },
  ),

  http.post("*/api/conversations/:conversationId/pause", async () =>
    HttpResponse.json({ success: true }),
  ),

  http.post("*/api/conversations/:conversationId/interrupt", async () =>
    HttpResponse.json({ success: true }),
  ),

  http.post("*/api/conversations/:conversationId/run", async () =>
    HttpResponse.json({ success: true }),
  ),

  http.post("*/api/cloud-proxy", async ({ request }) => {
    const envelope = (await request.json()) as CloudProxyEnvelope;
    const upstreamPath = envelope.path ?? "/";
    const upstreamUrl = new URL(upstreamPath, "https://mock-cloud.test");

    if (upstreamUrl.pathname === "/api/v1/app-conversations") {
      const ids = upstreamUrl.searchParams.getAll("ids");
      if (ids.length > 0) {
        return HttpResponse.json(
          ids.map((id) =>
            id === PAGINATION_CLOUD_CONVERSATION_ID
              ? CLOUD_PAGINATION_CONVERSATION
              : null,
          ),
        );
      }
    }

    if (upstreamUrl.pathname === "/api/v1/app-conversations/search") {
      return HttpResponse.json({
        items: [CLOUD_PAGINATION_CONVERSATION],
        next_page_id: null,
      });
    }

    if (
      upstreamUrl.pathname ===
      `/api/v1/conversation/${PAGINATION_CLOUD_CONVERSATION_ID}/events/search`
    ) {
      const paginationPage = await maybeReturnPaginationEvents(
        PAGINATION_CLOUD_CONVERSATION_ID,
        upstreamUrl.searchParams,
      );
      return HttpResponse.json(paginationPage);
    }

    if (upstreamUrl.pathname === "/api/v1/settings") {
      return HttpResponse.json({
        llm_model: "openhands/claude-haiku-4-5-20251001",
        llm_base_url: "",
        llm_api_key: null,
        llm_api_key_set: false,
        search_api_key_set: false,
        agent: "CodeActAgent",
        language: "en",
        user_consents_to_analytics: false,
        provider_tokens_set: { github: "" },
      });
    }

    if (upstreamUrl.pathname === "/api/keys/current") {
      return HttpResponse.json({
        id: "mock-key",
        name: "Mock key",
        org_id: "org-1",
        user_id: "user-1",
        auth_type: "api_key",
      });
    }

    if (upstreamUrl.pathname === "/api/organizations") {
      return HttpResponse.json({
        items: [{ id: "org-1", name: "Mock Org", is_personal: true }],
        current_org_id: "org-1",
      });
    }

    if (upstreamUrl.pathname === "/api/organizations/org-1/me") {
      return HttpResponse.json({ org_id: "org-1", user_id: "org-1" });
    }

    if (upstreamUrl.pathname === "/api/authenticate") {
      return HttpResponse.json({ ok: true });
    }

    return HttpResponse.json({});
  }),

  http.post("*/api/conversations/:conversationId/ask_agent", async () =>
    HttpResponse.json({ response: "Mock agent response" }),
  ),

  http.get("*/api/vscode/url", async () => HttpResponse.json({ url: null })),

  http.post("*/api/skills", async () => HttpResponse.json({ skills: [] })),

  http.post(
    "/api/v1/conversations/:conversationId/pending-messages",
    async () => HttpResponse.json({ id: "mock-pending-id", position: 0 }),
  ),
];
