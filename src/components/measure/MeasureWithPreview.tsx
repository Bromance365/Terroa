"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { PreviewRoom } from "@/lib/preview3d/build";
import { MeasureTool } from "./MeasureTool";

// three.js is loaded only when there is something to show, and never on the server.
const FlooringPreview3D = dynamic(() => import("@/components/preview3d/FlooringPreview3D").then((m) => m.FlooringPreview3D), { ssr: false });

/** The measuring tool with the 3D flooring preview under it. Rooms flow from the tool to the preview. */
export function MeasureWithPreview({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  const t = useTranslations("preview3d");
  const [rooms, setRooms] = useState<PreviewRoom[]>([]);
  const onRoomsChange = useCallback((r: PreviewRoom[]) => setRooms(r), []);
  return (
    <>
      <MeasureTool title={title} lead={lead} onRoomsChange={onRoomsChange} />
      {rooms.length > 0 ? (
        <section className="container-page pb-12" aria-labelledby="preview3d-title">
          <h2 id="preview3d-title">{t("title")}</h2>
          <FlooringPreview3D
            className="mt-6"
            rooms={rooms}
            labels={{
              title: t("title"),
              orbitHint: t("orbitHint"),
              interior: t("interior"),
              topView: t("topView"),
              unsupported: t("unsupported"),
              loading: t("loading"),
              reset: t("reset"),
              legend: t("legend"),
              noFlooring: t("noFlooring"),
            }}
          />
        </section>
      ) : null}
    </>
  );
}
