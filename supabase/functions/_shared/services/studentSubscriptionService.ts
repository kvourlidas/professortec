import {
  insertStudentSubscription,
  markSubscriptionAsRenewed,
  getSubscriptionByIdAndSchoolId,
  deleteSubscriptionById,
  insertStudentSubscriptionPayment,
  getSubscriptionPaymentByIdAndSchoolId,
  cancelSubscriptionPaymentById,
  insertStudentSubscriptionPlan,
  getActivePlanForStudent,
  getSubscriptionPlanByIdAndSchoolId,
  cancelSubscriptionPlanById,
} from "../repositories/studentSubscriptionRepo.ts";
import type {
  CreateStudentSubscriptionInput,
  DeleteStudentSubscriptionInput,
  CreateStudentSubscriptionPaymentInput,
  CancelStudentSubscriptionPaymentInput,
  CreateStudentSubscriptionPlanInput,
  CancelStudentSubscriptionPlanInput,
} from "../types/studentSubscription.ts";

export async function createStudentSubscriptionService(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionInput
) {
  if (!input.renew_from_sub_id) {
    const { data: existing } = await supabase
      .from("student_subscriptions")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_id", input.student_id)
      .eq("status", "active")
      .limit(1);
    if (existing && existing.length > 0) {
      throw new Error("Ο μαθητής έχει ήδη ενεργή συνδρομή. Δεν επιτρέπεται προσθήκη δεύτερης ενεργής συνδρομής.");
    }
  }

  const newSub = await insertStudentSubscription(supabase, schoolId, input);
  if (input.renew_from_sub_id) {
    await markSubscriptionAsRenewed(supabase, input.renew_from_sub_id, schoolId);
  }
  return newSub;
}

export async function deleteStudentSubscriptionService(
  supabase: any,
  schoolId: string,
  input: DeleteStudentSubscriptionInput
) {
  await getSubscriptionByIdAndSchoolId(supabase, input.subscription_id, schoolId);
  await deleteSubscriptionById(supabase, input.subscription_id);
  return { success: true };
}

export async function createStudentSubscriptionPaymentService(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionPaymentInput
) {
  await getSubscriptionByIdAndSchoolId(supabase, input.subscription_id, schoolId);
  return await insertStudentSubscriptionPayment(supabase, schoolId, input);
}

export async function cancelStudentSubscriptionPaymentService(
  supabase: any,
  schoolId: string,
  input: CancelStudentSubscriptionPaymentInput
) {
  await getSubscriptionPaymentByIdAndSchoolId(supabase, input.payment_id, schoolId);
  await cancelSubscriptionPaymentById(supabase, input.payment_id);
  return { success: true };
}

export async function createStudentSubscriptionPlanService(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionPlanInput
) {
  const existing = await getActivePlanForStudent(supabase, schoolId, input.student_id);
  if (existing.length > 0) {
    throw new Error("Ο μαθητής έχει ήδη ενεργό πρόγραμμα συνδρομής. Δεν επιτρέπεται προσθήκη δεύτερου ενεργού προγράμματος.");
  }

  const plan = await insertStudentSubscriptionPlan(supabase, schoolId, input);

  // Generate the currently-due month(s) immediately so the first charge
  // shows up right away instead of waiting for the next page load.
  const { data: generation, error } = await supabase.rpc("generate_due_subscription_charges", {
    p_school_id: schoolId,
    p_plan_id: plan.id,
  });
  if (error) throw new Error(error.message ?? "Failed to generate initial subscription charge");

  return { plan, generation };
}

export async function cancelStudentSubscriptionPlanService(
  supabase: any,
  schoolId: string,
  input: CancelStudentSubscriptionPlanInput
) {
  await getSubscriptionPlanByIdAndSchoolId(supabase, input.plan_id, schoolId);
  await cancelSubscriptionPlanById(supabase, input.plan_id);
  return { success: true };
}
