import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import InductionForm from './InductionForm'
import { clearInductionDraft, readInductionDraft, saveConstancia, writeInductionDraft } from './constanciaStore'
import { getSessionId, readDraft } from './progressStore'
import './styles.css'

// "/?constancia=1&registro=<id>" abre solo la constancia de inducción (se enlaza desde el PDF en otra pestaña).
const params = new URLSearchParams(window.location.search)
const isConstanciaPage = params.has('constancia')
if (isConstanciaPage) document.title = 'Constancia de Inducción — SanitHelp'

async function renderApp() {
  let page = <App />
  if (isConstanciaPage) {
    const sessionId = params.get('registro') || getSessionId()
    // Precarga nombre, cédula, cargo y correo con lo que la persona ya escribió en su HV.
    const draft = await readDraft(sessionId).catch(() => null)
    page = (
      <main className="constancia-page">
        <InductionForm
          initialAnswers={draft?.cvForm?.summary}
          savedDraft={readInductionDraft(sessionId)}
          onDraftChange={(inductionDraft) => writeInductionDraft(sessionId, inductionDraft)}
          onSubmitted={async (submitted) => {
            await saveConstancia(sessionId, submitted)
            clearInductionDraft(sessionId)
          }}
        />
      </main>
    )
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>{page}</React.StrictMode>,
  )
}

renderApp()
