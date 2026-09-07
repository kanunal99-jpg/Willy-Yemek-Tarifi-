import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query("excludedIngredients")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  },
})

export const add = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    const trimmed = args.name.trim()
    if (!trimmed) return
    const existing = await ctx.db
      .query("excludedIngredients")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    if (existing.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())) return
    await ctx.db.insert("excludedIngredients", { userId, name: trimmed })
  },
})

export const remove = mutation({
  args: { id: v.id("excludedIngredients") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    const item = await ctx.db.get(args.id)
    if (!item || item.userId !== userId) throw new Error("Bulunamadı.")
    await ctx.db.delete(args.id)
  },
})
