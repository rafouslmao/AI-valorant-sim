import { loadFromSlot, saveToSlot } from './storage.js';

let world = loadFromSlot();

export function getWorld() {
  return world;
}

export function setWorld(next) {
  world = next;
  if (world) saveToSlot(world);
}

export function mutateWorld(mutator) {
  if (!world) return;
  mutator(world);
  saveToSlot(world);
}

export function clearWorld() {
  world = null;
}
