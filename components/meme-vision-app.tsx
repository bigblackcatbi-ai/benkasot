'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Camera, ChevronRight, Cpu, History, ImagePlus, LayoutGrid, Mic, Pause, Play, Plus, RotateCcw, Settings, Sparkles, SlidersHorizontal, Video, Zap } from 'lucide-react'
import { memes } from '@/lib/memes'
import type { Meme } from '@/types/meme'
import { useCamera } from '@/hooks/use-camera'
import { useFaceLandmarker } from '@/hooks/use-face-landmarker'

const nav = [
  ['CAMERA', '/camera', Camera], ['MEMES', '/memes', LayoutGrid], ['CREATE', '/memes/create', Plus], ['LEARN', '/learn', Sparkles], ['HISTORY', '/history', History], ['SETTINGS', '/settings', Settings],
] as const

function Logo() { return <Link href="/" className="logo" aria-label="MEME VISION home"><span>MEME</span><b>//</b><span>VISION</span></Link> }

function Button({ children, accent = 'black', className = '', onClick }: { children: React.ReactNode; accent?: string; className?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={`brutal-btn ${accent} ${className}`}>{children}</button>
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

function CameraPage() {
  const camera = useCamera()
  const [overlay, setOverlay] = useState(true)

  useEffect(() => {
    void camera.start()
    return () => camera.stop()
  }, [camera.start, camera.stop])

  const isActive = camera.status === 'active'
  const isRequesting = camera.status === 'requesting'
  const face = useFaceLandmarker(camera.videoRef, isActive)

  return <Shell><main className="camera-page page-pad">
    <div className="camera-topline"><div><Sticker color={isActive ? 'mint' : camera.status === 'denied' || camera.status === 'unavailable' || camera.status === 'error' ? 'pink' : 'yellow'}>● {isActive ? 'CAMERA LIVE' : isRequesting ? 'REQUESTING CAMERA' : 'CAMERA OFF'}</Sticker><span className="technical">{camera.devices.length ? `${camera.devices.length} CAMERA${camera.devices.length === 1 ? '' : 'S'} AVAILABLE` : 'CAMERA DEVICE'}</span></div><div className="technical">MEDIAPIPE FACE · NO AUDIO</div></div>
    <div className="camera-workspace">
      <section className="camera-stage">
        <div className="stage-header"><span>LIVE VIEWPORT // 001</span><span>LOCAL VISION INPUT</span></div>
        <div className="camera-viewport">
          <video ref={camera.videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
          {!isActive && <div className="camera-status-message"><strong>{isRequesting ? 'ALLOW CAMERA ACCESS' : camera.status === 'idle' ? 'CAMERA STOPPED' : 'CAMERA UNAVAILABLE'}</strong><span>{camera.error ?? 'Your live camera preview will appear here.'}</span>{camera.status !== 'denied' && camera.status !== 'unavailable' && camera.status !== 'error' && <Button accent="pink" onClick={() => void camera.start()}>START CAMERA</Button>}{camera.status === 'denied' && <Button accent="pink" onClick={() => void camera.start()}>TRY AGAIN</Button>}</div>}
          {overlay && isActive && <div className="camera-meme"><span>!!!</span><strong>SHOCKED</strong><small>MOCK UI</small></div>}
        </div>
        <div className="camera-controls">
          <Button onClick={() => isActive ? camera.stop() : void camera.start()} accent="white">{isActive ? <Pause size={16}/> : <Play size={16}/>} {isActive ? 'STOP' : 'START'}</Button>
          <Button accent="white" disabled><Camera size={16}/> SNAPSHOT</Button>
          <Button accent="white" disabled><Video size={16}/> RECORD</Button>
          <Button accent="white" disabled><RotateCcw size={16}/> FLIP</Button>
          <Button accent="pink" className="meme-now" disabled>MEME NOW <Zap size={16}/></Button>
        </div>
      </section>
      <aside className="detect-panel">
        <div className="panel-heading"><span>FACE DETECTION</span><SlidersHorizontal size={17}/></div>
        <div className="detect-row"><span>CAMERA</span><b>{camera.status.toUpperCase()}</b></div>
        <div className="detect-row"><span>MEDIAPIPE</span><b>{face.status.toUpperCase()}</b></div>
        <div className="detect-row"><span>FACE</span><b><i className="green-dot"/> {face.faceDetected ? 'DETECTED' : 'NOT DETECTED'}</b></div>
        <div className="detect-row"><span>FACES</span><b>{face.faceCount}</b></div>
        <div className="detect-row"><span>LANDMARKS</span><b>{face.landmarkCount}</b></div>
        {face.error && <div className="match-box"><span>VISION MESSAGE</span><h2>CHECK MEDIAPIPE</h2><p>{face.error}</p></div>}
        {camera.devices.length > 0 && <div className="trigger"><div className="trigger-title"><span>CAMERA DEVICE</span></div>{camera.devices.map((device) => <label className="toggle" key={device.deviceId}><span>{device.label}</span><input type="radio" name="camera-device" checked={device.deviceId === camera.selectedDeviceId} onChange={() => void camera.selectDevice(device.deviceId)}/><i/></label>)}</div>}
        <div className="trigger"><div className="trigger-title"><span>PHASE 4</span></div><p>MediaPipe is detecting face landmarks only. Hands, expressions, triggers and overlays remain disabled.</p><small>FACE LANDMARKS → LOCAL PROCESSING</small></div>
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
