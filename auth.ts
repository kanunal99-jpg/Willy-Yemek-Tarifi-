import { convexAuth } from "@convex-dev/auth/server"
import { ResendOTP } from "./ResendOTP"
import { Anonymous } from "@convex-dev/auth/providers/Anonymous"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP, Anonymous],
})
