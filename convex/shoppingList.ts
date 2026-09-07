import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()
  },
})

export const addMany = mutation({
  args: { names: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    const existing = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    const existingNames = new Set(existing.map((i) => i.name.toLowerCase()))
    for (const name of args.names) {
      if (!name.trim() || existingNames.has(name.trim().toLowerCase())) continue
      await ctx.db.insert("shoppingListItems", {
        userId,
        name: name.trim(),
        checked: false,
        createdAt: Date.now(),
      })
      existingNames.add(name.trim().toLowerCase())
    }
  },
})

export const toggle = mutation({
  args: { id: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    const item = await ctx.db.get(args.id)
    if (!item || item.userId !== userId) throw new Error("Bulunamadı.")
    await ctx.db.patch(args.id, { checked: !item.checked })
  },
})

export const remove = mutation({
  args: { id: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    const item = await ctx.db.get(args.id)
    if (!item || item.userId !== userId) throw new Error("Bulunamadı.")
    await ctx.db.delete(args.id)
  },
})

export const clearChecked = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Oturum bulunamadı.")
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    for (const item of items) {
      if (item.checked) await ctx.db.delete(item._id)
    }
  },
})
