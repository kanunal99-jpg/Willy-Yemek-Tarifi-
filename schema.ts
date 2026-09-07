import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

const recipeIngredient = v.object({
  name: v.string(),
  quantity: v.number(),
  unit: v.string(),
})

export const recipeShape = v.object({
  name: v.string(),
  description: v.string(),
  prepTimeMinutes: v.number(),
  cookTimeMinutes: v.number(),
  baseServings: v.number(),
  extraIngredientsNeeded: v.array(v.string()),
  ingredients: v.array(recipeIngredient),
  steps: v.array(v.string()),
  calories: v.number(),
  carbsGrams: v.number(),
})

export default defineSchema({
  ...authTables,

  favorites: defineTable({
    userId: v.id("users"),
    recipe: recipeShape,
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  history: defineTable({
    userId: v.id("users"),
    source: v.union(v.literal("text"), v.literal("photo")),
    ingredients: v.array(v.string()),
    diets: v.array(v.string()),
    recipes: v.array(recipeShape),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  shoppingListItems: defineTable({
    userId: v.id("users"),
    name: v.string(),
    checked: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  excludedIngredients: defineTable({
    userId: v.id("users"),
    name: v.string(),
  }).index("by_user", ["userId"]),
})
