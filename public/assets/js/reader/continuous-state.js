// Continuous core owns lifetime transitions and buffer/trim bookkeeping.
// Core and rendition share input suppression and the owned scroll reporter.
const states = new WeakMap();

function stateFor(manager) {
  let state = states.get(manager);
  if (!state) {
    state = {
      generation: undefined,
      destroyed: false,
      buffer: { promise: undefined, generation: undefined, again: undefined, trimTimer: undefined },
      input: { suppressScrollUntil: undefined, lastUserScrollAt: undefined, onScrolled: undefined, stabilized: undefined }
    };
    states.set(manager, state);
  }
  return state;
}

// Preserve the pre-install undefined generation, including non-Continuous views.
// Reading state neither installs a manager nor creates a new lifetime.
export function continuousGeneration(manager) {
  return states.get(manager)?.generation;
}

export function isContinuousDestroyed(manager) {
  return states.get(manager)?.destroyed === true;
}

// Only Continuous core mutates this record. Keep it stable across navigation
// and teardown so a late task can compare ownership with the current promise.
export function continuousBufferState(manager) {
  return stateFor(manager).buffer;
}

// Core records input/reporter state; rendition restores and guards scrolling.
// Vendor geometry and boolean scroll bookkeeping remain on the manager.
export function continuousInputState(manager) {
  return stateFor(manager).input;
}

// Passive observation preserves the exact task identity and creates no state.
export function pendingContinuousBuffer(manager) {
  return states.get(manager)?.buffer.promise;
}

export function initializeContinuousState(manager) {
  const state = stateFor(manager);
  state.destroyed = false;
  state.generation = 0;
}

export function advanceContinuousGeneration(manager) {
  const state = stateFor(manager);
  state.generation = (state.generation || 0) + 1;
  return state.generation;
}

export function destroyContinuousState(manager) {
  stateFor(manager).destroyed = true;
  advanceContinuousGeneration(manager);
}
