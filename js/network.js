// 乘數衝鋒車連線層：Supabase Realtime Broadcast（WSS / 443）
// 房間頻道：cwsj-mk8-<4位數房號>。未設定金鑰時可預覽大廳，但不會真正連線。

import { createClient } from '../vendor/supabase/supabase-js.module.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './net-config.js';

export function isNetConfigured(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
  const u = String(url || '').trim();
  const k = String(key || '').trim();
  if (!u || !k) return false;
  if (u.includes('YOUR_PROJECT') || k.includes('YOUR_ANON_KEY')) return false;
  return true;
}

function randomRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function randomPeerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class KartNetworkManager {
  constructor() {
    this.client = null;
    this.channel = null;
    this.isHost = false;
    this.connected = false;
    this.configured = isNetConfigured();
    this.roomCode = '';
    this.mySlot = 0;
    this.peerId = randomPeerId();
    this.localProfile = null;
    this.remoteStates = new Map();
    this.syncTimer = null;
    this.aiSyncTimer = null;
    this.handlers = {};
    this._getLocalState = null;
    this._getAiStates = null;
    this.previewOnly = false;
  }

  isReady() {
    return this.connected && !this.previewOnly;
  }

  _ensureClient() {
    this.configured = isNetConfigured();
    if (!this.configured) {
      const err = new Error('NOT_CONFIGURED');
      err.code = 'NOT_CONFIGURED';
      throw err;
    }
    if (!this.client) {
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 40 } }
      });
    }
    return this.client;
  }

  _emit(name, ...args) {
    const fn = this.handlers && this.handlers[name];
    if (typeof fn === 'function') fn(...args);
  }

  _onPayload(payload) {
    if (!payload || payload.from === this.peerId) return;
    if (payload.type === 'KART_STATE' && typeof payload.slot === 'number') {
      this.remoteStates.set(payload.slot, { ...payload, recvTime: performance.now() });
    }
    // 必須喺訊息回呼處理（唔只依賴 requestAnimationFrame），以免房主切換分頁時漏轉發／漏收事件
    this._emit('onMessage', payload);
  }

  async _subscribe(roomCode) {
    const client = this._ensureClient();
    const channelName = `cwsj-mk8-${roomCode}`;
    if (this.channel) {
      try { await client.removeChannel(this.channel); } catch (_) {}
      this.channel = null;
    }
    this.channel = client.channel(channelName, {
      config: { broadcast: { ack: false, self: false } }
    });
    this.channel.on('broadcast', { event: 'kart' }, ({ payload }) => {
      this._onPayload(payload);
    });
    const status = await new Promise((resolve) => {
      let settled = false;
      const finish = (s) => { if (!settled) { settled = true; resolve(s); } };
      this.channel.subscribe((s) => {
        if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') finish(s);
      });
      setTimeout(() => finish('TIMED_OUT'), 8000);
    });
    if (status !== 'SUBSCRIBED') {
      const err = new Error('SUBSCRIBE_FAILED');
      err.code = 'SUBSCRIBE_FAILED';
      err.status = status;
      throw err;
    }
    this.connected = true;
    this.previewOnly = false;
  }

  async createRoom(profile, handlers = {}) {
    await this.disconnect({ silent: true });
    this.handlers = handlers;
    this.isHost = true;
    this.mySlot = 0;
    this.roomCode = randomRoomCode();
    this.peerId = randomPeerId();
    this.localProfile = { ...profile, slot: 0, isHost: true, ready: true };
    this.remoteStates.clear();
    this.configured = isNetConfigured();

    if (!this.configured) {
      this.previewOnly = true;
      this.connected = false;
      this._emit('onRoomReady', this.roomCode, { preview: true, configured: false });
      return { preview: true, configured: false, roomCode: this.roomCode };
    }

    try {
      await this._subscribe(this.roomCode);
      this._emit('onRoomReady', this.roomCode, { preview: false, configured: true });
      return { preview: false, configured: true, roomCode: this.roomCode };
    } catch (err) {
      this.connected = false;
      this._emit('onError', err);
      throw err;
    }
  }

  async joinRoom(code, profile, handlers = {}) {
    await this.disconnect({ silent: true });
    this.handlers = handlers;
    this.isHost = false;
    this.mySlot = -1;
    this.roomCode = String(code || '').trim();
    this.peerId = randomPeerId();
    this.localProfile = { ...profile, isHost: false, ready: true };
    this.remoteStates.clear();
    this.configured = isNetConfigured();

    if (!/^\d{4}$/.test(this.roomCode)) {
      const err = new Error('INVALID_CODE');
      err.code = 'INVALID_CODE';
      this._emit('onError', err);
      throw err;
    }
    if (!this.configured) {
      this.previewOnly = true;
      this.connected = false;
      const err = new Error('NOT_CONFIGURED');
      err.code = 'NOT_CONFIGURED';
      this._emit('onError', err);
      throw err;
    }

    try {
      await this._subscribe(this.roomCode);
      this.send({ type: 'JOIN', profile: this.localProfile });
      return { preview: false, configured: true, roomCode: this.roomCode };
    } catch (err) {
      this.connected = false;
      this._emit('onError', err);
      throw err;
    }
  }

  assignJoinedSlot(slot) {
    this.mySlot = slot;
    if (this.localProfile) this.localProfile.slot = slot;
    this._emit('onJoined', slot, this.roomCode);
  }

  send(payload) {
    if (!this.channel || !this.connected || this.previewOnly) return Promise.resolve(false);
    const msg = { ...payload, from: this.peerId, t: Date.now() };
    try {
      return this.channel.send({ type: 'broadcast', event: 'kart', payload: msg });
    } catch (_) {
      return Promise.resolve(false);
    }
  }

  // 20 Hz（每 50 ms）同步，用 setInterval 而唔只依賴 rAF，減少分頁節流影響
  startSyncLoop(getLocalState, getAiStates = null) {
    this.stopSyncLoop();
    this._getLocalState = getLocalState;
    this._getAiStates = getAiStates;
    const tick = () => {
      if (!this.isReady() || typeof this._getLocalState !== 'function') return;
      const state = this._getLocalState();
      if (state) this.send({ type: 'KART_STATE', ...state });
      if (this.isHost && typeof this._getAiStates === 'function') {
        const aiList = this._getAiStates() || [];
        for (const aiState of aiList) this.send({ type: 'KART_STATE', ...aiState });
      }
    };
    this.syncTimer = setInterval(tick, 50);
    tick();
  }

  stopSyncLoop() {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
    if (this.aiSyncTimer) { clearInterval(this.aiSyncTimer); this.aiSyncTimer = null; }
  }

  async disconnect({ silent = false } = {}) {
    this.stopSyncLoop();
    this.connected = false;
    this.previewOnly = false;
    const channel = this.channel;
    const client = this.client;
    this.channel = null;
    if (channel && client) {
      try { await client.removeChannel(channel); } catch (_) {}
    }
    this.remoteStates.clear();
    if (!silent) this._emit('onDisconnect');
    this.handlers = silent ? this.handlers : {};
  }
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
