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
  prepTimeMinutes: number
  cookTimeMinutes: number
  baseServings: number
  extraIngredientsNeeded: string[]
  ingredients: Ingredient[]
  steps: string[]
  calories: number
  carbsGrams: number
}

const DIET_OPTIONS = [
  { id: 'seker', label: 'Şeker hastası dostu' },
  { id: 'dusuk_kalori', label: 'Düşük kalorili' },
  { id: 'vejetaryen', label: 'Vejetaryen' },
  { id: 'glutensiz', label: 'Glutensiz' },
]

function formatQuantity(q: number): string {
  const rounded = Math.round(q * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',')
}

function App() {
  const generateFromText = useAction(api.recipes.generateFromText)
  const generateFromImage = useAction(api.recipes.generateFromImage)
  const detectIngredients = useAction(api.recipes.detectIngredientsFromImage)
  const generateDrinksFromIngredients = useAction(api.drinks.generateFromIngredients)
  const generateRandomDrink = useAction(api.drinks.generateRandom)

  const favorites = useQuery(api.favorites.list) ?? []
  const addFavorite = useMutation(api.favorites.add)
  const removeFavorite = useMutation(api.favorites.remove)

  const historyItems = useQuery(api.history.list) ?? []

  const shoppingItems = useQuery(api.shoppingList.list) ?? []
  const addToShoppingList = useMutation(api.shoppingList.addMany)
  const toggleShoppingItem = useMutation(api.shoppingList.toggle)
  const removeShoppingItem = useMutation(api.shoppingList.remove)
  const clearCheckedShopping = useMutation(api.shoppingList.clearChecked)

  const excludedList = useQuery(api.excludedIngredients.list) ?? []
  const addExcluded = useMutation(api.excludedIngredients.add)
  const removeExcluded = useMutation(api.excludedIngredients.remove)

  const [ingredientInput, setIngredientInput] = useState('')
  const [ingredients, setIngredients] = useState<string[]>([])
  const [selectedDiets, setSelectedDiets] = useState<string[]>([])
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoMediaType, setPhotoMediaType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [servingsOverride, setServingsOverride] = useState<number | null>(null)
  const [cookMode, setCookMode] = useState(false)
  const [cookStepIndex, setCookStepIndex] = useState(0)
  const [detectedIngredients, setDetectedIngredients] = useState<string[] | null>(null)
  const [excludedInput, setExcludedInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [drinkIngredientInput, setDrinkIngredientInput] = useState('')
  const [drinkIngredients, setDrinkIngredients] = useState<string[]>([])
  const [drinkLoading, setDrinkLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wakeLockRef = useRef<any>(null)

  const favoriteKeys = new Set(favorites.map((f: any) => f.recipe.name))

  useEffect(() => {
    if (cookMode && 'wakeLock' in navigator) {
      ;(navigator as any).wakeLock
        .request('screen')
        .then((lock: any) => {
          wakeLockRef.current = lock
        })
        .catch(() => {})
    }
    return () => {
      wakeLockRef.current?.release?.().catch(() => {})
      wakeLockRef.current = null
    }
  }, [cookMode])

  function addIngredient(raw?: string) {
    const trimmed = (raw ?? ingredientInput).trim()
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients((prev) => [...prev, trimmed])
    }
    if (!raw) setIngredientInput('')
  }

  function removeIngredient(item: string) {
    setIngredients(ingredients.filter((i) => i !== item))
  }

  function toggleDiet(id: string) {
    setSelectedDiets((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    )
  }

  function startVoiceInput() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Tarayıcınız sesli girişi desteklemiyor.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'tr-TR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript
      transcript
        .split(/,| ve /i)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((item) => addIngredient(item))
    }
    recognition.start()
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setPhotoPreview(result)
      const [meta, base64] = result.split(',')
      const mediaType = meta.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg'
      setPhotoMediaType(mediaType)
      setPhotoBase64(base64)
      setDetectedIngredients(null)
      setRecipes(null)
    }
    reader.readAsDataURL(file)
  }

  async function handleDetect() {
    if (!photoBase64 || !photoMediaType) {
      setError('Lütfen önce bir fotoğraf çekin veya seçin.')
      return
    }
    setDetecting(true)
    setError(null)
    try {
      const result = await detectIngredients({
        imageBase64: photoBase64,
        mediaType: photoMediaType,
      })
      setDetectedIngredients(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Malzemeler tespit edilemedi.')
    } finally {
      setDetecting(false)
    }
  }

  function removeDetected(item: string) {
    setDetectedIngredients((prev) => (prev ? prev.filter((i) => i !== item) : prev))
  }

  function addDetected(raw: string) {
    const trimmed = raw.trim()
    if (trimmed) setDetectedIngredients((prev) => [...(prev ?? []), trimmed])
  }

  async function handleTextSubmit() {
    if (ingredients.length === 0) {
      setError('Lütfen en az bir malzeme ekleyin.')
      return
    }
    setLoading(true)
    setError(null)
    setRecipes(null)
    try {
      const result = await generateFromText({
        ingredients,
        diets: selectedDiets,
        excludedIngredients: excludedList.map((e: any) => e.name),
      })
      setRecipes(result as Recipe[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePhotoSubmit() {
    if (!photoBase64 || !photoMediaType) {
      setError('Lütfen önce bir fotoğraf çekin veya seçin.')
      return
    }
    setLoading(true)
    setError(null)
    setRecipes(null)
    try {
      const result = await generateFromImage({
        imageBase64: photoBase64,
        mediaType: photoMediaType,
        diets: selectedDiets,
        excludedIngredients: excludedList.map((e: any) => e.name),
        confirmedIngredients: detectedIngredients ?? undefined,
      })
      setRecipes(result as Recipe[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  function addDrinkIngredient(raw?: string) {
    const trimmed = (raw ?? drinkIngredientInput).trim()
    if (trimmed && !drinkIngredients.includes(trimmed)) {
      setDrinkIngredients((prev) => [...prev, trimmed])
    }
    if (!raw) setDrinkIngredientInput('')
  }

  function removeDrinkIngredient(item: string) {
    setDrinkIngredients(drinkIngredients.filter((i) => i !== item))
  }

  async function handleDrinkSubmit() {
    if (drinkIngredients.length === 0) {
      setError('Lütfen en az bir malzeme ekleyin.')
      return
    }
    setDrinkLoading(true)
    setError(null)
    setRecipes(null)
    try {
      const result = await generateDrinksFromIngredients({
        ingredients: drinkIngredients,
        excludedIngredients: excludedList.map((e: any) => e.name),
      })
      setRecipes(result as Recipe[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setDrinkLoading(false)
    }
  }

  async function handleRandomDrink() {
    setDrinkLoading(true)
    setError(null)
    setRecipes(null)
    try {
      const result = await generateRandomDrink({
        excludedIngredients: excludedList.map((e: any) => e.name),
      })
      setRecipes(result as Recipe[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setDrinkLoading(false)
    }
  }

  function openRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe)
    setServingsOverride(recipe.baseServings)
    setCookMode(false)
    setCookStepIndex(0)
  }

  function scaleFactor(recipe: Recipe) {
    const servings = servingsOverride ?? recipe.baseServings
    return servings / recipe.baseServings
  }

  async function handleAddExtrasToShoppingList(recipe: Recipe) {
    if (recipe.extraIngredientsNeeded.length === 0) return
    await addToShoppingList({ names: recipe.extraIngredientsNeeded })
  }

  async function handleToggleFavorite(recipe: Recipe) {
    const existing = favorites.find((f: any) => f.recipe.name === recipe.name)
    if (existing) {
      await removeFavorite({ id: existing._id })
    } else {
      await addFavorite({ recipe })
    }
  }

  async function handleAddExcluded() {
    const trimmed = excludedInput.trim()
    if (!trimmed) return
    await addExcluded({ name: trimmed })
    setExcludedInput('')
  }

  const uncheckedShopping = shoppingItems.filter((i: any) => !i.checked)
  const checkedShopping = shoppingItems.filter((i: any) => i.checked)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ChefHat className="size-6 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Yemek Tarifi Asistanı</h1>
          </div>
          <div className="flex items-center gap-1">
            <ShoppingListSheet
              uncheckedShopping={uncheckedShopping}
              checkedShopping={checkedShopping}
              onToggle={(id) => toggleShoppingItem({ id })}
              onRemove={(id) => removeShoppingItem({ id })}
              onClearChecked={() => clearCheckedShopping({})}
            />
            <HistorySheet historyItems={historyItems} onOpenRecipe={openRecipe} />
            <FavoritesSheet favorites={favorites} onOpenRecipe={openRecipe} />
            <SettingsSheet
              excludedList={excludedList}
              excludedInput={excludedInput}
              setExcludedInput={setExcludedInput}
              onAdd={handleAddExcluded}
              onRemove={(id) => removeExcluded({ id })}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="text">Malzeme Yaz</TabsTrigger>
            <TabsTrigger value="photo">Fotoğraf Çek</TabsTrigger>
            <TabsTrigger value="drink">İçecek Hazırla</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Elindeki malzemeleri ekle</Label>
              <div className="flex gap-2">
                <Input
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addIngredient()
                    }
                  }}
                  placeholder="örn: domates"
                />
                <Button
                  type="button"
                  onClick={() => startVoiceInput()}
                  size="icon"
                  variant={isListening ? 'default' : 'outline'}
                  aria-label="Sesle ekle"
                >
                  <Mic className="size-4" />
                </Button>
                <Button type="button" onClick={() => addIngredient()} size="icon" aria-label="Ekle">
                  <Plus className="size-4" />
                </Button>
              </div>
              {ingredients.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {ingredients.map((item) => (
                    <Badge key={item} variant="secondary" className="gap-1 pr-1">
                      {item}
                      <button
                        type="button"
                        onClick={() => removeIngredient(item)}
                        aria-label={`${item} sil`}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DietSelector selected={selectedDiets} onToggle={toggleDiet} />

            <Button onClick={handleTextSubmit} disabled={loading} className="w-full">
              {loading ? <Spinner className="size-4" /> : <ChefHat className="size-4" />}
              5 Tarif Öner
            </Button>
          </TabsContent>

          <TabsContent value="photo" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Malzemelerinin fotoğrafını çek</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors overflow-hidden"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Seçilen malzemeler" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="size-8" />
                    <span className="text-sm">Fotoğraf çek veya seç</span>
                  </>
                )}
              </button>
            </div>

            {photoBase64 && detectedIngredients === null && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDetect}
                disabled={detecting}
                className="w-full"
              >
                {detecting ? <Spinner className="size-4" /> : <Camera className="size-4" />}
                Malzemeleri Tespit Et
              </Button>
            )}

            {detectedIngredients !== null && (
              <div className="space-y-2">
                <Label>Tespit edilen malzemeler (düzenleyebilirsin)</Label>
                <div className="flex flex-wrap gap-2">
                  {detectedIngredients.map((item) => (
                    <Badge key={item} variant="secondary" className="gap-1 pr-1">
                      {item}
                      <button
                        type="button"
                        onClick={() => removeDetected(item)}
                        aria-label={`${item} sil`}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  {detectedIngredients.length === 0 && (
                    <p className="text-sm text-muted-foreground">Hiç malzeme tespit edilmedi, elle ekleyebilirsin.</p>
                  )}
                </div>
                <AddDetectedInput onAdd={addDetected} />
              </div>
            )}

            <DietSelector selected={selectedDiets} onToggle={toggleDiet} />

            <Button onClick={handlePhotoSubmit} disabled={loading} className="w-full">
              {loading ? <Spinner className="size-4" /> : <ChefHat className="size-4" />}
              5 Tarif Öner
            </Button>
          </TabsContent>

          <TabsContent value="drink" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Elindeki malzemeleri ekle (isteğe bağlı)</Label>
              <div className="flex gap-2">
                <Input
                  value={drinkIngredientInput}
                  onChange={(e) => setDrinkIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addDrinkIngredient()
                    }
                  }}
                  placeholder="örn: portakal"
                />
                <Button type="button" onClick={() => addDrinkIngredient()} size="icon" aria-label="Ekle">
                  <Plus className="size-4" />
                </Button>
              </div>
              {drinkIngredients.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {drinkIngredients.map((item) => (
                    <Badge key={item} variant="secondary" className="gap-1 pr-1">
                      {item}
                      <button
                        type="button"
                        onClick={() => removeDrinkIngredient(item)}
                        aria-label={`${item} sil`}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Alkolsüz içecek tarifleri: meyve suları, smoothieler, limonatalar, mocktailler, sıcak
              içecekler ve daha fazlası. Malzeme girip ona göre tarif iste, ya da rastgele sürpriz bir
              tarif çıksın.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={handleDrinkSubmit}
                disabled={drinkLoading || drinkIngredients.length === 0}
                className="w-full"
              >
                {drinkLoading ? <Spinner className="size-4" /> : <GlassWater className="size-4" />}
                5 İçecek Öner
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRandomDrink}
                disabled={drinkLoading}
                className="w-full"
              >
                {drinkLoading ? <Spinner className="size-4" /> : <Shuffle className="size-4" />}
                Sürpriz Yap
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

        {recipes && recipes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Önerilen Tarifler</h2>
            <div className="grid gap-3">
              {recipes.map((recipe, i) => (
                <Card
                  key={i}
                  className="cursor-pointer hover:border-primary/50 transition-colors relative"
                  onClick={() => openRecipe(recipe)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFavorite(recipe)
                    }}
                    aria-label="Favorilere ekle"
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted"
                  >
                    <Heart
                      className={`size-4 ${favoriteKeys.has(recipe.name) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                    />
                  </button>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base pr-8">{recipe.name}</CardTitle>
                    <CardDescription>{recipe.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-0">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {recipe.prepTimeMinutes + recipe.cookTimeMinutes} dk
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="size-3.5" />
                      {recipe.calories} kcal
                    </span>
                    <span className="flex items-center gap-1">
                      <Wheat className="size-3.5" />
                      {recipe.carbsGrams}g karbonhidrat
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <Dialog
        open={!!selectedRecipe && !cookMode}
        onOpenChange={(open) => !open && setSelectedRecipe(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedRecipe && (
            <RecipeDetail
              recipe={selectedRecipe}
              servings={servingsOverride ?? selectedRecipe.baseServings}
              onServingsChange={setServingsOverride}
              isFavorite={favoriteKeys.has(selectedRecipe.name)}
              onToggleFavorite={() => handleToggleFavorite(selectedRecipe)}
              onAddExtrasToShoppingList={() => handleAddExtrasToShoppingList(selectedRecipe)}
              onStartCookMode={() => {
                setCookMode(true)
                setCookStepIndex(0)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedRecipe && cookMode && (
        <CookMode
          recipe={selectedRecipe}
          servings={servingsOverride ?? selectedRecipe.baseServings}
          stepIndex={cookStepIndex}
          setStepIndex={setCookStepIndex}
          onClose={() => setCookMode(false)}
        />
      )}
    </div>
  )
}

function AddDetectedInput({ onAdd }: { onAdd: (v: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="malzeme ekle"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onAdd(value)
            setValue('')
          }
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => {
          onAdd(value)
          setValue('')
        }}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}

function DietSelector({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (id: any) => void
}) {
  return (
    <div className="space-y-2">
      <Label>Diyet tercihleri (isteğe bağlı, birden fazla seçilebilir)</Label>
      <div className="grid grid-cols-2 gap-2">
        {DIET_OPTIONS.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
          >
            <Checkbox
              checked={selected.includes(option.id)}
              onCheckedChange={() => onToggle(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function RecipeDetail({
  recipe,
  servings,
  onServingsChange,
  isFavorite,
  onToggleFavorite,
  onAddExtrasToShoppingList,
  onStartCookMode,
}: {
  recipe: Recipe
  servings: number
  onServingsChange: (n: number) => void
  isFavorite: boolean
  onToggleFavorite: () => void
  onAddExtrasToShoppingList: () => void
  onStartCookMode: () => void
}) {
  const factor = servings / recipe.baseServings

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-2 pr-6">
          <DialogTitle>{recipe.name}</DialogTitle>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label="Favorilere ekle"
            className="p-1.5 rounded-full hover:bg-muted flex-none"
          >
            <Heart className={`size-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
          </button>
        </div>
        <DialogDescription>{recipe.description}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" />
          Hazırlık {recipe.prepTimeMinutes} dk, Pişirme {recipe.cookTimeMinutes} dk
        </span>
        <span className="flex items-center gap-1">
          <Flame className="size-3.5" />
          {Math.round(recipe.calories * factor)} kcal
        </span>
        <span className="flex items-center gap-1">
          <Wheat className="size-3.5" />
          {Math.round(recipe.carbsGrams * factor)}g karbonhidrat
        </span>
      </div>

      <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
        <span className="text-sm font-medium">Porsiyon</span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            onClick={() => onServingsChange(Math.max(1, servings - 1))}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-6 text-center text-sm font-medium">{servings}</span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            onClick={() => onServingsChange(servings + 1)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {recipe.extraIngredientsNeeded.length > 0 && (
        <div className="rounded-md bg-muted p-3 text-sm space-y-2">
          <p className="font-medium">Ek olarak gerekebilir:</p>
          <p className="text-muted-foreground">{recipe.extraIngredientsNeeded.join(', ')}</p>
          <Button type="button" size="sm" variant="outline" onClick={onAddExtrasToShoppingList}>
            <ShoppingCart className="size-3.5" />
            Alışveriş Listesine Ekle
          </Button>
        </div>
      )}

      <div>
        <h3 className="font-medium text-sm mb-2">Malzemeler</h3>
        <ul className="space-y-1 text-sm">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex justify-between border-b border-border/50 pb-1">
              <span>{ing.name}</span>
              <span className="text-muted-foreground">
                {formatQuantity(ing.quantity * factor)} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-medium text-sm mb-2">Yapılışı</h3>
        <ol className="space-y-3 text-sm">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-none size-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <Button type="button" onClick={onStartCookMode} className="w-full">
        <ChefHat className="size-4" />
        Pişirme Moduna Geç
      </Button>
    </>
  )
}

function CookMode({
  recipe,
  servings,
  stepIndex,
  setStepIndex,
  onClose,
}: {
  recipe: Recipe
  servings: number
  stepIndex: number
  setStepIndex: (n: number) => void
  onClose: () => void
}) {
  const isLast = stepIndex === recipe.steps.length - 1
  const isFirst = stepIndex === 0

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div>
          <p className="text-sm text-muted-foreground">{recipe.name}</p>
          <p className="text-xs text-muted-foreground">
            Adım {stepIndex + 1} / {recipe.steps.length} · {servings} kişilik
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Kapat">
          <X className="size-5" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-8 overflow-y-auto">
        <p className="text-2xl leading-relaxed font-medium text-center max-w-xl">
          {recipe.steps[stepIndex]}
        </p>
      </div>

      <div className="flex gap-3 p-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={isFirst}
          onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
        >
          Önceki
        </Button>
        {isLast ? (
          <Button type="button" className="flex-1" onClick={onClose}>
            Bitti
          </Button>
        ) : (
          <Button type="button" className="flex-1" onClick={() => setStepIndex(stepIndex + 1)}>
            Sonraki
          </Button>
        )}
      </div>
    </div>
  )
}

function FavoritesSheet({
  favorites,
  onOpenRecipe,
}: {
  favorites: any[]
  onOpenRecipe: (r: Recipe) => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Favoriler">
          <Heart className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Favori Tarifler</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-2">
          {favorites.length === 0 && (
            <p className="text-sm text-muted-foreground">Henüz favori tarifin yok.</p>
          )}
          {favorites.map((f: any) => (
            <button
              key={f._id}
              onClick={() => onOpenRecipe(f.recipe)}
              className="w-full text-left rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              <p className="font-medium text-sm">{f.recipe.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{f.recipe.description}</p>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function HistorySheet({
  historyItems,
  onOpenRecipe,
}: {
  historyItems: any[]
  onOpenRecipe: (r: Recipe) => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Geçmiş">
          <History className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Geçmiş</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-4">
          {historyItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Henüz geçmiş kaydın yok.</p>
          )}
          {historyItems.map((h: any) => (
            <div key={h._id} className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {h.source === 'photo' ? 'Fotoğraftan' : 'Malzemeden'} ·{' '}
                {new Date(h.createdAt).toLocaleString('tr-TR')}
              </p>
              <div className="grid gap-2">
                {h.recipes.map((r: Recipe, i: number) => (
                  <button
                    key={i}
                    onClick={() => onOpenRecipe(r)}
                    className="w-full text-left rounded-md border border-border p-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium text-sm">{r.name}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ShoppingListSheet({
  uncheckedShopping,
  checkedShopping,
  onToggle,
  onRemove,
  onClearChecked,
}: {
  uncheckedShopping: any[]
  checkedShopping: any[]
  onToggle: (id: any) => void
  onRemove: (id: any) => void
  onClearChecked: () => void
}) {
  async function handleShare() {
    const text = uncheckedShopping.map((i) => `- ${i.name}`).join('\n')
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Alışveriş Listesi', text })
      } catch {
        // paylaşım iptal edildi
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alışveriş Listesi" className="relative">
          <ShoppingCart className="size-5" />
          {uncheckedShopping.length > 0 && (
            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {uncheckedShopping.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Alışveriş Listesi</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-4">
          {uncheckedShopping.length === 0 && checkedShopping.length === 0 && (
            <p className="text-sm text-muted-foreground">Listen boş.</p>
          )}

          {uncheckedShopping.length > 0 && (
            <div className="space-y-1">
              {uncheckedShopping.map((item: any) => (
                <div key={item._id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={item.checked} onCheckedChange={() => onToggle(item._id)} />
                  <span className="flex-1 text-sm">{item.name}</span>
                  <button onClick={() => onRemove(item._id)} aria-label="Sil">
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {checkedShopping.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Alınanlar</p>
              {checkedShopping.map((item: any) => (
                <div key={item._id} className="flex items-center gap-2 py-1 opacity-60">
                  <Checkbox checked={item.checked} onCheckedChange={() => onToggle(item._id)} />
                  <span className="flex-1 text-sm line-through">{item.name}</span>
                  <button onClick={() => onRemove(item._id)} aria-label="Sil">
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={onClearChecked}>
                Alınanları temizle
              </Button>
            </div>
          )}

          {uncheckedShopping.length > 0 && (
            <Button type="button" variant="outline" className="w-full" onClick={handleShare}>
              Listeyi Paylaş
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SettingsSheet({
  excludedList,
  excludedInput,
  setExcludedInput,
  onAdd,
  onRemove,
}: {
  excludedList: any[]
  excludedInput: string
  setExcludedInput: (v: string) => void
  onAdd: () => void
  onRemove: (id: any) => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Ayarlar">
          <Settings className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Kaçınılacak Malzemeler</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Alerjin olan ya da hiç yemek istemediğin malzemeleri ekle, tarifler bunları hiç içermesin.
          </p>
          <div className="flex gap-2">
            <Input
              value={excludedInput}
              onChange={(e) => setExcludedInput(e.target.value)}
              placeholder="örn: fıstık"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAdd()
                }
              }}
            />
            <Button type="button" size="icon" onClick={onAdd}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {excludedList.map((item: any) => (
              <Badge key={item._id} variant="secondary" className="gap-1 pr-1">
                {item.name}
                <button
                  type="button"
                  onClick={() => onRemove(item._id)}
                  aria-label={`${item.name} sil`}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
