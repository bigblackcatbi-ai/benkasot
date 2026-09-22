'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronRight, Cpu, ImagePlus, LayoutGrid, Pause, Play, Plus, Settings, SlidersHorizontal, Zap } from 'lucide-react'
import { addCustomMeme, deleteMeme, getAllMemes, getMemeById, memes } from '@/lib/memes'
import type { Meme, MemeCondition, MemeConditionValue } from '@/types/meme'
import { useCamera } from '@/hooks/use-camera'
import { useFaceLandmarker } from '@/hooks/use-face-landmarker'
import { useHandLandmarker } from '@/hooks/use-hand-landmarker'
import { useExpressionGestureDetection } from '@/hooks/use-expression-gesture-detection'
import { useMemeTriggerEngine } from '@/hooks/use-meme-trigger-engine'

const nav = [
  ['CAMERA', '/camera', Camera], ['MEMES', '/memes', LayoutGrid], ['CREATE', '/memes/create', Plus], ['SETTINGS', '/settings', Settings],
] as const

function Logo() { return <Link href="/" className="logo" aria-label="BENKASOT home"><span>BENKASOT</span></Link> }

function Button({ children, accent = 'black', className = '', onClick, disabled = false }: { children: React.ReactNode; accent?: string; className?: string; onClick?: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`brutal-btn ${accent} ${className}`}>{children}</button>
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return <div className="app-shell"><header className="top-nav"><Logo /><nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href} className={path === href || (href === '/camera' && path === '/') ? 'active' : ''}><Icon size={15} />{label}</Link>)}</nav><Link href="/camera" className="open-camera"><span className="live-dot" /> OPEN CAMERA <ChevronRight size={16} /></Link></header>{children}<footer className="footer"><Logo /><span>LOCAL VISION / v0.8.4</span><span>NO VIDEO UPLOAD</span></footer><div className="mobile-nav">{nav.slice(0, 4).map(([label, href, Icon]) => <Link href={href} key={href} className={path === href ? 'active' : ''}><Icon size={17}/><span>{label}</span></Link>)}</div></div>
}

function Sticker({ children, color = 'yellow' }: { children: React.ReactNode; color?: string }) { return <span className={`sticker ${color}`}>{children}</span> }
function Placeholder({ label = 'MEME PREVIEW', color = 'yellow' }: { label?: string; color?: string }) { return <div className={`meme-placeholder ${color}`}><span>{label}</span><b>IMG</b></div> }

function MemePreview({ meme, index = 0 }: { meme: Meme; index?: number }) {
  if (meme.source === 'custom' && meme.imagePath) {
    return <div className={`meme-preview-image ${meme.accentColor}`}><img src={meme.imagePath} alt={meme.name} /></div>
  }
  return <Placeholder label={index % 3 === 1 ? '!!!' : meme.shortLabel} color={meme.accentColor} />
}

function Home() {
  return <Shell><main>
    <section className="hero page-pad"><div className="hero-copy"><Sticker>VISION ONLINE ●</Sticker><h1>MAKE A FACE.<br /><em>GET A MEME.</em></h1><p className="hero-sub">Your webcam watches the chaos. Your expressions trigger the reaction.</p><div className="hero-actions"><Link href="/camera" className="brutal-btn pink">OPEN CAMERA <ChevronRight size={18}/></Link><Link href="/memes" className="brutal-btn white">EXPLORE MEMES</Link></div><div className="badges"><Sticker color="mint">BROWSER-BASED</Sticker><Sticker color="blue">REAL-TIME</Sticker><Sticker color="orange">NO VIDEO UPLOAD</Sticker></div></div><div className="hero-device"><div className="device-top"><span><i className="live-dot"/> CAMERA LIVE</span><span>FPS 30</span></div><div className="fake-camera"><div className="face-grid"><span className="face-shape"/><span className="eye e1"/><span className="eye e2"/><span className="mouth"/></div><div className="ar-sticker">SHOCKED<br /><small>91% MATCH</small></div><span className="hud hud-a">FACE DETECTED</span><span className="hud hud-b">HANDS: 2</span><span className="hud hud-c">MEME LOCKED.</span></div><div className="device-bottom"><span>EXPRESSION: SURPRISED</span><span>LOCAL PROCESSING</span></div></div></section>
    <section className="how page-pad"><div className="section-heading"><Sticker color="blue">THE LOOP</Sticker><h2>HOW IT WORKS</h2><p>Four steps between your face and absolute nonsense.</p></div><div className="steps">{[['01','CAMERA','Allow webcam access.'],['02','VISION','Detect face + hands.'],['03','MATCH','Compare the chaos.'],['04','REACT','Drop meme on camera.']].map(([n,t,d])=><div className="step" key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p><ChevronRight /></div>)}</div></section>
    <section className="loaded page-pad"><div className="section-heading row"><div><Sticker color="yellow">LIBRARY STATUS</Sticker><h2>10 REACTIONS LOADED</h2></div><Link href="/memes" className="text-link">VIEW ALL <ChevronRight size={16}/></Link></div><div className="meme-grid mini">{memes.slice(0, 5).map((m, i)=><MemeCard meme={m} key={m.name} index={i}/>)}</div></section>
    <section className="chaos page-pad"><div><Sticker color="pink">BUILT FOR CHAOS</Sticker><h2>THE CAMERA<br /><em>GETS IT.</em></h2></div><div className="chaos-list">{['FACE REACTIONS','HAND GESTURES','EYE DIRECTION','HEAD MOVEMENT','CUSTOM TRIGGERS'].map((x,i)=><div key={x}><span>0{i+1}</span><strong>{x}</strong><ChevronRight /></div>)}</div></section>
  </main></Shell>
}

function MemeCard({ meme, index = 0, onDelete }: { meme: Meme; index?: number; onDelete?: (id: string) => void }) {
  return <article className="meme-card">
    <MemePreview meme={meme} index={index}/>
    <div className="meme-card-body">
      <div className="card-kicker"><span className={`dot ${meme.accentColor}`} /> {meme.typeLabel}</div>
      <h3>{meme.name}</h3>
      <p>{meme.triggerSummary}</p>
      <div className="card-footer">
        <span className="active-status">● {meme.enabled ? 'ACTIVE' : 'DISABLED'}</span>
        <div className="card-actions">
          <Link href={`/memes/create?edit=${encodeURIComponent(meme.id)}`} className="small-link">EDIT →</Link>
          {onDelete && <button type="button" className="small-link delete-link" onClick={() => onDelete(meme.id)}>DELETE</button>}
        </div>
      </div>
    </div>
  </article>
}

function LandmarkOverlay({ enabled, video, faceLandmarks, handLandmarks }: { enabled: boolean; video: HTMLVideoElement | null; faceLandmarks: React.MutableRefObject<import('@mediapipe/tasks-vision').NormalizedLandmark[][]>; handLandmarks: React.MutableRefObject<import('@mediapipe/tasks-vision').NormalizedLandmark[][]> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!enabled || !video) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const dpr = window.devicePixelRatio || 1
      const pixelWidth = Math.max(1, Math.round(width * dpr))
      const pixelHeight = Math.max(1, Math.round(height * dpr))

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const videoWidth = video.videoWidth || width
      const videoHeight = video.videoHeight || height
      const scale = Math.max(width / videoWidth, height / videoHeight)
      const renderedWidth = videoWidth * scale
      const renderedHeight = videoHeight * scale
      const offsetX = (width - renderedWidth) / 2
      const offsetY = (height - renderedHeight) / 2

      const point = (landmark: { x: number; y: number }) => ({
        x: offsetX + landmark.x * renderedWidth,
        y: offsetY + landmark.y * renderedHeight,
      })

      const dot = (landmark: { x: number; y: number }, radius = 1.5) => {
        const p = point(landmark)
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        const start = point(a)
        const end = point(b)
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()
      }

      ctx.lineWidth = 0.65
      ctx.globalAlpha = 0.72

      const faces = faceLandmarks.current
      if (faces[0]) {
        const face = faces[0]
        ctx.strokeStyle = '#111'
        ctx.fillStyle = '#111'

        for (let i = 0; i < face.length - 1; i += 2) line(face[i], face[i + 1])
        const outline = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10]
        for (let i = 0; i < outline.length - 1; i++) {
          const a = face[outline[i]]
          const b = face[outline[i + 1]]
          if (a && b) line(a, b)
        }
        face.forEach((landmark) => dot(landmark, 1.15))
      }

      const hands = handLandmarks.current
      const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]
      hands.forEach((hand) => {
        ctx.strokeStyle = '#ff5e88'
        ctx.fillStyle = '#ff5e88'
        connections.forEach(([a,b]) => {
          if (hand[a] && hand[b]) line(hand[a], hand[b])
        })
        hand.forEach((landmark) => dot(landmark, 1.7))
      })

      ctx.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [enabled, video, faceLandmarks, handLandmarks])

  if (!enabled) return null
  return <canvas ref={canvasRef} className="landmark-overlay" aria-hidden="true" />
}


function MemeAROverlay({ meme, video, faceLandmarks }: { meme: Meme | null; video: HTMLVideoElement | null; faceLandmarks: React.MutableRefObject<import('@mediapipe/tasks-vision').NormalizedLandmark[][]> }) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const [pose, setPose] = useState({ x: 50, y: 42, width: 28, angle: 0 })

  useEffect(() => {
    if (!meme || !video) return

    let frame = 0
    const update = () => {
      const canvas = video.parentElement
      const width = canvas?.clientWidth ?? 0
      const height = canvas?.clientHeight ?? 0
      const face = faceLandmarks.current[0]

      if (width && height && face?.length) {
        const xs = face.map(point => point.x)
        const ys = face.map(point => point.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2
        const faceWidth = Math.max(0.08, maxX - minX)
        const leftEye = face[33]
        const rightEye = face[263]
        const angle = leftEye && rightEye ? Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI : 0

        const videoWidth = video.videoWidth || width
        const videoHeight = video.videoHeight || height
        const scale = Math.max(width / videoWidth, height / videoHeight)
        const renderedWidth = videoWidth * scale
        const renderedHeight = videoHeight * scale
        const offsetX = (width - renderedWidth) / 2
        const offsetY = (height - renderedHeight) / 2

        const screenX = offsetX + centerX * renderedWidth
        const screenY = offsetY + centerY * renderedHeight
        const screenFaceWidth = faceWidth * renderedWidth

        setPose({
          x: (screenX / width) * 100 + meme.overlay.offsetX,
          y: (screenY / height) * 100 + meme.overlay.offsetY,
          width: Math.max(12, Math.min(65, (screenFaceWidth / width) * 100 * 2.15 * meme.overlay.scale)),
          angle: angle + meme.overlay.rotation,
        })
      }

      frame = requestAnimationFrame(update)
    }

    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [meme, video, faceLandmarks])

  if (!meme || !video) return null

  const imageBroken = failedImage === meme.id
  return (
    <div
      className="meme-ar-overlay"
      style={{
        left: `${pose.x}%`,
        top: `${pose.y}%`,
        width: `${pose.width}%`,
        opacity: meme.overlay.opacity,
        transform: `translate(-50%, -50%) rotate(${pose.angle}deg)`,
        animation: meme.overlay.animation === 'pop' ? 'meme-pop 260ms ease-out' : meme.overlay.animation === 'shake' ? 'meme-shake 360ms ease-in-out' : meme.overlay.animation === 'bounce' ? 'meme-bounce 500ms ease-in-out' : undefined,
      }}
    >
      {imageBroken ? (
        <div className="meme-ar-fallback">
          <span>BENKASOT</span>
          <strong>{meme.shortLabel}</strong>
        </div>
      ) : (
        <img src={meme.imagePath} alt={meme.name} onError={() => setFailedImage(meme.id)} />
      )}
      <span className="meme-ar-tag">{meme.shortLabel} · 100%</span>
    </div>
  )
}

function CameraPage() {
  const camera = useCamera()
  const [overlay, setOverlay] = useState(true)
  const [goatBot, setGoatBot] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  useEffect(() => {
    void camera.start()
    return () => camera.stop()
  }, [camera.start, camera.stop])

  const isActive = camera.status === 'active'
  const isRequesting = camera.status === 'requesting'
  const face = useFaceLandmarker(camera.videoRef, isActive)
  const hands = useHandLandmarker(camera.videoRef, isActive)
  const analysis = useExpressionGestureDetection(face.landmarksRef, hands.landmarksRef, hands.handednessRef, isActive)
  const memeEngine = useMemeTriggerEngine(analysis, face.landmarksRef, hands.landmarksRef, isActive)

  // activeMeme is only non-null when all of that meme's required groups match.
  const activeMeme = memeEngine.activeMeme
  const activeMatch = activeMeme
    ? memeEngine.matches.find(match => match.meme.id === activeMeme.id)
    : null

  return <Shell><main className="camera-page page-pad">
    <div className="camera-topline"><div><Sticker color={isActive ? 'mint' : camera.status === 'denied' || camera.status === 'unavailable' || camera.status === 'error' ? 'pink' : 'yellow'}>● {isActive ? 'CAMERA LIVE' : isRequesting ? 'REQUESTING CAMERA' : 'CAMERA OFF'}</Sticker><span className="technical">{camera.devices.length ? `${camera.devices.length} CAMERA${camera.devices.length === 1 ? '' : 'S'} AVAILABLE` : 'CAMERA DEVICE'}</span></div><div className="technical">MEDIAPIPE FACE + HAND · LOCAL ONLY</div></div>
    <div className="camera-workspace">
      <section className="camera-stage">
        <div className="stage-header"><span>LIVE VIEWPORT // 001</span><span>LOCAL VISION INPUT</span></div>
        <div className="camera-viewport">
          <video ref={camera.videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
          <LandmarkOverlay enabled={goatBot && isActive} video={camera.videoRef.current} faceLandmarks={face.landmarksRef} handLandmarks={hands.landmarksRef} />
          {!isActive && <div className="camera-status-message"><strong>{isRequesting ? 'ALLOW CAMERA ACCESS' : camera.status === 'idle' ? 'CAMERA STOPPED' : 'CAMERA UNAVAILABLE'}</strong><span>{camera.error ?? 'Your live camera preview will appear here.'}</span>{camera.status !== 'denied' && camera.status !== 'unavailable' && camera.status !== 'error' && <Button accent="pink" onClick={() => void camera.start()}>START CAMERA</Button>}{camera.status === 'denied' && <Button accent="pink" onClick={() => void camera.start()}>TRY AGAIN</Button>}</div>}
          {/* Meme AR overlay only appears after a meme's full requirement is met. */}
          {activeMeme && isActive && analysis.facePresent && <MemeAROverlay meme={activeMeme} video={camera.videoRef.current} faceLandmarks={face.landmarksRef} />}
        </div>
        <div className="camera-controls">
          <Button onClick={() => isActive ? camera.stop() : void camera.start()} accent="white">{isActive ? <Pause size={16}/> : <Play size={16}/>} {isActive ? 'STOP' : 'START'}</Button>
          <Button accent={goatBot ? 'yellow' : 'white'} onClick={() => setGoatBot((value) => !value)}><Cpu size={16}/> GOAT BOT {goatBot ? 'ON' : 'OFF'}</Button>
          <Button accent={debugMode ? 'yellow' : 'white'} onClick={() => setDebugMode((value) => !value)}><SlidersHorizontal size={16}/> DEBUG {debugMode ? 'ON' : 'OFF'}</Button>
          <Button accent="pink" className="meme-now" disabled>MEME NOW <Zap size={16}/></Button>
        </div>
      </section>
      <aside className="detect-panel">
        <div className="panel-heading"><span>VISION DETECTION</span><SlidersHorizontal size={17}/></div>
        <div className="detect-row"><span>CAMERA</span><b>{camera.status.toUpperCase()}</b></div>
        <div className="detect-row"><span>MEDIAPIPE</span><b>{face.status.toUpperCase()}</b></div>
        <div className="detect-row"><span>FACE</span><b><i className="green-dot"/> {face.faceDetected ? 'DETECTED' : 'NOT DETECTED'}</b></div>
        <div className="detect-row"><span>FACES</span><b>{face.faceCount}</b></div>
        <div className="detect-row"><span>FACE LANDMARKS</span><b>{face.landmarkCount}</b></div>
        <div className="detect-row"><span>HANDS</span><b><i className="green-dot"/> {hands.handDetected ? `${hands.handCount} DETECTED` : "NOT DETECTED"}</b></div>
        <div className="detect-row"><span>HAND LANDMARKS</span><b>{hands.landmarkCount}</b></div>
        <div className="detect-row"><span>LEFT / RIGHT</span><b>{hands.leftHandDetected ? "L" : "-"} / {hands.rightHandDetected ? "R" : "-"}</b></div>
        {(face.error || hands.error) && <div className="match-box"><span>VISION MESSAGE</span><h2>CHECK MEDIAPIPE</h2><p>{face.error ?? hands.error}</p></div>}
        <div className="analysis-box">
          <div className="analysis-heading"><span>MEME MATCH ENGINE</span><b>{activeMatch ? `${activeMatch.matched}/${activeMatch.total} ACTIVE` : memeEngine.topMatch ? `${memeEngine.topMatch.matched}/${memeEngine.topMatch.total} DETECTING` : 'WAITING'}</b></div>
          {activeMeme ? <div className="meme-match-live">
            <strong>{activeMeme.name}</strong>
            <span>{activeMatch ? `${activeMatch.matched}/${activeMatch.total}` : 'FULL'} TRIGGERS MET — MEME ACTIVE</span>
          </div> : memeEngine.topMatch ? <div className="meme-match-live">
            <strong>{memeEngine.topMatch.meme.name}</strong>
            <span>{memeEngine.topMatch.matched}/{memeEngine.topMatch.total} TRIGGERS MATCHED — WAITING FOR {memeEngine.topMatch.total}/{memeEngine.topMatch.total}</span>
          </div> : <div className="gesture-empty">NO MEME TRIGGERED YET</div>}
          {memeEngine.matches.slice(1, 4).map(match => <div className="meme-match-row" key={match.meme.id}><span>{match.meme.shortLabel}</span><b>{match.matched}/{match.total}</b></div>)}
        </div>

        {debugMode && <div className="analysis-box debug-box">
          <div className="analysis-heading"><span>PHASE 12 // DEBUG</span><b>LIVE</b></div>
          <div className="analysis-grid debug-grid">
            <span>CANDIDATE</span><strong>{memeEngine.debug.candidateId ? (memeEngine.matches.find(match => match.meme.id === memeEngine.debug.candidateId)?.meme.shortLabel ?? memeEngine.debug.candidateId) : 'NONE'}</strong>
            <span>CANDIDATE SCORE</span><strong>{memeEngine.debug.candidateScore}%</strong>
            <span>SAMPLES</span><strong>{memeEngine.debug.candidateSamples}</strong>
            <span>STABLE</span><strong>{memeEngine.debug.stableId ? (memeEngine.matches.find(match => match.meme.id === memeEngine.debug.stableId)?.meme.shortLabel ?? memeEngine.debug.stableId) : 'NONE'}</strong>
            <span>STABLE SCORE</span><strong>{memeEngine.debug.stableScore}%</strong>
            <span>ACTIVE MEME</span><strong>{activeMeme ? activeMeme.shortLabel : 'NONE'}</strong>
          </div>
          <small className="debug-note">MEME ACTIVATES WHEN ALL OF ITS REQUIRED TRIGGERS ARE MET</small>
        </div>}

        <div className="analysis-box">
          <div className="analysis-heading"><span>EXPRESSION / GESTURE</span><b>LIVE</b></div>
          <div className="analysis-section"><small>FACE</small><div className="analysis-grid">
            <span>EXPRESSION</span><strong>{analysis.facePresent ? analysis.faceExpression : 'NO FACE'}</strong>
            <span>EYES</span><strong>{analysis.facePresent ? analysis.eyes : 'NO FACE'}</strong>
            <span>MOUTH</span><strong>{analysis.facePresent ? analysis.mouth : 'NO FACE'}</strong>
            <span>HEAD</span><strong>{analysis.facePresent ? analysis.headDirection : 'NO FACE'}</strong>
          </div></div>
          <div className="analysis-section"><small>HANDS</small>
            {analysis.handGestures.length ? analysis.handGestures.map((hand, index) => <div className="gesture-row" key={hand.handedness + index}><span>{hand.handedness === 'Hand' ? `HAND ${index + 1}` : hand.handedness}</span><strong>{hand.gesture}</strong></div>) : <div className="gesture-empty">NO HAND GESTURE DETECTED</div>}
          </div>
        </div>
        {camera.devices.length > 0 && <div className="trigger"><div className="trigger-title"><span>CAMERA DEVICE</span></div>{camera.devices.map((device) => <label className="toggle" key={device.deviceId}><span>{device.label}</span><input type="radio" name="camera-device" checked={device.deviceId === camera.selectedDeviceId} onChange={() => void camera.selectDevice(device.deviceId)}/><i/></label>)}</div>}
        <div className="trigger"><div className="trigger-title"><span>GOAT BOT</span><b>{goatBot ? 'VISUALIZER ON' : 'VISUALIZER OFF'}</b></div><p>Show the live face + hand landmarks as a thin local debug mesh.</p><small>DOTS + STRINGS → CAMERA ONLY</small></div><div className="trigger"><div className="trigger-title"><span>PHASE 9</span><b>AR OVERLAY</b></div><p>The stable top meme now follows the detected face in the live viewport. Overlay position, scale and rotation come from local landmarks.</p><small>FACE → ANCHOR → MEME IMAGE</small></div>
        <label className="toggle"><span>SHOW MOCK MEME</span><input type="checkbox" checked={overlay} onChange={(event) => setOverlay(event.target.checked)}/><i/></label>
      </aside>
    </div>
  </main></Shell>
}
function LibraryPage() {
  const [allMemes, setAllMemes] = useState(getAllMemes())

  useEffect(() => {
    setAllMemes(getAllMemes())
  }, [])

  const handleDelete = (id: string) => {
    const meme = getAllMemes().find((item) => item.id === id)
    if (!meme) return
    if (!window.confirm(`Delete "${meme.name}"?`)) return
    deleteMeme(id)
    setAllMemes(getAllMemes())
  }

  return <Shell><main className="page-pad content-page"><div className="page-title"><Sticker color="yellow">THE REACTION BANK</Sticker><h1>MEME LIBRARY</h1><p>{allMemes.length} reactions ready to destroy your camera.</p></div><div className="library-tools"><div className="search">⌕ <input placeholder="SEARCH MEMES..." /></div>{['FACE','HAND','MOVEMENT','ACTIVE'].map(x=><Button accent="white" key={x}>{x}</Button>)}<Button accent="black"><SlidersHorizontal size={16}/> SORT</Button></div><div className="meme-grid">{allMemes.map((m,i)=><MemeCard meme={m} index={i} key={m.id} onDelete={handleDelete}/>)}<Link href="/memes/create" className="create-card"><Plus size={28}/><strong>CREATE NEW MEME</strong><span>Build a reaction from scratch →</span></Link></div></main></Shell>
}

function CreateMemePage() {
  const [name, setName] = useState('')
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [mode, setMode] = useState<'expression' | 'gesture' | 'combined'>('expression')
  const [selectedConditions, setSelectedConditions] = useState<MemeConditionValue[]>(['smiling'])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit')
    if (!id) return
    const existing = getMemeById(id)
    if (!existing) return

    setEditId(existing.id)
    setName(existing.name)
    setImagePath(existing.imagePath)
    setImageName(existing.source === 'custom' ? 'CURRENT CUSTOM IMAGE' : 'CURRENT BUILT-IN IMAGE')
    setMode(existing.trigger.type === 'combined' ? 'combined' : existing.trigger.type === 'gesture' ? 'gesture' : 'expression')
    setSelectedConditions(existing.trigger.conditions.filter((condition) => condition.enabled !== false).map((condition) => condition.value))
  }, [])

   const faceOptions: Array<{ value: MemeConditionValue; label: string }> = [
   { value: 'smiling', label: 'SMILE' },
   { value: 'happy', label: 'HAPPY' },
   { value: 'sad', label: 'SAD' },
   { value: 'surprised', label: 'SURPRISED' },
   { value: 'smirk', label: 'SMIRK' },
   { value: 'neutral', label: 'NEUTRAL' },
   { value: 'squinting', label: 'SQUINT EYES' },
   { value: 'wide', label: 'WIDE EYES' },
   { value: 'open', label: 'MOUTH OPEN' },
   { value: 'closed', label: 'MOUTH CLOSED' },
   { value: 'upward', label: 'LOOK UP' },
   { value: 'right', label: 'LOOK RIGHT' },
   { value: 'left', label: 'LOOK LEFT' },
   { value: 'down', label: 'LOOK DOWN' },
  ]

  const handOptions: Array<{ value: MemeConditionValue; label: string }> = [
    { value: 'open-palm', label: 'OPEN PALM' },
    { value: 'fist', label: 'FIST' },
    { value: 'peace', label: 'PEACE' },
    { value: 'thumbs-up', label: 'THUMBS UP' },
    { value: 'thumbs-down', label: 'THUMBS DOWN' },
    { value: 'pointing-up', label: 'POINTING UP' },
    { value: 'three-fingers', label: 'THREE FINGERS' },
    { value: 'ok', label: 'OK' },
    { value: 'hand-on-head', label: 'HAND ON HEAD' },
    { value: 'both-hands-near-head', label: 'BOTH HANDS ON HEAD' },
    { value: 'hand-on-chest', label: 'HAND ON CHEST' },
    { value: 'index-finger-near-mouth', label: 'INDEX FINGER NEAR MOUTH' },
    { value: 'index-finger-near-head', label: 'INDEX FINGER NEAR HEAD' },
    { value: 'index-finger-to-chest', label: 'INDEX FINGER TO CHEST' },
    { value: 'salute', label: 'SALUTE' },
  ]

  const visibleOptions = mode === 'expression'
    ? faceOptions
    : mode === 'gesture'
      ? handOptions
      : [...faceOptions, ...handOptions]

  const handleImage = (file?: File) => {
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large. Maximum size is 5 MB.')
      return
    }

    setError('')
    setSaved(false)
    setImageName(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePath(reader.result)
      }
    }
    reader.onerror = () => {
      setError('Could not read that image. Try another file.')
      setImagePath(null)
      setImageName('')
    }
    reader.readAsDataURL(file)
  }

  const toggleCondition = (value: MemeConditionValue) => {
    setSelectedConditions((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value])
    setSaved(false)
  }

  const handleModeChange = (nextMode: typeof mode) => {
    setMode(nextMode)
    setSelectedConditions([])
    setSaved(false)
  }

  const buildCondition = (value: MemeConditionValue): MemeCondition => {
  const eyeValues = new Set<MemeConditionValue>([
    'squinting',
    'wide',
  ])

  const mouthValues = new Set<MemeConditionValue>([
    'open',
    'closed',
    'smiling',
  ])

  const gazeValues = new Set<MemeConditionValue>([
    'upward',
    'right',
    'left',
    'down',
  ])

  const expressionValues = new Set<MemeConditionValue>([
    'happy',
    'sad',
    'surprised',
    'smirk',
    'neutral',
  ])

  if (eyeValues.has(value)) {
    return {
      feature: 'eyes',
      category: 'face',
      value,
      required: true,
    }
  }

  if (mouthValues.has(value)) {
    return {
      feature: 'mouth',
      category: 'face',
      value,
      required: true,
    }
  }

  if (gazeValues.has(value)) {
    return {
      feature: 'gaze',
      category: 'face',
      value,
      required: true,
    }
  }

  if (expressionValues.has(value)) {
    return {
      feature: 'expression',
      category: 'face',
      value,
      required: true,
    }
  }

  if (
    value === 'index-finger-near-mouth' ||
    value === 'index-finger-near-head' ||
    value === 'index-finger-to-chest'
  ) {
    return {
      feature: 'finger',
      category: 'hand',
      value,
      required: true,
    }
  }

  return {
    feature: 'hands',
    category: 'hand',
    value,
    required: true,
  }
}

  const saveMeme = () => {
    if (!name.trim() || !imagePath) {
      setError('Add a meme image and name before saving.')
      return
    }
    if (!selectedConditions.length) {
      setError('Choose at least one trigger condition.')
      return
    }

    const conditions = selectedConditions.map(buildCondition)
    const normalizedName = name.trim().toUpperCase()
    const existingMemes = getAllMemes().filter(meme => meme.id !== editId)

    const duplicateName = existingMemes.some(meme => meme.name.trim().toUpperCase() === normalizedName)
    if (duplicateName) {
      setError('STOP: A meme with this name already exists. Use a different name or edit the existing meme.')
      return
    }

    const triggerKey = conditions
      .map(condition => `${condition.feature}:${condition.value}`)
      .sort()
      .join('|')
    const duplicateTrigger = existingMemes.find(meme => meme.trigger.conditions
      .filter(condition => condition.enabled !== false)
      .map(condition => `${condition.feature}:${condition.value}`)
      .sort()
      .join('|') === triggerKey)

    if (duplicateTrigger) {
      setError(`STOP: These trigger conditions already belong to "${duplicateTrigger.name}". Change the conditions or edit that meme instead.`)
      return
    }

    const groups = new Map<string, string[]>()
    conditions.forEach(condition => {
      const labels = groups.get(condition.feature) ?? []
      labels.push(condition.value.replaceAll('-', ' '))
      groups.set(condition.feature, labels)
    })
    const summary = [...groups.values()]
      .map(values => values.length > 1 ? `(${values.join(' OR ')})` : values[0])
      .join(' + ')

    const meme: Meme = {
      id: editId ?? `custom-${Date.now()}`,
      name: normalizedName,
      shortLabel: name.trim().toUpperCase(),
      description: `Custom reaction triggered by ${summary}.`,
      triggerSummary: `When: ${summary}`,
      typeLabel: mode === 'combined' ? 'FACE + HAND' : mode === 'gesture' ? 'HAND' : 'FACE',
      imagePath,
      category: mode === 'combined' ? 'combination' : mode === 'gesture' ? 'hand' : 'face',
      enabled: true,
      source: 'custom',
      accentColor: 'pink',
      mockConfidence: 92,
      trigger: { type: mode === 'combined' ? 'combined' : mode, conditions },
      overlay: {
        anchor: 'face',
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: -12,
        opacity: 1,
        duration: 900,
        animation: 'pop',
      },
    }

    addCustomMeme(meme)
    setSaved(true)
    setError('')
  }

  return <Shell><main className="page-pad content-page create-meme-page">
    <div className="page-title">
      <Sticker color="pink">{editId ? 'PHASE 10 / EDIT MEME' : 'PHASE 10 / CUSTOM BUILDER'}</Sticker>
      <h1>{editId ? <>EDIT YOUR<br /><em>MEME.</em></> : <>MAKE YOUR<br /><em>OWN MEME.</em></>}</h1>
      <p>Upload the reaction. Pick one or more signals. Combine face and hand conditions for precise reactions.</p>
    </div>

    <div className="custom-builder">
      <section className="big-panel">
        <div className="panel-heading"><span>01 // MEME IMAGE</span><ImagePlus size={17}/></div>
        <label className="custom-upload">
          {imagePath ? <img src={imagePath} alt="Custom meme preview" /> : <div className="custom-upload-empty"><ImagePlus size={36}/><strong>DROP YOUR MEME</strong><span>PNG · JPG · WEBP · GIF · MAX 5 MB</span></div>}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleImage(event.target.files?.[0])} />
        </label>
        {imageName && <div className="file-name">LOADED // {imageName}</div>}
      </section>

      <section className="big-panel">
        <div className="panel-heading"><span>02 // NAME IT</span><span>REQUIRED</span></div>
        <input className="custom-input" value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} placeholder="E.G. BRO WHAT" maxLength={32} />
        <div className="panel-heading custom-heading"><span>03 // TRIGGER MODE</span><span>SELECT ONE</span></div>
        <div className="mode-grid">
          {[
            ['expression', 'FACE', 'Choose any face / gaze signals'],
            ['gesture', 'HAND', 'Choose any hand gesture / pose'],
            ['combined', 'FACE + HAND', 'Mix multiple face and hand signals'],
          ].map(([value, label, description]) => <button key={value} className={mode === value ? 'mode-card active' : 'mode-card'} onClick={() => handleModeChange(value as typeof mode)}><strong>{label}</strong><span>{description}</span></button>)}
        </div>
        <div className="panel-heading custom-heading">
          <span>04 // CONDITIONS</span>
          <span>{selectedConditions.length} SELECTED</span>
        </div>
        <div className="condition-grid">
          {visibleOptions.map((option) => <button key={option.value} className={selectedConditions.includes(option.value) ? 'condition-chip active' : 'condition-chip'} onClick={() => toggleCondition(option.value)}>{selectedConditions.includes(option.value) ? '✓ ' : ''}{option.label}</button>)}
        </div>
        <div className="custom-note-inline">Same-feature conditions are alternatives (OR). Different features combine together. Example: HAPPY + SAD + OPEN MOUTH means (HAPPY OR SAD) + OPEN MOUTH. Duplicate names and trigger sets are blocked.</div>
        <div className="custom-actions">
          <Button accent="pink" onClick={saveMeme}><Zap size={16}/> {saved ? 'SAVED TO SESSION' : editId ? 'UPDATE MEME' : 'SAVE CUSTOM MEME'}</Button>
          {saved && <Link href="/camera" className="brutal-btn white">TEST IN CAMERA →</Link>}
        </div>
        {error && <div className="custom-error">{error}</div>}
      </section>
    </div>

    <div className="custom-note">
      <Sticker color="yellow">PHASE 10 NOTE</Sticker>
      <p>Custom memes are kept in memory for this browser session. Nothing is uploaded to a server and nothing is permanently stored yet. Persistent storage arrives in Phase 12.</p>
    </div>
  </main></Shell>
}

function SettingsRows(){return <div className="settings-rows">{['CAMERA','AUDIO','DETECTION','OVERLAY','PRIVACY','PERFORMANCE','APPEARANCE'].map((x,i)=><div className="settings-row" key={x}><span>{x}</span><b>{i===4?'LOCAL PROCESSING ENABLED':'CONFIGURE'}</b><ChevronRight size={16}/></div>)}</div>}
function AboutDiagram(){return <div className="diagram">{['CAMERA','VISION ENGINE','FACE + HAND LANDMARKS','EXPRESSION / GESTURE','MEME MATCHER','AR OVERLAY'].map((x,i)=><div key={x}><strong>{x}</strong>{i<5 && <ChevronRight/>}</div>)}</div>}

function GenericPage({ kind }: { kind: string }) {
  const config: Record<string,[string,string,string]> = {
    settings:['SETTINGS','Tune the machine to your particular brand of chaos.','PREFERENCES / DEBUG / PRIVACY'],
    about:['HOW IT WORKS','Sophisticated computer vision. Extremely unserious output.','CAMERA → VISION → MATCH → REACT']
  }
  const [title, sub, kicker] = config[kind] || config.about
  return <Shell><main className="page-pad content-page generic"><div className="page-title"><Sticker color={kind==='settings'?'blue':'pink'}>{kicker}</Sticker><h1>{title}</h1><p>{sub}</p></div><div className="generic-layout"><section className="big-panel"><div className="panel-heading"><span>{kind === 'about' ? 'SYSTEM DIAGRAM' : kind.toUpperCase() + ' WORKSPACE'}</span><Cpu size={17}/></div>{kind === 'settings' && <SettingsRows/>}{kind === 'about' && <AboutDiagram/>}</section><aside className="side-note"><Sticker color="yellow">STATUS</Sticker><h2>VISION ONLINE.</h2><p>Everything here is a demo state, ready for MediaPipe to take over in VS Code.</p><Button accent="black">OPEN CAMERA <ChevronRight size={15}/></Button></aside></div></main></Shell>
}

export default function MemeVisionApp(){ const path=usePathname(); if(path==='/') return <Home/>; if(path==='/camera') return <CameraPage/>; if(path==='/memes') return <LibraryPage/>; if(path==='/memes/create') return <CreateMemePage/>; if(path==='/settings') return <GenericPage kind="settings"/>; return <GenericPage kind="about"/> }

export { Button, Logo, Shell, MemeCard, memes }
