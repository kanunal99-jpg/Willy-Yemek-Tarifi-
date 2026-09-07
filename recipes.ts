"use node"

import { action } from "./_generated/server"
import { v } from "convex/values"
import { callMacalyJson } from "./macaly"
import { internal } from "./_generated/api"

const DIET_INSTRUCTIONS: Record<string, string> = {
  seker:
    "Şeker hastası dostu: düşük glisemik indeksli, şeker ve basit karbonhidrat içermeyen tarifler seç, her tarifte tahmini karbonhidrat (g) belirt.",
  dusuk_kalori: "Düşük kalorili: kalori bilgisini öne çıkar, porsiyon başına kalori düşük tutulmalı.",
  vejetaryen: "Vejetaryen: et, tavuk, balık içermeyen tarifler.",
  glutensiz: "Glutensiz: buğday, arpa, çavdar ve gluten içeren hiçbir malzeme kullanma.",
}

function buildSystemPrompt(selectedDiets: string[], excluded: string[]): string {
  const dietText =
    selectedDiets.length > 0
      ? selectedDiets.map((d) => DIET_INSTRUCTIONS[d]).filter(Boolean).join("\n")
      : "Normal: özel bir diyet kısıtlaması yok."

  const excludedText =
    excluded.length > 0
      ? `\nKullanıcının KESİNLİKLE kullanılmasını istemediği malzemeler (alerji/istenmeyen): ${excluded.join(", ")}. Bu malzemeleri hiçbir tarifte kullanma.`
      : ""

  return `Sen bir yemek tarifi asistanısın. Kullanıcının verdiği malzemelerle, aşağıdaki diyet kurallarına uyan TAM OLARAK 5 farklı yemek tarifi öner.

Diyet kuralları:
${dietText}${excludedText}

Kurallar:
- Sadece geçerli JSON döndür. Başka hiçbir açıklama, markdown, kod bloğu işareti ekleme.
- JSON şu şemada olmalı:
{
  "recipes": [
    {
      "name": "string",
      "description": "string (1 cümle)",
      "prepTimeMinutes": number,
      "cookTimeMinutes": number,
      "baseServings": number (bu tarifin kaç kişilik olduğu, örn 2 veya 4),
      "extraIngredientsNeeded": ["string", ...],
      "ingredients": [{ "name": "string", "quantity": number, "unit": "string" }, ...],
      "steps": ["string", ...],
      "calories": number (kişi başı),
      "carbsGrams": number (kişi başı)
    }
  ]
}
- "ingredients" içindeki "unit" alanı şu değerlerden biri olmalı: "g", "kg", "ml", "l", "adet", "tatlı kaşığı", "yemek kaşığı", "çay kaşığı", "su bardağı", "diş" (sarımsak için), "demet". Sayı içermeyen "tutam" gibi ifadeler yerine en yakın sayısal karşılığı (örn 0.5) kullan.
- "extraIngredientsNeeded": kullanıcının muhtemelen evde bulunmayan ek malzemeleri listele, yoksa boş dizi ver.
- Tüm metinler Türkçe olmalı.
- Tam olarak 5 tarif üret, ne eksik ne fazla.`
}

function extractJson(text: string): unknown {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "")
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) {
    throw new Error("AI yanıtı geçerli JSON içermiyor.")
  }
  const jsonSlice = cleaned.slice(start, end + 1)
  return JSON.parse(jsonSlice)
}

export const detectIngredientsFromImage = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await callMacalyJson("/api/client-app/llm-usage", {
      preset: "REASONING",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            'Fotoğraftaki yemek malzemelerini tespit et. Sadece net görünen malzemeleri listele. Sadece geçerli JSON döndür: {"ingredients": ["string", ...]}. Başka açıklama ekleme.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Bu fotoğraftaki malzemeleri listele." },
            { type: "image", image: args.imageBase64, mediaType: args.mediaType },
          ],
        },
      ],
    })

    const text = (result as { text?: string }).text
    if (!text) throw new Error("AI'dan yanıt alınamadı.")
    const parsed = extractJson(text) as { ingredients: string[] }
    return parsed.ingredients ?? []
  },
})

export const generateFromText = action({
  args: {
    ingredients: v.array(v.string()),
    diets: v.array(v.string()),
    excludedIngredients: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.ingredients.length === 0) {
      throw new Error("En az bir malzeme girmelisiniz.")
    }

    const systemPrompt = buildSystemPrompt(args.diets, args.excludedIngredients ?? [])
    const userPrompt = `Elimdeki malzemeler: ${args.ingredients.join(", ")}`

    const result = await callMacalyJson("/api/client-app/llm-usage", {
      preset: "REASONING",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const text = (result as { text?: string }).text
    if (!text) throw new Error("AI'dan yanıt alınamadı.")

    const parsed = extractJson(text) as { recipes: unknown }
    const recipes = parsed.recipes as any[]

    await ctx.runMutation(internal.history.record, {
      source: "text",
      ingredients: args.ingredients,
      diets: args.diets,
      recipes,
    }).catch(() => {})

    return recipes
  },
})

export const generateFromImage = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.string(),
    diets: v.array(v.string()),
    excludedIngredients: v.optional(v.array(v.string())),
    confirmedIngredients: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const systemPrompt = buildSystemPrompt(args.diets, args.excludedIngredients ?? [])

    let recipes: any[]
    let ingredientsUsed: string[]

    if (args.confirmedIngredients && args.confirmedIngredients.length > 0) {
      ingredientsUsed = args.confirmedIngredients
      const userPrompt = `Elimdeki malzemeler: ${args.confirmedIngredients.join(", ")}`
      const result = await callMacalyJson("/api/client-app/llm-usage", {
        preset: "REASONING",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      })
      const text = (result as { text?: string }).text
      if (!text) throw new Error("AI'dan yanıt alınamadı.")
      recipes = (extractJson(text) as { recipes: any[] }).recipes
    } else {
      const userPrompt =
        "Bu fotoğraftaki malzemeleri tespit et ve bu malzemelerle yukarıdaki kurallara uyan 5 tarif öner. Fotoğrafta net görünmeyen ya da emin olamadığın malzemeleri dahil etme."
      const result = await callMacalyJson("/api/client-app/llm-usage", {
        preset: "REASONING",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image", image: args.imageBase64, mediaType: args.mediaType },
            ],
          },
        ],
      })
      const text = (result as { text?: string }).text
      if (!text) throw new Error("AI'dan yanıt alınamadı.")
      recipes = (extractJson(text) as { recipes: any[] }).recipes
      ingredientsUsed = []
    }

    await ctx.runMutation(internal.history.record, {
      source: "photo",
      ingredients: ingredientsUsed,
      diets: args.diets,
      recipes,
    }).catch(() => {})

    return recipes
  },
})
