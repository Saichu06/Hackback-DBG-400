import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';
import { config } from '../../config/env.js';
import { InvoiceService } from '../invoices/invoice.service.js';
import { PaymentService } from '../payments/payment.service.js';
import { BillService } from '../bills/bill.service.js';
import { LedgerService } from '../accounting/ledger.service.js';

/**
 * Deterministic pseudo-random number generator (LCG) using seed.
 */
class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }
  public next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export class TestHarnessService {
  /**
   * Executes KT3 randomized concurrent operations.
   */
  public static async runRandomOperations(
    seed: number = config.test.seed,
    count: number = config.test.opsCount,
    dbInstance?: Database.Database
  ): Promise<{ operations_run: number; final_trial_balance: any }> {
    const db = dbInstance || getDb();
    const rng = new SeededRandom(seed);

    const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };
    const vendor = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Vendor'").get() as { id: number };
    const admin = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number };

    const activeInvoiceIds: number[] = [];
    const activeBillIds: number[] = [];
    let opsCompleted = 0;

    // Run count randomized operations
    for (let i = 1; i <= count; i++) {
      const opType = rng.nextInt(1, 6);
      const amount = rng.nextInt(10, 500) * 100; // $10.00 to $500.00 in cents

      try {
        switch (opType) {
          case 1: {
            // Create & Deliver Sales Invoice
            const invNo = `KT3-INV-${seed}-${i}-${Date.now()}-${rng.nextInt(1000, 9999)}`;
            const created = InvoiceService.createInvoice(
              {
                customer_id: customer.id,
                invoice_no: invNo,
                total_amount: amount,
              },
              admin.id,
              db
            );
            InvoiceService.deliverInvoice(created.id, db);
            activeInvoiceIds.push(created.id);
            opsCompleted++;
            break;
          }
          case 2: {
            // Record Payment on an active invoice if available
            if (activeInvoiceIds.length > 0) {
              const invId = activeInvoiceIds[rng.nextInt(0, activeInvoiceIds.length - 1)];
              const inv = InvoiceService.getInvoiceById(invId, db);
              if (inv && (inv.status === 'Delivered' || inv.status === 'Partially Paid')) {
                const paidSoFar = (
                  db
                    .prepare('SELECT COALESCE(SUM(amount_applied), 0) as total FROM payment_receives_entries WHERE invoice_id = ?')
                    .get(invId) as { total: number }
                ).total;
                const remaining = inv.total_amount - paidSoFar;
                if (remaining > 0) {
                  const payAmount = rng.nextInt(1, Math.min(remaining, amount));
                  const payNo = `KT3-PAY-${seed}-${i}-${Date.now()}-${rng.nextInt(1000, 9999)}`;
                  PaymentService.recordPaymentReceived(
                    {
                      customer_id: customer.id,
                      amount: payAmount,
                      payment_receive_no: payNo,
                      entries: [{ invoice_id: invId, amount_applied: payAmount }],
                    },
                    db
                  );
                  opsCompleted++;
                }
              }
            }
            break;
          }
          case 3: {
            // Void an invoice (without payments)
            if (activeInvoiceIds.length > 0) {
              const invId = activeInvoiceIds.pop()!;
              try {
                InvoiceService.voidInvoice(invId, db);
                opsCompleted++;
              } catch (e) {
                // If it had payments, voiding is rejected as expected
              }
            }
            break;
          }
          case 4: {
            // Create Vendor Bill
            const billNo = `KT3-BILL-${seed}-${i}-${Date.now()}-${rng.nextInt(1000, 9999)}`;
            const created = BillService.createBill(
              {
                vendor_id: vendor.id,
                bill_number: billNo,
                total_amount: amount,
              },
              db
            );
            activeBillIds.push(created.id);
            opsCompleted++;
            break;
          }
          case 5: {
            // Pay Vendor Bill
            if (activeBillIds.length > 0) {
              const billId = activeBillIds[rng.nextInt(0, activeBillIds.length - 1)];
              const bill = BillService.getBillById(billId, db);
              if (bill && (bill.status === 'Open' || bill.status === 'Partially Paid')) {
                const paidSoFar = (
                  db
                    .prepare('SELECT COALESCE(SUM(amount_applied), 0) as total FROM bill_payments_entries WHERE bill_id = ?')
                    .get(billId) as { total: number }
                ).total;
                const remaining = bill.total_amount - paidSoFar;
                if (remaining > 0) {
                  const payAmount = rng.nextInt(1, Math.min(remaining, amount));
                  const payNo = `KT3-BPAY-${seed}-${i}-${Date.now()}-${rng.nextInt(1000, 9999)}`;
                  BillService.recordBillPayment(
                    {
                      vendor_id: vendor.id,
                      amount: payAmount,
                      payment_number: payNo,
                      entries: [{ bill_id: billId, amount_applied: payAmount }],
                    },
                    db
                  );
                  opsCompleted++;
                }
              }
            }
            break;
          }
          case 6: {
            // Void a Bill (without payments)
            if (activeBillIds.length > 0) {
              const billId = activeBillIds.pop()!;
              try {
                BillService.voidBill(billId, db);
                opsCompleted++;
              } catch (e) {
                // If it had payments, voiding is rejected as expected
              }
            }
            break;
          }
        }
      } catch (err) {
        // Continue random sequence
      }

      // Invariant assertion after every iteration: Global total debits === Total credits
      const tb = LedgerService.getTrialBalance(db);
      if (!tb.is_balanced) {
        throw new Error(
          `Trial balance broken after operation ${i}! Debits: ${tb.total_debit}, Credits: ${tb.total_credit}`
        );
      }
    }

    const finalTrialBalance = LedgerService.getTrialBalance(db);

    return {
      operations_run: opsCompleted,
      final_trial_balance: finalTrialBalance,
    };
  }
}
