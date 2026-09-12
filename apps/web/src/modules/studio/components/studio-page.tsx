// 生成工作台（Task 10）：媒体类型 Tabs（image/video/music）→ 左侧生成表单、右侧任务列表与画廊。
// 数据面：ai.queries.models（模型目录，Task 8）+ studio.queries.tasks / studio.mutations.createTask。

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstarter/ui-web/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ai } from "@/modules/ai/lib/api";
import { STUDIO_MEDIA_TYPES, type StudioMediaTypeId } from "@/modules/studio/lib/api";

import { GenerationForm } from "./generation-form";
import { TaskList } from "./task-list";

const TAB_LABELS: Record<StudioMediaTypeId, string> = {
  image: "Image",
  music: "Music",
  video: "Video",
};

const titleize = (mediaType: StudioMediaTypeId): string =>
  TAB_LABELS[mediaType] ?? mediaType.charAt(0).toUpperCase() + mediaType.slice(1);

export function StudioPage() {
  const [mediaType, setMediaType] = useState<StudioMediaTypeId>(STUDIO_MEDIA_TYPES[0]);

  const modelsQuery = useQuery({ ...ai.queries.models() });

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-bold text-2xl">Generation Studio</h1>
        <p className="text-muted-foreground">
          Generate images, videos and music with your configured AI models.
        </p>
      </div>

      <Tabs onValueChange={(value) => setMediaType(value as StudioMediaTypeId)} value={mediaType}>
        <TabsList>
          {STUDIO_MEDIA_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {titleize(type)}
            </TabsTrigger>
          ))}
        </TabsList>

        {STUDIO_MEDIA_TYPES.map((type) => (
          <TabsContent className="grid gap-6 lg:grid-cols-[380px_1fr]" key={type} value={type}>
            <GenerationForm mediaType={type} />
            <div className="min-w-0">
              <h2 className="mb-3 font-semibold text-lg">{titleize(type)} tasks</h2>
              <TaskList mediaType={type} />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {modelsQuery.error ? (
        <p className="text-destructive text-sm">{(modelsQuery.error as Error).message}</p>
      ) : null}
    </div>
  );
}
