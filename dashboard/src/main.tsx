import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { ApiError } from "@/lib/api"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // A wrong password will not get better on a retry.
      retry: (failures, error) => !(error instanceof ApiError && error.status === 401) && failures < 2,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-md !border !border-border !bg-popover !text-popover-foreground !shadow-lg",
              description: "!text-muted-foreground",
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
