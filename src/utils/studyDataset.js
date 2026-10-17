// Imported words can reuse LEAP IDs; their progress must never enter the shared LEAP namespace.
let imported = false

export function isImportedDataset() { return imported }
export function setImportedDataset(value) { imported = Boolean(value) }
