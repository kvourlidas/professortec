import type { ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'success' | 'warning';

type StatWidgetProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  variant?: Variant;
  className?: string;
};

const variantClassMap: Record<Variant, string> = {
  default: '',
  primary: 'dashboard-widget--primary',
  success: 'dashboard-widget--success',
  warning: 'dashboard-widget--warning',
};

export function StatWidget({
  title,
  value,
  subtitle,
  variant = 'default',
  className = '',
}: StatWidgetProps) {
  const variantClass = variantClassMap[variant];

  return (
    <div className={`dashboard-widget ${variantClass} ${className}`}>
      <div className="dashboard-widget-title">{title}</div>
      <div className="dashboard-widget-value">{value}</div>
      {subtitle && (
        <div className="dashboard-widget-sub">
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default StatWidget;
