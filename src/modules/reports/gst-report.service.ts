import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';

export class GstReportError extends Error {
  public statusCode: number;
  public errorCode: string;
  constructor(message: string, statusCode: number = 400, errorCode: string = 'ERR_INVALID_MONTH') {
    super(message);
    this.name = 'GstReportError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export interface GstByRateRow {
  rate_bp: number;
  line_type: 'intra-state' | 'inter-state';
  invoice_count: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_tax_paise: number;
}

export interface GstByHsnRow {
  hsn_code: string;
  description: string | null;
  quantity: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_tax_paise: number;
}

export interface GstTieOutEntry {
  report_paise: number;
  ledger_paise: number;
  ok: boolean;
}

export interface GstFilingPack {
  month: string;
  by_rate: GstByRateRow[];
  by_hsn: GstByHsnRow[];
  tie_out: {
    cgst: GstTieOutEntry;
    sgst: GstTieOutEntry;
    igst: GstTieOutEntry;
  };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function validateMonth(month: string): void {
  if (!MONTH_RE.test(month)) {
    throw new GstReportError('month must be a valid YYYY-MM value');
  }
}

interface GstLineRow {
  taxable: number;
  rate_bp: number | null;
  hsn_code: string | null;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  reference_id: number;
}

export class GstReportService {
  /**
   * Builds the GST Filing Pack (docs/API.md, docs/ARCHITECTURE.md §8): a read-only query over
   * invoice lines (by_rate, by_hsn) and journal lines (tie_out). Nothing is cached — every call
   * re-sums fresh (docs/DATA_MODEL.md §3).
   */
  public static getFilingPack(month: string, dbInstance?: Database.Database): GstFilingPack {
    validateMonth(month);
    const db = dbInstance || getDb();

    // Only Delivered/Partially Paid/Paid invoices dated this month count. Draft (never posted)
    // and Voided (reversed to zero) are excluded — see docs/ARCHITECTURE.md §8.
    const lines = db
      .prepare(
        `SELECT ie.amount as taxable, ie.tax_rate as rate_bp, ie.hsn_code,
                ie.cgst_paise, ie.sgst_paise, ie.igst_paise, ie.reference_id
         FROM items_entries ie
         JOIN sales_invoices si ON si.id = ie.reference_id
         WHERE ie.reference_type = 'SaleInvoice'
           AND si.status IN ('Delivered', 'Partially Paid', 'Paid')
           AND strftime('%Y-%m', si.created_at) = ?
           AND (ie.cgst_paise > 0 OR ie.sgst_paise > 0 OR ie.igst_paise > 0)`
      )
      .all(month) as GstLineRow[];

    // --- Block A: tax by rate, split by intra-state vs inter-state ---
    const rateGroups = new Map<
      string,
      GstByRateRow & { invoiceIds: Set<number> }
    >();
    for (const l of lines) {
      const lineType: 'intra-state' | 'inter-state' =
        l.cgst_paise > 0 || l.sgst_paise > 0 ? 'intra-state' : 'inter-state';
      const key = `${l.rate_bp}|${lineType}`;
      if (!rateGroups.has(key)) {
        rateGroups.set(key, {
          rate_bp: l.rate_bp ?? 0,
          line_type: lineType,
          invoice_count: 0,
          taxable_paise: 0,
          cgst_paise: 0,
          sgst_paise: 0,
          igst_paise: 0,
          total_tax_paise: 0,
          invoiceIds: new Set(),
        });
      }
      const row = rateGroups.get(key)!;
      row.taxable_paise += l.taxable;
      row.cgst_paise += l.cgst_paise;
      row.sgst_paise += l.sgst_paise;
      row.igst_paise += l.igst_paise;
      row.total_tax_paise += l.cgst_paise + l.sgst_paise + l.igst_paise;
      row.invoiceIds.add(l.reference_id);
    }
    const by_rate: GstByRateRow[] = [...rateGroups.values()]
      .map(({ invoiceIds, ...rest }) => ({ ...rest, invoice_count: invoiceIds.size }))
      .sort((a, b) => a.rate_bp - b.rate_bp || a.line_type.localeCompare(b.line_type));

    // --- Block B: HSN summary. A line with no HSN code is surfaced, never dropped. ---
    const hsnGroups = new Map<string, GstByHsnRow>();
    for (const l of lines) {
      const code = l.hsn_code && l.hsn_code.trim() ? l.hsn_code : '(missing HSN)';
      if (!hsnGroups.has(code)) {
        hsnGroups.set(code, {
          hsn_code: code,
          description: null,
          quantity: 0,
          taxable_paise: 0,
          cgst_paise: 0,
          sgst_paise: 0,
          igst_paise: 0,
          total_tax_paise: 0,
        });
      }
      const row = hsnGroups.get(code)!;
      row.quantity += 1; // proxy: number of invoice lines for this HSN this month (no product/quantity catalog — see DATA_MODEL.md §3)
      row.taxable_paise += l.taxable;
      row.cgst_paise += l.cgst_paise;
      row.sgst_paise += l.sgst_paise;
      row.igst_paise += l.igst_paise;
      row.total_tax_paise += l.cgst_paise + l.sgst_paise + l.igst_paise;
    }
    const by_hsn = [...hsnGroups.values()].sort((a, b) => b.total_tax_paise - a.total_tax_paise);

    // --- Block C: ledger tie-out. Credit minus debit on the 3 payable accounts, same month. ---
    const ledgerRows = db
      .prepare(
        `SELECT a.code as code, COALESCE(SUM(t.credit), 0) - COALESCE(SUM(t.debit), 0) as movement
         FROM accounts a
         LEFT JOIN accounts_transactions t
           ON t.account_id = a.id AND strftime('%Y-%m', t.created_at) = ?
         WHERE a.code IN ('2101', '2102', '2103')
         GROUP BY a.code`
      )
      .all(month) as { code: string; movement: number }[];

    const ledgerByCode: Record<string, number> = {};
    for (const r of ledgerRows) ledgerByCode[r.code] = r.movement;

    const reportCgst = by_rate.reduce((sum, r) => sum + r.cgst_paise, 0);
    const reportSgst = by_rate.reduce((sum, r) => sum + r.sgst_paise, 0);
    const reportIgst = by_rate.reduce((sum, r) => sum + r.igst_paise, 0);

    const makeTieOut = (reportPaise: number, code: string): GstTieOutEntry => {
      const ledgerPaise = ledgerByCode[code] ?? 0;
      return { report_paise: reportPaise, ledger_paise: ledgerPaise, ok: reportPaise === ledgerPaise };
    };

    return {
      month,
      by_rate,
      by_hsn,
      tie_out: {
        cgst: makeTieOut(reportCgst, '2101'),
        sgst: makeTieOut(reportSgst, '2102'),
        igst: makeTieOut(reportIgst, '2103'),
      },
    };
  }

  /** Flattens the three blocks into a single CSV, per docs/API.md. */
  public static toCsv(pack: GstFilingPack): string {
    const rows: string[] = [];
    rows.push(`GST Filing Pack,${pack.month}`);
    rows.push('');
    rows.push('Tax by Rate');
    rows.push('Rate (bp),Line Type,Invoices,Taxable (paise),CGST (paise),SGST (paise),IGST (paise),Total Tax (paise)');
    for (const r of pack.by_rate) {
      rows.push(
        `${r.rate_bp},${r.line_type},${r.invoice_count},${r.taxable_paise},${r.cgst_paise},${r.sgst_paise},${r.igst_paise},${r.total_tax_paise}`
      );
    }
    rows.push('');
    rows.push('HSN Summary');
    rows.push('HSN Code,Quantity,Taxable (paise),CGST (paise),SGST (paise),IGST (paise),Total Tax (paise)');
    for (const h of pack.by_hsn) {
      rows.push(
        `"${h.hsn_code}",${h.quantity},${h.taxable_paise},${h.cgst_paise},${h.sgst_paise},${h.igst_paise},${h.total_tax_paise}`
      );
    }
    rows.push('');
    rows.push('Ledger Tie-Out');
    rows.push('Tax Type,Report (paise),Ledger (paise),Match');
    rows.push(`CGST,${pack.tie_out.cgst.report_paise},${pack.tie_out.cgst.ledger_paise},${pack.tie_out.cgst.ok ? 'OK' : 'MISMATCH'}`);
    rows.push(`SGST,${pack.tie_out.sgst.report_paise},${pack.tie_out.sgst.ledger_paise},${pack.tie_out.sgst.ok ? 'OK' : 'MISMATCH'}`);
    rows.push(`IGST,${pack.tie_out.igst.report_paise},${pack.tie_out.igst.ledger_paise},${pack.tie_out.igst.ok ? 'OK' : 'MISMATCH'}`);
    return rows.join('\n');
  }
}
