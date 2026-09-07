import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect } from "react";

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  console.error('missing envar CONVEX_URL')
}
const convex = new ConvexReactClient(CONVEX_URL)

function AutoAnonymousSignIn({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signIn } = useAuthActions()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      signIn("anonymous").catch((err) => {
        console.error("Anonymous sign-in failed", err)
      })
    }
  }, [isLoading, isAuthenticated, signIn])

  return <>{children}</>
}

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexAuthProvider client={convex}>
      <AutoAnonymousSignIn>{children}</AutoAnonymousSignIn>
    </ConvexAuthProvider>
  )
}
