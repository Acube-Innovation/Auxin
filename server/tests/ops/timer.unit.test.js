// Unit tests for the task timer: Start / Hold / Stop (no database).
// Run: npm run test:ops   (from server/)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const VoyageTask = require('../../models/ops/VoyageTask');
const { applyTimerAction, stopOnClose, actualSeconds } = require('../../services/ops/taskTimer');

const at = (hhmm) => new Date(`2026-10-07T${hhmm}:00Z`);
const newTask = () => new VoyageTask({ voyage: new mongoose.Types.ObjectId(), name: 'Read Cargo Recap', status: 'INITIATED', plannedHours: 3 });

test('start 09:00, hold 10:00, start 11:00, stop 12:00 = 2 hours (time on hold not counted)', () => {
  const t = newTask();
  applyTimerAction(t, 'start', null, at('09:00'));
  applyTimerAction(t, 'hold', null, at('10:00'));
  assert.equal(t.timer.state, 'HELD');
  assert.equal(actualSeconds(t, at('10:59')), 3600, 'nothing counts while on hold');
  applyTimerAction(t, 'start', null, at('11:00'));
  assert.equal(actualSeconds(t, at('11:30')), 5400, 'the running period counts live');
  const entry = applyTimerAction(t, 'stop', null, at('12:00'));
  assert.equal(t.timer.state, 'STOPPED');
  assert.equal(t.workedSeconds, 7200);
  assert.equal(actualSeconds(t, at('18:00')), 7200);
  assert.equal(t.timeLog.length, 2);
  assert.ok(t.timeLog.every((p) => p.start && p.end));
  assert.match(entry.note, /worked 2h 00m/);
});

test('stop straight from hold adds nothing more; restarting after stop keeps adding', () => {
  const t = newTask();
  applyTimerAction(t, 'start', null, at('09:00'));
  applyTimerAction(t, 'hold', null, at('09:45'));
  applyTimerAction(t, 'stop', null, at('15:00'));
  assert.equal(t.workedSeconds, 45 * 60);
  applyTimerAction(t, 'start', null, at('16:00'));
  applyTimerAction(t, 'stop', null, at('16:15'));
  assert.equal(t.workedSeconds, 60 * 60);
});

test('invalid moves are refused', () => {
  const t = newTask();
  assert.throws(() => applyTimerAction(t, 'hold', null, at('09:00')), /Only a running timer/);
  assert.throws(() => applyTimerAction(t, 'stop', null, at('09:00')), /Start the timer first/);
  applyTimerAction(t, 'start', null, at('09:00'));
  assert.throws(() => applyTimerAction(t, 'start', null, at('09:10')), /already running/);
  assert.throws(() => applyTimerAction(t, 'pause', null, at('09:10')), /action must be/);
  t.status = 'DONE';
  assert.throws(() => applyTimerAction(t, 'hold', null, at('09:10')), /Re-open/);
});

test('closing a task stops a running or held timer', () => {
  const t = newTask();
  assert.equal(stopOnClose(t, at('09:00')), null, 'never started: nothing to do');
  applyTimerAction(t, 'start', null, at('09:00'));
  const entry = stopOnClose(t, at('09:30'));
  assert.equal(entry.to, 'STOPPED');
  assert.equal(t.workedSeconds, 1800);
});
