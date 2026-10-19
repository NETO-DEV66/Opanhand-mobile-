import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendConnectionOptions } from "./backend-form-modal";

afterEach(() => {
  vi.clearAllMocks();
});

describe("BackendConnectionOptions — manual backend connection", () => {
  it("renders the host and API key fields without a backend-kind selector", () => {
    render(
      <BackendConnectionOptions
        onConnected={vi.fn()}
        initialManualBackend={{ host: "https://app.example.com" }}
      />,
    );

    expect(screen.getByTestId("add-backend-host")).toBeInTheDocument();
    expect(screen.getByTestId("add-backend-api-key")).toBeInTheDocument();
    // AgentDeck only talks to a self-run agent server, so the legacy
    // Local/Cloud kind toggle must not be offered.
    expect(screen.queryByTestId("add-backend-kind")).not.toBeInTheDocument();
  });

  it("submits a local-kind backend for a self-hosted host", async () => {
    const onConnected = vi.fn();
    render(
      <BackendConnectionOptions
        onConnected={onConnected}
        initialManualBackend={{
          name: "My Server",
          host: "app.example.build.one",
          apiKey: "sk-test-key",
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("add-backend-submit"));

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
    expect(onConnected).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "local",
        name: "My Server",
        host: "https://app.example.build.one",
        apiKey: "sk-test-key",
      }),
      "manual",
      expect.objectContaining({ agentServerVersion: expect.any(String) }),
    );
  });
});
