import { useState } from 'react'
import { processOrder, type OrderAddress, type OrderConfirmation } from '../lib/checkout'
import { capture } from '../ship-happens'

interface User {
  name: string
  email: string
  address?: OrderAddress
}

const CART_ITEMS = [
  { id: 1, name: 'Wireless Headphones', price: 79.99, qty: 1 },
  { id: 2, name: 'USB-C Cable (2-pack)', price: 12.99, qty: 2 },
]
const CART_TOTAL = CART_ITEMS.reduce((sum, i) => sum + i.price * i.qty, 0)

const card: React.CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  padding: '28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
}
const label: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '6px',
}
const primaryBtn: React.CSSProperties = {
  background: '#6366f1',
  color: 'white',
  padding: '11px 24px',
  fontSize: '15px',
  fontWeight: 600,
  borderRadius: '8px',
  width: '100%',
  marginTop: '8px',
}
const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#64748b',
  border: '1px solid #cbd5e1',
  padding: '10px 20px',
  fontSize: '14px',
  borderRadius: '8px',
  marginTop: '8px',
}

function StepIndicator({ current }: { current: number }) {
  const steps = ['Cart', 'Address', 'Review']
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', alignItems: 'center' }}>
      {steps.map((s, i) => {
        const n = i + 1
        const active = n === current
        const done = n < current
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: n < 3 ? 1 : 'none' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '13px', fontWeight: 700,
              background: active ? '#6366f1' : done ? '#22c55e' : '#e2e8f0',
              color: active || done ? 'white' : '#94a3b8',
              flexShrink: 0,
            }}>
              {done ? '✓' : n}
            </div>
            <span style={{ fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? '#1e293b' : '#94a3b8' }}>{s}</span>
            {n < 3 && <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />}
          </div>
        )
      })}
    </div>
  )
}

export default function CheckoutStepper() {
  const [step, setStep] = useState(1)
  const [user, setUser] = useState<User>({ name: 'Demo User', email: 'demo@example.com' })
  const [form, setForm] = useState({ street: '', city: '', state: '', zip: '' })
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Step 1: Cart review ──────────────────────────────────────────────────

  if (step === 1) return (
    <div style={card}>
      <StepIndicator current={1} />

      {/* ── Demo guide hint ─────────────────────────────────────────────── */}
      <div style={{
        background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
        padding: '12px 16px', marginBottom: '20px', fontSize: '13px', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '6px', letterSpacing: '0.05em', fontSize: '11px', textTransform: 'uppercase' }}>
          🎬 Demo — trigger the bug
        </div>
        <ol style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8' }}>
          <li>Click <strong style={{ color: '#e2e8f0' }}>Continue to Shipping</strong> below</li>
          <li>On the next screen click <strong style={{ color: '#f97316' }}>Skip — I'll add an address later</strong></li>
          <li>Click <strong style={{ color: '#e2e8f0' }}>Place Order</strong> → TypeError fires</li>
          <li>Watch the pipeline at <strong style={{ color: '#818cf8' }}>localhost:8000/dashboard</strong></li>
        </ol>
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Your Cart</h2>
      {CART_ITEMS.map(item => (
        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span>{item.name} × {item.qty}</span>
          <span style={{ fontWeight: 600 }}>${(item.price * item.qty).toFixed(2)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', fontWeight: 700, fontSize: '16px' }}>
        <span>Total</span>
        <span>${CART_TOTAL.toFixed(2)}</span>
      </div>
      <button
        data-testid="continue-to-shipping"
        style={primaryBtn}
        onClick={() => setStep(2)}
      >
        Continue to Shipping
      </button>
    </div>
  )

  // ── Step 2: Shipping address ─────────────────────────────────────────────

  if (step === 2) return (
    <div style={card}>
      <StepIndicator current={2} />
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Shipping Address</h2>
      {(['street', 'city', 'state', 'zip'] as const).map(field => (
        <div key={field} style={{ marginBottom: '14px' }}>
          <label style={label}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
          <input
            data-testid={`address-${field}`}
            value={form[field]}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            placeholder={field === 'street' ? '123 Main St' : field === 'zip' ? '94105' : ''}
          />
        </div>
      ))}
      <button
        data-testid="save-address"
        style={primaryBtn}
        onClick={() => {
          setUser(u => ({ ...u, address: form as OrderAddress }))
          setStep(3)
        }}
      >
        Continue to Review
      </button>
      {/* ── BUG TRIGGER ─────────────────────────────────────────────────────
           Clicking "Skip" advances to step 3 without setting user.address.
           handlePlaceOrder on step 3 then calls processOrder(user.address)
           with user.address = undefined → TypeError.
      ──────────────────────────────────────────────────────────────────── */}
      <button
        data-testid="skip-address"
        style={secondaryBtn}
        onClick={() => setStep(3)}
      >
        Skip — I'll add an address later
      </button>
    </div>
  )

  // ── Step 3: Review & place order ─────────────────────────────────────────

  if (step === 3) return (
    <div style={card}>
      <StepIndicator current={3} />
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Review & Place Order</h2>

      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>Order summary</div>
        {CART_ITEMS.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569', padding: '4px 0' }}>
            <span>{item.name} × {item.qty}</span>
            <span>${(item.price * item.qty).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '8px' }}>
          <span>Total</span><span>${CART_TOTAL.toFixed(2)}</span>
        </div>
      </div>

      {user.address ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', marginBottom: '20px', fontSize: '14px' }}>
          <div style={{ fontWeight: 600, color: '#166534', marginBottom: '4px' }}>Shipping to</div>
          <div style={{ color: '#15803d' }}>{user.address.street}, {user.address.city}, {user.address.state} {user.address.zip}</div>
        </div>
      ) : (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '14px', marginBottom: '20px', fontSize: '14px', color: '#9a3412' }}>
          ⚠️ No shipping address provided.
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '14px', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <button
        data-testid="place-order"
        style={primaryBtn}
        onClick={() => {
          setError(null)
          // ── SEEDED BUG ───────────────────────────────────────────────────
          // user.address is undefined when the user skipped step 2.
          // processOrder(undefined) throws:
          //   TypeError: Cannot read properties of undefined (reading 'street')
          // The Ship Happens SDK captures this and sends a FailureEnvelope.
          //
          // FIX (generated by the repair engine):
          //   Add a guard here — if (!user.address) { setError(...); return; }
          // ────────────────────────────────────────────────────────────────
          try {
            const order = processOrder(user.address!)
            setConfirmation(order)
            setStep(4)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setError(msg)
            // Explicitly capture — window.onerror doesn't fire reliably
            // for errors thrown inside React 18 event handlers.
            capture(err)
          }
        }}
      >
        Place Order — ${CART_TOTAL.toFixed(2)}
      </button>
      <button style={secondaryBtn} onClick={() => setStep(2)}>← Back</button>
    </div>
  )

  // ── Step 4: Confirmation ─────────────────────────────────────────────────

  return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Order placed!</h2>
      <p style={{ color: '#64748b', marginBottom: '20px' }}>
        Confirmation: <strong>{confirmation?.confirmationNumber}</strong>
      </p>
      <p style={{ fontSize: '14px', color: '#94a3b8' }}>
        Estimated delivery: {confirmation?.estimatedDelivery}
      </p>
    </div>
  )
}
