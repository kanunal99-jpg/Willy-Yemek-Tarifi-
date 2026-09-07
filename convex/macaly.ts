// AI provider adapter for running the app outside Macaly.
// The original export called Macaly's internal proxy. This implementation
// keeps the existing callMacalyJson() interface so recipes.ts and drinks.ts
// do not need provider-specific changes.

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const DEFAULT_MODEL = "gemini-2.5-flash"

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
 * Existing callers pass { preset, temperature, messages } and expect { text }.
 * We translate that shape to Gemini's generateContent API, including base64
 * image parts used by the photo ingredient/recipe actions.
 */
export async function callMacalyJson(
  _path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const apiKey = requiredEnv("WILLY_GEMINI_API_KEY")
  const messages = (body.messages ?? []) as ChatMessage[]
  const systemMessage = messages.find((message) => message.role === "system")
  const conversationMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: normalizeContent(message.content),
    }))

  if (conversationMessages.length === 0) {
    throw new Error("Gemini isteği için en az bir kullanıcı mesajı gereklidir.")
  }

  const model = process.env.WILLY_GEMINI_MODEL || DEFAULT_MODEL
  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemMessage
          ? { systemInstruction: { parts: [{ text: contentToText(systemMessage.content) }] } }
          : {}),
        contents: conversationMessages,
        generationConfig: {
          ...(typeof body.temperature === "number"
            ? { temperature: body.temperature }
            : {}),
          responseMimeType: "application/json",
          maxOutputTokens:
            typeof body.max_tokens === "number" ? body.max_tokens : 4096,
        },
      }),
    },
  )

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    error?: { message?: string; status?: string }
  }

  if (!response.ok) {
    const message = data.error?.message || `Gemini API HTTP ${response.status}`
    throw new Error(`Gemini API hatası: ${message}`)
  }

  const text = data.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter((value): value is string => Boolean(value))
    .join("\n")

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason
    throw new Error(
      reason
        ? `Gemini API metin içeren yanıt döndürmedi (${reason}).`
        : "Gemini API metin içeren bir yanıt döndürmedi.",
    )
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

function normalizeContent(content: MessageContent): Array<Record<string, unknown>> {
  if (typeof content === "string") return [{ text: content }]

  return content.map((block) => {
    if (block.type === "text") {
      return { text: block.text ?? "" }
    }

    if (block.type === "image") {
      if (!block.image || !block.mediaType) {
        throw new Error("Görsel AI isteğinde image ve mediaType zorunludur.")
      }

      return {
        inlineData: {
          mimeType: block.mediaType,
          data: block.image,
        },
      }
    }

    throw new Error(`Desteklenmeyen AI içerik tipi: ${block.type}`)
  })
}
