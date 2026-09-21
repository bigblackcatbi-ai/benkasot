'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronRight, Cpu, History, ImagePlus, LayoutGrid, Mic, Pause, Play, Plus, RotateCcw, Settings, Sparkles, SlidersHorizontal, Video, Zap } from 'lucide-react'
import { memes } from '@/lib/memes'
import type { Meme } from '@/types/meme'
import { useCamera } from '@/hooks/use-camera'
import { useFaceLandmarker } from '@/hooks/use-face-landmarker'
import { useHandLandmarker } from '@/hooks/use-hand-landmarker'
import { useExpressionGestureDetection } from '@/hooks/use-expression-gesture-detection'
import { useMemeTriggerEngine } from '@/hooks/use-meme-trigger-engine'

const nav = [
  ['CAMERA', '/camera', Camera], ['MEMES', '/memes', LayoutGrid], ['CREATE', '/memes/create', Plus], ['LEARN', '/learn', Sparkles], ['HISTORY', '/history', History], ['SETTINGS', '/settings', Settings],
] as const

function Logo() { return <Link href="/" className="logo" aria-label="MEME VISION home"><span>MEME</span><b>//</b><span>VISION</span></Link> }

function Button({ children, accent = 'black', className = '', onClick, disabled = false }: { children: React.ReactNode; accent?: string; className?: string; onClick?: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`brutal-btn ${accent} ${className}`}>{children}</button>
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return <div className="app-shell"><header className="top-nav"><Logo /><nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href} className={path === href || (href === '/camera' && path === '/') ? 'active' : ''}><Icon size={15} />{label}</Link>)}</nav><Link href="/camera" className="open-camera"><span className="live-dot" /> OPEN CAMERA <ChevronRight size={16} /></Link></header>{children}<footer className="footer"><Logo /><span>LOCAL VISION / v0.8.4</span><span>NO VIDEO UPLOAD</span></footer><div className="mobile-nav">{nav.slice(0, 5).map(([label, href, Icon]) => <Link href={href} key={href} className={path === href ? 'active' : ''}><Icon size={17}/><span>{label}</span></Link>)}</div></div>
}

function Sticker({ children, color = 'yellow' }: { children: React.ReactNode; color?: string }) { return <span className={`sticker ${color}`}>{children}</span> }
function Placeholder({ label = 'MEME PREVIEW', color = 'yellow' }: { label?: string; color?: string }) { return <div className={`meme-placeholder ${color}`}><span>{label}</span><b>IMG</b></div> }

function Home() {
  return <Shell><main>
    <section className="hero page-pad"><div className="hero-copy"><Sticker>VISION ONLINE ●</Sticker><h1>MAKE A FACE.<br /><em>GET A MEME.</em></h1><p className="hero-sub">Your webcam watches the chaos. Your expressions trigger the reaction.</p><div className="hero-actions"><Link href="/camera" className="brutal-btn pink">OPEN CAMERA <ChevronRight size={18}/></Link><Link href="/memes" className="brutal-btn white">EXPLORE MEMES</Link></div><div className="badges"><Sticker color="mint">BROWSER-BASED</Sticker><Sticker color="blue">REAL-TIME</Sticker><Sticker color="orange">NO VIDEO UPLOAD</Sticker></div></div><div className="hero-device"><div className="device-top"><span><i className="live-dot"/> CAMERA LIVE</span><span>FPS 30</span></div><div className="fake-camera"><div className="face-grid"><span className="face-shape"/><span className="eye e1"/><span className="eye e2"/><span className="mouth"/></div><div className="ar-sticker">SHOCKED<br /><small>91% MATCH</small></div><span className="hud hud-a">FACE DETECTED</span><span className="hud hud-b">HANDS: 2</span><span className="hud hud-c">MEME LOCKED.</span></div><div className="device-bottom"><span>EXPRESSION: SURPRISED</span><span>LOCAL PROCESSING</span></div></div></section>
    <section className="how page-pad"><div className="section-heading"><Sticker color="blue">THE LOOP</Sticker><h2>HOW IT WORKS</h2><p>Four steps between your face and absolute nonsense.</p></div><div className="steps">{[['01','CAMERA','Allow webcam access.'],['02','VISION','Detect face + hands.'],['03','MATCH','Compare the chaos.'],['04','REACT','Drop meme on camera.']].map(([n,t,d])=><div className="step" key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p><ChevronRight /></div>)}</div></section>
    <section className="loaded page-pad"><div className="section-heading row"><div><Sticker color="yellow">LIBRARY STATUS</Sticker><h2>10 REACTIONS LOADED</h2></div><Link href="/memes" className="text-link">VIEW ALL <ChevronRight size={16}/></Link></div><div className="meme-grid mini">{memes.slice(0, 5).map((m, i)=><MemeCard meme={m} key={m.name} index={i}/>)}</div></section>
    <section className="chaos page-pad"><div><Sticker color="pink">BUILT FOR CHAOS</Sticker><h2>THE CAMERA<br /><em>GETS IT.</em></h2></div><div className="chaos-list">{['FACE REACTIONS','HAND GESTURES','EYE DIRECTION','HEAD MOVEMENT','CUSTOM TRIGGERS'].map((x,i)=><div key={x}><span>0{i+1}</span><strong>{x}</strong><ChevronRight /></div>)}</div></section>
  </main></Shell>
}

function MemeCard({ meme, index = 0 }: { meme: Meme; index?: number }) { return <article className="meme-card"><Placeholder label={index % 3 === 1 ? '!!!' : meme.shortLabel} color={meme.accentColor}/><div className="meme-card-body"><div className="card-kicker"><span className={`dot ${meme.accentColor}`} /> {meme.typeLabel}</div><h3>{meme.name}</h3><p>{meme.triggerSummary}</p><div className="card-footer"><span className="active-status">● {meme.enabled ? 'ACTIVE' : 'DISABLED'}</span><Link href={`/memes/${meme.id}`} className="small-link">EDIT →</Link></div></div></article> }

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

        // A light mesh: nearby landmark pairs plus the face outline.
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

function CameraPage() {
  const camera = useCamera()
  const [overlay, setOverlay] = useState(true)
  const [goatBot, setGoatBot] = useState(false)

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

  return <Shell><main className="camera-page page-pad">
    <div className="camera-topline"><div><Sticker color={isActive ? 'mint' : camera.status === 'denied' || camera.status === 'unavailable' || camera.status === 'error' ? 'pink' : 'yellow'}>● {isActive ? 'CAMERA LIVE' : isRequesting ? 'REQUESTING CAMERA' : 'CAMERA OFF'}</Sticker><span className="technical">{camera.devices.length ? `${camera.devices.length} CAMERA${camera.devices.length === 1 ? '' : 'S'} AVAILABLE` : 'CAMERA DEVICE'}</span></div><div className="technical">MEDIAPIPE FACE + HAND · LOCAL ONLY</div></div>
    <div className="camera-workspace">
      <section className="camera-stage">
        <div className="stage-header"><span>LIVE VIEWPORT // 001</span><span>LOCAL VISION INPUT</span></div>
        <div className="camera-viewport">
          <video ref={camera.videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
          <LandmarkOverlay enabled={goatBot && isActive} video={camera.videoRef.current} faceLandmarks={face.landmarksRef} handLandmarks={hands.landmarksRef} />
          {!isActive && <div className="camera-status-message"><strong>{isRequesting ? 'ALLOW CAMERA ACCESS' : camera.status === 'idle' ? 'CAMERA STOPPED' : 'CAMERA UNAVAILABLE'}</strong><span>{camera.error ?? 'Your live camera preview will appear here.'}</span>{camera.status !== 'denied' && camera.status !== 'unavailable' && camera.status !== 'error' && <Button accent="pink" onClick={() => void camera.start()}>START CAMERA</Button>}{camera.status === 'denied' && <Button accent="pink" onClick={() => void camera.start()}>TRY AGAIN</Button>}</div>}
          {overlay && isActive && <div className="camera-meme"><span>!!!</span><strong>SHOCKED</strong><small>MOCK UI</small></div>}
        </div>
        <div className="camera-controls">
          <Button onClick={() => isActive ? camera.stop() : void camera.start()} accent="white">{isActive ? <Pause size={16}/> : <Play size={16}/>} {isActive ? 'STOP' : 'START'}</Button>
          <Button accent={goatBot ? 'yellow' : 'white'} onClick={() => setGoatBot((value) => !value)}><Cpu size={16}/> GOAT BOT {goatBot ? 'ON' : 'OFF'}</Button>
          <Button accent="white" disabled><Camera size={16}/> SNAPSHOT</Button>
          <Button accent="white" disabled><Video size={16}/> RECORD</Button>
          <Button accent="white" disabled><RotateCcw size={16}/> FLIP</Button>
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
          <div className="analysis-heading"><span>MEME MATCH ENGINE</span><b>{memeEngine.topMatch ? memeEngine.topMatch.score + '%' : 'WAITING'}</b></div>
          {memeEngine.topMatch ? <div className="meme-match-live">
            <strong>{memeEngine.topMatch.meme.name}</strong>
            <span>{memeEngine.topMatch.matched}/{memeEngine.topMatch.total} TRIGGERS MATCHED</span>
          </div> : <div className="gesture-empty">NO MEME TRIGGERED YET</div>}
          {memeEngine.matches.slice(1, 4).map(match => <div className="meme-match-row" key={match.meme.id}><span>{match.meme.shortLabel}</span><b>{match.score}%</b></div>)}
        </div>

        <div className="analysis-box">
          <div className="analysis-heading"><span>EXPRESSION / GESTURE</span><b>LIVE</b></div>
          <div className="analysis-section"><small>FACE</small><div className="analysis-grid">
            <span>EXPRESSION</span><strong>{analysis.faceExpression}</strong>
            <span>EYES</span><strong>{analysis.eyes}</strong>
            <span>MOUTH</span><strong>{analysis.mouth}</strong>
            <span>HEAD</span><strong>{analysis.headDirection}</strong>
          </div></div>
          <div className="analysis-section"><small>HANDS</small>
            {analysis.handGestures.length ? analysis.handGestures.map((hand, index) => <div className="gesture-row" key={hand.handedness + index}><span>{hand.handedness === 'Hand' ? `HAND ${index + 1}` : hand.handedness}</span><strong>{hand.gesture}</strong></div>) : <div className="gesture-empty">NO HAND GESTURE DETECTED</div>}
          </div>
        </div>
        {camera.devices.length > 0 && <div className="trigger"><div className="trigger-title"><span>CAMERA DEVICE</span></div>{camera.devices.map((device) => <label className="toggle" key={device.deviceId}><span>{device.label}</span><input type="radio" name="camera-device" checked={device.deviceId === camera.selectedDeviceId} onChange={() => void camera.selectDevice(device.deviceId)}/><i/></label>)}</div>}
        <div className="trigger"><div className="trigger-title"><span>GOAT BOT</span><b>{goatBot ? 'VISUALIZER ON' : 'VISUALIZER OFF'}</b></div><p>Show the live face + hand landmarks as a thin local debug mesh.</p><small>DOTS + STRINGS → CAMERA ONLY</small></div><div className="trigger"><div className="trigger-title"><span>PHASE 7</span><b>LIVE MATCHING</b></div><p>The 10 built-in reactions now evaluate your local face and hand states in real time. No video is uploaded and no meme image is overlaid yet.</p><small>VISION → CONDITIONS → BEST MATCH</small></div>
        <label className="toggle"><span>SHOW MOCK MEME</span><input type="checkbox" checked={overlay} onChange={(event) => setOverlay(event.target.checked)}/><i/></label>
      </aside>
    </div>
  </main></Shell>
}
function LibraryPage() { return <Shell><main className="page-pad content-page"><div className="page-title"><Sticker color="yellow">THE REACTION BANK</Sticker><h1>MEME LIBRARY</h1><p>10 reactions ready to destroy your camera.</p></div><div className="library-tools"><div className="search">⌕ <input placeholder="SEARCH MEMES..." /></div>{['FACE','HAND','MOVEMENT','ACTIVE'].map(x=><Button accent="white" key={x}>{x}</Button>)}<Button accent="black"><SlidersHorizontal size={16}/> SORT</Button></div><div className="meme-grid">{memes.map((m,i)=><MemeCard meme={m} index={i} key={m.name}/>)}<Link href="/memes/create" className="create-card"><Plus size={28}/><strong>CREATE NEW MEME</strong><span>Build a reaction from scratch →</span></Link></div></main></Shell> }

function GenericPage({ kind }: { kind: string }) { const config: Record<string,[string,string,string]> = { create:['CREATE YOUR OWN REACTION','Build a trigger that feels like you.','UPLOAD → CONDITION → TEST → SAVE'], learn:['TEACH IT A NEW REACTION','Show the camera what your reaction looks like.','RECORD → ANALYZE → PROFILE'], history:['REACTION HISTORY','The receipts. Nothing more, nothing less.','LOCAL LOG / VIDEO NOT STORED'], settings:['SETTINGS','Tune the machine to your particular brand of chaos.','PREFERENCES / DEBUG / PRIVACY'], about:['HOW IT WORKS','Sophisticated computer vision. Extremely unserious output.','CAMERA → VISION → MATCH → REACT'] }; const [title, sub, kicker] = config[kind] || config.about; return <Shell><main className="page-pad content-page generic"><div className="page-title"><Sticker color={kind==='settings'?'blue':'pink'}>{kicker}</Sticker><h1>{title}</h1><p>{sub}</p></div><div className="generic-layout"><section className="big-panel"><div className="panel-heading"><span>{kind === 'about' ? 'SYSTEM DIAGRAM' : kind.toUpperCase() + ' WORKSPACE'}</span><Cpu size={17}/></div>{kind === 'create' && <><div className="upload-box"><ImagePlus size={32}/><h2>DROP A MEME HERE</h2><p>PNG · JPG · WEBP · GIF</p><Button accent="pink">CHOOSE FILE</Button></div><div className="builder-row"><span>WHEN</span><Sticker color="yellow">FACE</Sticker><Plus/><Sticker color="blue">HAND</Sticker><Plus/><Sticker color="mint">MOVEMENT</Sticker></div></>}{kind === 'learn' && <><div className="training-preview"><div className="training-face">READY?</div><span>CAMERA PREVIEW // HOLD YOUR REACTION FOR 3 SECONDS</span></div><div className="countdown"><b>03</b><span>GET READY</span><Button accent="pink">START RECORDING</Button></div></>}{kind === 'history' && <HistoryRows/>}{kind === 'settings' && <SettingsRows/>}{kind === 'about' && <AboutDiagram/>}</section><aside className="side-note"><Sticker color="yellow">STATUS</Sticker><h2>VISION ONLINE.</h2><p>Everything here is a demo state, ready for MediaPipe to take over in VS Code.</p><Button accent="black">OPEN CAMERA <ChevronRight size={15}/></Button></aside></div></main></Shell> }
function HistoryRows(){return <div className="history-rows">{[['11:42:12','SHOCKED','91%'],['11:40:03','JUDGING PEOPLE','84%'],['11:37:48','YESSS','88%'],['11:21:19','THINKING','79%']].map(r=><div className="history-row" key={r[0]}><span>{r[0]}</span><strong>{r[1]}</strong><b>{r[2]}</b><ChevronRight size={15}/></div>)}</div>}
function SettingsRows(){return <div className="settings-rows">{['CAMERA','AUDIO','DETECTION','OVERLAY','PRIVACY','PERFORMANCE','APPEARANCE'].map((x,i)=><div className="settings-row" key={x}><span>{x}</span><b>{i===4?'LOCAL PROCESSING ENABLED':'CONFIGURE'}</b><ChevronRight size={16}/></div>)}</div>}
function AboutDiagram(){return <div className="diagram">{['CAMERA','VISION ENGINE','FACE + HAND LANDMARKS','EXPRESSION / GESTURE','MEME MATCHER','AR OVERLAY'].map((x,i)=><div key={x}><strong>{x}</strong>{i<5 && <ChevronRight/>}</div>)}</div>}

export default function MemeVisionApp(){ const path=usePathname(); if(path==='/') return <Home/>; if(path==='/camera') return <CameraPage/>; if(path==='/memes') return <LibraryPage/>; if(path==='/memes/create') return <GenericPage kind="create"/>; if(path==='/learn') return <GenericPage kind="learn"/>; if(path==='/history') return <GenericPage kind="history"/>; if(path==='/settings') return <GenericPage kind="settings"/>; return <GenericPage kind="about"/> }

export { Button, Logo, Shell, MemeCard, memes }
