// 多人完賽分數合併：唔可以用過期嘅中途答題數蓋過較完整成績。
// 純函式，可供課堂遊戲同 headless 測試共用。

export function coerceCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return null;
}

export function normalizeQuizScore(src = {}, source = src.source || 'state') {
  let answered = coerceCount(src.answered);
  let correct = coerceCount(src.correct);
  if (answered == null && correct == null) {
    return { correct: null, answered: null, source, complete: false };
  }
  if (answered == null && correct != null) answered = correct;
  if (correct == null && answered != null) correct = 0;
  if (correct > answered) correct = answered;
  return { correct, answered, source, complete: true };
}

function sourceRank(source) {
  if (source === 'finish') return 3;
  if (source === 'score') return 2;
  if (source === 'state') return 1;
  return 0;
}

export function isBetterScore(next, prev) {
  if (!next || !next.complete) return false;
  if (!prev || !prev.complete) return true;
  if (next.answered !== prev.answered) return next.answered > prev.answered;
  if (next.correct !== prev.correct) return next.correct > prev.correct;
  return sourceRank(next.source) > sourceRank(prev.source);
}

export function mergeQuizScore(prev, incoming, source = 'state') {
  const next = normalizeQuizScore(incoming, source);
  const cur = prev ? normalizeQuizScore(prev, prev.source || 'state') : null;
  if (isBetterScore(next, cur)) {
    return { correct: next.correct, answered: next.answered, source: next.source };
  }
  if (cur && cur.complete) return { correct: cur.correct, answered: cur.answered, source: cur.source };
  if (next.complete) return { correct: next.correct, answered: next.answered, source: next.source };
  return { correct: 0, answered: 0, source: 'none' };
}

export function applyQuizCounts(target, incoming, source = 'state') {
  if (!target) return null;
  const merged = mergeQuizScore(
    { correct: target.correct, answered: target.answered, source: target.scoreSource },
    incoming,
    source
  );
  target.correct = merged.correct;
  target.answered = merged.answered;
  target.scoreSource = merged.source;
  return merged;
}

export function upsertHumanResult(list, entry, source = 'state') {
  const rows = list || [];
  const incoming = { ...entry };
  const quiz = mergeQuizScore(
    null,
    { correct: incoming.correct, answered: incoming.answered, source: incoming.scoreSource },
    incoming.scoreSource || source
  );
  incoming.correct = quiz.correct;
  incoming.answered = quiz.answered;
  incoming.scoreSource = quiz.source;
  const idx = rows.findIndex((r) => r.slot === incoming.slot);
  if (idx < 0) {
    rows.push({ ...incoming });
    return rows;
  }
  const prev = rows[idx];
  const mergedQuiz = mergeQuizScore(prev, incoming, incoming.scoreSource || source);
  rows[idx] = {
    ...prev,
    ...incoming,
    correct: mergedQuiz.correct,
    answered: mergedQuiz.answered,
    scoreSource: mergedQuiz.source,
    name: incoming.name || prev.name,
    finishOrder: incoming.finishOrder || prev.finishOrder,
    time: incoming.time != null ? incoming.time : prev.time,
    progress: incoming.progress != null ? incoming.progress : prev.progress
  };
  return rows;
}

export function mergeStandingsLists(primary = [], secondary = []) {
  const bySlot = new Map();
  for (const row of secondary) upsertHumanResult(bySlotToList(bySlot), row, row.scoreSource || 'state');
  // above helper uses array; simpler:
  const list = [];
  for (const row of secondary) upsertHumanResult(list, row, row.scoreSource || 'state');
  for (const row of primary) upsertHumanResult(list, row, row.scoreSource || 'state');
  return list;
}

function bySlotToList(map) {
  return [];
}

export function resolveHumanScore(slot, { kart, result, localSlot, localCorrect, localAnswered, isPlayer } = {}) {
  let acc = { correct: 0, answered: 0, source: 'none' };
  if (result) acc = mergeQuizScore(acc, result, result.scoreSource || 'finish');
  if (kart) acc = mergeQuizScore(acc, kart, kart.scoreSource || 'state');
  if (isPlayer || slot === localSlot) {
    acc = mergeQuizScore(acc, { correct: localCorrect, answered: localAnswered }, 'score');
  }
  return acc;
}

export function buildHumanStandings({
  karts = [],
  results = [],
  localSlot = 0,
  localCorrect = 0,
  localAnswered = 0,
  raceElapsed = 0
} = {}) {
  const resultBySlot = new Map((results || []).map((r) => [r.slot, r]));
  const humans = (karts || []).filter((k) => k && !k.isAi);
  const ordered = humans.slice().sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTime || 0) - (b.finishTime || 0) || (a.finishOrder || 0) - (b.finishOrder || 0);
    }
    if (!!a.finished !== !!b.finished) return a.finished ? -1 : 1;
    return (b.totalProgress || 0) - (a.totalProgress || 0);
  });
  const standings = ordered.map((h, idx) => {
    const prev = resultBySlot.get(h.slot);
    const quiz = resolveHumanScore(h.slot, {
      kart: h,
      result: prev,
      localSlot,
      localCorrect,
      localAnswered,
      isPlayer: !!h.isPlayer
    });
    return {
      slot: h.slot,
      name: h.name || (prev && prev.name) || '同學',
      finishOrder: idx + 1,
      time: h.finishTime || (prev && prev.time) || raceElapsed,
      correct: quiz.correct,
      answered: quiz.answered,
      scoreSource: quiz.source,
      progress: h.totalProgress || (prev && prev.progress) || 0
    };
  });
  // include any result-only humans missing from kart list
  for (const row of results || []) {
    if (standings.some((s) => s.slot === row.slot)) continue;
    const quiz = resolveHumanScore(row.slot, { result: row, localSlot, localCorrect, localAnswered });
    standings.push({
      slot: row.slot,
      name: row.name || '同學',
      finishOrder: row.finishOrder || (standings.length + 1),
      time: row.time || raceElapsed,
      correct: quiz.correct,
      answered: quiz.answered,
      scoreSource: quiz.source,
      progress: row.progress || 0
    });
  }
  standings.sort((a, b) => a.finishOrder - b.finishOrder);
  return standings;
}

export function mergeHostStandings(hostStandings, localRows) {
  return mergeStandingsLists(hostStandings || [], localRows || []).sort((a, b) => (a.finishOrder || 99) - (b.finishOrder || 99));
}
