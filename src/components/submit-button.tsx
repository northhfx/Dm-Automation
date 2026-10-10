"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./ui";
import { HiddenFields, runAction, type ActionFields, type FormAction } from "./action";

/**
 * ปุ่มส่งฟอร์ม — ระหว่างรอ Server Action จะแสดงวงหมุนและกดซ้ำไม่ได้
 * <form action={save}> ... <SubmitButton pendingText="กำลังบันทึก…">บันทึก</SubmitButton></form>
 */
export function SubmitButton({ children, pendingText, disabled, ...rest }: Omit<ButtonProps, "type" | "loading"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={disabled} {...rest}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

/**
 * ปุ่มเดี่ยวที่เรียก Server Action ทันที (มีฟอร์มซ่อนในตัว) + toast แจ้งผล
 * <ActionButton action={duplicateRule} fields={{ id }} icon={<Copy />} successMessage="ทำสำเนาแล้ว">ทำสำเนา</ActionButton>
 * ถ้าเป็นการลบหรือย้อนกลับไม่ได้ ให้ใช้ <ConfirmSubmit> แทน
 */
export function ActionButton({
  action,
  fields,
  successMessage,
  errorMessage,
  children,
  variant = "secondary",
  ...rest
}: Omit<ButtonProps, "type" | "loading" | "onClick"> & {
  action: FormAction;
  fields?: ActionFields;
  successMessage?: string;
  errorMessage?: string;
  pendingText?: string;
}) {
  return (
    <form
      className="contents"
      action={async (fd) => {
        await runAction(() => action(fd), { success: successMessage, error: errorMessage });
      }}
    >
      <HiddenFields fields={fields} />
      <SubmitButton variant={variant} {...rest}>
        {children}
      </SubmitButton>
    </form>
  );
}
