import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import {
  Camera,
  ChefHat,
  Clock,
  Flame,
  GlassWater,
  Heart,
  History,
  Mic,
  Minus,
  Plus,
  Settings,
  Shuffle,
  ShoppingCart,
  Trash2,
  Wheat,
  X,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: App })

type Ingredient = { name: string; quantity: number; unit: string }

type Recipe = {
  name: string
  description: string
