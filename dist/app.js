import express from 'express';
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
export function createApp() {
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
    app.post('/api/auth/login', (req, res, next) => {
        try {
            const { email, password } = req.body;
            const result = AuthService.login(email, password);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 2. User Management (Admin only)
    // -------------------------------------------------------------
    app.post('/api/users', authenticate, requireRoles('Admin'), (req, res, next) => {
        try {
            const { email, password, role } = req.body;
            const result = UserService.createUser({ email, password, role });
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    });
    app.get('/api/users', authenticate, requireRoles('Admin'), (_req, res, next) => {
        try {
            const users = UserService.listUsers();
            res.json(users);
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 3. Test Harness (Admin, test environment only)
    // -------------------------------------------------------------
    app.post('/api/test/seed-random', authenticate, requireRoles('Admin'), async (req, res, next) => {
        try {
            if (config.nodeEnv !== 'test') {
                res.status(403).json({ error: 'Endpoint available only in test environment' });
                return;
            }
            const { seed = config.test.seed, count = config.test.opsCount } = req.body;
            const result = await TestHarnessService.runRandomOperations(Number(seed), Number(count));
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 4. Accounts (Admin, Accountant, Staff)
    // -------------------------------------------------------------
    app.get('/api/accounts', authenticate, requireRoles('Admin', 'Accountant', 'Staff'), (_req, res, next) => {
        try {
            const accounts = AccountService.listAccounts();
            res.json(accounts);
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 5. Contacts (Admin, Staff)
    // -------------------------------------------------------------
    app.get('/api/contacts', authenticate, requireRoles('Admin', 'Staff'), (_req, res, next) => {
        try {
            const contacts = ContactService.listContacts();
            res.json(contacts);
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 6. Sales Invoices (Admin, Staff)
    // -------------------------------------------------------------
    app.get('/api/sale-invoices', authenticate, requireRoles('Admin', 'Staff'), (_req, res, next) => {
        try {
            const invoices = InvoiceService.listInvoices();
            res.json(invoices.map((inv) => ({
                id: inv.id,
                invoice_no: inv.invoice_no,
                total_amount: inv.total_amount,
                status: inv.status,
            })));
        }
        catch (err) {
            next(err);
        }
    });
    app.post('/api/sale-invoices', authenticate, requireRoles('Admin', 'Staff'), (req, res, next) => {
        try {
            const { customer_id, invoice_no, total_amount, entries } = req.body;
            const userId = req.user.id;
            const result = InvoiceService.createInvoice({ customer_id, invoice_no, total_amount, entries }, userId);
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    });
    app.put('/api/sale-invoices/:id/deliver', authenticate, requireRoles('Admin', 'Staff'), (req, res, next) => {
        try {
            const id = parseInt(String(req.params.id), 10);
            const result = InvoiceService.deliverInvoice(id);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    app.delete('/api/sale-invoices/:id', authenticate, requireRoles('Admin', 'Staff'), (req, res, next) => {
        try {
            const id = parseInt(String(req.params.id), 10);
            const result = InvoiceService.voidInvoice(id);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 7. Payments Received (Admin, Staff)
    // -------------------------------------------------------------
    app.post('/api/payments-received', authenticate, requireRoles('Admin', 'Staff'), (req, res, next) => {
        try {
            const { customer_id, amount, payment_receive_no, entries } = req.body;
            const result = PaymentService.recordPaymentReceived({
                customer_id,
                amount,
                payment_receive_no,
                entries,
            });
            res.status(201).json({ id: result.id, alert: result.alert ?? undefined });
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 8. Bills & Bill Payments (Admin, Staff)
    // -------------------------------------------------------------
    app.get('/api/bills', authenticate, requireRoles('Admin', 'Staff'), (_req, res, next) => {
        try {
            const bills = BillService.listBills();
            res.json(bills.map((b) => ({
                id: b.id,
                bill_number: b.bill_number,
                total_amount: b.total_amount,
                status: b.status,
            })));
        }
        catch (err) {
            next(err);
        }
    });
    app.post('/api/bills', authenticate, requireRoles('Admin', 'Staff'), (req, res, next) => {
        try {
            const { vendor_id, bill_number, total_amount, entries } = req.body;
            const result = BillService.createBill({
                vendor_id,
                bill_number,
                total_amount,
                entries,
            });
            res.status(201).json({ id: result.id });
        }
        catch (err) {
            next(err);
        }
    });
    app.delete('/api/bills/:id', authenticate, requireRoles('Admin', 'Staff'), (req, res, next) => {
        try {
            const id = parseInt(String(req.params.id), 10);
            const result = BillService.voidBill(id);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    app.post('/api/bill-payments', authenticate, requireRoles('Admin', 'Staff'), (req, res, next) => {
        try {
            const { vendor_id, amount, payment_number, entries } = req.body;
            const result = BillService.recordBillPayment({
                vendor_id,
                amount,
                payment_number,
                entries,
            });
            res.status(201).json({ id: result.id });
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 9. Manual Journals (Admin, Accountant)
    // -------------------------------------------------------------
    app.post('/api/manual-journals', authenticate, requireRoles('Admin', 'Accountant'), (req, res, next) => {
        try {
            const { journal_number, date, entries, notes } = req.body;
            const result = ManualJournalService.createManualJournal({
                journal_number,
                date,
                notes,
                entries,
            });
            res.status(201).json({ id: result.id });
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // 10. Financial Reports (Admin, Accountant)
    // -------------------------------------------------------------
    app.get('/api/reports/journal', authenticate, requireRoles('Admin', 'Accountant'), (_req, res, next) => {
        try {
            const result = ReportService.getJournalReport();
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    app.get('/api/reports/trial-balance-sheet', authenticate, requireRoles('Admin', 'Accountant'), (_req, res, next) => {
        try {
            const result = ReportService.getTrialBalanceSheet();
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    app.get('/api/reports/balance-sheet', authenticate, requireRoles('Admin', 'Accountant'), (_req, res, next) => {
        try {
            const result = ReportService.getBalanceSheet();
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    app.get('/api/reports/profit-loss-sheet', authenticate, requireRoles('Admin', 'Accountant'), (_req, res, next) => {
        try {
            const result = ReportService.getProfitLossSheet();
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    // -------------------------------------------------------------
    // Centralized Error Handler
    // -------------------------------------------------------------
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || 400;
        const errorResponse = {
            error: err.message || 'Internal Server Error',
        };
        if (err.errorCode) {
            errorResponse.code = err.errorCode;
        }
        res.status(status).json(errorResponse);
    });
    return app;
}
