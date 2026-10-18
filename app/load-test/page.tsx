'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

type Status = 'idle' | 'connecting' | 'online' | 'error' | 'closed';
type LogLevel = 'info' | 'warn' | 'error' | 'metric';
type LogEntry = { t: string; elapsedMs: number; level: LogLevel; source: string; event: string; detail?: Record<string, unknown> };
type Bot = {
  id: string; status: Status; client: SupabaseClient; channel: RealtimeChannel;
  interval?: ReturnType<typeof setInterval>; helloInterval?: ReturnType<typeof setInterval>; seq: number; received: number; gaps: number;
  lastSeqBySender: Record<string, number>; lastReceivedAtBySender: Record<string, number>;
  intervalsBySender: Record<string, number[]>; dispatchMs: number[]; errors: number;
  rtts: number[]; pendingPings: Map<string, number>; sent: number; lastStatus?: string;
};
type Peer = { id: string; label: string; lastSeen: number };

const MAX_LOGS = 12000;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(2));
};
const mean = (values: number[]) => values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null;
const fmt = (n: number | null, suffix = ' ms') => n === null ? '—' : `${n}${suffix}`;

export default function LoadTestPage() {
  const [runId, setRunId] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('device');
  const [botCount, setBotCount] = useState(10);
  const [intervalMs, setIntervalMs] = useState(250);
  const [probeTarget, setProbeTarget] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [fps, setFps] = useState<number | null>(null);
  const [frameP95, setFrameP95] = useState<number | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const botsRef = useRef<Bot[]>([]);
  const logsRef = useRef<LogEntry[]>([]);
  const startedRef = useRef<number | null>(null);
  const runIdRef = useRef('');
  const deviceRef = useRef('device');
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const frameRef = useRef<{ last: number; samples: number[]; frames: number }>({ last: 0, samples: [], frames: 0 });
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRunId(`run-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`);
    const stored = sessionStorage.getItem('vw-loadtest-device');
    if (stored) setDeviceLabel(stored);
    else setDeviceLabel(`device-${Math.random().toString(36).slice(2, 6)}`);
  }, []);

  const addLog = useCallback((level: LogLevel, source: string, event: string, detail?: Record<string, unknown>) => {
    const start = startedRef.current;
    const entry: LogEntry = {
      t: new Date().toISOString(),
      elapsedMs: start === null ? 0 : Math.round(performance.now() - start),
      level, source, event, ...(detail ? { detail } : {}),
    };
    logsRef.current.push(entry);
    if (logsRef.current.length > MAX_LOGS) logsRef.current.splice(0, logsRef.current.length - MAX_LOGS);
    setLogs([...logsRef.current]);
  }, []);

  const supabaseConfig = useMemo(() => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    keyAvailable: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }), []);

  const stop = useCallback((reason = 'manual stop') => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    botsRef.current.forEach((bot) => {
      if (bot.interval) clearInterval(bot.interval);
      bot.interval = undefined;
      try { void bot.client.removeChannel(bot.channel); } catch { /* cleanup only */ }
      try { bot.client.realtime.disconnect(); } catch { /* cleanup only */ }
    });
    botsRef.current = [];
    peersRef.current.clear();
    setPeers([]);
    setStatus('closed');
    addLog('info', 'controller', 'test_stopped', { reason });
  }, [addLog]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    botsRef.current.forEach((bot) => {
      if (bot.interval) clearInterval(bot.interval);
      if (bot.helloInterval) clearInterval(bot.helloInterval);
      try { void bot.client.removeChannel(bot.channel); } catch { /* cleanup only */ }
      try { bot.client.realtime.disconnect(); } catch { /* cleanup only */ }
    });
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const tick = () => {
      const sample = frameRef.current;
      const t = performance.now();
      if (sample.last) {
        const delta = t - sample.last;
        sample.samples.push(delta);
        if (sample.samples.length > 600) sample.samples.shift();
        sample.frames += 1;
        if (sample.frames >= 30) {
          const duration = sample.samples.slice(-sample.frames).reduce((a, b) => a + b, 0);
          setFps(duration > 0 ? Number((sample.frames * 1000 / duration).toFixed(1)) : null);
          setFrameP95(percentile(sample.samples.slice(-sample.frames), 0.95));
          sample.frames = 0;
        }
      }
      sample.last = t;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const start = async () => {
    if (botsRef.current.length) stop('restarted');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setStatus('error');
      addLog('error', 'controller', 'missing_supabase_config', { urlPresent: Boolean(url), anonKeyPresent: Boolean(key), note: 'No secrets were exported.' });
      return;
    }
    const safeRun = runId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
    const safeDevice = deviceLabel.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30) || 'device';
    if (!safeRun) { addLog('error', 'controller', 'invalid_run_id'); return; }
    runIdRef.current = safeRun;
    deviceRef.current = safeDevice;
    sessionStorage.setItem('vw-loadtest-device', safeDevice);
    const started = performance.now();
    startedRef.current = started;
    setStartedAt(started);
    setNow(started);
    logsRef.current = [];
    setLogs([]);
    peersRef.current.clear();
    setPeers([]);
    setStatus('connecting');
    addLog('info', 'controller', 'test_started', {
      runId: safeRun, deviceLabel: safeDevice, botCount, intervalMs,
      topic: `vw-loadtest:${safeRun}`,
      note: 'Isolated test channel; this route never subscribes to vw:<real-room-code>. RTT is measured with local performance.now().',
      browser: navigator.userAgent, visibility: document.visibilityState,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      screen: { width: screen.width, height: screen.height, dpr: devicePixelRatio },
      connection: (() => { const c = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection; return c ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData } : null; })(),
    });
    addLog('warn', 'controller', 'measurement_limits', {
      sameBrowserDispatch: 'Payload timestamp comparison is valid only for clients in this page/runtime; do not use it for cross-device one-way latency.',
      crossDevice: 'Use targeted Ping/Pong RTT; RTT/2 is only an estimate and assumes roughly symmetric paths.',
      load: 'Synthetic clients are separate Supabase clients but share this browser, device, CPU and network.',
    });

    const created: Bot[] = [];
    for (let i = 0; i < clamp(botCount, 1, 10); i++) {
      const id = `${safeDevice}-bot${i + 1}`;
      const client = createClient(url, key, {
        realtime: { params: { eventsPerSecond: clamp(Math.ceil(1000 / intervalMs) + 10, 20, 100) } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const channel = client.channel(`vw-loadtest:${safeRun}`, { config: { broadcast: { self: false, ack: true } } });
      const bot: Bot = {
        id, status: 'connecting', client, channel, seq: 0, received: 0, gaps: 0,
        lastSeqBySender: {}, lastReceivedAtBySender: {}, intervalsBySender: {}, dispatchMs: [], errors: 0,
        rtts: [], pendingPings: new Map(), sent: 0,
      };
      channel.on('broadcast', { event: 'hello' }, ({ payload }) => {
        if (!payload || typeof payload.id !== 'string' || payload.id === id) return;
        const peer: Peer = { id: payload.id, label: String(payload.label || payload.id), lastSeen: Date.now() };
        peersRef.current.set(peer.id, peer);
      });
      channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
        const receivedAt = performance.now();
        if (!payload || typeof payload.sender !== 'string' || payload.sender === id) return;
        bot.received += 1;
        if (typeof payload.sentAt === 'number') {
          // Same page's performance time origin only. Never interpret this as cross-device one-way latency.
          bot.dispatchMs.push(Math.max(0, receivedAt - payload.sentAt));
          if (bot.dispatchMs.length > 2000) bot.dispatchMs.shift();
        }
        const sender = payload.sender as string;
        if (typeof payload.seq === 'number') {
          const prev = bot.lastSeqBySender[sender];
          if (prev !== undefined && payload.seq > prev + 1) {
            bot.gaps += payload.seq - prev - 1;
            addLog('warn', id, 'sequence_gap', { sender, previousSeq: prev, currentSeq: payload.seq, missing: payload.seq - prev - 1 });
          }
          bot.lastSeqBySender[sender] = Math.max(prev ?? 0, payload.seq);
        }
        const prevAt = bot.lastReceivedAtBySender[sender];
        if (prevAt !== undefined) {
          const values = bot.intervalsBySender[sender] || (bot.intervalsBySender[sender] = []);
          values.push(receivedAt - prevAt);
          if (values.length > 1000) values.shift();
        }
        bot.lastReceivedAtBySender[sender] = receivedAt;
      });
      channel.on('broadcast', { event: 'ping' }, async ({ payload }) => {
        if (!payload || payload.target !== id || typeof payload.pingId !== 'string') return;
        const result = await channel.send({ type: 'broadcast', event: 'pong', payload: { pingId: payload.pingId, target: payload.sender, sender: id, targetSentAt: payload.sentAt } });
        if (result !== 'ok') { bot.errors += 1; addLog('error', id, 'pong_send_failed', { result, pingId: payload.pingId }); }
      });
      channel.on('broadcast', { event: 'pong' }, ({ payload }) => {
        if (!payload || payload.target !== id || typeof payload.pingId !== 'string') return;
        const sent = bot.pendingPings.get(payload.pingId);
        if (sent === undefined) return;
        const rtt = performance.now() - sent;
        bot.pendingPings.delete(payload.pingId);
        bot.rtts.push(rtt);
        if (bot.rtts.length > 1000) bot.rtts.shift();
        addLog('metric', id, 'rtt_sample', { rttMs: Number(rtt.toFixed(2)), peer: payload.sender, pingId: payload.pingId });
      });
      channel.subscribe((s, err) => {
        bot.lastStatus = s;
        if (s === 'SUBSCRIBED') {
          bot.status = 'online';
          addLog('info', id, 'channel_subscribed', { topic: `vw-loadtest:${safeRun}`, status: s });
          const announce = async () => {
            const result = await channel.send({ type: 'broadcast', event: 'hello', payload: { id, label: safeDevice, runId: safeRun, at: new Date().toISOString() } });
            if (result !== 'ok') { bot.errors += 1; addLog('error', id, 'hello_send_failed', { result }); }
          };
          void announce();
          // Heartbeat enables peers that join later to discover this client.
          if (bot.helloInterval) clearInterval(bot.helloInterval);
          bot.helloInterval = setInterval(() => { void announce(); }, 4000);
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          bot.status = 'error'; bot.errors += 1;
          addLog('error', id, 'channel_status', { status: s, error: err ? String(err.message || err) : null });
        } else addLog('info', id, 'channel_status', { status: s });
      });
      created.push(bot);
    }
    botsRef.current = created;
    // Wait briefly for subscriptions, then begin sending. A failed bot is still reported in logs.
    const begin = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (botsRef.current.length !== created.length) return;
      created.forEach((bot) => {
        if (bot.status !== 'online') return;
        bot.interval = setInterval(async () => {
          if (bot.status !== 'online') return;
          bot.seq += 1;
          const payload = { sender: bot.id, seq: bot.seq, sentAt: performance.now(), x: Math.sin(bot.seq / 8), z: Math.cos(bot.seq / 8), moving: true };
          const sendStarted = performance.now();
          const result = await bot.channel.send({ type: 'broadcast', event: 'pos', payload });
          const ackMs = performance.now() - sendStarted;
          bot.sent += 1;
          if (result !== 'ok') {
            bot.errors += 1;
            addLog('error', bot.id, 'position_send_failed', { seq: bot.seq, result, ackMs: Number(ackMs.toFixed(2)) });
          }
        }, intervalMs);
      });
      addLog('info', 'controller', 'position_stream_started', { onlineBots: created.filter(b => b.status === 'online').length, configuredBots: created.length, intervalMs, expectedBroadcastsPerSecond: Number((created.length * 1000 / intervalMs).toFixed(2)), estimatedDeliveriesPerSecond: Number((created.length * (created.length - 1) * 1000 / intervalMs).toFixed(2)), formula: 'N senders × (N−1 receivers) × updates/sec; approximate, not the provider billing counter.' });
      setStatus(created.some(b => b.status === 'online') ? 'online' : 'error');
      timerRef.current = setInterval(() => {
        const active = botsRef.current;
        const p = [...peersRef.current.values()].filter(x => Date.now() - x.lastSeen < 15000);
        setPeers(p);
        addLog('metric', 'controller', 'health_snapshot', {
          bots: active.map(b => ({ id: b.id, status: b.status, sent: b.sent, received: b.received, gaps: b.gaps, errors: b.errors, dispatchP50Ms: percentile(b.dispatchMs, 0.5), dispatchP95Ms: percentile(b.dispatchMs, 0.95), rttP50Ms: percentile(b.rtts, 0.5), rttP95Ms: percentile(b.rtts, 0.95) })),
          peerIds: p.map(x => x.id), pageVisibility: document.visibilityState,
          fps, frameP95Ms,
        });
      }, 5000);
    };
    void begin();
  };

  const pingPeer = async () => {
    const source = botsRef.current.find(b => b.status === 'online');
    const target = probeTarget;
    if (!source || !target) { addLog('warn', 'probe', 'ping_skipped', { reason: 'Select an online peer first', target }); return; }
    const pingId = `${source.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    source.pendingPings.set(pingId, performance.now());
    const result = await source.channel.send({ type: 'broadcast', event: 'ping', payload: { pingId, sender: source.id, target, sentAt: performance.now() } });
    addLog(result === 'ok' ? 'info' : 'error', 'probe', 'ping_sent', { from: source.id, to: target, pingId, result });
    setTimeout(() => {
      if (source.pendingPings.has(pingId)) {
        source.pendingPings.delete(pingId);
        addLog('warn', 'probe', 'ping_timeout', { from: source.id, to: target, pingId, timeoutMs: 5000 });
      }
    }, 5000);
  };

  const metrics = useMemo(() => {
    const bots = botsRef.current;
    const allRtt = bots.flatMap(b => b.rtts);
    const allDispatch = bots.flatMap(b => b.dispatchMs);
    const totalSent = bots.reduce((n, b) => n + b.sent, 0);
    const totalReceived = bots.reduce((n, b) => n + b.received, 0);
    const totalGaps = bots.reduce((n, b) => n + b.gaps, 0);
    const totalErrors = bots.reduce((n, b) => n + b.errors, 0);
    return { online: bots.filter(b => b.status === 'online').length, total: bots.length, totalSent, totalReceived, totalGaps, totalErrors, rttP50: percentile(allRtt, .5), rttP95: percentile(allRtt, .95), dispatchP50: percentile(allDispatch, .5), dispatchP95: percentile(allDispatch, .95) };
  // Health snapshot state changes trigger re-render; logs is intentionally a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, status]);

  const exportJson = () => {
    const end = performance.now();
    const data = {
      schema: 'virtual-marriage-loadtest-v1',
      exportedAt: new Date().toISOString(),
      config: { runId: runIdRef.current || runId, deviceLabel: deviceRef.current || deviceLabel, intervalMs, botCount, topicPrefix: 'vw-loadtest:', supabaseUrlPresent: supabaseConfig.url.length > 0, anonKeyPresent: supabaseConfig.keyAvailable },
      durationMs: startedRef.current === null ? 0 : Math.round(end - startedRef.current),
      browser: { userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null, visibility: typeof document !== 'undefined' ? document.visibilityState : null, hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? null : null, screen: typeof screen !== 'undefined' ? { width: screen.width, height: screen.height, dpr: devicePixelRatio } : null },
      summary: metrics,
      bots: botsRef.current.map(b => ({ id: b.id, status: b.status, sent: b.sent, received: b.received, gaps: b.gaps, errors: b.errors, rttSamples: b.rtts.length, rttP50Ms: percentile(b.rtts, .5), rttP95Ms: percentile(b.rtts, .95), dispatchP50Ms: percentile(b.dispatchMs, .5), dispatchP95Ms: percentile(b.dispatchMs, .95), receivedIntervalP50Ms: percentile(Object.values(b.intervalsBySender).flat(), .5), receivedIntervalP95Ms: percentile(Object.values(b.intervalsBySender).flat(), .95) })),
      peers: [...peersRef.current.values()],
      frame: { fps, frameIntervalP95Ms: frameP95 },
      limitations: ['One-way dispatch timing is only valid for bots sharing this page runtime/time origin.', 'RTT is measured on the sender with performance.now(); RTT/2 is not guaranteed to equal one-way latency.', 'Bots share one physical device/network and do not emulate separate mobile networks.', 'Client send results/acknowledgements are not a substitute for Supabase usage reports.', 'The export intentionally excludes the Supabase URL and anon key.'],
      logs: logsRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `vw-loadtest-${(runIdRef.current || runId || 'run').replace(/[^a-zA-Z0-9_-]/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(href);
    addLog('info', 'controller', 'json_exported', { logCount: logsRef.current.length, durationMs: data.durationMs });
  };

  const copyDiagnostics = async () => {
    const lines = [
      `Virtual-Marriage load test`, `run=${runIdRef.current || runId}`, `device=${deviceRef.current || deviceLabel}`,
      `status=${status}; bots=${metrics.online}/${metrics.total}; interval=${intervalMs}ms`,
      `sent=${metrics.totalSent}; received=${metrics.totalReceived}; gaps=${metrics.totalGaps}; errors=${metrics.totalErrors}`,
      `RTT p50=${fmt(metrics.rttP50)}; p95=${fmt(metrics.rttP95)}; dispatch p50=${fmt(metrics.dispatchP50)}; p95=${fmt(metrics.dispatchP95)}`,
      `FPS=${fps ?? '—'}; frame p95=${fmt(frameP95)}`, `logs=${logsRef.current.length}`,
      `Latest errors/warnings:`, ...logsRef.current.filter(l => l.level === 'error' || l.level === 'warn').slice(-30).map(l => `${l.t} +${l.elapsedMs}ms [${l.level}] ${l.source} ${l.event} ${JSON.stringify(l.detail || {})}`),
    ].join('\n');
    try { await navigator.clipboard.writeText(lines); setCopyMessage('تم نسخ الملخص'); }
    catch { setCopyMessage('تعذّر النسخ؛ صدّر JSON بدلًا منه'); }
  };

  const duration = startedAt ? Math.max(0, now - startedAt) : 0;
  const lastLogs = logs.slice(-80).reverse();

  return <main style={{ minHeight: '100vh', background: '#09090b', color: '#f4ecd8', padding: '18px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', direction: 'ltr' }}>
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div><h1 style={{ fontSize: 'clamp(22px,4vw,34px)', margin: 0 }}>Virtual Marriage · Realtime Lab</h1><p style={{ color: '#b9ac86', margin: '8px 0 0' }}>Isolated load test — never connects to real wedding room topics.</p></div>
        <div style={{ border: '1px solid #d8b55a66', borderRadius: 10, padding: '8px 12px', color: status === 'online' ? '#66e3a1' : status === 'error' ? '#ff8b8b' : '#d8b55a' }}>● {status.toUpperCase()} · {Math.floor(duration / 1000)}s</div>
      </header>

      <section style={panel}>
        <h2 style={h2}>Test configuration</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
          <label style={label}>Run ID (same value on both devices)<input style={input} value={runId} onChange={e => setRunId(e.target.value)} disabled={status === 'online' || status === 'connecting'} /></label>
          <label style={label}>Device label (unique per device)<input style={input} value={deviceLabel} onChange={e => setDeviceLabel(e.target.value)} disabled={status === 'online' || status === 'connecting'} /></label>
          <label style={label}>Synthetic clients on this device<select style={input} value={botCount} onChange={e => setBotCount(Number(e.target.value))} disabled={status === 'online' || status === 'connecting'}>{[1,2,3,5,8,10].map(n => <option key={n} value={n}>{n} clients</option>)}</select></label>
          <label style={label}>Position update interval<select style={input} value={intervalMs} onChange={e => setIntervalMs(Number(e.target.value))} disabled={status === 'online' || status === 'connecting'}>{[80,120,250,500,1000].map(n => <option key={n} value={n}>{n} ms · {(1000/n).toFixed(n < 100 ? 1 : 2)} updates/s/client</option>)}</select></label>
        </div>
        <p style={{ color: '#b9ac86', fontSize: 12, lineHeight: 1.6 }}>Supabase config: URL {supabaseConfig.url ? 'present' : 'MISSING'} · anon key {supabaseConfig.keyAvailable ? 'present' : 'MISSING'}. Values are never shown or included in the export.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button style={buttonPrimary} onClick={() => void start()} disabled={status === 'online' || status === 'connecting'}>Start test</button>
          <button style={button} onClick={() => stop()} disabled={!botsRef.current.length}>Stop test</button>
          <button style={button} onClick={exportJson}>Export full JSON logs</button>
          <button style={button} onClick={() => void copyDiagnostics()}>Copy diagnostic summary</button>
          <button style={button} onClick={() => { logsRef.current = []; setLogs([]); addLog('info','controller','logs_cleared'); }}>Clear visible logs</button>
        </div>
        {copyMessage && <p style={{ color: '#66e3a1', marginBottom: 0 }}>{copyMessage}</p>}
      </section>

      <section style={panel}>
        <h2 style={h2}>Cross-device RTT probe</h2>
        <p style={{ color: '#b9ac86', fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>Open this route on two devices with the same run ID and different device labels. Start the test on both. A peer appears after its hello broadcast; choose one and send a Ping/Pong. This measures round-trip time without comparing device clocks.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
          <label style={{ ...label, flex: '1 1 260px' }}>Target peer<select style={input} value={probeTarget} onChange={e => setProbeTarget(e.target.value)}><option value="">Select an online peer…</option>{peers.filter(p => !p.id.startsWith(`${deviceRef.current}-`)).map(p => <option key={p.id} value={p.id}>{p.label} · {p.id}</option>)}</select></label>
          <button style={buttonPrimary} onClick={() => void pingPeer()} disabled={status !== 'online' || !probeTarget}>Ping selected peer</button>
        </div>
        <p style={{ color: '#b9ac86', fontSize: 12 }}>Discovered peers: {peers.length ? peers.map(p => `${p.label} (${p.id})`).join(' · ') : 'none yet'}</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          ['Online clients', `${metrics.online}/${metrics.total}`], ['Position sends', String(metrics.totalSent)], ['Position receives', String(metrics.totalReceived)], ['Sequence gaps', String(metrics.totalGaps)], ['Send/channel errors', String(metrics.totalErrors)], ['RTT P50 / P95', `${fmt(metrics.rttP50)} / ${fmt(metrics.rttP95)}`], ['Same-page dispatch P50 / P95', `${fmt(metrics.dispatchP50)} / ${fmt(metrics.dispatchP95)}`], ['FPS / frame interval P95', `${fps ?? '—'} / ${fmt(frameP95)}`],
        ].map(([k,v]) => <div key={k} style={{ ...panel, margin: 0, padding: 14 }}><div style={{ color: '#b9ac86', fontSize: 11, marginBottom: 8 }}>{k}</div><div style={{ fontSize: 20, fontWeight: 700, overflowWrap: 'anywhere' }}>{v}</div></div>)}
      </section>

      <section style={panel}>
        <h2 style={h2}>Per-client metrics</h2>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}><thead><tr>{['Client','Status','Sent','Received','Gaps','Errors','Dispatch P95','RTT P95'].map(x => <th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{botsRef.current.map(b => <tr key={b.id}><td style={td}>{b.id}</td><td style={td}>{b.status}</td><td style={td}>{b.sent}</td><td style={td}>{b.received}</td><td style={td}>{b.gaps}</td><td style={td}>{b.errors}</td><td style={td}>{fmt(percentile(b.dispatchMs,.95))}</td><td style={td}>{fmt(percentile(b.rtts,.95))}</td></tr>)}</tbody></table></div>
      </section>

      <section style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><h2 style={{ ...h2, marginBottom: 0 }}>Live logs · latest 80</h2><span style={{ color: '#b9ac86', fontSize: 12 }}>{logs.length} in memory (max {MAX_LOGS})</span></div>
        <p style={{ color: '#b9ac86', fontSize: 12 }}>Newest first. Export JSON for full analysis; the screen shows only the latest 80 entries.</p>
        <div style={{ maxHeight: 520, overflow: 'auto', background: '#050506', border: '1px solid #ffffff1a', borderRadius: 8, padding: 10 }}>
          {lastLogs.length === 0 ? <p style={{ color: '#777' }}>No events yet. Start the test to populate diagnostics.</p> : lastLogs.map((l, i) => <div key={`${l.elapsedMs}-${i}`} style={{ padding: '7px 0', borderBottom: '1px solid #ffffff12', fontSize: 11, lineHeight: 1.55, overflowWrap: 'anywhere' }}><span style={{ color: '#777' }}>+{l.elapsedMs}ms {l.t}</span> <b style={{ color: l.level === 'error' ? '#ff7777' : l.level === 'warn' ? '#ffca72' : l.level === 'metric' ? '#72c8ff' : '#66e3a1' }}>[{l.level}]</b> <b>{l.source}</b> <span>{l.event}</span>{l.detail && <div style={{ color: '#b9ac86', whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.detail)}</div>}</div>)}
        </div>
      </section>
      <footer style={{ color: '#888', fontSize: 12, lineHeight: 1.7, margin: '16px 2px' }}>
        Safety: uses only <code>vw-loadtest:{'{runId}'}</code>; it never joins production <code>vw:{'{roomCode}'}</code> channels. Start modestly. Bots are separate WebSocket clients but share the same device and network. Compare provider Realtime usage reports after the run; these browser logs cannot authoritatively calculate billable events.
      </footer>
    </div>
  </main>;
}

const panel: React.CSSProperties = { background: '#15130f', border: '1px solid #d8b55a44', borderRadius: 12, padding: 16, marginBottom: 14 };
const h2: React.CSSProperties = { fontSize: 16, margin: '0 0 14px', color: '#e4c875' };
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, color: '#c9bd9b', fontSize: 12 };
const input: React.CSSProperties = { background: '#080808', color: '#f4ecd8', border: '1px solid #ffffff2b', borderRadius: 8, padding: '10px 11px', minWidth: 0, width: '100%' };
const button: React.CSSProperties = { background: '#24211a', color: '#f4ecd8', border: '1px solid #d8b55a66', borderRadius: 8, padding: '10px 13px', cursor: 'pointer' };
const buttonPrimary: React.CSSProperties = { ...button, background: '#d8b55a', color: '#171206', fontWeight: 800 };
const th: React.CSSProperties = { color: '#d8b55a', padding: 8, borderBottom: '1px solid #ffffff2b', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: 8, borderBottom: '1px solid #ffffff12', whiteSpace: 'nowrap' };
