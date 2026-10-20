"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/menu";
import { SegmentedControl } from "@/components/segmented-control";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Button, Field, inputClass, type ButtonSize } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { commonMessages } from "@/lib/i18n/messages/common";
import { rulesMessages } from "@/lib/i18n/messages/rules";
import { FOLDER_NAME_MAX, folderHref, type FolderFilter } from "@/lib/rules/folders";
import { createFolder, deleteFolder, renameFolder, type FolderFormState } from "./actions";

/*
 * โฟลเดอร์ (โปรเจกต์) ในหน้ากฎอัตโนมัติ
 * - FolderTabs: แถบเลือกโฟลเดอร์ (ทั้งหมด / แต่ละโฟลเดอร์ / ไม่มีโฟลเดอร์) + เมนูของโฟลเดอร์ที่เลือกอยู่
 * - NewFolderButton: ปุ่มสร้างโฟลเดอร์ (สร้างแล้วไปหน้าโฟลเดอร์นั้น)
 * - FolderDialog: หน้าต่างตั้งชื่อ ใช้ทั้งสร้างใหม่ เปลี่ยนชื่อ และ "ย้ายกฎไปโฟลเดอร์ใหม่" จากเมนูของกฎ
 */

export interface FolderSummary {
  id: number;
  name: string;
  /** จำนวนกฎในโฟลเดอร์ */
  count: number;
}

type DialogProps =
  | { mode: "create"; open: boolean; onClose: () => void; rule?: { id: number; name: string } }
  | { mode: "rename"; open: boolean; onClose: () => void; folder: { id: number; name: string } };

export function FolderDialog(props: DialogProps) {
  const t = useT(rulesMessages);
  const tCommon = useT(commonMessages);
  const inputId = useId();
  const rename = props.mode === "rename";
  const [state, formAction] = useActionState<FolderFormState, FormData>(rename ? renameFolder : createFolder, {});
  // ซ่อน error เดิมเมื่อเปิดหน้าต่างใหม่ (state ของ action ค้างอยู่จนกว่าจะส่งครั้งถัดไป)
  const [shownFrom, setShownFrom] = useState(0);
  const error = state.error && (state.attempt ?? 0) > shownFrom ? state.error : undefined;
  const { open, onClose } = props;
  const initialName = props.mode === "rename" ? props.folder.name : "";
  // ควบคุมค่าเอง: ฟอร์มที่ส่ง action จะถูกล้างหลังส่ง → ชื่อที่พิมพ์ไว้ต้องอยู่ต่อตอนขึ้น error (เช่น ชื่อซ้ำ)
  const [name, setName] = useState(initialName);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(initialName);
  }

  // เปลี่ยนชื่อสำเร็จ → ปิดหน้าต่าง + แจ้ง (สร้างใหม่สำเร็จจะย้ายไปหน้าโฟลเดอร์เอง)
  useEffect(() => {
    if (state.done && state.done === state.attempt) {
      toast(t("folderRenamed"), { tone: "good" });
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ทำครั้งเดียวต่อการบันทึกที่สำเร็จ
  }, [state.done]);

  function close() {
    setShownFrom(state.attempt ?? 0);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="sm"
      icon={rename ? <Pencil aria-hidden /> : <FolderPlus aria-hidden />}
      iconTone="accent"
      title={rename ? t("folderRename") : t("newFolderTitle")}
      description={props.mode === "create" ? (props.rule ? t("newFolderForRule", { rule: props.rule.name }) : t("newFolderBody")) : undefined}
      formAction={formAction}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close}>
            {tCommon("cancel")}
          </Button>
          <SubmitButton>{rename ? t("folderSave") : t("folderCreate")}</SubmitButton>
        </>
      }
    >
      {props.mode === "rename" && <input type="hidden" name="id" value={props.folder.id} />}
      {props.mode === "create" && props.rule && <input type="hidden" name="ruleId" value={props.rule.id} />}
      <Field label={t("folderNameLabel")} htmlFor={inputId} error={error}>
        <input
          id={inputId}
          name="name"
          required
          maxLength={FOLDER_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("folderNamePlaceholder")}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className={inputClass}
          data-autofocus
        />
      </Field>
    </Dialog>
  );
}

export function NewFolderButton({ size = "md", className }: { size?: ButtonSize; className?: string }) {
  const t = useT(rulesMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size={size} icon={<FolderPlus />} className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {t("newFolder")}
      </Button>
      <FolderDialog mode="create" open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** แถบโฟลเดอร์ (แสดงเมื่อมีโฟลเดอร์แล้ว) — เลือกโฟลเดอร์ไหนอยู่ จะมีปุ่ม ⋮ สำหรับเปลี่ยนชื่อ/ลบ */
export function FolderTabs({
  folders,
  filter,
  total,
  noneCount,
}: {
  folders: FolderSummary[];
  filter: FolderFilter;
  total: number;
  noneCount: number;
}) {
  const t = useT(rulesMessages);
  const [renaming, setRenaming] = useState(false);
  const selected = typeof filter === "number" ? folders.find((f) => f.id === filter) : undefined;
  const value = typeof filter === "number" ? String(filter) : filter;

  return (
    <div className="flex items-center gap-2">
      {/* ไม่ยืดเต็มแถว → ปุ่ม ⋮ ของโฟลเดอร์อยู่ติดแถบ */}
      <div className="min-w-0">
        <SegmentedControl
          label={t("folderTabsLabel")}
          value={value}
          equalWidth={false}
          // ไม่บีบปุ่มจนชื่อถูกตัด — ยาวเกินจอก็เลื่อนแถบในแนวนอนเอา (ตัวแถบเลื่อนได้อยู่แล้ว)
          className="[&>*]:shrink-0"
          options={[
            { value: "all", label: t("folderAll"), count: total, href: folderHref("all") },
            ...folders.map((f) => ({
              value: String(f.id),
              label: <span className="max-w-[12rem] truncate">{f.name}</span>,
              icon: <Folder aria-hidden />,
              count: f.count,
              href: folderHref(f.id),
            })),
            ...(noneCount > 0 || filter === "none"
              ? [{ value: "none", label: t("folderNone"), count: noneCount, href: folderHref("none") }]
              : []),
          ]}
        />
      </div>
      {selected && (
        <>
          <Menu label={t("folderMenuLabel", { folder: selected.name })}>
            <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
              {t("folderRename")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              action={deleteFolder}
              fields={{ id: selected.id }}
              icon={<Trash2 />}
              tone="danger"
              successMessage={t("folderDeleted")}
              confirm={{
                title: t("folderDeleteTitle", { folder: selected.name }),
                description: t("folderDeleteBody", { count: selected.count }),
                confirmLabel: t("folderDelete"),
              }}
            >
              {t("folderDelete")}
            </MenuItem>
          </Menu>
          <FolderDialog mode="rename" open={renaming} onClose={() => setRenaming(false)} folder={selected} />
        </>
      )}
    </div>
  );
}
