// AI provider adapter for running the app outside Macaly.
// The original export called Macaly's internal proxy. This implementation
// keeps the existing callMacalyJson() interface so recipes.ts and drinks.ts
// do not need provider-specific changes.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"
const DEFAULT_MODEL = "claude-sonnet-4-6"

type MessageContent =
  | string
  | Array<{
      type: string
      text?: string
      image?: string
      mediaType?: string
    }>

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: MessageContent
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Backwards-compatible adapter for the former Macaly AI call.
 *
 * The existing callers pass:
 *   { preset, temperature, messages }
 * and expect:
 *   { text }
 *
 * We translate that shape to Anthropic's Messages API, including base64 image
 * blocks used by the photo ingredient/recipe actions.
 */
export async function callMacalyJson(
  _path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const apiKey = requiredEnv("ANTHROPIC_API_KEY")
  const messages = (body.messages ?? []) as ChatMessage[]
  const systemMessage = messages.find((message) => message.role === "system")
  const conversationMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: normalizeContent(message.content),
    }))

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 4096,
      ...(systemMessage
        ? { system: contentToText(systemMessage.content) }
        : {}),
      temperature:
        typeof body.temperature === "number" ? body.temperature : undefined,
      messages: conversationMessages,
    }),
  })

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
    error?: { message?: string; type?: string }
  }

  if (!response.ok) {
    const message = data.error?.message || `Anthropic API HTTP ${response.status}`
    throw new Error(`Anthropic API hatası: ${message}`)
  }

  const text = data.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")

  if (!text) {
    throw new Error("Anthropic API metin içeren bir yanıt döndürmedi.")
  }

  return { text }
}

function contentToText(content: MessageContent): string {
  if (typeof content === "string") return content
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
}

function normalizeContent(content: MessageContent): unknown {
  if (typeof content === "string") return content

  return content.map((block) => {
    if (block.type === "text") {
      return { type: "text", text: block.text ?? "" }
    }

    if (block.type === "image") {
      if (!block.image || !block.mediaType) {
        throw new Error("Görsel AI isteğinde image ve mediaType zorunludur.")
      }

      return {
        type: "image",
        source: {
          type: "base64",
          media_type: block.mediaType,
          data: block.image,
        },
      }
    }

    throw new Error(`Desteklenmeyen AI içerik tipi: ${block.type}`)
  })
}
