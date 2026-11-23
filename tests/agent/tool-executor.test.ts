import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeToolCall } from "@/lib/agent/tools/executor";
import { AgentContext } from "@/lib/agent/types";

describe("SaansAI Tool Execution Engine — Safety, Timeout & Validation", () => {
  const dummyContext: AgentContext = {
    userId: "test_executor_user",
    conversationId: "conv_test_123",
  };

  it("returns TOOL_NOT_FOUND error for non-existent tools", async () => {
    const res = await executeToolCall("non_existent_tool_xyz", "call_1", {}, dummyContext);
    assert.strictEqual(res.isError, true);
    assert.strictEqual(res.toolName, "non_existent_tool_xyz");
    assert.ok(
      typeof res.result === "object" && res.result !== null && "error" in res.result,
      "Expected error object in result"
    );
  });

  it("validates argument schemas and returns structured validation error", async () => {
    // latitude must be <= 90
    const res = await executeToolCall(
      "get_current_aqi",
      "call_2",
      { latitude: 999 },
      dummyContext
    );

    assert.strictEqual(res.isError, true);
    assert.ok(
      typeof res.result === "object" && res.result !== null && "error" in res.result,
      "Expected error object in result"
    );
    assert.strictEqual((res.result as { error: string }).error, "INVALID_TOOL_ARGUMENTS");
  });

  it("successfully executes valid registered tools and tracks execution latency", async () => {
    const res = await executeToolCall(
      "get_current_aqi",
      "call_3",
      { lat: 28.6139, lon: 77.2090 },
      dummyContext
    );

    assert.strictEqual(res.isError, false);
    assert.strictEqual(res.toolName, "get_current_aqi");
    assert.strictEqual(typeof res.executionTimeMs, "number");
    assert.ok(res.executionTimeMs >= 0);
    assert.ok(
      typeof res.result === "object" && res.result !== null && "cpcbNAQI" in res.result
    );
  });
});
