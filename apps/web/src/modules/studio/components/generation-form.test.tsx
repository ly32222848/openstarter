// GenerationForm 组件测试（Task 10）：mock ai / studio 的查询与变更工厂，
// 覆盖 optionsSchema 动态参数渲染（enum → Select、number → Input）与提交 body 组装、
// 非法 schema 容错（解析失败不渲染动态字段，仅提交 prompt）。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom 未实现 scrollIntoView；Radix Select 打开时会对选中项调用它。
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom 未实现 PointerEvent（jsdom ≤ 29）；Radix Select 用 PointerEvent 判定指针类型。
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      public pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    }
    (window as { PointerEvent?: typeof PointerEvent }).PointerEvent =
      PointerEventPolyfill as unknown as typeof PointerEvent;
  }
});

const modelsState = vi.hoisted(() => ({
  catalog: {} as Record<string, Array<Record<string, unknown>>>,
}));

const studioMocks = vi.hoisted(() => ({ createTask: vi.fn() }));

const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/modules/ai/lib/api", () => ({
  ai: {
    queries: {
      models: () => ({
        queryKey: ["ai", "models"],
        queryFn: async () => modelsState.catalog,
      }),
    },
  },
}));

vi.mock("@/modules/studio/lib/api", () => ({
  studio: {
    mutations: {
      // 组件把工厂返回值展开进 useMutation：mock 必须提供真正的 mutationFn，
      // 让 TanStack 的 mutateAsync 调到 mock（仅给 mutateAsync 选项会被 TanStack 忽略）。
      createTask: () => ({ mutationFn: studioMocks.createTask }),
    },
  },
}));

vi.mock("sonner", () => ({ toast: toastMocks }));

import type { StudioMediaTypeId } from "@/modules/studio/lib/api";

import { GenerationForm } from "./generation-form";

const imageModel = (overrides: Partial<Record<string, unknown>> = {}) => ({
  creditPrice: 2,
  displayName: "Flux Dev",
  id: "model-1",
  maxOutputTokens: null,
  mediaType: "image",
  modelId: "flux-dev",
  optionsSchema: null,
  provider: "fal",
  ...overrides,
});

const renderForm = (mediaType: StudioMediaTypeId = "image") => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GenerationForm mediaType={mediaType} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  modelsState.catalog = {};
  studioMocks.createTask.mockReset();
  studioMocks.createTask.mockResolvedValue({ id: "task-1", status: "pending" });
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
});

describe("GenerationForm", () => {
  it("renders a Select for enum options and submits them in the request body", async () => {
    modelsState.catalog = {
      image: [
        imageModel({
          optionsSchema: JSON.stringify({
            properties: { aspect_ratio: { type: "string", enum: ["1:1", "16:9"] } },
          }),
        }),
      ],
    };

    renderForm();

    const modelTrigger = await screen.findByRole("combobox", { name: "Model" });
    await waitFor(() => expect(modelTrigger.textContent).toContain("Flux Dev"));

    fireEvent.click(screen.getByRole("combobox", { name: "aspect_ratio" }));
    fireEvent.click(await screen.findByRole("option", { name: "16:9" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "A cat in space" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    // TanStack 会向 mutationFn 追加第二个 context 参数，这里只断言业务入参。
    await waitFor(() => {
      expect(studioMocks.createTask).toHaveBeenCalledWith(
        {
          mediaType: "image",
          provider: "fal",
          model: "flux-dev",
          prompt: "A cat in space",
          options: { aspect_ratio: "16:9" },
        },
        expect.anything(),
      );
    });
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it("coerces number options into numeric values in the request body", async () => {
    modelsState.catalog = {
      image: [
        imageModel({
          displayName: "SDXL",
          modelId: "sdxl",
          optionsSchema: JSON.stringify({ properties: { steps: { type: "integer" } } }),
        }),
      ],
    };

    renderForm();

    await screen.findByRole("combobox", { name: "Model" });

    const stepsInput = await screen.findByLabelText("steps");
    fireEvent.change(stepsInput, { target: { value: "24" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "Portrait" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(studioMocks.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ model: "sdxl", options: { steps: 24 } }),
        expect.anything(),
      );
    });
  });

  it("renders no dynamic fields and omits options when optionsSchema is invalid JSON", async () => {
    modelsState.catalog = {
      image: [imageModel({ optionsSchema: "{not-json" })],
    };

    renderForm();

    await screen.findByRole("combobox", { name: "Model" });
    expect(screen.queryByRole("combobox", { name: "aspect_ratio" })).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(studioMocks.createTask).toHaveBeenCalledTimes(1);
    });
    const payload = studioMocks.createTask.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload).not.toHaveProperty("options");
  });
});
