import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';
import { ShopSettings } from '../../types/index.js';

/**
 * Single-row shop settings (docs/DATA_MODEL.md §3). Used only to decide whether a sale is
 * intra-state (CGST+SGST) or inter-state (IGST) for the GST Filing Pack. There is no API
 * endpoint for this on purpose (see PRD.md §2d) — it is seed-provided configuration, not a
 * user-facing settings screen, to keep this differentiator's scope tight.
 */
export class ShopSettingsService {
  public static get(dbInstance?: Database.Database): ShopSettings | null {
    const db = dbInstance || getDb();
    const row = db.prepare('SELECT id, gstin, state_code FROM shop_settings WHERE id = 1').get() as
      | ShopSettings
      | undefined;
    return row || null;
  }

  public static upsert(
    gstin: string | null,
    state_code: string | null,
    dbInstance?: Database.Database
  ): ShopSettings {
    const db = dbInstance || getDb();
    db.prepare(
      `INSERT INTO shop_settings (id, gstin, state_code) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET gstin = excluded.gstin, state_code = excluded.state_code`
    ).run(gstin, state_code);
    return { id: 1, gstin, state_code };
  }
}
