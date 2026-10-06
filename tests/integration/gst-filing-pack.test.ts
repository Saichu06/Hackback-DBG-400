import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/app.js';
import { createInMemoryDb, setDb } from '../../src/database/db.js';
import { seedDatabase } from '../../src/database/seed.js';
import { GstReportService, GstReportError, currentMonth } from '../../src/modules/reports/gst-report.service.js';
import { InvoiceService } from '../../src/modules/invoices/invoice.service.js';

describe('GST Filing Pack', () => {
  let db: Database.Database;
  let app: any;
  let adminToken: string;
  let acmeId: number; // intra-state customer (state 27, same as shop)
  let apexId: number; // inter-state customer (state 29)

  beforeEach(async () => {
    db = createInMemoryDb();
    setDb(db);
    seedDatabase(db); // zero ledger impact: accounts, admin, GST-ready contacts, shop settings
    app = createApp();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'securepassword123' });
    adminToken = res.body.token;

    acmeId = (db.prepare("SELECT id FROM contacts WHERE name = 'ACME Corp'").get() as { id: number }).id;
    apexId = (db.prepare("SELECT id FROM contacts WHERE name = 'Apex Retail'").get() as { id: number }).id;
  });

  const admin = () => (db.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number }).id;

  it('matches hand-calculated totals for a 5% intra-state, 18% intra-state, and 18% inter-state invoice', () => {
    // 5% intra-state: taxable 200000, tax 10000 -> CGST 5000 / SGST 5000
    InvoiceService.deliverInvoice(
      InvoiceService.createInvoice(
        { customer_id: acmeId, invoice_no: 'T-5PCT', total_amount: 210000, entries: [{ amount: 200000, tax_rate: 500, tax_amount: 10000, hsn_code: '1111' }] },
        admin(),
        db
      ).id,
      db
    );

    // 18% intra-state: taxable 500000, tax 90000 -> CGST 45000 / SGST 45000
    InvoiceService.deliverInvoice(
      InvoiceService.createInvoice(
        { customer_id: acmeId, invoice_no: 'T-18PCT-INTRA', total_amount: 590000, entries: [{ amount: 500000, tax_rate: 1800, tax_amount: 90000, hsn_code: '1111' }] },
        admin(),
        db
      ).id,
      db
    );

    // 18% inter-state: taxable 300000, tax 54000 -> IGST 54000
    InvoiceService.deliverInvoice(
      InvoiceService.createInvoice(
        { customer_id: apexId, invoice_no: 'T-18PCT-INTER', total_amount: 354000, entries: [{ amount: 300000, tax_rate: 1800, tax_amount: 54000, hsn_code: '1111' }] },
        admin(),
        db
      ).id,
      db
    );

    const pack = GstReportService.getFilingPack(currentMonth(), db);

    const fivePct = pack.by_rate.find((r) => r.rate_bp === 500 && r.line_type === 'intra-state');
    expect(fivePct).toBeDefined();
    expect(fivePct).toMatchObject({ invoice_count: 1, taxable_paise: 200000, cgst_paise: 5000, sgst_paise: 5000, igst_paise: 0, total_tax_paise: 10000 });

    const eighteenIntra = pack.by_rate.find((r) => r.rate_bp === 1800 && r.line_type === 'intra-state');
    expect(eighteenIntra).toMatchObject({ invoice_count: 1, taxable_paise: 500000, cgst_paise: 45000, sgst_paise: 45000, igst_paise: 0, total_tax_paise: 90000 });

    const eighteenInter = pack.by_rate.find((r) => r.rate_bp === 1800 && r.line_type === 'inter-state');
    expect(eighteenInter).toMatchObject({ invoice_count: 1, taxable_paise: 300000, cgst_paise: 0, sgst_paise: 0, igst_paise: 54000, total_tax_paise: 54000 });

    // Ledger tie-out: CGST = 5000+45000 = 50000; SGST = 50000; IGST = 54000 — and it must match the ledger exactly.
    expect(pack.tie_out.cgst).toEqual({ report_paise: 50000, ledger_paise: 50000, ok: true });
    expect(pack.tie_out.sgst).toEqual({ report_paise: 50000, ledger_paise: 50000, ok: true });
    expect(pack.tie_out.igst).toEqual({ report_paise: 54000, ledger_paise: 54000, ok: true });
  });

  it('excludes a voided invoice from the report while the tie-out stays OK', () => {
    const kept = InvoiceService.createInvoice(
      { customer_id: acmeId, invoice_no: 'T-KEEP', total_amount: 118000, entries: [{ amount: 100000, tax_rate: 1800, tax_amount: 18000, hsn_code: '2222' }] },
      admin(),
      db
    );
    InvoiceService.deliverInvoice(kept.id, db);

    const voided = InvoiceService.createInvoice(
      { customer_id: acmeId, invoice_no: 'T-VOID', total_amount: 59000, entries: [{ amount: 50000, tax_rate: 1800, tax_amount: 9000, hsn_code: '2222' }] },
      admin(),
      db
    );
    InvoiceService.deliverInvoice(voided.id, db);
    InvoiceService.voidInvoice(voided.id, db);

    const pack = GstReportService.getFilingPack(currentMonth(), db);

    // Only the kept invoice's 100000 taxable value should show — the voided invoice's 50000 must not.
    const row = pack.by_rate.find((r) => r.rate_bp === 1800 && r.line_type === 'intra-state');
    expect(row?.invoice_count).toBe(1);
    expect(row?.taxable_paise).toBe(100000);
    expect(row?.cgst_paise).toBe(9000);
    expect(row?.sgst_paise).toBe(9000);

    // Tie-out must still hold: the void's reversal zeroed its ledger contribution too.
    expect(pack.tie_out.cgst.ok).toBe(true);
    expect(pack.tie_out.sgst.ok).toBe(true);
    expect(pack.tie_out.cgst.report_paise).toBe(9000);
    expect(pack.tie_out.cgst.ledger_paise).toBe(9000);
  });

  it('surfaces a line with no HSN code under "(missing HSN)" instead of dropping it', () => {
    const inv = InvoiceService.createInvoice(
      {
        customer_id: acmeId,
        invoice_no: 'T-NO-HSN',
        total_amount: 118000,
        entries: [{ amount: 100000, tax_rate: 1800, tax_amount: 18000, hsn_code: null }],
      },
      admin(),
      db
    );
    InvoiceService.deliverInvoice(inv.id, db);

    const pack = GstReportService.getFilingPack(currentMonth(), db);
    const missing = pack.by_hsn.find((h) => h.hsn_code === '(missing HSN)');
    expect(missing).toBeDefined();
    expect(missing?.taxable_paise).toBe(100000);
    expect(missing?.total_tax_paise).toBe(18000);
  });

  it('returns zero totals and an empty breakdown for a month with no invoices', () => {
    const pack = GstReportService.getFilingPack('2019-01', db);
    expect(pack.by_rate).toEqual([]);
    expect(pack.by_hsn).toEqual([]);
    expect(pack.tie_out.cgst).toEqual({ report_paise: 0, ledger_paise: 0, ok: true });
    expect(pack.tie_out.sgst).toEqual({ report_paise: 0, ledger_paise: 0, ok: true });
    expect(pack.tie_out.igst).toEqual({ report_paise: 0, ledger_paise: 0, ok: true });
  });

  it('rejects an invalid month at the service level with ERR_INVALID_MONTH', () => {
    expect(() => GstReportService.getFilingPack('2026-13', db)).toThrow(GstReportError);
    try {
      GstReportService.getFilingPack('not-a-month', db);
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('ERR_INVALID_MONTH');
    }
  });

  it('GET /api/v1/reports/gst returns 400 ERR_INVALID_MONTH for a bad month over HTTP', async () => {
    const res = await request(app)
      .get('/api/v1/reports/gst?month=2026-13')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ERR_INVALID_MONTH');
  });

  it('GET /api/v1/reports/gst defaults to the current month and returns the three blocks', async () => {
    InvoiceService.deliverInvoice(
      InvoiceService.createInvoice(
        { customer_id: acmeId, invoice_no: 'T-HTTP-1', total_amount: 118000, entries: [{ amount: 100000, tax_rate: 1800, tax_amount: 18000, hsn_code: '3333' }] },
        admin(),
        db
      ).id,
      db
    );

    const res = await request(app).get('/api/v1/reports/gst').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.month).toBe(currentMonth());
    expect(res.body.by_rate.length).toBeGreaterThan(0);
    expect(res.body.tie_out.cgst.ok).toBe(true);
  });

  it('GET /api/v1/reports/gst.csv returns a text/csv download with the same totals', async () => {
    const res = await request(app).get('/api/v1/reports/gst.csv').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('GST Filing Pack');
    expect(res.text).toContain('Ledger Tie-Out');
  });

  it('rejects Staff from the GST Filing Pack endpoint with 403', async () => {
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'staff-gst@example.com', password: 'password123', role: 'Staff' });

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff-gst@example.com', password: 'password123' });

    const res = await request(app)
      .get('/api/v1/reports/gst')
      .set('Authorization', `Bearer ${staffLogin.body.token}`);

    expect(res.status).toBe(403);
  });
});
