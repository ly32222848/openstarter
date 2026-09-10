// 生成结果画廊（Task 10）：按媒体类型把 taskInfo 的归一化媒体渲染为 img/video/audio。
// taskInfo 为 JSON 字符串：解析失败或字段缺失时降级为提示文本（容错 taskResult 原始 JSON 不可用）。

import { cn } from "@openstarter/ui-web/lib/utils";

import type { AiTaskInfoView, AiTaskRow } from "@/modules/studio/lib/api";

/** 解析任务行上的 taskInfo JSON；非法输入返回 null（渲染层降级）。 */
const parseTaskInfo = (task: AiTaskRow): AiTaskInfoView | null => {
  if (!task.taskInfo) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(task.taskInfo);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as AiTaskInfoView;
  } catch {
    return null;
  }
};

/** 失败任务优先展示后端写入的 errorMessage。 */
export const taskErrorMessage = (task: AiTaskRow): string | null => {
  const info = parseTaskInfo(task);
  const message = info?.errorMessage;
  return typeof message === "string" && message.length > 0 ? message : null;
};

export function TaskGallery({ mediaType, tasks }: { mediaType: string; tasks: AiTaskRow[] }) {
  const succeeded = tasks.filter((task) => task.status === "success");
  if (succeeded.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {succeeded.map((task) => (
        <GalleryItem key={task.id} mediaType={mediaType} task={task} />
      ))}
    </div>
  );
}

function GalleryItem({ mediaType, task }: { mediaType: string; task: AiTaskRow }) {
  const info = parseTaskInfo(task);

  return (
    <figure className="flex flex-col gap-2 overflow-hidden rounded-lg border">
      {mediaType === "image" ? <ImageSlide imageUrls={imageUrls(info)} /> : null}
      {mediaType === "video" ? <VideoSlide items={videoItems(info)} /> : null}
      {mediaType === "music" ? <MusicSlide items={songItems(info)} /> : null}
      <figcaption className="flex items-center justify-between gap-2 px-3 pb-3">
        <span className="truncate text-muted-foreground text-xs">{task.prompt}</span>
        <span className="shrink-0 text-muted-foreground text-xs">
          {task.costCredits > 0 ? `${task.costCredits} credits` : null}
        </span>
      </figcaption>
    </figure>
  );
}

const imageUrls = (info: AiTaskInfoView | null): string[] =>
  (info?.images ?? [])
    .map((image) => image.imageUrl)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

const videoItems = (
  info: AiTaskInfoView | null,
): Array<{ thumbnailUrl?: string; videoUrl?: string }> =>
  (info?.videos ?? []).filter(
    (video) => typeof video.videoUrl === "string" && video.videoUrl.length > 0,
  );

const songItems = (info: AiTaskInfoView | null): Array<{ audioUrl?: string; imageUrl?: string }> =>
  (info?.songs ?? []).filter(
    (song) => typeof song.audioUrl === "string" && song.audioUrl.length > 0,
  );

function ImageSlide({ imageUrls: urls }: { imageUrls: string[] }) {
  const first = urls.at(0);
  if (!first) {
    return <GalleryPlaceholder mediaType="image" />;
  }
  return (
    <div className="grid gap-1 p-1 sm:grid-cols-2">
      {urls.map((url) => (
        <img
          alt="Generated image"
          className={cn("w-full rounded-md object-cover", urls.length === 1 && "sm:col-span-2")}
          key={url}
          loading="lazy"
          src={url}
        />
      ))}
    </div>
  );
}

function VideoSlide({ items }: { items: Array<{ thumbnailUrl?: string; videoUrl?: string }> }) {
  const first = items.at(0);
  if (!first?.videoUrl) {
    return <GalleryPlaceholder mediaType="video" />;
  }
  return (
    <video className="w-full bg-black" controls poster={first.thumbnailUrl} src={first.videoUrl} />
  );
}

function MusicSlide({ items }: { items: Array<{ audioUrl?: string; imageUrl?: string }> }) {
  const first = items.at(0);
  if (!first?.audioUrl) {
    return <GalleryPlaceholder mediaType="music" />;
  }
  return (
    <div className="flex flex-col gap-2 p-2">
      {typeof first.imageUrl === "string" && first.imageUrl.length > 0 ? (
        <img
          alt="Generated cover"
          className="w-full rounded-md"
          loading="lazy"
          src={first.imageUrl}
        />
      ) : null}
      <audio className="w-full" controls src={first.audioUrl} />
    </div>
  );
}

function GalleryPlaceholder({ mediaType }: { mediaType: string }) {
  return (
    <div className="flex h-32 items-center justify-center bg-muted/40 text-muted-foreground text-xs">
      No {mediaType} output.
    </div>
  );
}
