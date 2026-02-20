import { nanoid } from 'nanoid';

// Validates the prefixed ID format used throughout the storage layer.
// Pattern: lowercase prefix, underscore separator, nanoid suffix (URL-safe chars).
const ID_PATTERN = /^[a-z]+_[A-Za-z0-9_-]+$/;

export function generateId(prefix) {
  return `${prefix}_${nanoid(10)}`;
}

export function validateId(id) {
  return ID_PATTERN.test(id);
}
