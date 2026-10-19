import { AGENT_CANVAS_CLIENT_SOURCE } from "#/api/client-source";
import { getBackendTelemetryProperties } from "#/services/telemetry-context";
import { trackEvent } from "#/services/telemetry";

export type CloudConnectionSource =
  | "onboarding"
  | "add_backend_modal"
  | "manage_backends_modal";

const CLOUD_CONVERSATION_READY_INSERT_ID_PREFIX = `${AGENT_CANVAS_CLIENT_SOURCE}:cloud_conversation_ready`;

function trackCloudFunnelEvent(
  event: string,
  properties: Record<string, unknown>,
): void {
  void trackEvent(event, properties);
}

function cloudConversationBackendContext() {
  return getBackendTelemetryProperties({
    backendKind: "cloud",
  });
}

export function trackCloudConversationReady(
  taskId: string,
  conversationId: string,
): void {
  trackCloudFunnelEvent("cloud_conversation_ready", {
    ...cloudConversationBackendContext(),
    $insert_id: `${CLOUD_CONVERSATION_READY_INSERT_ID_PREFIX}:${taskId}`,
    task_id: taskId,
    conversation_id: conversationId,
  });
}
