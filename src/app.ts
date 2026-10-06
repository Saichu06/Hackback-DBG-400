import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { authenticate, requireRoles } from './middlewares/auth.middleware.js';
import { AuthService } from './modules/auth/auth.service.js';
import { UserService } from './modules/users/user.service.js';
import { AccountService } from './modules/accounts/account.service.js';
import { ContactService } from './modules/contacts/contact.service.js';
import { InvoiceService } from './modules/invoices/invoice.service.js';
import { PaymentService } from './modules/payments/payment.service.js';
import { BillService } from './modules/bills/bill.service.js';
import { ManualJournalService } from './modules/manual-journals/manual-journal.service.js';
import { ReportService } from './modules/reports/report.service.js';
import { TestHarnessService } from './modules/test-harness/test-harness.service.js';
import { ChatbotService } from './modules/chatbot/chatbot.service.js';
import { GstReportService, currentMonth } from './modules/reports/gst-report.service.js';

export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'GST-Ready Accounting Ledger' });
  });

  // -------------------------------------------------------------
  // 1. Auth Endpoints
  // -------------------------------------------------------------
  app.post('/api/auth/login', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = AuthService.login(email, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------
  // 2. User Management (Admin only)
  // -------------------------------------------------------------
  app.post(
    '/api/users',
    authenticate,
    requireRoles('Admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password, role } = req.body;
        const result = UserService.createUser({ email, password, role });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    '/api/users',
    authenticate,
    requireRoles('Admin'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const users = UserService.listUsers();
        res.json(users);
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 3. Test Harness (Admin, test environment only)
  // -------------------------------------------------------------
  app.post(
    '/api/test/seed-random',
    authenticate,
    requireRoles('Admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (config.nodeEnv !== 'test') {
          res.status(403).json({ error: 'Endpoint available only in test environment' });
          return;
        }
        const { seed = config.test.seed, count = config.test.opsCount } = req.body;
        const result = await TestHarnessService.runRandomOperations(
          Number(seed),
          Number(count)
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 4. Accounts (Admin, Accountant, Staff)
  // -------------------------------------------------------------
  app.get(
    '/api/accounts',
    authenticate,
    requireRoles('Admin', 'Accountant', 'Staff'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const accounts = AccountService.listAccounts();
        res.json(accounts);
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 5. Contacts (Admin, Staff)
  // -------------------------------------------------------------
  app.get(
    '/api/contacts',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const contacts = ContactService.listContacts();
        res.json(contacts);
      } catch (err) {
        next(err);
      }
    }
  );

  // Additive convenience endpoint (not in API.md's core surface, but does not
  // change any documented contract): lets Admin/Staff add new customers or
  // vendors from the UI instead of relying solely on the seed data.
  app.post(
    '/api/contacts',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, contact_type } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
          res.status(400).json({ error: 'name is required' });
          return;
        }
        if (contact_type !== 'Customer' && contact_type !== 'Vendor') {
          res.status(400).json({ error: "contact_type must be 'Customer' or 'Vendor'" });
          return;
        }
        const contact = ContactService.createContact(name.trim(), contact_type);
        res.status(201).json(contact);
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 6. Sales Invoices (Admin, Staff)
  // -------------------------------------------------------------
  app.get(
    '/api/sale-invoices',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const invoices = InvoiceService.listInvoices();
        res.json(
          invoices.map((inv) => ({
            id: inv.id,
            invoice_no: inv.invoice_no,
            total_amount: inv.total_amount,
            status: inv.status,
          }))
        );
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/sale-invoices',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { customer_id, invoice_no, total_amount, entries } = req.body;
        const userId = req.user!.id;
        const result = InvoiceService.createInvoice(
          { customer_id, invoice_no, total_amount, entries },
          userId
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.put(
    '/api/sale-invoices/:id/deliver',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = parseInt(String(req.params.id), 10);
        const result = InvoiceService.deliverInvoice(id);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    '/api/sale-invoices/:id',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = parseInt(String(req.params.id), 10);
        const result = InvoiceService.voidInvoice(id);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 7. Payments Received (Admin, Staff)
  // -------------------------------------------------------------
  app.post(
    '/api/payments-received',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { customer_id, amount, payment_receive_no, entries } = req.body;
        const result = PaymentService.recordPaymentReceived({
          customer_id,
          amount,
          payment_receive_no,
          entries,
        });
        res.status(201).json({ id: result.id, alert: result.alert ?? undefined });
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 8. Bills & Bill Payments (Admin, Staff)
  // -------------------------------------------------------------
  app.get(
    '/api/bills',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const bills = BillService.listBills();
        res.json(
          bills.map((b) => ({
            id: b.id,
            bill_number: b.bill_number,
            total_amount: b.total_amount,
            status: b.status,
          }))
        );
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/bills',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { vendor_id, bill_number, total_amount, entries } = req.body;
        const result = BillService.createBill({
          vendor_id,
          bill_number,
          total_amount,
          entries,
        });
        res.status(201).json({ id: result.id });
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    '/api/bills/:id',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = parseInt(String(req.params.id), 10);
        const result = BillService.voidBill(id);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/bill-payments',
    authenticate,
    requireRoles('Admin', 'Staff'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { vendor_id, amount, payment_number, entries } = req.body;
        const result = BillService.recordBillPayment({
          vendor_id,
          amount,
          payment_number,
          entries,
        });
        res.status(201).json({ id: result.id });
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 9. Manual Journals (Admin, Accountant)
  // -------------------------------------------------------------
  app.post(
    '/api/manual-journals',
    authenticate,
    requireRoles('Admin', 'Accountant'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { journal_number, date, entries, notes } = req.body;
        const result = ManualJournalService.createManualJournal({
          journal_number,
          date,
          notes,
          entries,
        });
        res.status(201).json({ id: result.id });
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 10. Financial Reports (Admin, Accountant)
  // -------------------------------------------------------------
  app.get(
    '/api/reports/journal',
    authenticate,
    requireRoles('Admin', 'Accountant'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = ReportService.getJournalReport();
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    '/api/reports/trial-balance-sheet',
    authenticate,
    requireRoles('Admin', 'Accountant'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = ReportService.getTrialBalanceSheet();
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    '/api/reports/balance-sheet',
    authenticate,
    requireRoles('Admin', 'Accountant'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = ReportService.getBalanceSheet();
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    '/api/reports/profit-loss-sheet',
    authenticate,
    requireRoles('Admin', 'Accountant'),
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = ReportService.getProfitLossSheet();
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 10b. GST Filing Pack (Admin, Accountant) — see docs/API.md
  // -------------------------------------------------------------
  app.get(
    '/api/v1/reports/gst',
    authenticate,
    requireRoles('Admin', 'Accountant'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const month = typeof req.query.month === 'string' && req.query.month ? req.query.month : currentMonth();
        const pack = GstReportService.getFilingPack(month);
        res.json(pack);
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    '/api/v1/reports/gst.csv',
    authenticate,
    requireRoles('Admin', 'Accountant'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const month = typeof req.query.month === 'string' && req.query.month ? req.query.month : currentMonth();
        const pack = GstReportService.getFilingPack(month);
        const csv = GstReportService.toCsv(pack);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="gst-filing-pack-${pack.month}.csv"`);
        res.send(csv);
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // 11. AI Assistant Chatbot (any authenticated role)
  // -------------------------------------------------------------
  // Additive feature, not part of API.md's documented surface: proxies to
  // Google Gemini so the API key never reaches the browser. The system
  // instruction is built from the caller's own role/email (see
  // chatbot.service.ts), so answers are scoped to what that role can do.
  app.post(
    '/api/chatbot',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { message, history } = req.body;
        const reply = await ChatbotService.sendMessage(
          message,
          history,
          req.user!.role,
          req.user!.email
        );
        res.json({ reply });
      } catch (err) {
        next(err);
      }
    }
  );

  // -------------------------------------------------------------
  // Centralized Error Handler
  // -------------------------------------------------------------
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.statusCode || 400;
    const errorResponse: { error: string; code?: string } = {
      error: err.message || 'Internal Server Error',
    };
    if (err.errorCode) {
      errorResponse.code = err.errorCode;
    }
    res.status(status).json(errorResponse);
  });

  return app;
}
