// A page for recording the demo video: the scene, full width, and a Replay
// button outside the stage. Open /stage/ on the dashboard's dev server.
// Add ?clean to hide the button while recording.
import "@fontsource-variable/geist"
import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"

import SupportDemo from "./support-demo"
import "./page.css"

function Page() {
  const [run, setRun] = useState(0)
  const clean = new URLSearchParams(location.search).has("clean")
  return (
    <main className="page">
      <div className="page__scene" id="scene">
        <SupportDemo key={run} />
      </div>
      {!clean && (
        <button type="button" className="page__replay" onClick={() => setRun((n) => n + 1)}>
          Replay
        </button>
      )}
    </main>
  )
}

// The kit measures text to animate it, so the font must be in before the first measure
await Promise.all([
  document.fonts.load("400 13px 'Geist Variable'"),
  document.fonts.load("600 13px 'Geist Variable'"),
]).catch(() => undefined)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>
)
