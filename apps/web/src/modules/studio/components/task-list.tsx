// 任务列表（Task 10）：当前媒体类型的任务历史，含状态徽标、失败原因与积分消耗。
// 轮询节奏由 studio.lib.api 的 taskRefetchInterval（refetchInterval 回调）控制。

import { Badge } from "@openstarter/ui-web/components/badge";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Pagination, StatusText } from "@/components/admin/list";
import { studio, taskRefetchInterval, type StudioMediaTypeId } from "@/modules/studio/lib/api";

import { taskErrorMessage, TaskGallery } from "./task-gallery";

const PAGE_SIZE = 20;

const statusVariant = (status: string): "secondary" | "destructive" | "outline" => {
  if (status === "success") {
    return "secondary";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "outline";
};

const formatTime = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleString() : "—";

export function TaskList({ mediaType }: { mediaType: StudioMediaTypeId }) {
  const [page, setPage] = useState(1);

  const tasksQuery = useQuery({
    ...studio.queries.tasks({ mediaType, page }),
    placeholderData: keepPreviousData,
    refetchInterval: taskRefetchInterval,
  });

  const items = tasksQuery.data?.items ?? [];
  const total = tasksQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <TaskGallery mediaType={mediaType} tasks={items} />

      <StatusText
        empty={items.length === 0}
        emptyLabel="No generation tasks yet."
        error={tasksQuery.error as Error | null}
        loading={tasksQuery.isPending}
      />

      {items.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((task) => (
            <li className="flex flex-col gap-1 px-4 py-3" key={task.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                <span className="font-mono text-muted-foreground text-xs">{task.model}</span>
                {task.costCredits > 0 ? (
                  <span className="text-muted-foreground text-xs">{task.costCredits} credits</span>
                ) : null}
                <span className="ml-auto text-muted-foreground text-xs">
                  {formatTime(task.createdAt)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm">{task.prompt}</p>
              {taskErrorMessage(task) ? (
                <p className="text-destructive text-xs">{taskErrorMessage(task)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Pagination onPageChange={setPage} page={page} totalPages={totalPages} />
    </div>
  );
}
