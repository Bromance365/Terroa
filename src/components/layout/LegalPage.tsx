import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/controls";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export async function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const t = await getTranslations();
  const prefix = kind === "privacy" ? "p" : "t";
  const count = kind === "privacy" ? 7 : 5;
  return (
    <div className="container-page section-y">
      <Breadcrumb items={[{ label: t("nav.home"), href: "/" }, { label: t(`legal.${kind}Title`) }]} />
      <article className="mt-6 max-w-3xl">
        <h1>{t(`legal.${kind}Title`)}</h1>
        <p className="mt-3 text-[18px] leading-7 text-ink-muted">{t(`legal.${kind}Lead`)}</p>
        <Alert className="mt-6" kind="info">
          {t("legal.draftNotice")}
        </Alert>
        <div className="mt-8 space-y-8">
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
            <section key={n} aria-labelledby={`${prefix}${n}`}>
              <h2 id={`${prefix}${n}`}>{t(`legal.${prefix}${n}Title`)}</h2>
              <p className="mt-2">{t(`legal.${prefix}${n}Text`)}</p>
            </section>
          ))}
        </div>
        <p className="small mt-10 text-ink-muted">{t("legal.updated")}</p>
      </article>
    </div>
  );
}
