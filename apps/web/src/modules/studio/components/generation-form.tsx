// GenerationForm（Task 10）：媒体模型选择 + prompt + 按 optionsSchema 动态渲染参数字段。
// optionsSchema 为 JSON 字符串（DB 原样透传）：仅支持 `type:"string"` + `enum` → Select，
// `type:"number"/"integer"` → 数字 Input；其余属性按 YAGNI 忽略；解析失败静默降级为无动态字段。

import { Button } from "@openstarter/ui-web/components/button";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstarter/ui-web/components/select";
import { Textarea } from "@openstarter/ui-web/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ai, type AiModelView } from "@/modules/ai/lib/api";
import { studio, type StudioMediaTypeId } from "@/modules/studio/lib/api";

/** optionsSchema 中受支持的单个属性定义（宽松视图，解析后逐字段窄化）。 */
type OptionProperty = { enum?: unknown; type: string } | { enum?: unknown; type: string[] };

type ParsedOptionsSchema = {
  properties?: Record<string, OptionProperty>;
};

type SelectOption = { name: string; values: string[] };
type NumberOption = { name: string };

export type GenerationPayload = {
  mediaType: StudioMediaTypeId;
  model: string;
  options?: Record<string, unknown>;
  prompt: string;
  provider: string;
};

/** 解析 optionsSchema JSON；非法或非对象输入返回 null（调用方降级为无动态字段）。 */
const parseOptionsSchema = (schema: string | null): ParsedOptionsSchema | null => {
  if (!schema) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(schema);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as ParsedOptionsSchema;
  } catch {
    return null;
  }
};

/** 从 properties 中筛出受支持的动态字段（enum Select 与 number/integer Input）。 */
const supportedOptions = (
  schema: string | null,
): { numbers: NumberOption[]; selects: SelectOption[] } => {
  const parsed = parseOptionsSchema(schema);
  const properties = parsed?.properties ?? {};

  const selects: SelectOption[] = [];
  const numbers: NumberOption[] = [];
  for (const [name, property] of Object.entries(properties)) {
    if (!property || typeof property !== "object") {
      continue;
    }
    if (Array.isArray(property.enum) && property.enum.every((value) => typeof value === "string")) {
      selects.push({ name, values: property.enum });
      continue;
    }
    if (property.type === "number" || property.type === "integer") {
      numbers.push({ name });
    }
    // 其余类型（boolean/array/object…）按 YAGNI 忽略。
  }
  return { numbers, selects };
};

const modelKey = (model: { modelId: string; provider: string }): string =>
  `${model.provider}:${model.modelId}`;

export function GenerationForm({ mediaType }: { mediaType: StudioMediaTypeId }) {
  const modelsQuery = useQuery({ ...ai.queries.models() });
  const createTask = useMutation({ ...studio.mutations.createTask() });

  const models: AiModelView[] = modelsQuery.data?.[mediaType] ?? [];

  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [optionValues, setOptionValues] = useState<Record<string, string>>({});

  // 切换媒体类型分组时，把选中模型重置回该分组默认项。
  const activeModelKey =
    selectedModelKey ?? modelKey(models.at(0) ?? { modelId: "", provider: "" });
  const activeModel = models.find((model) => modelKey(model) === activeModelKey) ?? models.at(0);

  const dynamicOptions = useMemo(
    () => supportedOptions(activeModel?.optionsSchema ?? null),
    [activeModel?.optionsSchema],
  );

  const isSubmitDisabled = prompt.trim().length === 0 || !activeModel || createTask.isPending;

  const handleOptionChange = (name: string, value: string) => {
    setOptionValues((prev) => ({ ...prev, [name]: value }));
  };

  const buildOptionsPayload = (): Record<string, unknown> | undefined => {
    const entries: Array<[string, unknown]> = [];
    for (const select of dynamicOptions.selects) {
      const value = optionValues[select.name] ?? select.values.at(0);
      if (value !== undefined) {
        entries.push([select.name, value]);
      }
    }
    for (const number of dynamicOptions.numbers) {
      const raw = optionValues[number.name];
      if (raw === undefined || raw.trim() === "") {
        continue;
      }
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        entries.push([number.name, parsed]);
      }
    }
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const handleSubmit = () => {
    if (!activeModel) {
      return;
    }
    const options = buildOptionsPayload();
    const payload: GenerationPayload = {
      mediaType,
      provider: activeModel.provider,
      model: activeModel.modelId,
      prompt: prompt.trim(),
      ...(options ? { options } : {}),
    };
    createTask.mutate(payload, {
      onError: (error: Error) => toast.error(error.message),
      onSuccess: () => {
        setPrompt("");
        toast.success("Generation task created");
      },
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="studio-model">Model</Label>
        <Select onValueChange={setSelectedModelKey} value={activeModelKey}>
          <SelectTrigger className="w-full" id="studio-model">
            <SelectValue placeholder="Select a model..." />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={modelKey(model)}>
                {model.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dynamicOptions.selects.map((select) => (
        <div className="space-y-1.5" key={select.name}>
          <Label htmlFor={`studio-option-${select.name}`}>{select.name}</Label>
          <Select
            onValueChange={(value) => handleOptionChange(select.name, value)}
            value={optionValues[select.name] ?? select.values.at(0)}
          >
            <SelectTrigger className="w-full" id={`studio-option-${select.name}`}>
              <SelectValue placeholder={`Select ${select.name}...`} />
            </SelectTrigger>
            <SelectContent>
              {select.values.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {dynamicOptions.numbers.map((number) => (
        <div className="space-y-1.5" key={number.name}>
          <Label htmlFor={`studio-option-${number.name}`}>{number.name}</Label>
          <Input
            id={`studio-option-${number.name}`}
            inputMode="decimal"
            onChange={(event) => handleOptionChange(number.name, event.target.value)}
            type="text"
            value={optionValues[number.name] ?? ""}
          />
        </div>
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="studio-prompt">Prompt</Label>
        <Textarea
          id="studio-prompt"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe what to generate..."
          rows={3}
          value={prompt}
        />
      </div>

      <Button disabled={isSubmitDisabled} onClick={handleSubmit} type="button">
        {createTask.isPending ? "Submitting..." : "Generate"}
      </Button>
    </section>
  );
}
