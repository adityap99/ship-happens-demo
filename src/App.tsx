import CheckoutStepper from './components/CheckoutStepper'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#0f172a', color: 'white', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>Ship Happens</span>
        <span style={{ fontSize: '12px', background: '#1e3a5f', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>checkout demo</span>
      </header>
      <main style={{ maxWidth: '640px', margin: '48px auto', padding: '0 24px' }}>
        <CheckoutStepper />
      </main>
    </div>
  )
}
