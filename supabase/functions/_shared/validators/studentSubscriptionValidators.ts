import { ValidationError } from "../errors.ts";
import type {
  CreateStudentSubscriptionInput,
  DeleteStudentSubscriptionInput,
  CreateStudentSubscriptionPaymentInput,
  CancelStudentSubscriptionPaymentInput,
  CreateStudentSubscriptionPlanInput,
  CancelStudentSubscriptionPlanInput,
} from "../types/studentSubscription.ts";

function normalizeMonthKey(input: any): string | null {
  const v = (input ?? "").toString().trim();
  const m = v.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export function validateCreateStudentSubscriptionBody(body: any): CreateStudentSubscriptionInput {
  const student_id = body?.student_id?.trim?.();
  const package_id = body?.package_id?.trim?.();
  const package_name = body?.package_name?.trim?.();
  const price = typeof body?.price === "number" ? body.price : parseFloat(body?.price);
  const currency = body?.currency?.trim?.() || "EUR";
  const starts_on = body?.starts_on?.trim?.() || null;
  const ends_on = body?.ends_on?.trim?.() || null;
  const discount_reason = body?.discount_reason?.trim?.() || null;
  const renew_from_sub_id = body?.renew_from_sub_id?.trim?.() || null;

  if (!student_id) throw new ValidationError("Missing student_id");
  if (!package_id) throw new ValidationError("Missing package_id");
  if (!package_name) throw new ValidationError("Missing package_name");
  if (isNaN(price) || price < 0) throw new ValidationError("Invalid price");

  return { student_id, package_id, package_name, price, currency, starts_on, ends_on, discount_reason, renew_from_sub_id };
}

export function validateDeleteStudentSubscriptionBody(body: any): DeleteStudentSubscriptionInput {
  const subscription_id = body?.subscription_id?.trim?.();
  if (!subscription_id) throw new ValidationError("Missing subscription_id");
  return { subscription_id };
}

export function validateCreateStudentSubscriptionPaymentBody(body: any): CreateStudentSubscriptionPaymentInput {
  const subscription_id = body?.subscription_id?.trim?.();
  const amount = typeof body?.amount === "number" ? body.amount : parseFloat(body?.amount);
  const payment_method = body?.payment_method?.trim?.();

  if (!subscription_id) throw new ValidationError("Missing subscription_id");
  if (isNaN(amount) || amount <= 0) throw new ValidationError("Invalid amount");
  if (!payment_method || !["cash", "card", "bank_transfer"].includes(payment_method)) {
    throw new ValidationError("Invalid payment_method");
  }

  return { subscription_id, amount, payment_method };
}

export function validateCancelStudentSubscriptionPaymentBody(body: any): CancelStudentSubscriptionPaymentInput {
  const payment_id = body?.payment_id?.trim?.();
  if (!payment_id) throw new ValidationError("Missing payment_id");
  return { payment_id };
}

export function validateCreateStudentSubscriptionPlanBody(body: any): CreateStudentSubscriptionPlanInput {
  const student_id = body?.student_id?.trim?.();
  const package_id = body?.package_id?.trim?.();
  const package_name = body?.package_name?.trim?.();
  const monthly_price = typeof body?.monthly_price === "number" ? body.monthly_price : parseFloat(body?.monthly_price);
  const currency = body?.currency?.trim?.() || "EUR";
  const start_month = normalizeMonthKey(body?.start_month);
  const end_month = normalizeMonthKey(body?.end_month);
  const discount_mode = ["none", "pct", "amount"].includes(body?.discount_mode) ? body.discount_mode : "none";
  const discount_value = typeof body?.discount_value === "number" ? body.discount_value : (parseFloat(body?.discount_value) || 0);
  const discount_scope = ["range", "months"].includes(body?.discount_scope) ? body.discount_scope : "range";
  const discount_reason = body?.discount_reason?.trim?.() || null;

  if (!student_id) throw new ValidationError("Missing student_id");
  if (!package_id) throw new ValidationError("Missing package_id");
  if (!package_name) throw new ValidationError("Missing package_name");
  if (isNaN(monthly_price) || monthly_price < 0) throw new ValidationError("Invalid monthly_price");
  if (!start_month) throw new ValidationError("Invalid start_month");
  if (!end_month) throw new ValidationError("Invalid end_month");
  if (end_month < start_month) throw new ValidationError("end_month must not be before start_month");
  if (discount_mode !== "none" && (isNaN(discount_value) || discount_value < 0)) {
    throw new ValidationError("Invalid discount_value");
  }

  let discount_months: string[] = [];
  if (discount_mode !== "none" && discount_scope === "months") {
    const raw = Array.isArray(body?.discount_months) ? body.discount_months : [];
    const startKey = start_month.slice(0, 7), endKey = end_month.slice(0, 7);
    discount_months = raw
      .map((v: any) => (v ?? "").toString().trim())
      .filter((v: string) => /^\d{4}-\d{2}$/.test(v));
    for (const key of discount_months) {
      if (key < startKey || key > endKey) throw new ValidationError(`discount_months entry ${key} is outside the plan range`);
    }
    if (discount_months.length === 0) {
      throw new ValidationError("Select at least one month for the discount, or switch to whole-range scope");
    }
  }

  return {
    student_id, package_id, package_name, monthly_price, currency,
    start_month, end_month, discount_mode, discount_value,
    discount_scope, discount_months, discount_reason,
  };
}

export function validateCancelStudentSubscriptionPlanBody(body: any): CancelStudentSubscriptionPlanInput {
  const plan_id = body?.plan_id?.trim?.();
  if (!plan_id) throw new ValidationError("Missing plan_id");
  return { plan_id };
}
