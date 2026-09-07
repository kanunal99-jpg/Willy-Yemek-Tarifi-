"use node"

import { action } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"

function buildDrinkSystemPrompt(excluded: string[]): string {
  const excludedText =
    excluded.length > 0
      ? `\nKullanıcının KESİNLİKLE kullanılmasını istemediği malzemeler: ${excluded.join(", ")}. Bunları hiç kullanma.`
      : ""

  return `Sen bir içecek uzmanısın. SADECE ALKOLSÜZ içecek tarifleri üretirsin. Hiçbir zaman alkollü içki veya alkol içeren malzeme önermezsin.

Elinde binlerce farklı alkolsüz içecek fikri var: taze meyve suları, smoothieler, milkshakeler, limonatalar, şerbetler, soğuk/sıcak bitki çayları, mocktailler (alkolsüz kokteyller), ayranlar, sıcak baharatlı içecekler, buzlu kahveler, çikolatalı içecekler, sodalı karışımlar, detoks suları vb. Her seferinde mümkün olduğunca farklı ve yaratıcı ol, aynı tarifleri tekrar etme.${excludedText}

Kurallar:
- Sadece geçerli JSON döndür. Başka açıklama, markdown, kod bloğu işareti ekleme.
- JSON şu şemada olmalı:
{
  "recipes": [
    {
      "name": "string",
      "description": "string (1 cümle)",
      "prepTimeMinutes": number,
      "cookTimeMinutes": number,
      "baseServings": number,
      "extraIngredientsNeeded": ["string", ...],
      "ingredients": [{ "name": "string", "quantity": number, "unit": "string" }, ...],
      "steps": ["string", ...],
      "calories": number (kişi başı),
      "carbsGrams": number (kişi başı)
    }
  ]
}
- "unit" şu değerlerden biri olmalı: "g", "kg", "ml", "l", "adet", "tatlı kaşığı", "yemek kaşığı", "çay kaşığı", "su bardağı", "demet".
- Tüm metinler Türkçe olmalı.
- Tam olarak 5 tarif üret, ne eksik ne fazla.
- ASLA alkol içeren bir malzeme veya tarif önerme.`
}

async function callAnthropicJson(
  systemPrompt: string,
  userContent: string,
  temperature: number,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      temperature,
      messages: [{ role: "user", content: userContent }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API hatası: ${response.status}`)
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const text = data.content?.find((item) => item.type === "text")?.text
  if (!text) throw new Error("AI'dan yanıt alınamadı.")
  return text
}

function extractJson(text: string): unknown {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "")
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) {
    throw new Error("AI yanıtı geçerli JSON içermiyor.")
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

export const generateFromIngredients = action({
  args: {
    ingredients: v.array(v.string()),
    excludedIngredients: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.ingredients.length === 0) {
      throw new Error("En az bir malzeme girmelisiniz.")
    }
    const systemPrompt = buildDrinkSystemPrompt(args.excludedIngredients ?? [])
    const userPrompt = `Elimdeki malzemeler: ${args.ingredients.join(", ")}. Bu malzemeleri kullanarak (gerekirse su, buz, şeker gibi temel ek malzemelerle birlikte) 5 alkolsüz içecek tarifi öner.`

    const text = await callAnthropicJson(systemPrompt, userPrompt, 0.9)
    const recipes = (extractJson(text) as { recipes: any[] }).recipes

    await ctx.runMutation(internal.history.record, {
      source: "text",
      ingredients: args.ingredients,
      diets: ["icecek"],
      recipes,
    }).catch(() => {})

    return recipes
  },
})

export const generateRandom = action({
  args: {
    excludedIngredients: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const systemPrompt = buildDrinkSystemPrompt(args.excludedIngredients ?? [])
    const randomSeed = Math.floor(Math.random() * 1000000)
    const userPrompt = `Bana sürpriz yap: mümkün olduğunca yaratıcı ve farklı 5 alkolsüz içecek tarifi öner. Rastgelelik anahtarı: ${randomSeed}. Türk mutfağından, dünya mutfağından ve modern kafe kültüründen karışık örnekler seç.`

    const text = await callAnthropicJson(systemPrompt, userPrompt, 1.0)
    const recipes = (extractJson(text) as { recipes: any[] }).recipes

    await ctx.runMutation(internal.history.record, {
      source: "text",
      ingredients: [],
      diets: ["icecek", "surpriz"],
      recipes,
    }).catch(() => {})

    return recipes
  },
})
