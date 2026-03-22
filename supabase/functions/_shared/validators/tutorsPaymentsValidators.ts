import { ValidationError } from "../errors.ts";
import type {
  CreateTutorPaymentInput,
  UpdateTutorPaymentInput,
  DeleteTutorPaymentInput,
} from "../types/tutorsPayments.ts";

export function validateCreateTutorPaymentBody(body: any): CreateTutorPaymentInput {
  const payment = body?.payment;
  if (!payment) throw new ValidationError("Missing payment object");

  const tutor_id = payment?.tutor_id?.trim?.();
  if (!tutor_id) throw new ValidationError("Missing payment.tutor_id");

  const period_year = Number(payment?.period_year);
  const period_month = Number(payment?.period_month);
  if (!period_year || !period_month) throw new ValidationError("Missing payment period");

  const base_net = Number(payment?.base_net ?? 0);
  const base_gross = Number(payment?.base_gross ?? 0);
  const net_total = Number(payment?.net_total ?? 0);
  const gross_total = Number(payment?.gross_total ?? 0);
  const bonus_total = Number(payment?.bonus_total ?? 0);

  if (net_total <= 0 && gross_total <= 0 && bonus_total <= 0) {
    throw new ValidationError("Payment amount cannot be 0");
  }

  const paid_on = payment?.paid_on?.trim?.();
  if (!paid_on) throw new ValidationError("Missing payment.paid_on");

  const created_by = payment?.created_by?.trim?.();
  if (!created_by) throw new ValidationError("Missing payment.created_by");

  // Optional profile upsert
  const profileRaw = body?.profile ?? null;
  const profile = profileRaw ? {
    tutor_id: profileRaw.tutor_id?.trim?.(),
    base_gross: Number(profileRaw.base_gross ?? 0),
    base_net: Number(profileRaw.base_net ?? 0),
    currency: profileRaw.currency?.trim?.() || "EUR",
    updated_by: profileRaw.updated_by?.trim?.(),
  } : null;

  // Optional bonus insert
  const bonusRaw = body?.bonus ?? null;
  const bonus = bonusRaw ? {
    tutor_id: bonusRaw.tutor_id?.trim?.(),
    period_year: Number(bonusRaw.period_year),
    period_month: Number(bonusRaw.period_month),
    kind: bonusRaw.kind as 'percent' | 'amount',
    value: Number(bonusRaw.value ?? 0),
    description: bonusRaw.description?.trim?.() || null,
    created_by: bonusRaw.created_by?.trim?.(),
  } : null;

  return {
    profile,
    bonus,
    payment: {
      tutor_id, period_year, period_month,
      base_net, base_gross, net_total, gross_total, bonus_total,
      paid_on, notes: payment?.notes?.trim?.() || null, created_by,
    },
  };
}

export function validateUpdateTutorPaymentBody(body: any): UpdateTutorPaymentInput {
  const payment_id = body?.payment_id?.trim?.();
  if (!payment_id) throw new ValidationError("Missing payment_id");

  const base_net = Number(body?.base_net ?? 0);
  const base_gross = Number(body?.base_gross ?? 0);
  const net_total = Number(body?.net_total ?? 0);
  const gross_total = Number(body?.gross_total ?? 0);
  const bonus_total = Number(body?.bonus_total ?? 0);

  if (net_total <= 0 && gross_total <= 0 && bonus_total <= 0) {
    throw new ValidationError("Cannot save with 0 amounts");
  }

  const paid_on = body?.paid_on?.trim?.();
  if (!paid_on) throw new ValidationError("Missing paid_on");

  return {
    payment_id,
    base_net, base_gross, net_total, gross_total, bonus_total,
    paid_on,
    notes: body?.notes?.trim?.() || null,
  };
}

export function validateDeleteTutorPaymentBody(body: any): DeleteTutorPaymentInput {
  const payment_id = body?.payment_id?.trim?.();
  if (!payment_id) throw new ValidationError("Missing payment_id");
  return { payment_id };
}
