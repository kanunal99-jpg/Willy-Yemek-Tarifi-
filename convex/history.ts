import { internalMutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { recipeShape } from "./schema"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query("history")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20)
  },
})

export const record = internalMutation({
  args: {
    source: v.union(v.literal("text"), v.literal("photo")),
    ingredients: v.array(v.string()),
    diets: v.array(v.string()),
    recipes: v.array(recipeShape),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return
    await ctx.db.insert("history", { ...args, userId, createdAt: Date.now() })
  },
})
