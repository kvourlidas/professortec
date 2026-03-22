export type PackageType = 'hourly' | 'monthly' | 'yearly';

export type CreatePackageInput = {
  name: string;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  package_type: PackageType;
  hours: number | null;
  starts_on: string | null;
  ends_on: string | null;
  avatar_color: string;
  is_custom: boolean;
};

export type UpdatePackageInput = {
  packages: {
    id: string;
    name: string;
    price: number;
    currency: string;
    is_active: boolean;
    sort_order: number;
    package_type: PackageType;
    hours: number | null;
    starts_on: string | null;
    ends_on: string | null;
    avatar_color: string;
    is_custom: boolean;
  }[];
};

export type DeletePackageInput = {
  package_id: string;
};
