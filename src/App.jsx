import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Check, ChevronDown, Download, ImagePlus, Layers3, LockKeyhole,
  RotateCcw, Sparkles, Shirt, SlidersHorizontal, Upload, WandSparkles, X
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const steps = [
  { id: 'person', label: 'Your photo', number: '01', icon: Upload },
  { id: 'outfit', label: 'Choose a look', number: '02', icon: Shirt },
  { id: 'result', label: 'See the magic', number: '03', icon: WandSparkles },
];

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('Please choose a JPG, PNG, or WEBP image.'));
    const reader = new FileReader();
    reader.onload = () => resolve({ src: reader.result, name: file.name, size: file.size });
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function prepareImageForApi(src, maxSize = 1600) {
  const image = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function coverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

async function makePreview(personSrc, outfitSrc) {
  const [person, outfit] = await Promise.all([loadImage(personSrc), loadImage(outfitSrc)]);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  const background = ctx.createLinearGradient(0, 0, 1200, 1500);
  background.addColorStop(0, '#fbfaf5');
  background.addColorStop(1, '#e8ece4');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = 0.96;
  coverImage(ctx, person, 80, 65, 1040, 1370);
  ctx.restore();

  // A local, transparent preview engine: the garment is blended into the torso region.
  // A provider-backed model can replace this image through the optional API without changing the UI.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(245, 455, 710, 845, 80);
  ctx.clip();
  ctx.globalAlpha = 0.82;
  ctx.globalCompositeOperation = 'multiply';
  coverImage(ctx, outfit, 245, 455, 710, 845);
  ctx.globalCompositeOperation = 'source-over';
  const sheen = ctx.createLinearGradient(260, 470, 930, 1250);
  sheen.addColorStop(0, 'rgba(255,255,255,.26)');
  sheen.addColorStop(.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(12,30,26,.16)');
  ctx.fillStyle = sheen;
  ctx.fillRect(245, 455, 710, 845);
  ctx.restore();

  ctx.fillStyle = 'rgba(251,250,245,.9)';
  ctx.roundRect(48, 1390, 300, 55, 28);
  ctx.fill();
  ctx.fillStyle = '#263a32';
  ctx.font = '600 22px Inter, Arial, sans-serif';
  ctx.fillText('OUTFITLY · AI PREVIEW', 76, 1426);
  return canvas.toDataURL('image/png', 0.94);
}

function UploadCard({ type, image, onPick, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const title = type === 'person' ? 'Upload your photo' : 'Add an outfit';
  const helper = type === 'person' ? 'A clear, full or half-body photo works best' : 'Use a flat-lay, product shot, or screenshot';

  async function acceptFile(file) {
    try { onPick(await readImage(file)); } catch (error) { onPick(null, error.message); }
  }

  return (
    <div
      className={`upload-card ${image ? 'has-image' : ''} ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}
    >
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => acceptFile(event.target.files?.[0])} />
      {image ? (
        <>
          <img className="upload-preview" src={image.src} alt={`${type} upload preview`} />
          <div className="upload-overlay" />
          <button className="clear-image" onClick={onClear} aria-label={`Remove ${type} image`}><X size={16} /></button>
          <div className="image-caption"><span><Check size={14} /> Ready</span><small>{image.name}</small></div>
        </>
      ) : (
        <button className="upload-empty" onClick={() => inputRef.current?.click()}>
          <span className="upload-icon"><ImagePlus size={22} /></span>
          <strong>{title}</strong>
          <span>{helper}</span>
          <em>Drop image here or <u>browse files</u></em>
        </button>
      )}
    </div>
  );
}

function CompareView({ before, after, position, setPosition }) {
  const containerRef = useRef(null);
  function updatePosition(event) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.touches?.[0]?.clientX ?? event.clientX;
    setPosition(Math.max(4, Math.min(96, ((x - rect.left) / rect.width) * 100)));
  }
  return (
    <div ref={containerRef} className="compare-view" onPointerMove={(event) => event.buttons === 1 && updatePosition(event)} onPointerDown={updatePosition}>
      <img src={before} alt="Before outfit" />
      <div className="after-layer" style={{ width: `${position}%` }}><img src={after} alt="After outfit preview" /></div>
      <div className="compare-label before-label">BEFORE</div><div className="compare-label after-label">AFTER</div>
      <div className="compare-handle" style={{ left: `${position}%` }}><span><SlidersHorizontal size={14} /></span></div>
      <input className="compare-range" type="range" min="4" max="96" value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label="Compare before and after" />
    </div>
  );
}

export default function App() {
  const [person, setPerson] = useState(null);
  const [outfit, setOutfit] = useState(null);
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [generationMode, setGenerationMode] = useState('local');
  const [position, setPosition] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [activeStep, setActiveStep] = useState('person');

  const ready = Boolean(person && outfit);
  const status = useMemo(() => {
    if (result) return 'Your preview is ready';
    if (ready) return 'Ready to generate';
    if (person) return 'Now choose an outfit';
    return 'Start with a photo of yourself';
  }, [person, outfit, result, ready]);

  function pick(type, image, error) {
    if (error) { setMessage(error); return; }
    setMessage('');
    if (type === 'person') { setPerson(image); setResult(null); if (image) setActiveStep('outfit'); }
    else { setOutfit(image); setResult(null); if (image && person) setActiveStep('result'); }
  }

  async function generate() {
    if (!ready || isGenerating) return;
    setIsGenerating(true); setMessage(''); setAnalysis(''); setActiveStep('result');
    try {
      if (API_URL || window.location.hostname !== 'localhost') {
        const [personImage, outfitImage] = await Promise.all([
          prepareImageForApi(person.src),
          prepareImageForApi(outfit.src)
        ]);
        const response = await fetch(`${API_URL}/api/try-on`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ person: personImage, outfit: outfitImage, description: outfit.name }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The AI provider rejected this request.');
        if ((data.mode === 'openrouter-image' || data.mode === 'requesty-image') && data.output) {
          setAnalysis(data.analysis || '');
          setGenerationMode(data.mode === 'openrouter-image' ? 'openrouter' : 'requesty');
          setResult(data.output);
          return;
        }
        if (data.mode === 'openrouter-analysis') {
          setAnalysis(data.analysis || 'The AI returned no analysis.');
          setGenerationMode('gemma');
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1050));
      setResult(await makePreview(person.src, outfit.src));
    } catch (error) {
      setMessage(error.message || 'Something went wrong while creating the preview. Please try again.');
    } finally { setIsGenerating(false); }
  }

  function download() {
    if (!result) return;
    const link = document.createElement('a'); link.href = result; link.download = 'outfitly-preview.png'; link.click();
  }

  function reset() { setPerson(null); setOutfit(null); setResult(null); setAnalysis(''); setMessage(''); setActiveStep('person'); setPosition(50); }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Outfitly home"><span className="brand-mark"><Sparkles size={15} /></span><span>outfitly</span></a>
        <nav><a href="#how-it-works">How it works</a><a href="#studio">Try it now</a><a href="#about">About</a></nav>
        <a className="header-cta" href="#studio">Create a look <ArrowRight size={15} /></a>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> Your wardrobe, reimagined</div>
            <h1>See yourself<br /><i>in a new light.</i></h1>
            <p className="hero-subtitle">Try on the look before you buy it. Outfitly uses intelligent visual magic to put any outfit on you — no changing room required.</p>
            <a className="primary-button" href="#studio">Start styling <ArrowRight size={17} /></a>
            <div className="hero-note"><LockKeyhole size={14} /> Your photos stay yours. Nothing is saved.</div>
          </div>
          <div className="hero-visual" aria-label="Fashion preview collage">
            <div className="hero-card hero-card-back"><div className="hero-pattern" /><span>YOUR<br />STYLE<br />PLAYGROUND</span></div>
            <div className="hero-card hero-card-main"><div className="model-silhouette"><div className="model-head" /><div className="model-body" /><div className="model-legs" /></div><div className="hero-card-label"><span>01</span><strong>THE<br />EVERYDAY<br />EDIT</strong></div></div>
            <div className="floating-pill"><Sparkles size={14} /><span>AI-powered<br /><b>style preview</b></span></div>
            <div className="vertical-word">OUTFITLY</div>
          </div>
        </section>

        <section className="marquee"><div>TRY IT ON <span>✦</span> LOVE THE LOOK <span>✦</span> MAKE IT YOURS <span>✦</span> TRY IT ON <span>✦</span> LOVE THE LOOK <span>✦</span></div></section>

        <section className="studio-section" id="studio">
          <div className="section-heading"><div><div className="eyebrow">The styling studio</div><h2>One photo.<br /><i>Endless possibilities.</i></h2></div><p>Bring your inspiration. We’ll show you what it could look like on you.</p></div>
          <div className="studio-layout">
            <aside className="steps-panel">
              <div className="steps-top"><span>YOUR SESSION</span><span className="live-dot">● LIVE</span></div>
              {steps.map(({ id, label, number, icon: Icon }, index) => <button key={id} className={`step-item ${activeStep === id ? 'active' : ''} ${((id === 'person' && person) || (id === 'outfit' && outfit) || (id === 'result' && result)) ? 'done' : ''}`} onClick={() => setActiveStep(id)}><span className="step-number">{((id === 'person' && person) || (id === 'outfit' && outfit) || (id === 'result' && result)) ? <Check size={14} /> : number}</span><span>{label}</span><Icon size={17} /></button>)}
              <div className="session-tip"><Sparkles size={17} /><div><strong>Style tip</strong><p>Good lighting and a simple pose give the most natural preview.</p></div></div>
            </aside>
            <div className="workspace">
              {!result ? <>
                <div className="workspace-header"><div><span className="workspace-kicker">{status}</span><h3>Build your look</h3></div><span className="privacy-chip"><LockKeyhole size={13} /> Private by default</span></div>
                <div className="upload-grid"><div><div className="field-label"><span>01</span><strong>Person</strong></div><UploadCard type="person" image={person} onPick={(image, error) => pick('person', image, error)} onClear={() => { setPerson(null); setResult(null); }} /></div><div><div className="field-label"><span>02</span><strong>Outfit</strong></div><UploadCard type="outfit" image={outfit} onPick={(image, error) => pick('outfit', image, error)} onClear={() => { setOutfit(null); setResult(null); }} /></div></div>
                {message && <div className="error-message">{message}</div>}
                <div className="generate-row"><div className="format-note"><Layers3 size={16} /><span>Best results with<br /><b>JPG, PNG or WEBP</b></span></div><button className="generate-button" disabled={!ready || isGenerating} onClick={generate}>{isGenerating ? <><span className="spinner" /> Creating your preview…</> : <><WandSparkles size={18} /> Generate my look <ArrowRight size={16} /></>}</button></div>
              </> : <>
                <div className="workspace-header result-header"><div><span className="workspace-kicker">{status}</span><h3>Meet your new look</h3></div><div className="result-actions"><button className="text-button" onClick={reset}><RotateCcw size={15} /> Start over</button><button className="download-button" onClick={download}><Download size={16} /> Download</button></div></div>
                <CompareView before={person.src} after={result} position={position} setPosition={setPosition} />
                {analysis && <div className="analysis-note"><strong><Sparkles size={14} /> AI style notes</strong><p>{analysis}</p></div>}
                <div className="result-foot"><span><Sparkles size={15} /> Drag the slider to compare</span><span className="provider-badge">{generationMode === 'openrouter' ? 'OPENROUTER · AI IMAGE' : generationMode === 'requesty' ? 'GEMINI · REQUESTY IMAGE' : generationMode === 'gemma' ? 'GEMMA · FREE ANALYSIS + LOCAL PREVIEW' : 'LOCAL PREVIEW · PRIVATE'}</span></div>
              </>}
            </div>
          </div>
        </section>

        <section className="how-section" id="how-it-works"><div className="eyebrow">The Outfitly way</div><h2>Style should feel<br /><i>like play.</i></h2><div className="feature-grid"><div className="feature-card feature-dark"><span>01</span><Shirt size={28} /><h3>Bring the inspo</h3><p>Save that screenshot. Upload that dream outfit. Your next look starts anywhere.</p></div><div className="feature-card"><span>02</span><WandSparkles size={28} /><h3>Let us remix it</h3><p>Our preview engine creates a visual starting point, so you can explore without overthinking.</p></div><div className="feature-card feature-accent"><span>03</span><Download size={28} /><h3>Make it yours</h3><p>Compare, download, share with a friend — and decide what feels like you.</p></div></div></section>
        <section className="bottom-cta" id="about"><div><div className="eyebrow">Your next favorite outfit</div><h2>Ready to see<br /><i>the possibility?</i></h2></div><a className="primary-button light-button" href="#studio">Open the studio <ArrowRight size={17} /></a></section>
      </main>
      <footer><a className="brand" href="#top"><span className="brand-mark"><Sparkles size={15} /></span><span>outfitly</span></a><span>Made for curious closets.</span><span>© 2026 Outfitly</span></footer>
    </div>
  );
}
