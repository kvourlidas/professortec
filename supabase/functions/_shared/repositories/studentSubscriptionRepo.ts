import { NotFoundError } from "../errors.ts";
import type {
  CreateStudentSubscriptionInput,
  CreateStudentSubscriptionPaymentInput,
  CreateStudentSubscriptionPlanInput,
} from "../types/studentSubscription.ts";

export async function getSubscriptionPaymentByIdAndSchoolId(
  supabase: any,
  paymentId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("student_subscription_payments")
    .select("id, school_id, cancelled_at")
    .eq("id", paymentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Payment not found or not accessible");
  return data;
}

export async function cancelSubscriptionPaymentById(
  supabase: any,
  paymentId: string
) {
  const { error } = await supabase
    .from("student_subscription_payments")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", paymentId);

  if (error) throw new Error(error.message ?? "Failed to cancel payment");
  return true;
}

export async function getSubscriptionByIdAndSchoolId(
  supabase: any,
  subscriptionId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("student_subscriptions")
    .select("id, school_id")
    .eq("id", subscriptionId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Subscription not found or not accessible");

  return data;
}

export async function insertStudentSubscription(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionInput
) {
  const { data, error } = await supabase
    .from("student_subscriptions")
    .insert({
      school_id: schoolId,
      student_id: input.student_id,
      package_id: input.package_id,
      package_name: input.package_name,
      price: input.price,
      currency: input.currency,
      status: "active",
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      discount_reason: input.discount_reason,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? "Failed to create subscription");
  return data;
}

export async function markSubscriptionAsRenewed(
  supabase: any,
  subscriptionId: string,
  schoolId: string
) {
  const { error } = await supabase
    .from("student_subscriptions")
    .update({ status: "renewed" })
    .eq("id", subscriptionId)
    .eq("school_id", schoolId);

  if (error) throw new Error(error.message);
}

export async function deleteSubscriptionById(
  supabase: any,
  subscriptionId: string
) {
  const { error } = await supabase
    .from("student_subscriptions")
    .delete()
    .eq("id", subscriptionId);

  if (error) throw new Error(error.message);
}

export async function insertStudentSubscriptionPlan(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionPlanInput
) {
  const { data, error } = await supabase
    .from("student_subscription_plans")
    .insert({
      school_id: schoolId,
      student_id: input.student_id,
      package_id: input.package_id,
      package_name: input.package_name,
      monthly_price: input.monthly_price,
      currency: input.currency,
      start_month: input.start_month,
      end_month: input.end_month,
      discount_mode: input.discount_mode,
      discount_value: input.discount_value,
      discount_scope: input.discount_scope,
      discount_months: input.discount_months,
      discount_reason: input.discount_reason,
      status: "active",
    })
    .select("*")
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? "Failed to create subscription plan");
  return data;
}

export async function getActivePlanForStudent(
  supabase: any,
  schoolId: string,
  studentId: string
) {
  const { data, error } = await supabase
    .from("student_subscription_plans")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSubscriptionPlanByIdAndSchoolId(
  supabase: any,
  planId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("student_subscription_plans")
    .select("id, school_id, status")
    .eq("id", planId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Subscription plan not found or not accessible");
  return data;
}

export async function cancelSubscriptionPlanById(
  supabase: any,
  planId: string
) {
  const { error } = await supabase
    .from("student_subscription_plans")
    .update({ status: "canceled" })
    .eq("id", planId);

  if (error) throw new Error(error.message ?? "Failed to cancel subscription plan");
  return true;
}

export async function insertStudentSubscriptionPayment(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionPaymentInput
) {
  const { data, error } = await supabase
    .from("student_subscription_payments")
    .insert({
      school_id: schoolId,
      subscription_id: input.subscription_id,
      amount: input.amount,
      payment_method: input.payment_method,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? "Failed to create payment");
  return data;
}
