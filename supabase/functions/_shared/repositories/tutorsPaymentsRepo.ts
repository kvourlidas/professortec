import { NotFoundError } from "../errors.ts";
import type {
  CreateTutorPaymentInput,
  UpdateTutorPaymentInput,
} from "../types/tutorsPayments.ts";

export async function upsertTutorPaymentProfile(
  supabase: any,
  schoolId: string,
  input: NonNullable<CreateTutorPaymentInput["profile"]>
) {
  const { error } = await supabase
    .from("tutor_payment_profiles")
    .upsert({
      school_id: schoolId,
      tutor_id: input.tutor_id,
      base_gross: input.base_gross,
      base_net: input.base_net,
      currency: input.currency,
      updated_by: input.updated_by,
      updated_at: new Date().toISOString(),
    }, { onConflict: "school_id,tutor_id" });

  if (error) throw new Error(error.message ?? "Failed to upsert payment profile");
}

export async function insertTutorBonus(
  supabase: any,
  schoolId: string,
  input: NonNullable<CreateTutorPaymentInput["bonus"]>
) {
  const { error } = await supabase
    .from("tutor_payment_bonuses")
    .insert({
      school_id: schoolId,
      tutor_id: input.tutor_id,
      period_year: input.period_year,
      period_month: input.period_month,
      kind: input.kind,
      value: input.value,
      description: input.description,
      is_active: true,
      created_by: input.created_by,
    });

  if (error) throw new Error(error.message ?? "Failed to insert bonus");
}

export async function insertTutorPayment(
  supabase: any,
  schoolId: string,
  input: CreateTutorPaymentInput["payment"]
) {
  const { data, error } = await supabase
    .from("tutor_payments")
    .insert({
      school_id: schoolId,
      tutor_id: input.tutor_id,
      period_year: input.period_year,
      period_month: input.period_month,
      base_net: input.base_net,
      base_gross: input.base_gross,
      net_total: input.net_total,
      gross_total: input.gross_total,
      bonus_total: input.bonus_total,
      status: "paid",
      paid_on: input.paid_on,
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? "Failed to insert payment");
  return data;
}

export async function getTutorPaymentByIdAndSchoolId(
  supabase: any,
  paymentId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("tutor_payments")
    .select("id, school_id")
    .eq("id", paymentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Payment not found or not accessible");
  return data;
}

export async function updateTutorPaymentById(
  supabase: any,
  input: UpdateTutorPaymentInput
) {
  const { error } = await supabase
    .from("tutor_payments")
    .update({
      base_net: input.base_net,
      base_gross: input.base_gross,
      net_total: input.net_total,
      gross_total: input.gross_total,
      bonus_total: input.bonus_total,
      status: "paid",
      paid_on: input.paid_on,
      notes: input.notes,
    })
    .eq("id", input.payment_id);

  if (error) throw new Error(error.message ?? "Failed to update payment");
}

export async function deleteTutorPaymentById(
  supabase: any,
  paymentId: string
) {
  const { error } = await supabase
    .from("tutor_payments")
    .delete()
    .eq("id", paymentId);

  if (error) throw new Error(error.message ?? "Failed to delete payment");
  return true;
}
