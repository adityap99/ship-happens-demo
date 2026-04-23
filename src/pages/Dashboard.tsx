import { useState, useEffect, useRef, useCallback } from 'react'

const BACKEND = (import.meta.env.VITE_SHIP_HAPPENS_ENDPOINT as string | undefined) || 'http://localhost:8000'

// ── Seeded envelope (mirrors demo.py) ─────────────────────────────────────
function makeEnvelope() {
  return {
    id: `dashboard-${Date.now()}`,
    timestamp: new Date().toISOString(),
    url: 'http://localhost:3000/checkout',
    userAgent: 'Mozilla/5.0 (Ship Happens Dashboard)',
    error: {
      message: "TypeError: Cannot read properties of undefined (reading 'street')",
      name: 'TypeError',
      stackTrace:
        "TypeError: Cannot read properties of undefined (reading 'street')\n" +
        '    at processOrder (src/lib/checkout.ts:8:20)\n' +
        '    at handlePlaceOrder (src/components/CheckoutStepper.tsx:74:5)\n' +
        '    at HTMLButtonElement.onClick (src/components/CheckoutStepper.tsx:120:9)',
    },
    interactionSequence: [
      { type: 'navigate', url: 'http://localhost:3000/checkout', timestamp: 0 },
      { type: 'click', selector: "[data-testid='continue-to-shipping']", timestamp: 800 },
      { type: 'click', selector: "[data-testid='skip-address']", timestamp: 1600 },
      { type: 'click', selector: "[data-testid='place-order']", timestamp: 2400 },
    ],
    networkLog: [],
    sessionId: 'dashboard-session',
    userId: 'dashboard-user',
  }
}

// ── Types ──────────────────────────────────────────────────────────────────
type RunStatus =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'reproducing'
  | 'diagnosing'
  | 'repairing'
  | 'resolved'
  | 'escalated'
  | 'error'

interface PollData {
  failure_id: string
  status: RunStatus
  stage: string | null
  test_case: Record<string, unknown> | null
  diagnosis: Record<string, unknown> | null
  fix_proposal: Record<string, unknown> | null
}

interface DiffHunkData {
  file_path?: string
  original?: string
  replacement?: string
  explanation?: string
}

// ── Pipeline step definitions ──────────────────────────────────────────────
const STEPS = [
  { label: 'Ingested', desc: 'Failure captured & queued' },
  { label: 'Reproducing', desc: 'Playwright replay & LLM analysis' },
  { label: 'Diagnosing', desc: 'LLM root-cause classification' },
  { label: 'Repairing', desc: 'Generating & verifying fix' },
  { label: 'Resolved', desc: 'Fix proposal ready' },
]

function statusToActiveStep(status: RunStatus): number {
  switch (status) {
    case 'idle': return -1
    case 'queued':
    case 'processing': return 0
    case 'reproducing': return 1
    case 'diagnosing': return 2
    case 'repairing': return 3
    case 'resolved': return 5   // > 4 → all steps done
    case 'escalated': return -2
    case 'error': return -2
    default: return 0
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 14,
      height: 14,
      border: '2px solid #3b82f6',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

function StepBubble({ index, activeStep, label, desc }: {
  index: number
  activeStep: number
  label: string
  desc: string
}) {
  const done = index < activeStep
  const active = index === activeStep
  const pending = index > activeStep && activeStep >= 0

  const bubbleColor = done
    ? '#16a34a'
    : active
    ? '#3b82f6'
    : '#334155'

  const textColor = done ? '#4ade80' : active ? '#93c5fd' : '#475569'
  const descColor = done ? '#4ade80' : active ? '#7dd3fc' : '#334155'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: bubbleColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
        boxShadow: active ? '0 0 0 4px rgba(59,130,246,0.3)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        {done ? '✓' : active ? <Spinner /> : index + 1}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: active || done ? 700 : 400, color: textColor, transition: 'color 0.4s' }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: descColor, marginTop: 2, transition: 'color 0.4s' }}>
          {pending ? '' : desc}
        </div>
      </div>
    </div>
  )
}

function Connector({ activeStep, index }: { activeStep: number; index: number }) {
  const filled = index < activeStep
  return (
    <div style={{
      height: 2,
      flex: 1,
      marginTop: -10,
      background: filled ? '#16a34a' : '#1e293b',
      transition: 'background 0.6s ease',
      borderRadius: 2,
    }} />
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      background: color,
      color: 'white',
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 4,
      letterSpacing: '0.05em',
    }}>
      {text}
    </span>
  )
}

function ResultCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 16,
      animation: 'fadeIn 0.5s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.03em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function KV({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: '#64748b', width: 120, flexShrink: 0, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        color: '#cbd5e1',
        fontFamily: mono ? '"Cascadia Code", "Fira Code", ui-monospace, monospace' : 'inherit',
        wordBreak: 'break-word',
      }}>
        {value}
      </span>
    </div>
  )
}

function DiffViewer({ hunk }: { hunk: DiffHunkData }) {
  const removed = (hunk.original || '').split('\n').filter(Boolean)
  const added = (hunk.replacement || '').split('\n')

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: '"Cascadia Code", "Fira Code", ui-monospace, monospace',
          fontSize: 12,
          color: '#7dd3fc',
          background: '#0c1929',
          padding: '3px 10px',
          borderRadius: 4,
        }}>
          {hunk.file_path}
        </span>
      </div>
      {hunk.explanation && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, fontStyle: 'italic' }}>
          {hunk.explanation}
        </div>
      )}
      <div style={{
        fontFamily: '"Cascadia Code", "Fira Code", ui-monospace, monospace',
        fontSize: 12,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #1e293b',
      }}>
        <div style={{
          background: '#0a0f1e',
          padding: '6px 14px',
          fontSize: 10,
          color: '#475569',
          letterSpacing: '0.1em',
          fontWeight: 600,
        }}>
          DIFF ── {hunk.file_path?.split('/').pop()}
        </div>
        {removed.map((line, i) => (
          <div key={`-${i}`} style={{
            background: 'rgba(220, 38, 38, 0.15)',
            color: '#fca5a5',
            padding: '3px 14px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            borderLeft: '3px solid #dc2626',
          }}>
            {'- ' + line}
          </div>
        ))}
        {added.map((line, i) => (
          <div key={`+${i}`} style={{
            background: 'rgba(22, 163, 74, 0.15)',
            color: '#86efac',
            padding: '3px 14px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            borderLeft: '3px solid #16a34a',
          }}>
            {(line ? '+ ' + line : '+')}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [data, setData] = useState<PollData | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [failureId, setFailureId] = useState<string | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const stopAll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopAll(), [stopAll])

  const startRun = useCallback(async () => {
    stopAll()
    setRunStatus('queued')
    setData(null)
    setIngestError(null)
    setElapsed(0)
    setFailureId(null)
    startTimeRef.current = Date.now()

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    try {
      const res = await fetch(`${BACKEND}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeEnvelope()),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`POST /ingest → ${res.status}: ${text}`)
      }
      const { failure_id } = (await res.json()) as { failure_id: string }
      setFailureId(failure_id)

      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`${BACKEND}/failures/${failure_id}`)
          if (!pr.ok) return
          const d = (await pr.json()) as PollData
          setData(d)
          const s = d.status as RunStatus
          setRunStatus(s)
          if (s === 'resolved' || s === 'escalated') stopAll()
        } catch {
          // swallow transient network errors during polling
        }
      }, 2000)
    } catch (e) {
      setRunStatus('error')
      setIngestError(e instanceof Error ? e.message : String(e))
      stopAll()
    }
  }, [stopAll])

  const activeStep = statusToActiveStep(runStatus)
  const isRunning =
    runStatus !== 'idle' &&
    runStatus !== 'resolved' &&
    runStatus !== 'escalated' &&
    runStatus !== 'error'

  const testCase = data?.test_case as Record<string, unknown> | null | undefined
  const diagnosis = data?.diagnosis as Record<string, unknown> | null | undefined
  const fixProposal = data?.fix_proposal as Record<string, unknown> | null | undefined
  const diagnosisRootCause = diagnosis?.root_cause as Record<string, unknown> | undefined
  const diagnosisComponent = diagnosis?.affected_component as Record<string, unknown> | undefined
  const diffList = (fixProposal?.diff as DiffHunkData[] | undefined) || []

  const statusLabel: Record<RunStatus, string> = {
    idle: 'Ready',
    queued: 'Queued',
    processing: 'Processing',
    reproducing: 'Reproducing failure…',
    diagnosing: 'Diagnosing root cause…',
    repairing: 'Generating fix…',
    resolved: 'Resolved ✓',
    escalated: 'Escalated — needs review',
    error: 'Error',
  }

  const statusColor: Record<RunStatus, string> = {
    idle: '#475569',
    queued: '#0ea5e9',
    processing: '#0ea5e9',
    reproducing: '#f59e0b',
    diagnosing: '#a855f7',
    repairing: '#f97316',
    resolved: '#16a34a',
    escalated: '#ef4444',
    error: '#ef4444',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020817', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
          ⚡ Ship Happens
        </span>
        <span style={{ fontSize: 11, background: '#1e3a5f', padding: '2px 8px', borderRadius: 4, color: '#7dd3fc', fontWeight: 600 }}>
          Autonomous Bug Repair
        </span>
        <div style={{ flex: 1 }} />
        <a href="/" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>← Checkout Demo</a>
      </header>

      {/* ── Content ── */}
      <main style={{ maxWidth: 860, margin: '40px auto', padding: '0 24px' }}>

        {/* ── Hero card ── */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 24,
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>
                Pipeline Monitor
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
                Injects a seeded TypeError and runs the autonomous repair pipeline
              </p>
            </div>
            <div style={{ flex: 1 }} />
            {/* Status badge */}
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: statusColor[runStatus],
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {isRunning && (
                <span style={{ animation: 'pulse 1.5s ease-in-out infinite', fontSize: 8 }}>●</span>
              )}
              {statusLabel[runStatus]}
              {isRunning && (
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 400 }}>
                  {elapsed}s
                </span>
              )}
              {runStatus === 'resolved' && elapsed > 0 && (
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 400 }}>
                  in {elapsed}s
                </span>
              )}
            </div>
          </div>

          {/* ── Pipeline strip ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 28 }}>
            {STEPS.map((step, i) => (
              <>
                <StepBubble
                  key={step.label}
                  index={i}
                  activeStep={activeStep}
                  label={step.label}
                  desc={step.desc}
                />
                {i < STEPS.length - 1 && (
                  <Connector key={`c-${i}`} activeStep={activeStep} index={i + 1} />
                )}
              </>
            ))}
          </div>

          {/* ── Inject button ── */}
          <button
            onClick={startRun}
            disabled={isRunning}
            style={{
              background: isRunning ? '#1e293b' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: isRunning ? '#475569' : 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px 28px',
              fontSize: 14,
              fontWeight: 700,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
              transition: 'all 0.2s',
              width: '100%',
            }}
          >
            {isRunning
              ? `Running… (${elapsed}s)`
              : runStatus === 'resolved'
              ? '↺ Run Again'
              : '💥 Inject Bug & Run Pipeline'}
          </button>

          {/* Failure ID */}
          {failureId && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#334155', textAlign: 'center', fontFamily: 'monospace' }}>
              failure_id: {failureId}
            </div>
          )}

          {/* Error banner */}
          {runStatus === 'error' && ingestError && (
            <div style={{
              marginTop: 12,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#fca5a5',
              fontFamily: 'monospace',
            }}>
              {ingestError}
            </div>
          )}

          {/* Escalation banner */}
          {runStatus === 'escalated' && (
            <div style={{
              marginTop: 12,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#fca5a5',
            }}>
              ⚠️ Pipeline escalated — confidence below threshold. Human review required.
            </div>
          )}
        </div>

        {/* ── Error detail: what we injected ── */}
        {runStatus !== 'idle' && (
          <ResultCard title="Injected Failure" icon="🐛">
            <KV label="error.name" value="TypeError" />
            <KV
              label="error.message"
              value="Cannot read properties of undefined (reading 'street')"
              mono
            />
            <KV
              label="stack trace"
              value={
                <pre style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {`at processOrder (src/lib/checkout.ts:8:20)\nat handlePlaceOrder (src/components/CheckoutStepper.tsx:74:5)\nat HTMLButtonElement.onClick (src/components/CheckoutStepper.tsx:120:9)`}
                </pre>
              }
            />
            <KV label="url" value="http://localhost:3000/checkout" mono />
            <KV
              label="interactions"
              value="navigate → continue-to-shipping → skip-address → place-order"
            />
          </ResultCard>
        )}

        {/* ── Reproduction result ── */}
        {testCase && (
          <ResultCard title="Reproduction" icon="🔍">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <Badge
                text={testCase.failure_reproduced ? '✓ Reproduced' : '✗ Not Reproduced'}
                color={testCase.failure_reproduced ? '#16a34a' : '#dc2626'}
              />
              {testCase.confidence != null && (
                <Badge
                  text={`Confidence ${((testCase.confidence as number) * 100).toFixed(0)}%`}
                  color="#0ea5e9"
                />
              )}
            </div>
            {testCase.failure_assertion && (
              <KV label="assertion" value={String(testCase.failure_assertion)} mono />
            )}
          </ResultCard>
        )}

        {/* ── Diagnosis result ── */}
        {diagnosis && (
          <ResultCard title="Diagnosis" icon="🔬">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {diagnosisRootCause?.classification && (
                <Badge text={String(diagnosisRootCause.classification)} color="#7c3aed" />
              )}
              {diagnosis.confidence != null && (
                <Badge
                  text={`Confidence ${((diagnosis.confidence as number) * 100).toFixed(0)}%`}
                  color="#0ea5e9"
                />
              )}
            </div>
            {diagnosisComponent && (
              <KV
                label="component"
                value={`${diagnosisComponent.file_path}:${diagnosisComponent.line_number} — ${diagnosisComponent.function_name}()`}
                mono
              />
            )}
            {diagnosis.failure_condition && (
              <KV label="condition" value={String(diagnosis.failure_condition)} />
            )}
            {diagnosisRootCause?.explanation && (
              <KV label="explanation" value={String(diagnosisRootCause.explanation)} />
            )}
          </ResultCard>
        )}

        {/* ── Fix Proposal ── */}
        {fixProposal && (
          <ResultCard title="Fix Proposal" icon="🔧">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {fixProposal.confidence != null && (
                <Badge
                  text={`Confidence ${((fixProposal.confidence as number) * 100).toFixed(0)}%`}
                  color="#16a34a"
                />
              )}
              <Badge
                text={fixProposal.auto_merge_eligible ? 'Auto-merge eligible' : 'Manual review'}
                color={fixProposal.auto_merge_eligible ? '#16a34a' : '#f59e0b'}
              />
            </div>
            {diffList.length > 0 ? (
              diffList.map((hunk, i) => <DiffViewer key={i} hunk={hunk} />)
            ) : (
              <div style={{ fontSize: 12, color: '#475569' }}>No diff available</div>
            )}
          </ResultCard>
        )}

      </main>
    </div>
  )
}
