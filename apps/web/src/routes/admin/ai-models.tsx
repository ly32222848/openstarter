// apps/web/src/routes/admin/ai-models.tsx
// AI 模型目录管理（Task 10）：列表（provider/modelId/mediaType/price/enabled 开关）+
// Dialog 表单（create/update）+ 直接删除（与 roles.tsx 一致，无确认弹层——admin 内无 AlertDialog 先例）。
// 数据经 /api/admin/ai-models*（requirePermission admin.*）。

import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstarter/ui-web/components/dialog";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstarter/ui-web/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { Textarea } from "@openstarter/ui-web/components/textarea";
import { cn } from "@openstarter/ui-web/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { admin, type AiModelMediaType, AI_MODEL_MEDIA_TYPES } from "@/modules/admin/lib/api";

export const Route = createFileRoute("/admin/ai-models")({
  component: AdminAiModelsPage,
});

const PAGE_SIZE = 20;

type MediaType = AiModelMediaType;

const MEDIA_TYPES = AI_MODEL_MEDIA_TYPES;

interface ModelForm {
  id: string | null;
  provider: string;
  modelId: string;
  displayName: string;
  mediaType: MediaType;
  creditPrice: string;
  maxOutputTokens: string;
  optionsSchema: string;
  metadata: string;
  enabled: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ModelForm = {
  id: null,
  provider: "",
  modelId: "",
  displayName: "",
  mediaType: "image",
  creditPrice: "0",
  maxOutputTokens: "",
  optionsSchema: "",
  metadata: "",
  enabled: true,
  sortOrder: "0",
};

interface ModelRow {
  creditPrice: number;
  displayName: string;
  enabled: boolean;
  id: string;
  maxOutputTokens: number | null;
  mediaType: string;
  metadata: string | null;
  modelId: string;
  optionsSchema: string | null;
  provider: string;
  sortOrder: number;
}

/** 整数输入解析：空串 → null（后端 nullable 语义），非法输入返回 undefined（提交前拦截）。 */
const parseIntOrNull = (value: string): number | null | undefined => {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function AdminAiModelsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<ModelForm | null>(null);

  const modelsQuery = useQuery({
    ...admin.queries.aiModels(page),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "ai-models"] });
  };

  const saveMutation = useMutation({
    ...admin.mutations.saveAiModel(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      setForm(null);
      invalidate();
      toast.success("Model saved");
    },
  });

  const deleteMutation = useMutation({
    ...admin.mutations.deleteAiModel(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      invalidate();
      toast.success("Model deleted");
    },
  });

  const toggleMutation = useMutation({
    ...admin.mutations.toggleAiModel(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      invalidate();
      toast.success("Model updated");
    },
  });

  const items = (modelsQuery.data?.items ?? []) as ModelRow[];
  const total = (modelsQuery.data?.total as number | undefined) ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSave = () => {
    if (!form) {
      return;
    }
    const creditPrice = Number.parseInt(form.creditPrice, 10);
    const maxOutputTokens = parseIntOrNull(form.maxOutputTokens);
    if (!Number.isFinite(creditPrice) || creditPrice < 0 || maxOutputTokens === undefined) {
      toast.error("Price and token limit must be non-negative integers.");
      return;
    }
    saveMutation.mutate({
      id: form.id,
      provider: form.provider.trim(),
      modelId: form.modelId.trim(),
      displayName: form.displayName.trim(),
      mediaType: form.mediaType,
      creditPrice,
      maxOutputTokens,
      optionsSchema: form.optionsSchema.trim() === "" ? null : form.optionsSchema.trim(),
      metadata: form.metadata.trim() === "" ? null : form.metadata.trim(),
      enabled: form.enabled,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    });
  };

  return (
    <div>
      <AdminHeader
        action={
          <Button onClick={() => setForm(EMPTY_FORM)} size="sm" type="button">
            New model
          </Button>
        }
        description="Catalog of AI models available for generation and credit pricing."
        title="AI Models"
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel="No AI models yet."
        error={modelsQuery.error as Error | null}
        loading={modelsQuery.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Media type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-mono text-sm">{model.provider}</TableCell>
                  <TableCell className="font-mono text-sm">{model.modelId}</TableCell>
                  <TableCell>{model.displayName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{model.mediaType}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{model.creditPrice}</TableCell>
                  <TableCell>
                    <SwitchField
                      checked={model.enabled}
                      id={`ai-model-enabled-${model.id}`}
                      onChange={(checked) =>
                        toggleMutation.mutate({ id: model.id, enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      onClick={() =>
                        setForm({
                          id: model.id,
                          provider: model.provider,
                          modelId: model.modelId,
                          displayName: model.displayName,
                          mediaType: (MEDIA_TYPES as readonly string[]).includes(model.mediaType)
                            ? (model.mediaType as MediaType)
                            : "image",
                          creditPrice: String(model.creditPrice),
                          maxOutputTokens:
                            model.maxOutputTokens === null ? "" : String(model.maxOutputTokens),
                          optionsSchema: model.optionsSchema ?? "",
                          metadata: model.metadata ?? "",
                          enabled: model.enabled,
                          sortOrder: String(model.sortOrder),
                        })
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => deleteMutation.mutate(model.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Pagination onPageChange={setPage} page={page} totalPages={totalPages} />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setForm(null);
          }
        }}
        open={form !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit model" : "New model"}</DialogTitle>
            <DialogDescription>
              Configure a catalog entry consumed by the generation studio and credit pricing.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-model-provider">Provider</Label>
                  <Input
                    id="ai-model-provider"
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    placeholder="replicate"
                    value={form.provider}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model-model-id">Model ID</Label>
                  <Input
                    id="ai-model-model-id"
                    onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                    placeholder="black-forest-labs/flux-dev"
                    value={form.modelId}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model-display-name">Display name</Label>
                <Input
                  id="ai-model-display-name"
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Flux Dev"
                  value={form.displayName}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-model-media-type">Media type</Label>
                  <Select
                    onValueChange={(value) => setForm({ ...form, mediaType: value as MediaType })}
                    value={form.mediaType}
                  >
                    <SelectTrigger className="w-full" id="ai-model-media-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDIA_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model-price">Credit price</Label>
                  <Input
                    id="ai-model-price"
                    inputMode="numeric"
                    onChange={(e) => setForm({ ...form, creditPrice: e.target.value })}
                    value={form.creditPrice}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-model-max-tokens">Max output tokens</Label>
                  <Input
                    id="ai-model-max-tokens"
                    inputMode="numeric"
                    onChange={(e) => setForm({ ...form, maxOutputTokens: e.target.value })}
                    placeholder="Leave empty for no limit"
                    value={form.maxOutputTokens}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model-sort-order">Sort order</Label>
                  <Input
                    id="ai-model-sort-order"
                    inputMode="numeric"
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    value={form.sortOrder}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model-options-schema">Options schema (JSON)</Label>
                <Textarea
                  id="ai-model-options-schema"
                  onChange={(e) => setForm({ ...form, optionsSchema: e.target.value })}
                  placeholder='{"properties":{"aspect_ratio":{"type":"string","enum":["1:1","16:9"]}}}'
                  rows={4}
                  value={form.optionsSchema}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model-metadata">Metadata (JSON)</Label>
                <Textarea
                  id="ai-model-metadata"
                  onChange={(e) => setForm({ ...form, metadata: e.target.value })}
                  placeholder='{"note":"internal remarks"}'
                  rows={2}
                  value={form.metadata}
                />
              </div>
              <div className="flex items-center gap-2">
                <SwitchField
                  checked={form.enabled}
                  id="ai-model-form-enabled"
                  onChange={(checked) => setForm({ ...form, enabled: checked })}
                />
                <Label htmlFor="ai-model-form-enabled">Enabled</Label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              disabled={
                !form ||
                form.provider.trim().length === 0 ||
                form.modelId.trim().length === 0 ||
                form.displayName.trim().length === 0 ||
                saveMutation.isPending
              }
              onClick={handleSave}
              type="button"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// base-ui 无 Switch 组件封装，这里用一个带样式的 checkbox 作为开关（与 settings.tsx 一致）。
// 外观与 shadcn/base-ui toggle 一致（圆点滑动），纯 CSS 实现，无新依赖。
function SwitchField({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={id}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors",
        checked ? "bg-primary" : "bg-input",
      )}
      id={id}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow ring-1 ring-foreground/5 transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
