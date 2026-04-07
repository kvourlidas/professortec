export type CreateStudentSubscriptionInput = {
  student_id: string;
  package_id: string;
  package_name: string;
  price: number;
  currency: string;
  starts_on: string | null;
  ends_on: string | null;
  discount_reason: string | null;
  renew_from_sub_id: string | null;
};

export type DeleteStudentSubscriptionInput = {
  subscription_id: string;
};

export type CreateStudentSubscriptionPaymentInput = {
  subscription_id: string;
  amount: number;
  payment_method: string;
};
