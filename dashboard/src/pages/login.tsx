import { CircleAlert, Eye, EyeOff, Sparkles, Zap } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { confirmLogin, logout, saveLogin, startDemo } from "@/lib/api"
import { api } from "@/lib/api"

/** A still of the product's one job: an email comes in, a grounded reply goes out. */
function Preview() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="max-w-sm self-start rounded-lg bg-white/10 px-4 py-3 text-sm leading-relaxed text-white/90">
        Hi, I'm 172 cm tall. Which frame size should I pick for the Carmel C1?
      </div>
      <div className="max-w-sm self-end">
        <p className="mb-1 flex items-center justify-end gap-1.5 text-xs text-white/70">
          <Sparkles className="size-3.5" /> AI reply · 9 seconds later
        </p>
        <div className="rounded-lg bg-white px-4 py-3 text-sm leading-relaxed text-slate-900">
          Size M is the right fit for you. It suits riders from 165 to 179 cm.
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    saveLogin(username, password)
    try {
      await api("/login")
      confirmLogin()
    } catch (cause) {
      logout()
      const wrong = cause instanceof Error && cause.message.includes("Wrong username")
      setError(wrong ? "Wrong username or password. Check both and try again." : "Could not reach the server. Is the API running?")
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#143f78] p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
          aria-hidden
        />
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#143f78]">
            <Zap className="size-4 fill-current" aria-hidden />
          </span>
          <span className="text-sm font-semibold">EBikes IL · Support autopilot</span>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <Preview />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">Every support email answered in seconds.</h2>
          <p className="mt-3 text-base leading-relaxed text-white/75">
            The AI replies from your own knowledge base, and hands anything risky to a person with a suggested next step.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-rise">
          <span className="mb-6 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
            <Zap className="size-5 fill-current" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-muted-foreground">See what the AI did with your support inbox.</p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
              {error && (
                <p id="login-error" role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" disabled={pending} className="mt-2 h-10">
              {pending ? "Logging in" : "Log in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" onClick={startDemo} className="h-10 w-full">
            Explore with sample data
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">No account needed. Uses invented customers and emails.</p>
        </div>
      </div>
    </div>
  )
}
