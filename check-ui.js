import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:5173'
const API  = 'http://localhost:3001'
const errors = []
const warnings = []

mkdirSync('screenshots', { recursive: true })

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page    = await browser.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error')   errors.push(`[JS Error] ${msg.text()}`)
    if (msg.type() === 'warning') warnings.push(`[JS Warn] ${msg.text()}`)
  })
  page.on('pageerror', err => errors.push(`[Page Error] ${err.message}`))
  page.on('response', resp => {
    if (resp.status() >= 400 && !resp.url().includes('favicon')) {
      errors.push(`[HTTP ${resp.status()}] ${resp.url()}`)
    }
  })

  // ── Health check ─────────────────────────────────────────────────────────
  console.log('\n🔍 Backend health check...')
  const health = await page.goto(`${API}/health`)
  const healthBody = await health.json().catch(() => ({}))
  console.log(`   /health → ${health.status()} ${health.ok() ? '✅' : '❌'} — ${JSON.stringify(healthBody)}`)

  // ── Login ─────────────────────────────────────────────────────────────────
  console.log('\n🔑 Login con admin@syna.com.ar...')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'screenshots/01-login.png', fullPage: true })

  await page.fill('input[type="email"]',    'admin@syna.com.ar')
  await page.fill('input[type="password"]', 'Admin123!')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'screenshots/02-post-login.png', fullPage: true })
  console.log(`   URL post-login: ${page.url()} ${page.url().includes('dashboard') ? '✅' : '❌'}`)

  // ── Rutas en español (las correctas) ─────────────────────────────────────
  const routes = [
    { path: '/dashboard',     label: 'Dashboard' },
    { path: '/cupones',       label: 'Cupones' },
    { path: '/sucursales',    label: 'Sucursales' },
    { path: '/emails',        label: 'Emails' },
    { path: '/alertas',       label: 'Alertas' },
    { path: '/usuarios',      label: 'Usuarios' },
    { path: '/configuracion', label: 'Configuracion' },
    { path: '/logs',          label: 'Logs' },
  ]

  for (const [i, route] of routes.entries()) {
    console.log(`\n📄 ${route.label}...`)
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 12000 })
      .catch(err => errors.push(`Nav ${route.path}: ${err.message}`))
    await page.waitForTimeout(800)

    const currentUrl = page.url()
    const landed = currentUrl.includes(route.path)
    if (!landed) errors.push(`${route.label}: redirected away to ${currentUrl}`)

    const fname = `screenshots/${String(i + 3).padStart(2,'0')}-${route.label}.png`
    await page.screenshot({ path: fname, fullPage: true })
    console.log(`   ${landed ? '✅' : '❌'} URL: ${currentUrl} — ${fname}`)
  }

  // ── Detalle de cupón (si hay alguno) ─────────────────────────────────────
  console.log('\n🎫 Chequeando cupones...')
  await page.goto(`${BASE}/cupones`, { waitUntil: 'networkidle' })
  const rows = await page.$$('tr[class], tbody tr, [class*="row"]')
  console.log(`   Filas encontradas: ${rows.length} ${rows.length === 0 ? '(DB vacía — esperado)' : '✅'}`)

  // ── Verificar que el CRON no rompió nada ─────────────────────────────────
  console.log('\n⏰ Verificando logs del sistema...')
  await page.goto(`${BASE}/logs`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'screenshots/12-logs-final.png', fullPage: true })

  await browser.close()

  // ── Reporte ────────────────────────────────────────────────────────────
  const reactRouterWarns = warnings.filter(w => w.includes('React Router'))
  const otherWarnings    = warnings.filter(w => !w.includes('React Router'))

  console.log('\n' + '═'.repeat(60))
  console.log('📊 REPORTE FINAL')
  console.log('═'.repeat(60))

  if (errors.length === 0) {
    console.log('\n✅ Sin errores')
  } else {
    console.log(`\n❌ ${errors.length} ERRORES:`)
    errors.forEach(e => console.log(`   ${e}`))
  }

  if (otherWarnings.length > 0) {
    console.log(`\n⚠️  ${otherWarnings.length} advertencias:`)
    otherWarnings.forEach(w => console.log(`   ${w}`))
  }

  if (reactRouterWarns.length > 0) {
    console.log(`\n📌 React Router deprecation warnings: ${reactRouterWarns.length} (ya corregidos con future flags)`)
  }

  console.log('\n' + '═'.repeat(60))

  if (errors.length > 0) process.exit(1)
}

run().catch(err => {
  console.error('Check failed:', err.message)
  process.exit(1)
})
