import { getTranslations } from "next-intl/server";
import { LinkButton } from "@/components/ui/Button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="container-page section-y flex min-h-[50vh] flex-col items-start justify-center gap-4">
      <h1>{t("title")}</h1>
      <p className="text-ink-muted">{t("text")}</p>
      <LinkButton href="/">{t("action")}</LinkButton>
    </div>
  );
}
