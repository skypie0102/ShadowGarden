// Continuous core owns initialization, navigation generations and destruction.
// Other reader modules only observe them; none is stored on the vendor manager.
const states = new WeakMap();

function stateFor(manager) {
  let state = states.get(manager);
  if (!state) {
    state = { generation: undefined, destroyed: false };
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
