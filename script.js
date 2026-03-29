/* ═══════════════════════════════════════════════════
   LAVA GLASS — script.js

   Key systems:
   1. Autonomous blob movement  — Lissajous + wander steering
   2. Metaball merge            — CSS blur+contrast (in style.css)
   3. SVG feTurbulence warp     — edges ripple like liquid
   4. Per-ball color lerp       — no flicker, smooth transitions
   5. Organic radius wobble     — blobs breathe
   6. Live fancy clock          — IM Fell English serif
═══════════════════════════════════════════════════ */

const canvas = document.getElementById("canvas")
const ctx    = canvas.getContext("2d")

function resize() {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
}
window.addEventListener("resize", resize)
resize()

/* ─── Color utilities ────────────────────────────── */

function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1,3), 16),
        g: parseInt(hex.slice(3,5), 16),
        b: parseInt(hex.slice(5,7), 16),
    }
}
function rgbToHex(r, g, b) {
    return "#" + [r,g,b].map(v =>
        Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2,"0")
    ).join("")
}
function lerpColor(hexA, hexB, t = 0.022) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB)
    return rgbToHex(
        a.r + (b.r - a.r) * t,
        a.g + (b.g - a.g) * t,
        a.b + (b.b - a.b) * t
    )
}

/* ─── Mode palettes ──────────────────────────────── */
/*
  Colors are intentionally vivid here — on a black
  background with "lighter" blending, blobs ADD light
  together, so they naturally glow and merge bright.
  Desaturated colors would look muddy in this mode.
*/
const MODES = {
    fire:     { colors: ["#e8927c","#e8b87c","#e8c97c","#d4856e","#e8a87c","#c97a6e"], speed: 1.6 },
    pastel:   { colors: ["#d4a8c7","#a8b8d4","#a8d4bc","#d4cca8","#c4a8d4","#a8cdd4"], speed: 0.8 },
    electric: { colors: ["#a8cce8","#a8b4e8","#b8cce8","#c4d8e8","#a8d4e8","#bcc8e8"], speed: 2.2 },
    calm:     { colors: ["#7ea8cc","#7eb8cc","#7eaabc","#8cb8cc","#7aaabb","#8ab4c4"], speed: 0.42 },
    aurora:   { colors: ["#a8d4bc","#c4a8d4","#a8d4cc","#d4a8bc","#bcd4a8","#d4bca8"], speed: 1.0 },
}

let currentMode = MODES.fire
let palette     = [...currentMode.colors]
let speed       = currentMode.speed

function randomColor() {
    return palette[Math.floor(Math.random() * palette.length)]
}

/* ─── Ball factory ───────────────────────────────── */
/*
  Each ball has TWO motion systems that blend together:

  A) Lissajous path — a smooth figure-8 / orbital curve.
     Each ball has its own freqX, freqY, phaseX, phaseY so
     they all trace different looping paths across the screen.
     This guarantees they never clump in one corner or
     freeze — they always have somewhere to go.

  B) Wander steering — a small random angular drift added
     each frame. This breaks the perfectly repeating Lissajous
     loop so motion never feels mechanical or robotic.

  The two systems are blended: Lissajous provides the
  large-scale trajectory, wander adds organic micro-variation.
*/
function makeBall() {
    const c = randomColor()
    return {
        // Position — start scattered across screen
        x: canvas.width  * (0.15 + Math.random() * 0.7),
        y: canvas.height * (0.15 + Math.random() * 0.7),

        // Velocity (wander component)
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,

        // Lissajous parameters
        // freqX/Y: how many cycles across the screen per loop
        // phaseX/Y: offset so each ball is at a different point in its orbit
        lissX:  canvas.width  * 0.35 * (0.5 + Math.random() * 0.5),
        lissY:  canvas.height * 0.35 * (0.5 + Math.random() * 0.5),
        freqX:  0.18 + Math.random() * 0.22,   // radians/s equivalent
        freqY:  0.14 + Math.random() * 0.20,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        lissWeight: 0.012 + Math.random() * 0.008, // how strongly lissajous steers

        // Wander: current heading angle (radians), drifts each frame
        wanderAngle: Math.random() * Math.PI * 2,
        wanderSpeed: 0.02 + Math.random() * 0.03, // how fast heading drifts

        // Wobble: radius pulses organically
        baseR:       60 + Math.random() * 70,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.35 + Math.random() * 0.55,

        color:       c,
        targetColor: c,
    }
}

const BALL_COUNT = 10
let balls = Array.from({ length: BALL_COUNT }, makeBall)

/* ─── SVG turbulence animation ───────────────────── */
/*
  Slowly drifting seed + oscillating baseFrequency
  keeps the liquid warp feeling alive and never looping.
*/
const turbulence = document.getElementById("turbulence")
let turbSeed  = 2
let turbPhase = 0

function animateTurbulence() {
    turbSeed  += 0.003
    turbPhase += 0.007
    const bfX = 0.008 + Math.sin(turbPhase * 0.6) * 0.003
    const bfY = 0.006 + Math.cos(turbPhase * 0.45) * 0.002
    turbulence.setAttribute("seed",          turbSeed.toFixed(3))
    turbulence.setAttribute("baseFrequency", `${bfX.toFixed(5)} ${bfY.toFixed(5)}`)
}

/* ─── Physics update ─────────────────────────────── */

function updateBalls(t) {
    const cx = canvas.width  * 0.5   // screen center
    const cy = canvas.height * 0.5

    for (let b of balls) {

        /* 1. WANDER — heading drifts randomly each frame */
        b.wanderAngle += (Math.random() - 0.5) * b.wanderSpeed * 2
        const wanderFx = Math.cos(b.wanderAngle) * 0.08
        const wanderFy = Math.sin(b.wanderAngle) * 0.08

        /* 2. LISSAJOUS STEERING
           Compute the target point on this ball's Lissajous orbit.
           Then steer toward it — not teleport, just nudge velocity.
           WHY nudge: teleporting would look jittery. Steering gives
           the ball momentum and makes path changes feel physical. */
        const lt = t * 0.0004   // slow time scale for big lazy loops
        const targetX = cx + Math.sin(lt * b.freqX + b.phaseX) * b.lissX
        const targetY = cy + Math.sin(lt * b.freqY + b.phaseY) * b.lissY
        const steerX  = (targetX - b.x) * b.lissWeight
        const steerY  = (targetY - b.y) * b.lissWeight

        /* 3. COMBINE forces */
        b.vx += wanderFx + steerX
        b.vy += wanderFy + steerY

        /* 4. DAMPING — gentle friction keeps speed bounded */
        b.vx *= 0.978
        b.vy *= 0.978

        /* 5. SPEED CAP */
        const maxSpd = speed * 3.5
        const spd = Math.hypot(b.vx, b.vy)
        if (spd > maxSpd) { b.vx = (b.vx/spd)*maxSpd; b.vy = (b.vy/spd)*maxSpd }

        /* 6. MOVE */
        b.x += b.vx * speed
        b.y += b.vy * speed

        /* 7. SOFT BOUNDARY — invisible walls push blobs back gently */
        const margin = b.baseR * 0.5
        if (b.x < margin)                 b.vx += 0.4
        if (b.x > canvas.width  - margin) b.vx -= 0.4
        if (b.y < margin)                 b.vy += 0.4
        if (b.y > canvas.height - margin) b.vy -= 0.4

        /* 8. RADIUS WOBBLE — blobs breathe */
        b.r = b.baseR + Math.sin(t * 0.001 * b.wobbleSpeed + b.wobblePhase) * 12

        /* 9. COLOR LERP — smooth slide toward target, never flicker */
        b.color = lerpColor(b.color, b.targetColor, 0.022)
    }
}

/* ─── Drawing ────────────────────────────────────── */
/*
  WHY black fill + "lighter" blending:
  ctx.globalCompositeOperation = "lighter" adds pixel
  RGB values together. On a black canvas, this means:
  - Single blob → its color
  - Two overlapping blobs → their colors add (brighter, saturated)
  - Three blobs → even brighter
  This naturally creates glowing cores and bright merge zones
  that look like lava or bioluminescence. No extra math needed.

  The CSS blur+contrast then merges their alpha channels
  into unified silhouettes.
*/
function drawBlobs() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let b of balls) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        g.addColorStop(0,    b.color + "ff")
        g.addColorStop(0.55, b.color + "dd")
        g.addColorStop(1,    b.color + "00")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
    }
}

/* ─── Mode switching ─────────────────────────────── */

function setMode(name) {
    const m = MODES[name]
    if (!m) return
    currentMode = m
    palette = [...m.colors]
    speed   = m.speed
    for (let b of balls) b.targetColor = randomColor()

    // Update clock glow color to match mode
    updateClockTheme(name)

    document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"))
    document.getElementById("btn-" + name)?.classList.add("active")
}

/* ─── Clock ──────────────────────────────────────── */
/*
  Updates every second. We use Intl.DateTimeFormat for
  proper locale-aware day/month names — looks elegant
  in the IM Fell English serif font.

  The clock glow color shifts to match the active mode
  so it feels part of the scene, not bolted on.
*/
const clockTime = document.getElementById("clock-time")
const clockDate = document.getElementById("clock-date")

const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"]

function updateClock() {
    const now = new Date()
    const h   = String(now.getHours()).padStart(2,"0")
    const m   = String(now.getMinutes()).padStart(2,"0")
    const s   = String(now.getSeconds()).padStart(2,"0")
    clockTime.textContent = `${h}∶${m}∶${s}`   // ∶ is a ratio colon, looks more elegant

    const day  = DAYS[now.getDay()]
    const date = now.getDate()
    const mon  = MONTHS[now.getMonth()]
    const yr   = now.getFullYear()

    // Ordinal suffix: 1st, 2nd, 3rd, 4th…
    const suffix = date === 1 || date === 21 || date === 31 ? "st"
                 : date === 2 || date === 22             ? "nd"
                 : date === 3 || date === 23             ? "rd" : "th"
    clockDate.textContent = `${day}, ${date}${suffix} ${mon} ${yr}`
}

// Mode → clock glow color mapping
const CLOCK_THEMES = {
    fire:     { time: "rgba(232,200,180,0.90)", glow: "210,150,120" },
    pastel:   { time: "rgba(210,190,220,0.90)", glow: "180,150,210" },
    electric: { time: "rgba(180,210,230,0.90)", glow: "140,180,220" },
    calm:     { time: "rgba(170,200,220,0.90)", glow: "120,170,210" },
    aurora:   { time: "rgba(180,220,200,0.90)", glow: "140,200,180" },
}

function updateClockTheme(name) {
    const t = CLOCK_THEMES[name] || CLOCK_THEMES.fire
    const g = t.glow
    clockTime.style.color = t.time
    clockTime.style.textShadow = `
        0 0 8px  rgba(${g},0.9),
        0 0 24px rgba(${g},0.5),
        0 0 60px rgba(${g},0.25),
        0 0 120px rgba(${g},0.12)
    `
    clockDate.style.color = t.time.replace("0.95","0.5").replace("0.90","0.45")
    clockDate.style.textShadow = `
        0 0 12px rgba(${g},0.35),
        0 0 30px rgba(${g},0.15)
    `
}

updateClock()
setInterval(updateClock, 1000)

/* ─── Main loop ──────────────────────────────────── */

function loop(t) {
    animateTurbulence()
    updateBalls(t)
    drawBlobs()
    requestAnimationFrame(loop)
}

requestAnimationFrame(loop)

// Boot on fire mode
setMode("fire")