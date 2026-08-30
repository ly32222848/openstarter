// 表单字段组合（label + 输入框 + 错误信息），基于 reusables Input/Text 组装。
// 旧版自建 Input 的表单 API（label/errors）由此承接，业务侧配合
// @tanstack/react-form 使用。min-h 44px 对齐触控目标可访问性要求。
import { View } from "react-native";

import { cn } from "../../lib/utils";
import { Input } from "./input";
import { Text } from "./text";

type FieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  errors?: string[];
};

function Field({ className, errors, label, ...props }: FieldProps) {
  const messages = errors ?? [];

  return (
    <View className={cn("gap-1.5", className)}>
      <Text className="font-medium text-sm text-foreground">{label}</Text>
      <Input
        accessibilityLabel={label}
        autoCapitalize="none"
        className="min-h-[44px] rounded-xl"
        {...props}
      />
      {messages.map((message) => (
        <Text className="text-xs text-destructive" key={message}>
          {message}
        </Text>
      ))}
    </View>
  );
}

export { Field };
