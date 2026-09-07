import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { recipeShape } from "./schema"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()
  },
})

export const add = mutation({
  args: { recipe: recipeShape },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    return await ctx.db.insert("favorites", {
      userId,
      recipe: args.recipe,
      createdAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id("favorites") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    const fav = await ctx.db.get(args.id)
    if (!fav || fav.userId !== userId) throw new Error("Bulunamadı.")
    await ctx.db.delete(args.id)
  },
})
