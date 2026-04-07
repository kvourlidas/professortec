import { ValidationError } from "../errors.ts";
import type {
  CreateStudentSubscriptionInput,
  DeleteStudentSubscriptionInput,
  CreateStudentSubscriptionPaymentInput,
} from "../types/studentSubscription.ts";

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
  if (!payment_method || !["cash", "card"].includes(payment_method)) {
    throw new ValidationError("Invalid payment_method");
  }

  return { subscription_id, amount, payment_method };
}
