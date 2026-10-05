/**
 * Build-time kill switch for iCloud sync. Nothing in the product reads it yet:
 * P1 (schema, stamping, merge) is inert, and the later phases (engine, plugin,
 * Settings) must gate on this so a build can ship with sync compiled out.
 * See docs/ICLOUD_SYNC_DESIGN.md.
 */
export const SYNC_ENABLED = false;
