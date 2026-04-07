import { NotFoundError } from "../errors.ts";
import type {
  CreateStudentSubscriptionInput,
  CreateStudentSubscriptionPaymentInput,
} from "../types/studentSubscription.ts";

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
