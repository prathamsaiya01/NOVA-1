const OLLAMA_URL = "http://localhost:11434/api/chat";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

const conversations = new Map<string, Message[]>();

const SYSTEM_PROMPT: Message = {
  role: "system",
  content: `
You are NOVA AI.

You are friendly, intelligent and helpful.

Remember previous messages in the conversation.

Answer naturally.

Never mention that you are using memory.

Keep answers concise unless the user asks for details.
`,
};

export async function askModel(
  sessionId: string,
  message: string
): Promise<string> {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, [SYSTEM_PROMPT]);
  }

  const history = conversations.get(sessionId)!;

  history.push({
    role: "user",
    content: message,
  });

  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen2.5:7b",
      messages: history,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status}): ${text || "Unknown error"}`);
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const json = JSON.parse(trimmed);

        const content = json?.message?.content;
        if (typeof content === "string") {
          reply += content;
        }
      } catch {
        // Ignore incomplete JSON fragments from partial chunk boundaries.
      }
    }
  }

  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer.trim());
      const content = json?.message?.content;
      if (typeof content === "string") {
        reply += content;
      }
    } catch {
      // Ignore trailing partial chunk data.
    }
  }

  history.push({
    role: "assistant",
    content: reply,
  });

  if (history.length > 21) {
    const system = history[0];
    const recent = history.slice(-20);
    conversations.set(sessionId, [system, ...recent]);
  }

  return reply;
}