import type { ReactNode } from "react";
import { CircleHelp, ArrowUpRight, X as XIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { PublishStatus } from "@/lib/model";
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>
      )}
    </header>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Status({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "orange" | "blue" | "red";
  className?: string;
}) {
  return <span className={cn("status-pill", tone, className)}>{children}</span>;
}
export function PublishBadge({ status }: { status: PublishStatus }) {
  const labels = {
    scheduled: "Geplant",
    publishing: "Wird ausgeführt",
    published: "Veröffentlicht",
    failed: "Fehlgeschlagen",
    partial: "Teilweise veröffentlicht",
    uncertain: "Abgleich erforderlich",
    cancelled: "Storniert",
  };
  return (
    <Status
      tone={
        status === "published"
          ? "green"
          : status === "scheduled"
            ? "blue"
            : status === "cancelled"
              ? "neutral"
              : "orange"
      }
    >
      {labels[status]}
    </Status>
  );
}
export function AccountIcon({
  channel,
  size = 24,
}: {
  channel: string;
  size?: number;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
        channel === "X"
          ? "bg-foreground text-background"
          : channel === "LinkedIn"
            ? "bg-[#e7eef7] text-[#32679b]"
            : "bg-[#e9eff4] text-[#426d98]",
      )}
    >
      {channel === "X" ? (
        <XIcon size={size * 0.55} />
      ) : channel === "LinkedIn" ? (
        "in"
      ) : channel === "Bluesky" ? (
        "B"
      ) : (
        "M"
      )}
    </span>
  );
}
export function AccountSelect({
  value,
  onChange,
  disabled = false,
  label = "Account",
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { state } = useStore();
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select
        className="native-select"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Ohne Account-Zuordnung</option>
        {state.accounts
          .filter((a) => a.workspaceId === state.activeWorkspaceId)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.channel} · {a.handle}
              {!a.connected ? " · getrennt" : ""}
            </option>
          ))}
      </select>
    </label>
  );
}
export function Section({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface p-5 sm:p-6", className)}>
      <div className="section-heading">
        <div>
          <h3>{title}</h3>
          {description && (
            <p className="muted mt-1 mb-0 text-xs leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function DemoNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-dashed p-3 text-xs leading-relaxed muted">
      <CircleHelp size={15} className="mt-0.5 shrink-0" />
      <span>
        {children ??
          "Beispieldaten · Aktionen werden ausschließlich lokal simuliert."}
      </span>
    </div>
  );
}
export function TextLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-xs font-semibold hover:text-primary"
    >
      {children}
      <ArrowUpRight size={13} />
    </Link>
  );
}
export function formatDate(
  value: string,
  timezone = "Europe/Berlin",
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(new Date(value));
}
