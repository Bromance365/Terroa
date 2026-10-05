import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cx } from "@/components/ui/cx";

function Lock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="mt-0.5 flex-none text-accent">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Law 25 notice shown next to every place where a plan can be uploaded. [N] stays a placeholder. */
export function PrivacyNotice({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <aside aria-label={t("footer.privacy")} className={cx("flex gap-3 rounded-md border border-line bg-surface-raised p-4", className)}>
      <Lock />
      <p className="small text-[15px] leading-[22px]">
        {t("planReader.privacy")} <Link href="/privacy">{t("footer.privacy")}</Link>
      </p>
    </aside>
  );
}
