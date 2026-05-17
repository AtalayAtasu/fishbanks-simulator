import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './styles.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8787' : 'https://salmonrush.onrender.com');
const money = (x) => '$' + Math.round(Number(x || 0)).toLocaleString();
const PHASES = {
  SETUP:'Waiting to start', AUCTION_TRADE:'Auction & Trading',
  CONSTRUCTION_DEPLOYMENT:'Deploy Your Fleet', RESULTS:'Processing…',
  FINISHED:'Game Over', DEBRIEF:'Debrief',
};
const TEAM_COLORS = ['#38bdf8','#4ade80','#f97316','#f472b6','#a78bfa','#facc15','#34d399','#fb923c','#818cf8','#f87171'];

function secsLeft(g) {
  if (g.pausedAt != null && g.phaseRemainingSeconds != null) return Math.max(0, Math.ceil(g.phaseRemainingSeconds));
  return g.phaseEndsAt ? Math.max(0, Math.ceil((new Date(g.phaseEndsAt) - Date.now()) / 1000)) : null;
}

// ── Ocean animation ───────────────────────────────────────────────────────────
function OceanAnimation() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let raf;
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    const rnd = (a,b) => a + Math.random()*(b-a);

    // Fishing boats (stored as x-fractions)
    const boats = Array.from({length:4}, (_, i) => ({
      xFrac: 0.10 + i*0.22 + rnd(-0.04,0.04),
      phase: rnd(0,Math.PI*2), bobSpeed: rnd(0.35,0.60),
      scale: rnd(1.4,1.9),
      speed: rnd(0.008,0.015) * (i%2===0?1:-1),
    }));

    // Salmon schools (move horizontally, slight vertical sine)
    const salmons = Array.from({length:8}, (_, i) => ({
      xFrac: rnd(0,1),
      depthFrac: 0.56 + rnd(0.04,0.36),
      speed: rnd(0.032,0.07) * (Math.random()>0.5?1:-1),
      phase: rnd(0,Math.PI*2),
      waveAmp: rnd(0.008,0.020),
      waveFreq: rnd(1.4,2.8),
      len: rnd(44,72),
    }));
    salmons.forEach(s=>{ s.facing = s.speed>0?1:-1; });

    function drawBoat(x, surfY, sc) {
      ctx.save(); ctx.translate(x, surfY); ctx.scale(sc, sc);

      // ── water shadow beneath hull ──
      ctx.beginPath(); ctx.ellipse(3,16,52,8,0,0,Math.PI*2);
      ctx.fillStyle='rgba(0,20,60,0.22)'; ctx.fill();

      // ── deep hull (below waterline) ──
      const hullDeep=ctx.createLinearGradient(0,2,0,22);
      hullDeep.addColorStop(0,'#1a2744');hullDeep.addColorStop(1,'#0f1a30');
      ctx.beginPath();
      ctx.moveTo(-50,2); ctx.bezierCurveTo(-52,10,-38,20,-18,22);
      ctx.bezierCurveTo(-6,24,6,24,18,22);
      ctx.bezierCurveTo(38,20,52,10,50,2); ctx.closePath();
      ctx.fillStyle=hullDeep; ctx.fill();

      // ── main hull (dark steel trawler) ──
      const hg=ctx.createLinearGradient(0,-14,0,4);
      hg.addColorStop(0,'#1e2d3d');hg.addColorStop(0.5,'#162030');hg.addColorStop(1,'#0d1520');
      ctx.beginPath();
      ctx.moveTo(-50,2); ctx.lineTo(-48,-4);
      ctx.bezierCurveTo(-46,-12,-36,-14,-18,-14);
      ctx.lineTo(28,-14);
      ctx.bezierCurveTo(44,-14,50,-8,50,2);
      ctx.bezierCurveTo(38,10,20,14,0,14);
      ctx.bezierCurveTo(-20,14,-38,10,-50,2); ctx.closePath();
      ctx.fillStyle=hg; ctx.fill();
      ctx.strokeStyle='#0a1020'; ctx.lineWidth=1.2; ctx.stroke();

      // ── hull highlight (subtle sheen on upper hull) ──
      ctx.beginPath();
      ctx.moveTo(-46,-2); ctx.bezierCurveTo(-40,-10,-24,-13,0,-13);
      ctx.bezierCurveTo(20,-13,38,-9,46,-2);
      ctx.strokeStyle='rgba(100,140,180,0.18)'; ctx.lineWidth=1.5; ctx.stroke();

      // ── bow rake (angled bow like a trawler) ──
      ctx.beginPath();
      ctx.moveTo(-48,-4); ctx.lineTo(-54,-14); ctx.lineTo(-44,-14); ctx.lineTo(-48,-4);
      ctx.fillStyle='#1e2d3d'; ctx.fill(); ctx.strokeStyle='#0a1020'; ctx.lineWidth=1; ctx.stroke();

      // ── bulwark rail along deck ──
      ctx.strokeStyle='#374151'; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(-48,-14); ctx.lineTo(28,-14); ctx.stroke();
      // stanchions
      ctx.lineWidth=1;
      for(let rx=-42;rx<=24;rx+=10){
        ctx.beginPath(); ctx.moveTo(rx,-14); ctx.lineTo(rx,-18); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-42,-18); ctx.lineTo(26,-18);
      ctx.strokeStyle='rgba(100,120,140,0.7)'; ctx.lineWidth=0.8; ctx.stroke();

      // ── deck (main working deck behind wheelhouse) ──
      ctx.fillStyle='#2d3a4a';
      ctx.beginPath(); ctx.roundRect(-48,-14,30,6,1); ctx.fill();
      // deck equipment: winch drum on bow
      ctx.fillStyle='#374151';
      ctx.beginPath(); ctx.roundRect(-44,-14,10,4,2); ctx.fill();
      ctx.strokeStyle='#4b5563'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(-39,-14); ctx.lineTo(-39,-10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-36,-14); ctx.lineTo(-36,-10); ctx.stroke();
      // net reel / stern deck
      ctx.fillStyle='#263240';
      ctx.beginPath(); ctx.roundRect(22,-14,10,5,1); ctx.fill();

      // ── wheelhouse (offset toward stern — typical trawler) ──
      // Lower wheelhouse body
      const wh=ctx.createLinearGradient(0,-34,0,-14);
      wh.addColorStop(0,'#d1d5db');wh.addColorStop(0.5,'#e5e7eb');wh.addColorStop(1,'#c9ced6');
      ctx.beginPath(); ctx.roundRect(-4,-34,32,20,2); ctx.fill(  );
      ctx.fillStyle=wh;
      ctx.beginPath(); ctx.roundRect(-4,-34,32,20,2); ctx.fill();
      ctx.strokeStyle='#9ca3af'; ctx.lineWidth=0.8; ctx.stroke();
      // Bridge wings (narrow overhangs on sides)
      ctx.fillStyle='#c9ced6';
      ctx.beginPath(); ctx.roundRect(-10,-30,6,12,1); ctx.fill();
      ctx.beginPath(); ctx.roundRect(28,-30,6,12,1); ctx.fill();
      ctx.strokeStyle='#9ca3af'; ctx.lineWidth=0.7; ctx.stroke();
      // Upper wheelhouse / bridge top
      ctx.fillStyle='#b8bec8';
      ctx.beginPath(); ctx.roundRect(-2,-42,28,10,2); ctx.fill();
      ctx.strokeStyle='#8a9aaa'; ctx.lineWidth=0.8; ctx.stroke();

      // ── wheelhouse windows (bridge front) ──
      // Large panoramic windows
      ctx.fillStyle='rgba(147,197,253,0.55)';
      ctx.beginPath(); ctx.roundRect(0,-32,10,7,1); ctx.fill();
      ctx.beginPath(); ctx.roundRect(13,-32,10,7,1); ctx.fill();
      ctx.strokeStyle='#6b7280'; ctx.lineWidth=0.6;
      ctx.beginPath(); ctx.roundRect(0,-32,10,7,1); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(13,-32,10,7,1); ctx.stroke();
      // window frame divider
      ctx.beginPath(); ctx.moveTo(5,-32); ctx.lineTo(5,-25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18,-32); ctx.lineTo(18,-25); ctx.stroke();
      // Upper bridge windows (smaller)
      ctx.fillStyle='rgba(147,197,253,0.4)';
      ctx.beginPath(); ctx.roundRect(1,-40,8,5,1); ctx.fill();
      ctx.beginPath(); ctx.roundRect(14,-40,8,5,1); ctx.fill();

      // ── exhaust stack / funnel ──
      ctx.fillStyle='#1f2937';
      ctx.beginPath(); ctx.roundRect(6,-50,8,10,2); ctx.fill();
      ctx.strokeStyle='#374151'; ctx.lineWidth=0.8; ctx.stroke();
      // smoke puff
      ctx.save(); ctx.globalAlpha=0.18;
      ctx.fillStyle='#9ca3af';
      ctx.beginPath(); ctx.arc(12,-53,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(17,-56,3.5,0,Math.PI*2); ctx.fill();
      ctx.restore();

      // ── main mast (forward mast, tall) ──
      ctx.strokeStyle='#374151'; ctx.lineWidth=2.8;
      ctx.beginPath(); ctx.moveTo(-32,-14); ctx.lineTo(-32,-72); ctx.stroke();
      // cross-tree / spreader
      ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(-44,-58); ctx.lineTo(-20,-58); ctx.stroke();
      // stays / rigging lines
      ctx.strokeStyle='rgba(100,120,140,0.5)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(-32,-72); ctx.lineTo(-50,-14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-32,-72); ctx.lineTo(-10,-14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-44,-58); ctx.lineTo(-50,-14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20,-58); ctx.lineTo(-10,-14); ctx.stroke();
      // navigation light on mast
      ctx.fillStyle='#fef08a';
      ctx.beginPath(); ctx.arc(-32,-66,2.5,0,Math.PI*2); ctx.fill();

      // ── radar / antenna on wheelhouse ──
      ctx.strokeStyle='#4b5563'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(12,-42); ctx.lineTo(12,-52); ctx.stroke();
      // radar dome
      ctx.fillStyle='#e5e7eb';
      ctx.beginPath(); ctx.arc(12,-53,3.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#9ca3af'; ctx.lineWidth=0.6; ctx.stroke();
      // VHF antenna
      ctx.strokeStyle='#374151'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(22,-42); ctx.lineTo(22,-60); ctx.stroke();

      // ── outrigger poles (for trawl gear) ──
      ctx.strokeStyle='#4b5563'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(30,-14); ctx.lineTo(58,-30); ctx.stroke();
      // outrigger wires
      ctx.strokeStyle='rgba(100,120,140,0.5)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(58,-30); ctx.quadraticCurveTo(66,-5,62,8); ctx.stroke();

      // ── flag ──
      ctx.fillStyle='#dc2626';
      ctx.beginPath(); ctx.moveTo(-32,-72); ctx.lineTo(-18,-67); ctx.lineTo(-32,-62); ctx.closePath(); ctx.fill();

      ctx.restore();
    }

    function drawSalmon(s, W, H, t) {
      const x = ((s.xFrac*W % W)+W)%W;
      const y = s.depthFrac*H + Math.sin(t*s.waveFreq+s.phase)*s.waveAmp*H;
      const L = s.len;
      ctx.save(); ctx.translate(x,y);
      if(s.facing<0) ctx.scale(-1,1);
      // body
      const bg=ctx.createLinearGradient(-L*0.4,0,L*0.4,0);
      bg.addColorStop(0,'#7dd3fc'); bg.addColorStop(0.35,'#60a5fa');
      bg.addColorStop(0.65,'#f97316'); bg.addColorStop(1,'#ea580c');
      ctx.beginPath(); ctx.ellipse(0,0,L*0.42,L*0.13,0,0,Math.PI*2);
      ctx.fillStyle=bg; ctx.fill();
      // belly highlight
      ctx.beginPath(); ctx.ellipse(L*0.05,L*0.04,L*0.25,L*0.07,0,0,Math.PI*2);
      ctx.fillStyle='rgba(254,215,170,0.45)'; ctx.fill();
      // lateral silver line
      ctx.strokeStyle='rgba(186,230,253,0.65)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-L*0.34,0); ctx.lineTo(L*0.28,0); ctx.stroke();
      // tail (forked)
      ctx.fillStyle='#c2410c';
      ctx.beginPath();
      ctx.moveTo(-L*0.40,0); ctx.lineTo(-L*0.60,-L*0.11); ctx.lineTo(-L*0.52,0);
      ctx.lineTo(-L*0.60,L*0.11); ctx.closePath(); ctx.fill();
      // dorsal fin
      ctx.fillStyle='rgba(234,88,12,0.75)';
      ctx.beginPath(); ctx.moveTo(-L*0.05,-L*0.13);
      ctx.quadraticCurveTo(L*0.08,-L*0.24,L*0.18,-L*0.13); ctx.closePath(); ctx.fill();
      // pectoral fin
      ctx.fillStyle='rgba(234,88,12,0.55)';
      ctx.beginPath(); ctx.moveTo(L*0.10,L*0.04);
      ctx.quadraticCurveTo(L*0.18,L*0.17,L*0.05,L*0.14); ctx.closePath(); ctx.fill();
      // eye
      ctx.beginPath(); ctx.arc(L*0.34,-L*0.02,L*0.032,0,Math.PI*2);
      ctx.fillStyle='#0f172a'; ctx.fill();
      ctx.beginPath(); ctx.arc(L*0.35,-L*0.03,L*0.013,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fill();
      ctx.restore();
    }

    function drawRock(cx, sy) {
      ctx.save(); ctx.translate(cx, sy);
      // Water ripple/reflection around base
      ctx.beginPath(); ctx.ellipse(2,8,52,10,0,0,Math.PI*2);
      ctx.fillStyle='rgba(0,20,50,0.22)'; ctx.fill();
      // Submerged base (water tint)
      ctx.beginPath();
      ctx.moveTo(-46,4); ctx.bezierCurveTo(-50,12,-36,24,-14,28);
      ctx.bezierCurveTo(4,32,26,30,42,22); ctx.bezierCurveTo(52,14,48,4,40,2);
      ctx.bezierCurveTo(26,16,4,20,-16,18); ctx.bezierCurveTo(-32,16,-44,10,-46,4);
      ctx.fillStyle='rgba(20,50,80,0.32)'; ctx.fill();
      // Main rock — warm brownish-grey like granite
      const rg=ctx.createLinearGradient(-44,-42,44,22);
      rg.addColorStop(0,'#c4a882'); rg.addColorStop(0.28,'#b09070');
      rg.addColorStop(0.6,'#8a7058'); rg.addColorStop(1,'#604c3a');
      ctx.beginPath();
      ctx.moveTo(-46,4); ctx.bezierCurveTo(-54,-6,-48,-26,-32,-38);
      ctx.bezierCurveTo(-18,-48,2,-50,20,-44); ctx.bezierCurveTo(36,-38,50,-24,50,-8);
      ctx.bezierCurveTo(52,6,42,16,26,20); ctx.bezierCurveTo(10,26,-18,26,-34,18);
      ctx.bezierCurveTo(-42,14,-46,8,-46,4); ctx.closePath();
      ctx.fillStyle=rg; ctx.fill();
      // Dark patches / lichen texture
      ctx.fillStyle='rgba(60,42,28,0.28)';
      ctx.beginPath(); ctx.ellipse(-8,-18,14,9,0.4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(18,-30,10,6,-0.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-24,-8,8,5,0.2,0,Math.PI*2); ctx.fill();
      // Top surface highlight
      ctx.beginPath();
      ctx.moveTo(-26,-38); ctx.bezierCurveTo(-8,-48,14,-48,30,-40);
      ctx.bezierCurveTo(14,-36,-4,-34,-26,-38);
      ctx.fillStyle='rgba(220,195,160,0.28)'; ctx.fill();
      // Waterline foam
      ctx.beginPath(); ctx.ellipse(0,5,48,7,0,0,Math.PI);
      ctx.strokeStyle='rgba(200,228,255,0.50)'; ctx.lineWidth=2.2; ctx.stroke();
      ctx.restore();
    }

    function drawFisher(cx, sy, t) {
      // Female fisher sitting on rock, holding fishing rod — scale similar to boats
      const sc=0.60;
      ctx.save(); ctx.translate(cx-6, sy-34*sc); ctx.scale(sc,sc);

      // Fishing line — animated bob
      const rodTipX=52, rodTipY=-82;
      const floatX=rodTipX+18+Math.sin(t*1.1)*3, floatY=42+Math.sin(t*0.8)*5;
      ctx.beginPath(); ctx.moveTo(rodTipX,rodTipY);
      ctx.bezierCurveTo(rodTipX+14,-30,floatX+4,10,floatX,floatY);
      ctx.strokeStyle='rgba(210,230,255,0.82)'; ctx.lineWidth=0.9; ctx.stroke();
      // Bobber — red/white float
      ctx.beginPath(); ctx.arc(floatX,floatY,3,Math.PI,Math.PI*2);
      ctx.fillStyle='#dd2222'; ctx.fill();
      ctx.beginPath(); ctx.arc(floatX,floatY,3,0,Math.PI);
      ctx.fillStyle='#f5f5f5'; ctx.fill();

      // WADERS / LEGS — sitting, feet dangling
      ctx.fillStyle='#2a4060';
      ctx.beginPath(); ctx.moveTo(-10,2); ctx.bezierCurveTo(-12,14,-16,28,-18,40);
      ctx.bezierCurveTo(-18,44,-12,44,-10,40); ctx.bezierCurveTo(-8,28,-5,14,-4,4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4,2); ctx.bezierCurveTo(6,14,10,28,12,40);
      ctx.bezierCurveTo(12,44,18,44,18,40); ctx.bezierCurveTo(16,28,12,14,8,4); ctx.closePath(); ctx.fill();
      // Boots
      ctx.fillStyle='#181c20';
      ctx.beginPath(); ctx.ellipse(-14,42,6,3,-0.15,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(15,42,6,3,0.15,0,Math.PI*2); ctx.fill();

      // SHIRT — light blue base
      ctx.fillStyle='#4a86c0';
      ctx.beginPath(); ctx.moveTo(-10,2); ctx.bezierCurveTo(-13,-8,-11,-22,-8,-32);
      ctx.lineTo(8,-32); ctx.bezierCurveTo(11,-22,13,-8,10,2); ctx.closePath(); ctx.fill();

      // FISHING VEST — orange, two panels
      ctx.fillStyle='#d46418';
      ctx.beginPath(); ctx.moveTo(-10,-2); ctx.bezierCurveTo(-12,-10,-10,-20,-8,-28);
      ctx.lineTo(-2,-28); ctx.lineTo(-2,-2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10,-2); ctx.bezierCurveTo(12,-10,10,-20,8,-28);
      ctx.lineTo(2,-28); ctx.lineTo(2,-2); ctx.closePath(); ctx.fill();
      // Vest pocket detail
      ctx.strokeStyle='rgba(160,80,10,0.55)'; ctx.lineWidth=0.7;
      ctx.strokeRect(-10,-16,7,7); ctx.strokeRect(3,-16,7,7);

      // LEFT ARM — resting casually on knee
      ctx.fillStyle='#4a86c0';
      ctx.beginPath(); ctx.moveTo(-8,-28); ctx.bezierCurveTo(-16,-22,-18,-10,-16,2);
      ctx.bezierCurveTo(-13,6,-9,4,-8,0); ctx.bezierCurveTo(-10,-12,-8,-24,-6,-30); ctx.closePath(); ctx.fill();
      // Left hand resting on thigh
      ctx.fillStyle='#d4956a';
      ctx.beginPath(); ctx.ellipse(-14,3,4,3,0.3,0,Math.PI*2); ctx.fill();

      // RIGHT ARM — extended holding rod
      ctx.fillStyle='#4a86c0';
      ctx.beginPath(); ctx.moveTo(8,-28); ctx.bezierCurveTo(18,-36,28,-52,34,-66);
      ctx.bezierCurveTo(36,-70,38,-68,36,-64); ctx.bezierCurveTo(30,-50,20,-34,12,-24);
      ctx.bezierCurveTo(10,-20,8,-22,8,-28); ctx.closePath(); ctx.fill();
      // Right hand gripping rod
      ctx.fillStyle='#d4956a';
      ctx.beginPath(); ctx.ellipse(35,-64,4,3,-0.6,0,Math.PI*2); ctx.fill();

      // FISHING ROD
      ctx.beginPath(); ctx.moveTo(18,-32); ctx.bezierCurveTo(28,-50,40,-66,rodTipX,rodTipY);
      ctx.strokeStyle='#7a5020'; ctx.lineWidth=2.8; ctx.lineCap='round'; ctx.stroke();
      // Rod tip (lighter, thinner)
      ctx.beginPath(); ctx.moveTo(40,-68); ctx.lineTo(rodTipX,rodTipY);
      ctx.strokeStyle='#b08040'; ctx.lineWidth=1.2; ctx.stroke();
      // Line guides (small rings on rod)
      [[26,-46],[36,-60],[46,-74]].forEach(([rx,ry])=>{
        ctx.beginPath(); ctx.arc(rx,ry,2,0,Math.PI*2);
        ctx.strokeStyle='#c8a050'; ctx.lineWidth=0.9; ctx.stroke();
      });

      // NECK
      ctx.fillStyle='#d4956a';
      ctx.beginPath(); ctx.moveTo(-4,-32); ctx.bezierCurveTo(-4,-40,4,-40,4,-32);
      ctx.bezierCurveTo(3,-28,-3,-28,-4,-32); ctx.fill();

      // HAIR — dark ponytail behind, swept back under hat
      ctx.fillStyle='#3a200a';
      ctx.beginPath(); ctx.moveTo(-7,-52); ctx.bezierCurveTo(-13,-44,-15,-30,-12,-14);
      ctx.bezierCurveTo(-10,-6,-6,-2,-4,4);
      ctx.bezierCurveTo(-2,-2,-4,-10,-6,-24); ctx.bezierCurveTo(-9,-40,-5,-50,-3,-56);
      ctx.closePath(); ctx.fill();

      // HEAD
      ctx.beginPath(); ctx.ellipse(0,-48,9,11,0,0,Math.PI*2);
      const hg=ctx.createRadialGradient(-2,-52,1,0,-48,9);
      hg.addColorStop(0,'#eeaa82'); hg.addColorStop(0.65,'#d4956a'); hg.addColorStop(1,'#b87850');
      ctx.fillStyle=hg; ctx.fill();

      // HAT — wide-brimmed fishing hat (khaki)
      // Brim (full ellipse)
      ctx.beginPath(); ctx.ellipse(-2,-57,17,4.5,0,0,Math.PI*2);
      const brimG=ctx.createLinearGradient(-19,-57,15,-52);
      brimG.addColorStop(0,'#a8883a'); brimG.addColorStop(0.5,'#c4a34a'); brimG.addColorStop(1,'#9a7830');
      ctx.fillStyle=brimG; ctx.fill();
      ctx.strokeStyle='#856820'; ctx.lineWidth=0.6; ctx.stroke();
      // Crown
      ctx.beginPath(); ctx.moveTo(-9,-57); ctx.bezierCurveTo(-10,-68,-5,-74,0,-74);
      ctx.bezierCurveTo(5,-74,10,-68,9,-57); ctx.closePath();
      const crownG=ctx.createLinearGradient(-10,-74,10,-57);
      crownG.addColorStop(0,'#d4b460'); crownG.addColorStop(1,'#a88c38');
      ctx.fillStyle=crownG; ctx.fill();
      ctx.strokeStyle='#856820'; ctx.lineWidth=0.6; ctx.stroke();
      // Hat band (red)
      ctx.beginPath(); ctx.moveTo(-9,-60); ctx.bezierCurveTo(-3,-62,3,-62,9,-60);
      ctx.strokeStyle='#c03018'; ctx.lineWidth=1.8; ctx.lineCap='butt'; ctx.stroke();

      // FACE — simple friendly features
      ctx.fillStyle='#2a1008';
      ctx.beginPath(); ctx.ellipse(-3,-48,1.4,1.4,0,0,Math.PI*2); ctx.fill(); // left eye
      ctx.beginPath(); ctx.ellipse(3,-48,1.4,1.4,0,0,Math.PI*2); ctx.fill(); // right eye
      // Smile
      ctx.beginPath(); ctx.moveTo(-3,-43); ctx.bezierCurveTo(-1,-41,1,-41,3,-43);
      ctx.strokeStyle='#9a4820'; ctx.lineWidth=1; ctx.stroke();
      // Rosy cheeks
      ctx.fillStyle='rgba(220,120,80,0.22)';
      ctx.beginPath(); ctx.ellipse(-5,-46,3,2,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5,-46,3,2,0,0,Math.PI*2); ctx.fill();

      ctx.restore();
    }

    function drawBear(cx, sy, t) {
      // Brown bear crouching on rock, periodically dipping paw to catch salmon
      const sc=0.62;
      ctx.save(); ctx.translate(cx+4, sy-30*sc); ctx.scale(sc,sc);

      // Paw-dip cycle — smooth periodic lunge, roughly every 5–6 s
      const dipRaw=Math.sin(t*2.5+1.2);
      const dipCycle=Math.max(0,dipRaw);
      const pawDip=dipCycle*dipCycle*54;   // 0..54 px downward
      const bodyLean=dipCycle*dipCycle*10; // lean forward when dipping

      // Shared fur gradient helper
      function furG(x0,y0,x1,y1,hi='#8a5222',mid='#6a3c12',lo='#2e1006'){
        const g=ctx.createLinearGradient(x0,y0,x1,y1);
        g.addColorStop(0,hi); g.addColorStop(0.5,mid); g.addColorStop(1,lo); return g;
      }

      // HIND QUARTERS — large rounded rump, crouching
      ctx.beginPath();
      ctx.moveTo(-32,2); ctx.bezierCurveTo(-42,-8,-40,-28,-24,-36);
      ctx.bezierCurveTo(-10,-42,8,-38,14,-26); ctx.bezierCurveTo(18,-14,10,4,0,8);
      ctx.bezierCurveTo(-10,12,-24,10,-32,2); ctx.closePath();
      ctx.fillStyle=furG(-42,-36,18,12); ctx.fill();
      ctx.strokeStyle='rgba(20,6,0,0.22)'; ctx.lineWidth=1; ctx.stroke();

      // HIND LEGS dangling at rock edge
      [[-22,4],[-6,6]].forEach(([lx,ly],i)=>{
        ctx.beginPath();
        ctx.moveTo(lx,ly); ctx.bezierCurveTo(lx-4,ly+12,lx-6,ly+26,lx-4,ly+36);
        ctx.bezierCurveTo(lx+2,ly+40,lx+8,ly+36,lx+8,ly+28);
        ctx.bezierCurveTo(lx+6,ly+16,lx+4,ly+6,lx+2,ly); ctx.closePath();
        ctx.fillStyle=furG(lx-6,ly,lx+8,ly+40,'#7a4818','#5a3010','#251006');
        ctx.fill(); ctx.strokeStyle='rgba(20,6,0,0.18)'; ctx.lineWidth=0.8; ctx.stroke();
        // Hind paw
        ctx.beginPath(); ctx.ellipse(lx+2,ly+37,7,4,i===0?0.25:-0.2,0,Math.PI*2);
        ctx.fillStyle='#1a0800'; ctx.fill();
        // Toe claws
        [-3,0,3].forEach(cx2=>{ ctx.beginPath(); ctx.moveTo(lx+cx2,ly+40);
          ctx.bezierCurveTo(lx+cx2-1,ly+45,lx+cx2,ly+48,lx+cx2+1,ly+49);
          ctx.strokeStyle='#0a0400'; ctx.lineWidth=1.1; ctx.lineCap='round'; ctx.stroke(); });
      });

      // BODY — leaning forward with dip
      ctx.save(); ctx.translate(bodyLean,0);
      ctx.beginPath();
      ctx.moveTo(-24,2); ctx.bezierCurveTo(-28,-10,-22,-28,-8,-38);
      ctx.bezierCurveTo(4,-46,22,-44,32,-32); ctx.bezierCurveTo(42,-18,38,-2,26,6);
      ctx.bezierCurveTo(12,14,-12,12,-24,2); ctx.closePath();
      const bodyG=ctx.createLinearGradient(-28,-38,38,14);
      bodyG.addColorStop(0,'#8a5222'); bodyG.addColorStop(0.45,'#6a3c12'); bodyG.addColorStop(1,'#2e1006');
      ctx.fillStyle=bodyG; ctx.fill();
      ctx.strokeStyle='rgba(20,6,0,0.22)'; ctx.lineWidth=1; ctx.stroke();
      // Belly lighter patch
      ctx.beginPath(); ctx.ellipse(6,-10,13,17,0.08,0,Math.PI*2);
      const bellyG=ctx.createRadialGradient(6,-10,2,6,-10,17);
      bellyG.addColorStop(0,'#c89050'); bellyG.addColorStop(0.7,'rgba(160,100,40,0.4)'); bellyG.addColorStop(1,'rgba(160,100,40,0)');
      ctx.fillStyle=bellyG; ctx.fill();

      // LEFT FRONT LEG — resting on rock surface
      ctx.beginPath();
      ctx.moveTo(-18,-6); ctx.bezierCurveTo(-26,-2,-30,10,-28,22);
      ctx.bezierCurveTo(-24,28,-16,26,-14,18); ctx.bezierCurveTo(-14,8,-16,-2,-14,-8);
      ctx.closePath();
      ctx.fillStyle=furG(-30,-6,-12,28,'#7a4818','#5a3010','#251006'); ctx.fill();
      ctx.strokeStyle='rgba(20,6,0,0.18)'; ctx.lineWidth=0.8; ctx.stroke();
      // Left paw (resting)
      ctx.beginPath(); ctx.ellipse(-22,22,7,4,0.3,0,Math.PI*2);
      ctx.fillStyle='#1a0800'; ctx.fill();
      [-26,-22,-18].forEach(cx2=>{
        ctx.beginPath(); ctx.moveTo(cx2,25); ctx.bezierCurveTo(cx2-1,29,cx2,32,cx2+1,33);
        ctx.strokeStyle='#0a0400'; ctx.lineWidth=1.1; ctx.lineCap='round'; ctx.stroke();
      });

      // RIGHT FRONT LEG — animated dipping arm
      const pawX=34, pawY=-4+pawDip;
      ctx.beginPath();
      ctx.moveTo(18,-16);
      ctx.bezierCurveTo(28,-12+pawDip*0.25, 34,-4+pawDip*0.55, pawX,pawY);
      ctx.bezierCurveTo(38,pawY+6, 30,pawY+10, 26,pawY+4);
      ctx.bezierCurveTo(20,pawY-4+pawDip*0.25, 16,-8, 14,-18);
      ctx.closePath();
      const armG=ctx.createLinearGradient(14,-18,38,pawY+10);
      armG.addColorStop(0,'#8a5222'); armG.addColorStop(1,'#2e1006');
      ctx.fillStyle=armG; ctx.fill();
      ctx.strokeStyle='rgba(20,6,0,0.20)'; ctx.lineWidth=0.8; ctx.stroke();
      // Dipping paw
      ctx.beginPath(); ctx.ellipse(pawX,pawY+5,9,4.5,-0.15,0,Math.PI*2);
      ctx.fillStyle='#1a0800'; ctx.fill();
      // Dipping claws (spread for catching)
      [[-5,8],[-2,10],[2,10],[5,8]].forEach(([dx,dy])=>{
        ctx.beginPath(); ctx.moveTo(pawX+dx,pawY+dy);
        ctx.bezierCurveTo(pawX+dx-1,pawY+dy+5,pawX+dx,pawY+dy+8,pawX+dx+1,pawY+dy+9);
        ctx.strokeStyle='#0a0400'; ctx.lineWidth=1.3; ctx.lineCap='round'; ctx.stroke();
      });

      // Water splash when paw hits surface
      if(pawDip>36){
        const sp=Math.min(1,(pawDip-36)/18);
        ctx.save(); ctx.globalAlpha=sp*0.8;
        ctx.strokeStyle='rgba(180,230,255,0.95)'; ctx.lineWidth=1.6; ctx.lineCap='round';
        [[-10,2,-14,-5],[-6,4,-8,-8],[6,4,8,-8],[10,2,14,-5],[-13,6,-18,2],[13,6,18,2]].forEach(([x1,y1,x2,y2])=>{
          ctx.beginPath(); ctx.moveTo(pawX+x1,pawY+y1); ctx.lineTo(pawX+x2,pawY+y2); ctx.stroke();
        });
        // Small splash drops
        ctx.fillStyle='rgba(200,240,255,0.7)';
        [[-12,-4],[12,-3],[-6,-9],[5,-10]].forEach(([dx,dy])=>{
          ctx.beginPath(); ctx.ellipse(pawX+dx,pawY+dy,1.5,1.5,0,0,Math.PI*2); ctx.fill();
        });
        ctx.restore();
      }

      ctx.restore(); // end body lean

      // HEAD — large, looking down toward water
      ctx.save(); ctx.translate(bodyLean*0.8,0);
      ctx.beginPath(); ctx.ellipse(26,-50,20,17,0.18,0,Math.PI*2);
      const headG=ctx.createRadialGradient(22,-55,2,26,-50,20);
      headG.addColorStop(0,'#9a6030'); headG.addColorStop(0.55,'#6a3c12'); headG.addColorStop(1,'#2e1006');
      ctx.fillStyle=headG; ctx.fill();
      ctx.strokeStyle='rgba(20,6,0,0.22)'; ctx.lineWidth=1; ctx.stroke();

      // Ears — round and fluffy
      [[14,-65],[36,-64]].forEach(([ex,ey])=>{
        ctx.beginPath(); ctx.ellipse(ex,ey,8,7,ex<26?-0.3:0.3,0,Math.PI*2);
        ctx.fillStyle='#5a3010'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex,ey,5,4,ex<26?-0.3:0.3,0,Math.PI*2);
        ctx.fillStyle='#8a4c1e'; ctx.fill();
      });

      // Muzzle — protruding rounded snout
      ctx.beginPath(); ctx.ellipse(38,-43,11,9,0.2,0,Math.PI*2);
      const mzG=ctx.createRadialGradient(38,-43,1,38,-43,11);
      mzG.addColorStop(0,'#d4a870'); mzG.addColorStop(0.6,'#b08040'); mzG.addColorStop(1,'#8a6028');
      ctx.fillStyle=mzG; ctx.fill();
      ctx.strokeStyle='rgba(20,6,0,0.15)'; ctx.lineWidth=0.8; ctx.stroke();

      // Nose — large wet black
      ctx.beginPath(); ctx.ellipse(43,-48,5,3.5,0.15,0,Math.PI*2);
      const noseG=ctx.createRadialGradient(41,-49,0.5,43,-48,5);
      noseG.addColorStop(0,'#3a1408'); noseG.addColorStop(1,'#0a0300');
      ctx.fillStyle=noseG; ctx.fill();
      // Nose highlight
      ctx.fillStyle='rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(41,-49,2,1.2,-0.3,0,Math.PI*2); ctx.fill();

      // Eyes — small, dark, glinting — looking downward
      [[22,-57],[36,-55]].forEach(([ex,ey])=>{
        ctx.beginPath(); ctx.ellipse(ex,ey,3,2.5,0.15,0,Math.PI*2);
        ctx.fillStyle='#0a0300'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex-1,ey-1,1.1,0.9,0,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();
      });

      // Mouth — opens slightly when lunging
      const mOpen=Math.max(0,(pawDip-24)/30)*5;
      ctx.beginPath();
      ctx.moveTo(36,-38+mOpen*0.3); ctx.bezierCurveTo(38,-36+mOpen,43,-36+mOpen,45,-38+mOpen*0.3);
      ctx.strokeStyle='#5a2808'; ctx.lineWidth=1.2; ctx.lineCap='round'; ctx.stroke();
      if(mOpen>2){
        // Tongue tip
        ctx.beginPath(); ctx.ellipse(41,-35+mOpen,3,2,0,0,Math.PI*2);
        ctx.fillStyle='rgba(210,60,60,0.75)'; ctx.fill();
      }

      ctx.restore(); // end head
      ctx.restore(); // end bear
    }

    let last=0;
    function frame(ts) {
      const t=ts/1000, dt=Math.min(t-last,0.05); last=t;
      const W=canvas.width, H=canvas.height;
      const surfY=H*0.44;

      // sky
      const sky=ctx.createLinearGradient(0,0,0,surfY);
      sky.addColorStop(0,'#0369a1'); sky.addColorStop(0.55,'#0ea5e9'); sky.addColorStop(1,'#7dd3fc');
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,surfY);

      // clouds
      [{fx:0.14,fy:0.09},{fx:0.46,fy:0.13},{fx:0.76,fy:0.07}].forEach(({fx,fy},i)=>{
        const cx=fx*W+Math.sin(t*0.07+i)*10, cy=fy*H;
        ctx.save(); ctx.globalAlpha=0.78; ctx.fillStyle='#e0f2fe';
        [[0,0,42,20],[30,-9,30,15],[-30,-7,28,15],[56,-3,24,13],[-54,1,22,13]].forEach(([dx,dy,rx,ry])=>{
          ctx.beginPath(); ctx.ellipse(cx+dx,cy+dy,rx,ry,0,0,Math.PI*2); ctx.fill();
        });
        ctx.restore();
      });

      // ocean water body
      const wg=ctx.createLinearGradient(0,surfY,0,H);
      wg.addColorStop(0,'#0ea5e9'); wg.addColorStop(0.25,'#0369a1');
      wg.addColorStop(0.65,'#075985'); wg.addColorStop(1,'#0c4a6e');
      ctx.fillStyle=wg; ctx.fillRect(0,surfY,W,H-surfY);

      // animated surface wave
      ctx.beginPath(); ctx.moveTo(0,surfY);
      for(let x=0;x<=W;x+=3){
        const wy=surfY+Math.sin(x/W*Math.PI*7+t*1.3)*6+Math.sin(x/W*Math.PI*13+t*0.95)*2.5;
        ctx.lineTo(x,wy);
      }
      ctx.lineTo(W,surfY); ctx.lineTo(0,surfY); ctx.closePath();
      const wavG=ctx.createLinearGradient(0,surfY-8,0,surfY+12);
      wavG.addColorStop(0,'rgba(125,211,252,0.75)'); wavG.addColorStop(1,'rgba(14,165,233,0)');
      ctx.fillStyle=wavG; ctx.fill();

      // surface shimmer lines
      for(let i=0;i<5;i++){
        const wy=surfY+14+i*20+Math.sin(t*0.6+i*2.2)*4;
        ctx.strokeStyle=`rgba(255,255,255,${0.10+0.05*Math.sin(t+i)})`; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(0,wy);
        ctx.bezierCurveTo(W*0.25,wy+Math.sin(t*0.7+i)*5,W*0.75,wy-Math.sin(t*0.7+i)*5,W,wy);
        ctx.stroke();
      }

      // rocks at horizon
      drawRock(W*0.86, surfY);
      // Bear rock — slightly smaller, far left
      ctx.save(); ctx.translate(W*0.14, surfY); ctx.scale(0.82,0.82); ctx.translate(-W*0.14,-surfY);
      drawRock(W*0.14, surfY);
      ctx.restore();

      // underwater light rays
      for(let i=0;i<7;i++){
        const rx=W*(0.08+i*0.13);
        ctx.save(); ctx.globalAlpha=0.038+0.018*Math.sin(t*0.45+i);
        ctx.beginPath(); ctx.moveTo(rx-8,surfY); ctx.lineTo(rx+8,surfY);
        ctx.lineTo(rx+40+i*6,H); ctx.lineTo(rx-40-i*6,H); ctx.closePath();
        ctx.fillStyle='#7dd3fc'; ctx.fill(); ctx.restore();
      }

      // salmon swimming
      salmons.forEach(s=>{
        s.xFrac+=s.speed*dt;
        if(s.xFrac>1.12) s.xFrac=-0.12;
        if(s.xFrac<-0.12) s.xFrac=1.12;
        drawSalmon(s,W,H,t);
      });

      // fisher on far-right rock
      drawFisher(W*0.86-10, surfY, t);
      // bear on far-left rock
      drawBear(W*0.14+6, surfY, t);

      // boats on surface (drift slowly)
      boats.forEach(b=>{
        b.xFrac += b.speed * dt;
        if(b.xFrac > 1.15) b.xFrac = -0.15;
        if(b.xFrac < -0.15) b.xFrac = 1.15;
        const bx=b.xFrac*W;
        const bob=Math.sin(t*b.bobSpeed+b.phase)*5;
        const surf=surfY+Math.sin(bx/W*Math.PI*7+t*1.3)*6;
        // flip drawing direction based on travel direction
        ctx.save(); ctx.translate(bx, surf+bob);
        if(b.speed<0) ctx.scale(-1,1);
        ctx.translate(-bx, -(surf+bob));
        drawBoat(bx,surf+bob,b.scale);
        ctx.restore();
      });

      raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);};
  },[]);
  return <canvas ref={ref} style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:0,pointerEvents:'none'}} />;
}



// ── Login ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [code,setCode]     = useState('');
  const [role,setRole]     = useState('team-1');
  const [uname,setUname]   = useState('');
  const [pass,setPass]     = useState('');
  const [msg,setMsg]       = useState('');
  const [busy,setBusy]     = useState(false);
  const [serverOk,setServerOk] = useState(null);
  const isAdmin      = role === 'admin';
  const isSuperAdmin = role === 'superadmin';
  function pick(v){ setRole(v); setPass(''); setUname(''); setMsg(''); }

  useEffect(()=>{
    let cancelled = false;
    fetch(API+'/api/health',{signal:AbortSignal.timeout(5000)})
      .then(r=>r.ok?setServerOk(true):setServerOk(false))
      .catch(()=>{ if(!cancelled) setServerOk(false); });
    return ()=>{ cancelled=true; };
  },[]);

  async function call(url, body) {
    setBusy(true); setMsg('');
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(API+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const j = await r.json(); setBusy(false); return j;
      } catch(e) {
        if (attempt < 3) {
          setMsg(`Server waking up… retrying (${attempt}/3)`);
          await new Promise(res => setTimeout(res, 10000));
        } else {
          setMsg('Cannot reach server. Check your connection or try again shortly.');
          setBusy(false); return null;
        }
      }
    }
  }
  async function login() {
    const body = isSuperAdmin
      ? {role:'superadmin', password:pass}
      : {instanceCode:code, role, username:uname, password:pass};
    const j = await call('/api/login', body);
    if (!j) return;
    if (j.error) { setMsg(j.error); return; }
    localStorage.setItem('salmonrushToken',j.token); onLogin(j.token);
  }
  return (
    <div className="login-wrap" style={{background:'transparent',justifyContent:'center'}}>
      <OceanAnimation />
      <div className="login-card" style={{position:'relative',zIndex:1,backdropFilter:'blur(2px)',background:'rgba(255,255,255,0.92)'}}>
        <div className="login-header">
          <span className="fish-big">🐟</span>
          <h1>SalmonRush</h1>
        </div>
        {!isSuperAdmin && (
          <label>Session code<input className="code-input" value={code} placeholder="Enter the provided session code" onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&login()} /></label>
        )}
        <label>Role
          <select value={role} onChange={e=>pick(e.target.value)}>
            <option value="admin">Instructor</option>
            {['Group 1','Group 2','Group 3','Group 4','Group 5','Group 6','Group 7','Group 8','Group 9','Group 10'].map((n,i)=><option key={i} value={'team-'+(i+1)}>{n}</option>)}
            <option value="superadmin">— Super Admin —</option>
          </select>
        </label>
        {isAdmin && (
          <label>Username<input value={uname} placeholder="leave blank for master admin" onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} /></label>
        )}
        <label>Password<input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} /></label>
        {serverOk===false && <p className="flash">⚠ Server is starting up — this can take ~30 s on first load. Please wait.</p>}
        {serverOk===null  && <p className="hint">Checking server…</p>}
        <button className="btn primary wide" onClick={login} disabled={busy}>{busy?'Signing in…':'Sign In →'}</button>
        {msg && <p className="flash">{msg}</p>}
        <p style={{textAlign:'center',fontSize:'0.72rem',color:'var(--muted)',marginTop:4}}>A classroom fishing simulation</p>
        <p style={{textAlign:'center',fontSize:'0.72rem',marginTop:4}}><a href="mailto:atalay.atasu@gmail.com" style={{color:'var(--primary)'}}>Want to play? Contact us.</a></p>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header({ state, tick, onLogout }) {
  const g = state.game;
  const t = secsLeft(g);
  const isPaused = !!g.pausedAt;
  return (
    <header className="app-header">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span className="logo">🐟 SalmonRush</span>
        <span className="session-name">{g.name}</span>
      </div>
      <div className="phase-bar">
        <span className="phase-label">{PHASES[g.phase]||g.phase}</span>
        <span className="year-badge">Year {g.currentYear} / 10</span>
        {t !== null && <span className={'timer'+(isPaused?' paused':t<30?' urgent':'')}>{isPaused?'⏸ ':''}{t}s</span>}
        {isPaused && <span style={{fontSize:'0.78rem',color:'var(--orange)'}}>PAUSED</span>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span className="user-badge">{state.user.role==='admin'?'Instructor':state.user.teamName}</span>
        <button className="btn-sm" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
function Leaderboard({ teams, myId, shipValue }) {
  const sorted = [...teams].sort((a,b)=>b.investorValuation-a.investorValuation);
  return (
    <div className="card">
      <h3>📊 Investor Valuation Ranking <span style={{fontSize:'0.78rem',color:'var(--muted)',fontWeight:400}}>Ship value: {money(shipValue)}/unit</span></h3>
      <table className="lb-table">
        <thead><tr><th>#</th><th>Company</th><th>Valuation</th></tr></thead>
        <tbody>
          {sorted.map((t,i)=>(
            <tr key={t.id} className={t.id===myId?'my-row':''}>
              <td>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
              <td>{t.name}{t.id===myId?' ← you':''}</td>
              <td><strong>{money(t.investorValuation)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── History charts ────────────────────────────────────────────────────────────
function HistoryCharts({ myResults }) {
  if (!myResults || myResults.length === 0) return null;
  const data = myResults.map(r => ({
    year: 'Y'+r.year,
    coastalCatch: Math.round(r.coastalCatch||0),
    deepCatch:   Math.round(r.deepCatch||0),
    cash:          Math.round(r.cashEnd||0),
    fleet:         r.shipsEnd||0,
    valuation:     Math.round(r.investorValuation||0),
  }));
  const tip = { contentStyle:{background:'#ffffff',border:'1px solid #bfdbfe',borderRadius:6}, labelStyle:{color:'#1e3a5f'} };
  const ax  = { stroke:'#4b6384', tick:{fontSize:10} };
  return (
    <div className="card">
      <h3>📈 Performance history</h3>
      <div className="chart-grid">
        <div className="chart-card">
          <h4>🐟 Catch by zone</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" {...ax} /><YAxis {...ax} />
              <Tooltip {...tip} /><Legend wrapperStyle={{fontSize:11}} />
              <Line type="monotone" dataKey="coastalCatch" name="Coastal" stroke="#86efac" strokeWidth={2} dot={{r:2}} />
              <Line type="monotone" dataKey="deepCatch"   name="Deep Sea" stroke="#4ade80" strokeWidth={2} dot={{r:2}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>💰 Cash position ($)</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" {...ax} /><YAxis {...ax} tickFormatter={v=>money(v)} />
              <Tooltip {...tip} formatter={v=>money(v)} /><Legend wrapperStyle={{fontSize:11}} />
              <Line type="monotone" dataKey="cash" name="Cash" stroke="#facc15" strokeWidth={2} dot={{r:2}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>🚢 Fleet size (ships)</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" {...ax} /><YAxis {...ax} allowDecimals={false} />
              <Tooltip {...tip} /><Legend wrapperStyle={{fontSize:11}} />
              <Line type="monotone" dataKey="fleet" name="Ships" stroke="#f97316" strokeWidth={2} dot={{r:2}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>📈 Investor valuation ($)</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" {...ax} /><YAxis {...ax} tickFormatter={v=>money(v)} />
              <Tooltip {...tip} formatter={v=>money(v)} /><Legend wrapperStyle={{fontSize:11}} />
              <Line type="monotone" dataKey="valuation" name="Valuation" stroke="#a78bfa" strokeWidth={2} dot={{r:2}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Auction panel ─────────────────────────────────────────────────────────────
function AuctionPanel({ state, token }) {
  const { auction, listings, myListing, team, myResults } = state;
  const lastResult = myResults && myResults.length>0 ? myResults[myResults.length-1] : null;
  const [bid,setBid]         = useState(auction.minimumNextBidPerShip||0);
  const [listQty,setListQty] = useState(0);
  const [listRes,setListRes] = useState(300);
  const [tradeBids,setTradeBids] = useState({});
  const [tradeDone,setTradeDone] = useState({});
  const [bidDone,setBidDone] = useState(false);

  useEffect(()=>{ setBid(auction.minimumNextBidPerShip||0); setBidDone(false); },[auction.minimumNextBidPerShip]);

  useEffect(()=>{
    setTradeBids(prev=>{
      const upd={...prev};
      listings.forEach(l=>{ if(!(l.id in upd)||upd[l.id]<l.minNextBid) upd[l.id]=l.minNextBid; });
      return upd;
    });
  },[listings]);

  async function post(url,body) {
    const r = await fetch(API+url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(body)});
    const j = await r.json(); if(j.error) alert(j.error); return j;
  }

  return (
    <div>
      {/* Last year's catch breakdown */}
      {lastResult && (lastResult.coastalCatch>0||lastResult.deepCatch>0) && (
        <div className="card" style={{padding:'10px 16px',background:'rgba(14,165,233,0.07)',borderColor:'rgba(14,165,233,0.3)'}}>
          <h4 style={{marginBottom:6,fontSize:'0.85rem'}}>🐟 Your catch last year (Year {lastResult.year})</h4>
          <div style={{display:'flex',gap:20,fontSize:'0.82rem',color:'var(--text)'}}>
            {lastResult.coastalCatch>0 && <span>🌿 Coastal: <strong>{Math.round(lastResult.coastalCatch)} fish</strong></span>}
            {lastResult.deepCatch>0    && <span>🌊 Deep Sea: <strong>{Math.round(lastResult.deepCatch)} fish</strong></span>}
            <span style={{color:'var(--muted)'}}>Total: <strong>{Math.round(lastResult.catch||0)} fish</strong></span>
          </div>
        </div>
      )}
      {/* Bank auction */}
      <div className="card">
        <h3>🏦 Bank Auction — 5 ships available</h3>
        <div className="auction-hi">
          {auction.currentHighBidPerShip>0
            ? <><p>Current high bid: <strong>{money(auction.currentHighBidPerShip)}/unit</strong> by <strong>{auction.currentHighBidderName}</strong></p>
                 <p>Minimum next bid: <strong>{money(auction.minimumNextBidPerShip)}/unit</strong> · Total for 5: <strong>{money(auction.minimumNextBidPerShip*5)}</strong></p></>
            : <><p>No bids yet. Reserve: <strong>{money(auction.reservePrice)}/unit</strong></p>
                 <p>Win all 5 ships for <strong>{money(auction.reservePrice*5)}</strong></p></>}
        </div>
        <div className="row">
          <input type="number" step="10" value={bid} onChange={e=>setBid(Math.max(0,Number(e.target.value)))} />
          <button className="btn primary" onClick={async()=>{const j=await post('/api/team/bank-bid',{bidPerShip:bid});if(j&&!j.error)setBidDone(true);}}>Place bid</button>
          {bidDone && <span className="submitted">✓ Bid placed</span>}
        </div>
      </div>

      {/* Seller: your own listing status */}
      <div className="card">
        <h3>🤝 Sell your ships</h3>
        {myListing && (
          <div className="my-listing-card">
            <p>📋 Your listing: <strong>{myListing.quantity} ships</strong> · Reserve {money(myListing.reservePricePerShip)}/unit</p>
            {myListing.currentBid
              ? <p>🏆 Highest bid: <strong>{money(myListing.currentBid)}/unit</strong> by <strong>{myListing.currentBidder}</strong> · Total: {money(myListing.currentBid*myListing.quantity)}</p>
              : <p style={{color:'var(--muted)'}}>No bids yet.</p>}
          </div>
        )}
        <p className="muted">You have {team.ships} ships. List some for other companies to bid on (highest bid wins when auction closes).</p>
        <div className="row">
          <label>Qty <input type="number" min="0" max={team.ships} value={listQty} onChange={e=>setListQty(Math.max(0,Number(e.target.value)))} /></label>
          <label>Reserve $/unit <input type="number" min="0" step="10" value={listRes} onChange={e=>setListRes(Math.max(0,Math.round(Number(e.target.value)/10)*10))} /></label>
          <button className="btn" onClick={async()=>{const j=await post('/api/team/listing',{quantity:listQty,reservePricePerShip:listRes});if(j&&!j.error)alert('Listed '+listQty+' ships at reserve $'+listRes+'/unit.');}}>List for sale</button>
        </div>
      </div>

      {/* Buyers: listings from other teams */}
      {listings.length>0 && (
        <div className="card">
          <h3>🛒 Ships for sale — bid now (highest bid wins at close)</h3>
          {listings.map(l=>(
            <div key={l.id} className="listing-row">
              <div>
                <div><strong>{l.sellerName}</strong>: {l.quantity} ships · reserve {money(l.reservePricePerShip)}/unit</div>
                <div className={'listing-bid-info'+(l.currentBid?' has-bid':'')}>
                  {l.currentBid
                    ? `🏆 Current high: ${money(l.currentBid)}/unit by ${l.currentBidder} — min next bid: ${money(l.minNextBid)}/unit`
                    : `No bids yet — min bid: ${money(l.minNextBid)}/unit`}
                </div>
              </div>
              <div className="row">
                <input type="number" step="10" value={tradeBids[l.id]??l.minNextBid} onChange={e=>setTradeBids(p=>({...p,[l.id]:Math.max(0,Number(e.target.value))}))} />
                <button className="btn" onClick={async()=>{const j=await post('/api/team/trade-bid',{listingId:l.id,bidPerShip:tradeBids[l.id]??l.minNextBid});if(j&&!j.error)setTradeDone(p=>({...p,[l.id]:true}));}}>Bid</button>
                {tradeDone[l.id] && <span className="submitted">✓ Bid placed</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deploy panel ──────────────────────────────────────────────────────────────
function DeployPanel({ state, token }) {
  const { team, game, myResults } = state;
  const avail = team.availableShips || 0;
  const maxBuild = Math.ceil(avail / 2);

  function calcDefaults(a) {
    const lr = myResults && myResults.length > 0 ? myResults[myResults.length-1] : null;
    if (!lr) return { harbor:a, coastal:0, deep:0 };
    const c = Math.min(lr.shipsCoastal||0, a);
    const d = Math.min(lr.shipsDeepSea||0, a-c);
    return { harbor: a-c-d, coastal:c, deep:d };
  }

  const init = calcDefaults(avail);
  const [harbor,setHarbor]   = useState(init.harbor);
  const [coastal,setCoastal] = useState(init.coastal);
  const [deep,setDeep]       = useState(init.deep);
  const [build,setBuild]     = useState(0);
  const [done,setDone]       = useState(false);
  const prevYear = useRef(game.currentYear);

  useEffect(()=>{
    if(game.currentYear!==prevYear.current||avail!==harbor+coastal+deep){
      prevYear.current=game.currentYear;
      const d=calcDefaults(avail); setHarbor(d.harbor); setCoastal(d.coastal); setDeep(d.deep); setBuild(0); setDone(false);
    }
  },[avail,game.currentYear]);

  const total = harbor+coastal+deep;
  const opex  = harbor*50+coastal*150+deep*250;
  const ok    = total===avail;

  async function submit() {
    if (!ok){ alert('Harbor + Coastal + Deep Sea must equal '+avail+' ships.'); return; }
    if (build>maxBuild){ alert('Max ships to order: '+maxBuild); return; }
    const r = await fetch(API+'/api/team/deploy',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({shipsToConstruct:build,shipsHarbor:harbor,shipsCoastal:coastal,shipsDeepSea:deep})});
    const j = await r.json(); if(j.error) alert(j.error); else setDone(true);
  }

  return (
    <div className="card">
      <h3>🎣 Deploy your fleet — Year {game.currentYear}</h3>
      <p className="muted">You have <strong>{avail} ships</strong> available. Assign every one to a zone.</p>
      <div className="deploy-grid">
        <div className="zone harbor">
          <div className="zone-title">🏠 Harbor</div>
          <div className="zone-sub">$50/unit · No catching</div>
          <input type="number" min="0" max={avail} value={harbor} onChange={e=>setHarbor(Math.max(0,+e.target.value))} />
        </div>
        <div className="zone coastal">
          <div className="zone-title">🌿 Coastal</div>
          <div className="zone-sub">$150/unit · Moderate yield</div>
          <input type="number" min="0" max={avail} value={coastal} onChange={e=>setCoastal(Math.max(0,+e.target.value))} />
        </div>
        <div className="zone deep">
          <div className="zone-title">🌊 Deep Sea</div>
          <div className="zone-sub">$250/unit · Higher yield</div>
          <input type="number" min="0" max={avail} value={deep} onChange={e=>setDeep(Math.max(0,+e.target.value))} />
        </div>
      </div>
      <div className={'tally '+(ok?'ok':'bad')}>{total} / {avail} ships assigned{ok?' ✓':' — assign all to proceed'}</div>
      <div className="cost-row">
        <span>Operating costs: <strong>{money(opex)}</strong></span>
        <span>Cash: <strong>{money(team.cash)}</strong></span>
        <span>Ship value: <strong>{money(game.shipValue)}/unit</strong></span>
        {opex>team.cash && <span style={{color:'var(--orange)'}}>⚠ Will borrow at 5% interest</span>}
      </div>
      <div className="card-inner">
        <h4>🔨 Order new ships — paid &amp; delivered at start of next year (max {maxBuild})</h4>
        <div className="row" style={{marginBottom:14}}>
          <input type="number" min="0" max={maxBuild} value={build} onChange={e=>setBuild(Math.max(0,Math.min(+e.target.value,maxBuild)))} />
          <span style={{color:'var(--muted)'}}>× $300 = {money(build*300)} due next year</span>
        </div>
        {build>maxBuild && <p style={{color:'var(--red)',fontSize:'0.82rem'}}>Max {maxBuild} ships (half your fleet)</p>}
      </div>
      {done
        ? <div className="tally ok">✓ Deployment submitted! Waiting for other companies…</div>
        : <button className="btn primary wide" onClick={submit} disabled={!ok}>Confirm deployment</button>}
    </div>
  );
}

// ── P&L card ──────────────────────────────────────────────────────────────────
function PLCard({ myResults }) {
  if (!myResults || myResults.length === 0) return null;
  const idx = myResults.length - 1;
  const r = myResults[idx];
  const prev = idx > 0 ? myResults[idx - 1] : null;

  const prevCash          = prev ? prev.cashEnd : 600;
  const cashBeforeAuction = r.cashBeforeAuction ?? prevCash;
  const postAuction       = r.cashStart ?? prevCash;

  const shipyardCost  = cashBeforeAuction - prevCash;
  const auctionCost   = postAuction - cashBeforeAuction;

  const hasCatchDetail = r.coastalCatch != null && (r.coastalCatch > 0 || r.deepCatch > 0);
  const harborOpex    = (r.shipsHarbor||0) * 50;
  const coastalOpex   = (r.shipsCoastal||0) * 150;
  const deepOpex      = (r.shipsDeepSea||0) * 250;
  const interest      = r.interest || 0;
  const preInterestBal = postAuction + (r.revenue||0) - (r.opex||0);
  const interestRate  = interest >= 0 ? 2 : 5;

  return (
    <div className="card">
      <h3>📋 Year {r.year} — Cash flow &amp; P&amp;L</h3>
      <table className="detail-table">
        <tbody>
          <tr className="section-header"><td colSpan="3">Cash position</td></tr>
          <tr><td>Opening cash</td><td></td><td className={'num '+(prevCash>=0?'':'neg')}>{money(prevCash)}</td></tr>
          {shipyardCost < 0 && <tr><td>🔨 Ship delivery — units paid &amp; received</td><td></td><td className="num neg">{money(shipyardCost)}</td></tr>}
          {auctionCost !== 0 && <tr><td>{auctionCost<0?'🐟 Ships purchased (auction / trade)':'🤝 Ships sold (trade)'}</td><td></td><td className={'num '+(auctionCost>=0?'pos':'neg')}>{auctionCost>=0?'+':''}{money(auctionCost)}</td></tr>}

          <tr className="section-header"><td colSpan="3">Catch revenue</td></tr>
          {hasCatchDetail
            ? <><tr><td>🌿 Coastal catch</td><td className="num">{Math.round(r.coastalCatch)} fish</td><td className="num pos">+{money(r.coastalCatch*20)}</td></tr>
                  <tr><td>🌊 Deep Sea catch</td><td className="num">{Math.round(r.deepCatch||0)} fish</td><td className="num pos">+{money((r.deepCatch||0)*20)}</td></tr></>
            : <tr><td>🐟 Total catch</td><td className="num">{Math.round(r.catch||0)} fish</td><td className="num pos">+{money(r.revenue)}</td></tr>}
          <tr className="subtotal"><td colSpan="2"><strong>Total revenue</strong> ({Math.round(r.catch||0)} fish × $20)</td><td className="num pos"><strong>+{money(r.revenue)}</strong></td></tr>

          <tr className="section-header"><td colSpan="3">Operating costs</td></tr>
          {(r.shipsHarbor||0)>0 && <tr><td>🏠 Harbor ({r.shipsHarbor} × $50)</td><td></td><td className="num neg">−{money(harborOpex)}</td></tr>}
          {(r.shipsCoastal||0)>0 && <tr><td>🌿 Coastal ({r.shipsCoastal} × $150)</td><td></td><td className="num neg">−{money(coastalOpex)}</td></tr>}
          {(r.shipsDeepSea||0)>0 && <tr><td>🌊 Deep Sea ({r.shipsDeepSea} × $250)</td><td></td><td className="num neg">−{money(deepOpex)}</td></tr>}
          <tr className="subtotal"><td colSpan="2"><strong>Total operating costs</strong></td><td className="num neg"><strong>−{money(r.opex)}</strong></td></tr>

          {(r.shipsToConstruct||0)>0 && <tr><td colSpan="2" style={{color:'var(--muted)',fontStyle:'italic'}}>🔨 {r.shipsToConstruct} ships ordered — {money(r.shipsToConstruct*300)} due next year</td><td></td></tr>}

          <tr className="subtotal"><td colSpan="2">Balance before interest</td><td className={'num '+(preInterestBal>=0?'':'neg')}>{money(preInterestBal)}</td></tr>
          <tr><td>{interest>=0?`💰 Interest earned (${interestRate}% on ${money(preInterestBal)}):`:`💸 Interest paid (${interestRate}% on ${money(preInterestBal)}):`}</td><td></td><td className={'num '+(interest>=0?'pos':'neg')}>{interest>=0?'+':'−'}{money(Math.abs(interest))}</td></tr>

          <tr className="total-row"><td colSpan="2"><strong>Closing cash</strong></td><td className={'num '+(r.cashEnd>=0?'pos':'neg')}><strong>{money(r.cashEnd)}</strong></td></tr>

          <tr className="section-header"><td colSpan="3">Investor valuation</td></tr>
          <tr><td>Cash</td><td></td><td className={'num '+(r.cashEnd>=0?'':'neg')}>{money(r.cashEnd)}</td></tr>
          <tr><td>Fleet ({r.shipsEnd} ships × {money(r.investorValuation-r.cashEnd>0?(r.investorValuation-r.cashEnd)/r.shipsEnd:0)}/unit)</td><td></td><td className="num">{money(r.investorValuation-r.cashEnd)}</td></tr>
          <tr className="total-row"><td colSpan="2"><strong>Total investor valuation</strong></td><td className="num pos"><strong>{money(r.investorValuation)}</strong></td></tr>
        </tbody>
      </table>
      <p className="muted" style={{marginTop:8,fontSize:'0.77rem'}}>Ship market value set each round by auction prices, capped by estimated future earnings, floored at reserve.</p>
    </div>
  );
}

// ── Admin panel ───────────────────────────────────────────────────────────────
function AdminPanel({ state, token }) {
  const { game, teams, history, currentBids, auctionHistory, tradeHistory, currentListings, currentDeployments } = state;
  const sorted = [...teams].sort((a,b)=>a.teamNumber-b.teamNumber);
  const cPct = Math.round((game.coastalFishStock/1500)*100);
  const dPct = Math.round((game.deepSeaFishStock/3000)*100);
  const isPaused = !!game.pausedAt;
  async function post(url){ await fetch(API+url,{method:'POST',headers:{Authorization:'Bearer '+token}}); }

  const auctionWinners = {};
  (auctionHistory||[]).forEach(b=>{ if(!auctionWinners[b.year]||b.bidPerShip>auctionWinners[b.year].bidPerShip) auctionWinners[b.year]=b; });
  const winnerList = Object.values(auctionWinners).sort((a,b)=>a.year-b.year);

  return (
    <div>
      {/* Controls */}
      <div className="card">
        <h3>🎓 Instructor controls</h3>
        <div className="admin-btns">
          {game.phase==='SETUP' && <button className="btn primary" onClick={()=>post('/api/admin/start')}>▶ Start Year 1</button>}
          {game.phase!=='DEBRIEF' && <button className="btn" onClick={()=>post('/api/admin/close-auction')}>⏹ Close auction</button>}
          {game.phase!=='DEBRIEF' && <button className="btn" onClick={()=>post('/api/admin/close-deployment')}>⏹ Close deployment</button>}
          {game.phase!=='DEBRIEF' && (isPaused
            ? <button className="btn warn" onClick={()=>post('/api/admin/resume-timer')}>▶ Resume timer</button>
            : <button className="btn warn" onClick={()=>post('/api/admin/pause-timer')}>⏸ Pause timer</button>)}
          {game.phase!=='DEBRIEF'
            ? <button className="btn" onClick={()=>post('/api/admin/debrief')}>🔍 Open debrief</button>
            : <button className="btn primary" onClick={()=>post('/api/admin/exit-debrief')}>← Exit debrief</button>}
          <button className="btn danger" onClick={()=>{if(window.confirm('Reset the entire game?'))post('/api/admin/reset');}}>↺ Reset</button>
          <a className="btn" href={API+'/api/admin/export?token='+token} download>⬇ Export CSV</a>
        </div>
      </div>

      {/* Live auction bids */}
      {game.phase==='AUCTION_TRADE' && (
        <div className="card">
          <h3>🏦 Bank auction — live bids (Year {game.currentYear})</h3>
          {(!currentBids||currentBids.length===0)
            ? <p className="muted">No bids placed yet.</p>
            : <table className="admin-tbl">
                <thead><tr><th>#</th><th>Company</th><th>Bid/unit</th><th>Total (5 units)</th><th>Status</th></tr></thead>
                <tbody>{currentBids.map((b,i)=>(
                  <tr key={i} className={i===0?'winner-row':''}>
                    <td>{i===0?'🏆':i+1}</td><td>{b.teamName}</td>
                    <td>{money(b.bidPerShip)}</td><td>{money(b.bidPerShip*5)}</td>
                    <td>{i===0?'✓ Leading':'Outbid'}</td>
                  </tr>
                ))}</tbody>
              </table>}
        </div>
      )}

      {/* Live trade listings */}
      {game.phase==='AUCTION_TRADE' && (
        <div className="card">
          <h3>🤝 Ship trades — live listings (Year {game.currentYear})</h3>
          {(!currentListings||currentListings.length===0)
            ? <p className="muted">No ships listed for sale yet.</p>
            : <table className="admin-tbl">
                <thead><tr><th>Seller</th><th>Qty</th><th>Reserve/unit</th><th>Highest bid</th><th>Min next bid</th><th>Leading buyer</th></tr></thead>
                <tbody>{currentListings.map((l,i)=>(
                  <tr key={i}>
                    <td>{l.sellerName}</td><td>{l.quantity}</td>
                    <td>{money(l.reservePricePerShip)}</td>
                    <td>{l.currentBid?money(l.currentBid):'No bids'}</td>
                    <td>{money(l.minNextBid)}</td>
                    <td>{l.currentBidder||'—'}</td>
                  </tr>
                ))}</tbody>
                <tfoot><tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                  <td>Total</td>
                  <td>{currentListings.reduce((s,l)=>s+l.quantity,0)}</td>
                  <td></td>
                  <td>{money(currentListings.reduce((s,l)=>s+(l.currentBid||0)*l.quantity,0))}</td>
                  <td></td><td></td>
                </tr></tfoot>
              </table>}
        </div>
      )}

      {/* Deployment status — visible during CONSTRUCTION_DEPLOYMENT */}
      {game.phase==='CONSTRUCTION_DEPLOYMENT' && currentDeployments && (
        <div className="card">
          <h3>🎣 Fleet deployment — Year {game.currentYear}</h3>
          <table className="admin-tbl">
            <thead>
              <tr><th>Company</th><th>Ships</th><th>Harbor</th><th>Coastal</th><th>Deep Sea</th><th>Ordering</th><th>Status</th></tr>
            </thead>
            <tbody>{currentDeployments.map(t=>(
              <tr key={t.teamId} style={{opacity:t.submittedAt?1:0.55}}>
                <td>{t.teamName}</td>
                <td>{t.ships}</td>
                <td>{t.submittedAt?t.shipsHarbor:'—'}</td>
                <td>{t.submittedAt?t.shipsCoastal:'—'}</td>
                <td>{t.submittedAt?t.shipsDeepSea:'—'}</td>
                <td>{t.submittedAt?(t.shipsToConstruct>0?`+${t.shipsToConstruct}`:'—'):'—'}</td>
                <td>{t.submittedAt?<span style={{color:'var(--green)',fontWeight:700}}>✓ Confirmed</span>:<span style={{color:'var(--orange)'}}>⏳ Pending</span>}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
              <td>Confirmed</td>
              <td colSpan={5}></td>
              <td>{currentDeployments.filter(t=>t.submittedAt).length} / {currentDeployments.length}</td>
            </tr></tfoot>
          </table>
        </div>
      )}

      {/* Auction history */}
      {winnerList.length>0 && (
        <div className="card">
          <h3>🏦 Auction results by year</h3>
          <table className="admin-tbl">
            <thead><tr><th>Year</th><th>Winner</th><th>Price/unit</th><th>Total paid</th></tr></thead>
            <tbody>{winnerList.map(b=>(
              <tr key={b.year}><td>Y{b.year}</td><td>{b.teamName}</td><td>{money(b.bidPerShip)}</td><td>{money(b.bidPerShip*5)}</td></tr>
            ))}</tbody>
            <tfoot><tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
              <td>Total</td><td></td><td></td>
              <td>{money(winnerList.reduce((s,b)=>s+b.bidPerShip*5,0))}</td>
            </tr></tfoot>
          </table>
        </div>
      )}

      {/* Trade history */}
      {tradeHistory&&tradeHistory.length>0 && (
        <div className="card">
          <h3>🤝 Ship trades by year</h3>
          <table className="admin-tbl">
            <thead><tr><th>Year</th><th>Seller</th><th>Buyer</th><th>Qty</th><th>Price/unit</th><th>Status</th></tr></thead>
            <tbody>{tradeHistory.map((t,i)=>(
              <tr key={i}><td>Y{t.year}</td><td>{t.sellerName}</td><td>{t.buyerName||'—'}</td><td>{t.quantity}</td><td>{t.winningBid?money(t.winningBid):'—'}</td><td>{t.status}</td></tr>
            ))}</tbody>
            <tfoot><tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
              <td>Total</td><td></td><td></td>
              <td>{tradeHistory.reduce((s,t)=>s+t.quantity,0)}</td>
              <td>{money(tradeHistory.filter(t=>t.winningBid).reduce((s,t)=>s+t.winningBid*t.quantity,0))}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
      )}

      {/* Fish populations */}
      <div className="card ecology">
        <h3>🌲 Fish populations — hidden from students</h3>
        <div className="stock-bars">
          <div>
            <div className="stock-lbl">Coastal: <strong>{Math.round(game.coastalFishStock)}</strong> / 1500 ({cPct}%){cPct<30?' ⚠ CRITICAL':cPct<60?' ⚡ Declining':' ✓ Healthy'}</div>
            <div className="bar-bg"><div className="bar-fill coastal" style={{width:cPct+'%'}} /></div>
          </div>
          <div>
            <div className="stock-lbl">Deep Sea: <strong>{Math.round(game.deepSeaFishStock)}</strong> / 3000 ({dPct}%){dPct<30?' ⚠ CRITICAL':dPct<60?' ⚡ Declining':' ✓ Healthy'}</div>
            <div className="bar-bg"><div className="bar-fill deep" style={{width:dPct+'%'}} /></div>
          </div>
        </div>
        <p className="muted" style={{marginBottom:12}}>Ship market value: <strong>{money(game.shipValue)}/unit</strong></p>
        {history.length>0 && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" stroke="#4b6384" tick={{fontSize:11}} />
              <YAxis stroke="#4b6384" tick={{fontSize:11}} />
              <Tooltip contentStyle={{background:'#ffffff',border:'1px solid #bfdbfe',borderRadius:6}} />
              <Legend />
              <Line type="monotone" dataKey="coastalFishEnd" name="Coastal fish" stroke="#4ade80" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="deepSeaFishEnd" name="Deep Sea fish" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="totalShips" name="Total ships" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* All companies */}
      <div className="card">
        <h3>🏢 All companies — current status</h3>
        <table className="admin-tbl">
          <thead><tr><th>Company</th><th>Ships</th><th>Cash</th><th>Valuation</th></tr></thead>
          <tbody>{sorted.map(t=>(
            <tr key={t.id}>
              <td>{t.name}</td><td>{t.ships}</td>
              <td style={{color:t.cash<0?'var(--red)':''}}>{money(t.cash)}</td>
              <td><strong>{money(t.investorValuation)}</strong></td>
            </tr>
          ))}</tbody>
          <tfoot><tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
            <td>Total</td>
            <td>{sorted.reduce((s,t)=>s+t.ships,0)}</td>
            <td style={{color:sorted.reduce((s,t)=>s+t.cash,0)<0?'var(--red)':''}}>{money(sorted.reduce((s,t)=>s+t.cash,0))}</td>
            <td><strong>{money(sorted.reduce((s,t)=>s+t.investorValuation,0))}</strong></td>
          </tr></tfoot>
        </table>
        <p className="muted" style={{marginTop:8,fontSize:'0.77rem'}}>Ship market value: <strong>{money(game.shipValue)}/unit</strong></p>
      </div>
    </div>
  );
}

// ── Debrief ────────────────────────────────────────────────────────────────────
function DebriefView({ state, token, isAdmin }) {
  const { history, teams, allTeamResults } = state;
  async function exitDebrief(){ await fetch(API+'/api/admin/exit-debrief',{method:'POST',headers:{Authorization:'Bearer '+token}}); }
  const sorted = [...teams].sort((a,b)=>b.investorValuation-a.investorValuation);
  const tip = { contentStyle:{background:'#ffffff',border:'1px solid #bfdbfe',borderRadius:6} };
  const ax  = { stroke:'#4b6384', tick:{fontSize:11} };

  const valByYear={}, catchByYear={};
  (allTeamResults||[]).forEach(r=>{
    if(!valByYear[r.year]) valByYear[r.year]={year:r.year};
    valByYear[r.year]['t'+r.teamNumber]=Math.round(r.investorValuation||0);
    if(!catchByYear[r.year]) catchByYear[r.year]={year:r.year};
    catchByYear[r.year]['t'+r.teamNumber]=Math.round((r.coastalCatch||0)+(r.deepCatch||r.catch||0));
  });
  // Year 0 baseline: initial fish stocks (from first round's start values), initial fleet, initial valuations
  const year0Val={year:0}, year0Catch={year:0};
  teams.forEach(t=>{ year0Val['t'+t.teamNumber]=1500; year0Catch['t'+t.teamNumber]=0; });
  const valData   = [year0Val, ...Object.values(valByYear).sort((a,b)=>a.year-b.year)];
  const catchData = [year0Catch, ...Object.values(catchByYear).sort((a,b)=>a.year-b.year)];
  const histWithBase = history.length>0
    ? [{year:0, coastalFishEnd:history[0].coastalFishStart, deepSeaFishEnd:history[0].deepSeaFishStart, totalShips:teams.length*3}, ...history]
    : [];

  // Aggregate system metrics by year
  const systemByYear = {};
  (allTeamResults||[]).forEach(r=>{
    if(!systemByYear[r.year]) systemByYear[r.year]={year:r.year, totalValue:0, totalLiabilities:0};
    systemByYear[r.year].totalValue += Math.round(r.investorValuation||0);
    if((r.cashEnd||0)<0) systemByYear[r.year].totalLiabilities += Math.round(-(r.cashEnd||0));
  });
  const systemRows = Object.values(systemByYear).sort((a,b)=>a.year-b.year);
  const finalSystemRow = systemRows.length>0 ? systemRows[systemRows.length-1] : null;

  return (
    <div>
      <div className="card debrief-banner">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <h2>📋 The full picture</h2>
            <p>The fish populations were hidden during the game. Here is what actually happened in the forest.</p>
          </div>
          {isAdmin && (
            <button className="btn" onClick={exitDebrief} style={{whiteSpace:'nowrap'}}>← Exit debrief</button>
          )}
        </div>
      </div>

      {/* System-level value & liabilities summary */}
      {finalSystemRow && (
        <div className="card">
          <h3>🏦 System-level outcomes</h3>
          <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:20}}>
            <div style={{flex:1,minWidth:180,background:'var(--bg3)',borderRadius:10,padding:'16px 20px',textAlign:'center'}}>
              <div style={{fontSize:'0.8rem',color:'var(--muted)',marginBottom:4}}>Total value in system (final year)</div>
              <div style={{fontSize:'1.7rem',fontWeight:700,color:'var(--green)'}}>{money(finalSystemRow.totalValue)}</div>
              <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:2}}>sum of all investor valuations</div>
            </div>
            <div style={{flex:1,minWidth:180,background:'var(--bg3)',borderRadius:10,padding:'16px 20px',textAlign:'center'}}>
              <div style={{fontSize:'0.8rem',color:'var(--muted)',marginBottom:4}}>Total liabilities in system (final year)</div>
              <div style={{fontSize:'1.7rem',fontWeight:700,color:finalSystemRow.totalLiabilities>0?'var(--red)':'var(--green)'}}>{money(finalSystemRow.totalLiabilities)}</div>
              <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:2}}>sum of negative cash balances</div>
            </div>
          </div>
          {systemRows.length>0 && (
            <div style={{overflowX:'auto'}}>
              <table className="lb-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th style={{textAlign:'right'}}>Total system value</th>
                    <th style={{textAlign:'right'}}>Total liabilities</th>
                    <th style={{textAlign:'right'}}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {systemRows.map(row=>(
                    <tr key={row.year}>
                      <td><strong>Y{row.year}</strong></td>
                      <td style={{textAlign:'right',color:'var(--green)',fontVariantNumeric:'tabular-nums'}}>{money(row.totalValue)}</td>
                      <td style={{textAlign:'right',color:row.totalLiabilities>0?'var(--red)':'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{row.totalLiabilities>0?money(row.totalLiabilities):'—'}</td>
                      <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:(row.totalValue-row.totalLiabilities)>=0?'':'var(--red)'}}>{money(row.totalValue-row.totalLiabilities)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fish populations vs fleet */}
      {histWithBase.length>0 && (
        <div className="card">
          <h3>Fish populations vs. total ships over time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={histWithBase}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" {...ax} />
              <YAxis yAxisId="fish" {...ax} />
              <YAxis yAxisId="catchers" orientation="right" stroke="#f97316" tick={{fontSize:11}} />
              <Tooltip {...tip} /><Legend />
              <Line yAxisId="fish" type="monotone" dataKey="coastalFishEnd" name="Coastal fish" stroke="#4ade80" strokeWidth={2} />
              <Line yAxisId="fish" type="monotone" dataKey="deepSeaFishEnd" name="Deep Sea fish" stroke="#38bdf8" strokeWidth={2} />
              <Line yAxisId="catchers" type="monotone" dataKey="totalShips" name="Total ships (right)" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* All-team valuation chart */}
      {history.length>0 && (
        <div className="card">
          <h3>📈 Investor valuation — all companies over time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={valData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" {...ax} tickFormatter={v=>'Y'+v} />
              <YAxis {...ax} tickFormatter={v=>money(v)} />
              <Tooltip {...tip} formatter={v=>money(v)} /><Legend />
              {teams.map((t,i)=>(
                <Line key={t.id} type="monotone" dataKey={'t'+t.teamNumber} name={t.name} stroke={TEAM_COLORS[i%TEAM_COLORS.length]} strokeWidth={2} dot={{r:3}} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* All-team catch chart */}
      {history.length>0 && (
        <div className="card">
          <h3>🐟 Total fish catch — all companies over time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={catchData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
              <XAxis dataKey="year" {...ax} tickFormatter={v=>'Y'+v} />
              <YAxis {...ax} />
              <Tooltip {...tip} /><Legend />
              {teams.map((t,i)=>(
                <Line key={t.id} type="monotone" dataKey={'t'+t.teamNumber} name={t.name} stroke={TEAM_COLORS[i%TEAM_COLORS.length]} strokeWidth={2} dot={{r:3}} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <h3>Final rankings</h3>
        <table className="lb-table">
          <thead><tr><th>#</th><th>Company</th>{isAdmin&&<th>Ships</th>}{isAdmin&&<th>Cash</th>}<th>Valuation</th></tr></thead>
          <tbody>{sorted.map((t,i)=><tr key={t.id}><td>{i===0&&sorted[0].investorValuation>=1500?'🏆 1':i+1}</td><td>{t.name}</td>{isAdmin&&<td>{t.ships}</td>}{isAdmin&&<td>{money(t.cash)}</td>}<td><strong>{money(t.investorValuation)}</strong></td></tr>)}</tbody>
        </table>
      </div>

      {history.length>0 && (
        <div className="card">
          <h3>📊 Investor valuation by year — all companies</h3>
          <div style={{overflowX:'auto'}}>
            <table className="lb-table">
              <thead>
                <tr>
                  <th>Year</th>
                  {[...teams].sort((a,b)=>a.teamNumber-b.teamNumber).map(t=><th key={t.id}>{t.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {valData.map(row=>(
                  <tr key={row.year}>
                    <td><strong>Y{row.year}</strong></td>
                    {[...teams].sort((a,b)=>a.teamNumber-b.teamNumber).map(t=>(
                      <td key={t.id} style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:row['t'+t.teamNumber]>=1500?'var(--green)':row['t'+t.teamNumber]<0?'var(--red)':''}}>
                        {row['t'+t.teamNumber]!=null?money(row['t'+t.teamNumber]):'—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team view ──────────────────────────────────────────────────────────────────
function TeamView({ state, token }) {
  const { game, team, teams, myResults } = state;

  const hasAction = game.phase==='AUCTION_TRADE'||game.phase==='CONSTRUCTION_DEPLOYMENT';
  const isWaiting = ['SETUP','FINISHED'].includes(game.phase);

  return (
    <div>
      {/* Stats always at top */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Cash</div><div className="stat-value" style={{color:team.cash<0?'var(--red)':''}}>{money(team.cash)}</div>{team.cash<0&&<div className="stat-sub">5% interest on debt</div>}</div>
        <div className="stat-card"><div className="stat-label">Fleet size</div><div className="stat-value">{team.ships} 🚢</div>{team.availableShips!==team.ships&&<div className="stat-sub">+{team.availableShips-team.ships} arriving</div>}</div>
        <div className="stat-card"><div className="stat-label">Ship value</div><div className="stat-value">{money(game.shipValue)}</div><div className="stat-sub">per unit</div></div>
        <div className="stat-card hi"><div className="stat-label">My valuation</div><div className="stat-value">{money(team.investorValuation)}</div><div className="stat-sub">fleet + cash</div></div>
      </div>

      {/* Decision panels first */}
      {game.phase==='AUCTION_TRADE'          && <AuctionPanel state={state} token={token} />}
      {game.phase==='CONSTRUCTION_DEPLOYMENT' && <DeployPanel  state={state} token={token} />}
      {isWaiting && (
        <div className="card waiting"><p>{game.phase==='FINISHED'?'🏁 Game over! Waiting for instructor to open debrief.':'⏳ Waiting for the instructor to start the game…'}</p></div>
      )}

      {/* Historical data below */}
      <PLCard myResults={myResults} />
      <HistoryCharts myResults={myResults} />
      <Leaderboard teams={teams} myId={team?.id} shipValue={game.shipValue} />
    </div>
  );
}

// ── Super-admin panel ─────────────────────────────────────────────────────────
function SuperAdminPanel({ token, onLogout }) {
  const [sessions,setSessions] = useState(null);
  const [msg,setMsg]           = useState('');
  const [busy,setBusy]         = useState(false);
  // create-session form
  const [newCode,setNewCode]   = useState('');
  const [newName,setNewName]   = useState('');
  const [showCreate,setShowCreate] = useState(false);
  // add-instructor form keyed by gameId
  const [instrForm,setInstrForm]   = useState({});   // { [gameId]: {username:'',password:''} }

  const hdr = { Authorization:'Bearer '+token };

  async function loadSessions() {
    try {
      const r = await fetch(API+'/api/superadmin/sessions',{headers:hdr});
      const j = await r.json();
      if(Array.isArray(j)) setSessions(j); else setMsg(j.error||'Error loading sessions');
    } catch { setMsg('Cannot reach server'); }
  }
  useEffect(()=>{ loadSessions(); },[]);

  async function createSession() {
    if(!newCode.trim()){ setMsg('Code is required'); return; }
    setBusy(true); setMsg('');
    const r = await fetch(API+'/api/superadmin/sessions',{method:'POST',headers:{...hdr,'Content-Type':'application/json'},body:JSON.stringify({code:newCode.trim().toUpperCase(),name:newName.trim()||newCode.trim().toUpperCase()})});
    const j = await r.json(); setBusy(false);
    if(j.error){ setMsg(j.error); return; }
    setNewCode(''); setNewName(''); setShowCreate(false); loadSessions();
  }

  async function deleteSession(id,code) {
    if(!window.confirm(`Delete session "${code}" and ALL its data? This cannot be undone.`)) return;
    setBusy(true);
    await fetch(API+'/api/superadmin/sessions/'+id,{method:'DELETE',headers:hdr});
    setBusy(false); loadSessions();
  }

  async function addInstructor(gameId) {
    const f = instrForm[gameId]||{};
    if(!f.username||!f.password){ setMsg('Username and password are required'); return; }
    setBusy(true); setMsg('');
    const r = await fetch(API+'/api/superadmin/instructors',{method:'POST',headers:{...hdr,'Content-Type':'application/json'},body:JSON.stringify({gameId,username:f.username,password:f.password,startDate:f.startDate||'',endDate:f.endDate||''})});
    const j = await r.json(); setBusy(false);
    if(j.error){ setMsg(j.error); return; }
    setInstrForm(prev=>({...prev,[gameId]:{username:'',password:'',startDate:'',endDate:''}}));
    loadSessions();
  }

  async function removeInstructor(id) {
    if(!window.confirm('Remove this instructor?')) return;
    await fetch(API+'/api/superadmin/instructors/'+id,{method:'DELETE',headers:hdr});
    loadSessions();
  }

  const phaseLabel = { SETUP:'Setup', AUCTION_TRADE:'Auction', CONSTRUCTION_DEPLOYMENT:'Deploy', RESULTS:'Processing', FINISHED:'Finished', DEBRIEF:'Debrief' };

  return (
    <div className="app">
      <div className="app-header">
        <span className="logo">🐟 SalmonRush</span>
        <span className="phase-label">Super Admin</span>
        <button className="btn-sm" onClick={onLogout}>Log out</button>
      </div>
      <main className="app-main">
        {msg && <p className="flash" style={{marginBottom:12}}>{msg}</p>}

        {/* Create session */}
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3>Sessions</h3>
            <button className="btn primary" onClick={()=>setShowCreate(v=>!v)}>+ New session</button>
          </div>
          {showCreate && (
            <div style={{marginTop:14,display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'0.85rem',color:'var(--muted)'}}>
                Code
                <input value={newCode} onChange={e=>setNewCode(e.target.value.toUpperCase())} placeholder="e.g. MBA26A" style={{padding:'8px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'0.9rem',width:120}} onKeyDown={e=>e.key==='Enter'&&createSession()} />
              </label>
              <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'0.85rem',color:'var(--muted)'}}>
                Display name (optional)
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. MBA 2026 Section A" style={{padding:'8px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'0.9rem',width:220}} onKeyDown={e=>e.key==='Enter'&&createSession()} />
              </label>
              <button className="btn primary" onClick={createSession} disabled={busy}>Create</button>
              <button className="btn" onClick={()=>setShowCreate(false)}>Cancel</button>
            </div>
          )}
        </div>

        {/* Sessions list */}
        {sessions===null ? <p className="muted">Loading…</p> : sessions.length===0 ? <p className="muted">No sessions yet. Create one above.</p> : sessions.map(s=>(
          <div key={s.id} className="card" style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
              <div>
                <span style={{fontWeight:700,fontSize:'1rem'}}>{s.code}</span>
                {s.name!==s.code && <span style={{color:'var(--muted)',marginLeft:8,fontSize:'0.9rem'}}>{s.name}</span>}
                <span className="year-badge" style={{marginLeft:10}}>{phaseLabel[s.phase]||s.phase}</span>
                {s.phase!=='SETUP'&&s.phase!=='DEBRIEF'&&s.phase!=='FINISHED'&&<span style={{color:'var(--muted)',fontSize:'0.8rem',marginLeft:8}}>Year {s.currentYear}</span>}
              </div>
              <button className="btn danger" onClick={()=>deleteSession(s.id,s.code)} disabled={busy}>Delete session</button>
            </div>

            {/* Instructors */}
            <div style={{marginTop:14,borderTop:'1px solid var(--border)',paddingTop:12}}>
              <h4 style={{marginBottom:8}}>Instructors</h4>
              {s.instructors.length===0
                ? <p className="muted" style={{fontSize:'0.82rem',marginBottom:8}}>No instructors assigned — only master admin password works.</p>
                : <table className="admin-tbl" style={{marginBottom:10}}>
                    <thead><tr><th>Username</th><th>Password</th><th>Start date</th><th>End date</th><th></th></tr></thead>
                    <tbody>{s.instructors.map(ins=>{
                      const today=new Date().toISOString().slice(0,10);
                      const notYet=ins.startDate&&today<ins.startDate;
                      const expired=ins.endDate&&today>ins.endDate;
                      const status=expired?'⛔ expired':notYet?'⏳ pending':'✓ active';
                      const statusColor=expired?'var(--red)':notYet?'var(--muted)':'var(--green)';
                      return (
                      <tr key={ins.id}>
                        <td><strong>{ins.username}</strong> <span style={{fontSize:'0.75rem',color:statusColor}}>{status}</span></td>
                        <td style={{fontFamily:'monospace'}}>{ins.password}</td>
                        <td style={{color:'var(--muted)',fontSize:'0.8rem'}}>{ins.startDate||'—'}</td>
                        <td style={{color:'var(--muted)',fontSize:'0.8rem'}}>{ins.endDate||'—'}</td>
                        <td><button className="btn-sm" style={{color:'var(--red)',borderColor:'var(--red)'}} onClick={()=>removeInstructor(ins.id)}>Remove</button></td>
                      </tr>
                    )})}</tbody>
                  </table>
              }
              {/* Add instructor form */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
                <input
                  placeholder="Username"
                  value={(instrForm[s.id]||{}).username||''}
                  onChange={e=>setInstrForm(prev=>({...prev,[s.id]:{...(prev[s.id]||{}),username:e.target.value}}))}
                  style={{padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'0.85rem',width:140}}
                />
                <input
                  placeholder="Password"
                  type="password"
                  value={(instrForm[s.id]||{}).password||''}
                  onChange={e=>setInstrForm(prev=>({...prev,[s.id]:{...(prev[s.id]||{}),password:e.target.value}}))}
                  style={{padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'0.85rem',width:140}}
                />
                <label style={{display:'flex',flexDirection:'column',gap:2,fontSize:'0.75rem',color:'var(--muted)'}}>
                  Start date
                  <input
                    type="date"
                    value={(instrForm[s.id]||{}).startDate||''}
                    onChange={e=>setInstrForm(prev=>({...prev,[s.id]:{...(prev[s.id]||{}),startDate:e.target.value}}))}
                    style={{padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'0.85rem'}}
                  />
                </label>
                <label style={{display:'flex',flexDirection:'column',gap:2,fontSize:'0.75rem',color:'var(--muted)'}}>
                  End date
                  <input
                    type="date"
                    value={(instrForm[s.id]||{}).endDate||''}
                    onChange={e=>setInstrForm(prev=>({...prev,[s.id]:{...(prev[s.id]||{}),endDate:e.target.value}}))}
                    style={{padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'0.85rem'}}
                  />
                </label>
                <button className="btn" onClick={()=>addInstructor(s.id)} disabled={busy}>+ Add instructor</button>
              </div>
            </div>

            {/* Team login reference */}
            <div style={{marginTop:12,borderTop:'1px solid var(--border)',paddingTop:10,fontSize:'0.78rem',color:'var(--muted)'}}>
              Team passwords — Group 1: lugano · Group 2: anelka · Group 3: alex · Group 4: deivid · Group 5: anderson · Group 6: kante · Group 7: kocaman · Group 8: guendouzi · Group 9: aurelio · Group 10: asencio
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

// helper — decode JWT payload without verifying signature (safe: used only for routing)
function tokenRole(token){ try{ return JSON.parse(atob(token.split('.')[1])).role; }catch{ return null; } }

// ── Chat box ──────────────────────────────────────────────────────────────────
function ChatBox({ state, token, socket }) {
  const [open,setOpen]       = useState(false);
  const [msg,setMsg]         = useState('');
  const [toTeamId,setToTeam] = useState('all');
  const [messages,setMessages] = useState([]);
  const [unread,setUnread]   = useState(0);
  const endRef = useRef(null);
  const isAdmin = state.user.role==='admin';
  const sorted  = [...state.teams].sort((a,b)=>a.teamNumber-b.teamNumber);

  // Load history once on mount
  useEffect(()=>{
    fetch(API+'/api/chat',{headers:{Authorization:'Bearer '+token}})
      .then(r=>r.json()).then(data=>{ if(Array.isArray(data)) setMessages(data); });
  },[]);

  // Listen for incoming chat messages over socket
  useEffect(()=>{
    if(!socket) return;
    const handler=(m)=>{
      setMessages(prev=>[...prev,m]);
      if(!open) setUnread(u=>u+1);
    };
    socket.on('chat_msg',handler);
    return ()=>socket.off('chat_msg',handler);
  },[socket,open]);

  // Scroll to bottom + clear unread when panel opens
  useEffect(()=>{
    if(open){ setUnread(0); setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),50); }
  },[open]);
  useEffect(()=>{ if(open) endRef.current?.scrollIntoView({behavior:'smooth'}); },[messages,open]);

  async function send(){
    if(!msg.trim()) return;
    const toId   = toTeamId==='all'?null:toTeamId;
    const toName = toId ? sorted.find(t=>t.id===toId)?.name||null : null;
    await fetch(API+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({message:msg.trim(),toTeamId:toId,toTeamName:toName})});
    setMsg('');
  }

  const btnStyle={position:'fixed',bottom:24,right:24,zIndex:2000};
  const panelStyle={position:'fixed',bottom:24,right:24,zIndex:2000,width:310,height:400,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,display:'flex',flexDirection:'column',boxShadow:'0 8px 32px rgba(0,0,0,0.35)'};

  if(!open) return (
    <div style={btnStyle}>
      <button className="btn primary" style={{borderRadius:'50%',width:50,height:50,fontSize:'1.2rem',padding:0,position:'relative'}} onClick={()=>setOpen(true)}>
        💬
        {unread>0 && <span style={{position:'absolute',top:-5,right:-5,background:'var(--red)',color:'#fff',borderRadius:'50%',width:18,height:18,fontSize:'0.62rem',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{unread}</span>}
      </button>
    </div>
  );

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{padding:'9px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontWeight:700,fontSize:'0.88rem'}}>💬 Chat</span>
        <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:'1rem',lineHeight:1}} onClick={()=>setOpen(false)}>✕</button>
      </div>
      {/* Recipient selector — admin only */}
      {isAdmin && (
        <div style={{padding:'5px 10px',borderBottom:'1px solid var(--border)'}}>
          <select value={toTeamId} onChange={e=>setToTeam(e.target.value)} style={{width:'100%',fontSize:'0.75rem',padding:'3px 5px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)'}}>
            <option value="all">📢 Broadcast to all</option>
            {sorted.map(t=><option key={t.id} value={t.id}>Private → {t.name}</option>)}
          </select>
        </div>
      )}
      {/* Messages */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:5}}>
        {messages.length===0 && <p style={{color:'var(--muted)',fontSize:'0.78rem',textAlign:'center',marginTop:20}}>No messages yet.</p>}
        {messages.map(m=>(
          <div key={m.id} style={{background:m.fromRole==='admin'?'rgba(14,165,233,0.13)':'var(--bg3)',borderRadius:8,padding:'5px 9px',fontSize:'0.79rem'}}>
            <div style={{fontWeight:700,fontSize:'0.7rem',color:'var(--muted)',marginBottom:2}}>
              {m.fromRole==='admin'?'🎓 Instructor':m.fromName}
              {m.toTeamName && <span style={{color:'var(--orange)',fontWeight:400}}> → {m.toTeamName}</span>}
            </div>
            <div style={{wordBreak:'break-word'}}>{m.message}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {/* Input */}
      <div style={{padding:'7px 10px',borderTop:'1px solid var(--border)',display:'flex',gap:6}}>
        <input style={{flex:1,padding:'5px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:'0.82rem'}}
          value={msg} onChange={e=>setMsg(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="Type a message…" />
        <button className="btn primary" style={{padding:'5px 11px',fontSize:'0.78rem'}} onClick={send}>Send</button>
      </div>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
function App() {
  const [token,setToken] = useState(localStorage.getItem('salmonrushToken'));
  const [state,setState] = useState(null);
  const [tick,setTick]   = useState(0);
  const role = tokenRole(token);
  const isSuperAdmin = role === 'superadmin';
  // Only open a socket for non-superadmin sessions
  const socket = useMemo(()=>(token&&!isSuperAdmin)?io(API,{auth:{token}}):null,[token,isSuperAdmin]);
  async function load() {
    if (!token || isSuperAdmin) return;
    try {
      const r = await fetch(API+'/api/state',{headers:{Authorization:'Bearer '+token}});
      const j = await r.json();
      if (j.error){ localStorage.removeItem('salmonrushToken'); setToken(null); } else setState(j);
    } catch {}
  }
  useEffect(()=>{ load(); },[token]);
  useEffect(()=>{ if(!socket) return; socket.on('state_changed',load); socket.on('connect',load); return ()=>socket.disconnect(); },[socket]);
  useEffect(()=>{ const t=setInterval(()=>setTick(x=>x+1),1000); return ()=>clearInterval(t); },[]);
  function logout(){ localStorage.removeItem('salmonrushToken'); setToken(null); setState(null); }
  if (!token) return <Login onLogin={setToken} />;
  if (isSuperAdmin) return <SuperAdminPanel token={token} onLogout={logout} />;
  if (!state)  return <div className="loading">🐟 Loading…</div>;
  const isAdmin    = state.user.role==='admin';
  const isDebrief  = state.game.phase==='DEBRIEF';
  const isFinished = state.game.phase==='FINISHED';
  const showChat = !['SETUP'].includes(state.game.phase);
  return (
    <div className="app">
      <Header state={state} tick={tick} onLogout={logout} />
      <main className="app-main">
        {isDebrief                   && <DebriefView state={state} token={token} isAdmin={isAdmin} />}
        {(isFinished||!isDebrief) && isAdmin  && <AdminPanel  state={state} token={token} />}
        {!isDebrief && !isAdmin       && <TeamView    state={state} token={token} />}
      </main>
      {showChat && <ChatBox state={state} token={token} socket={socket} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
