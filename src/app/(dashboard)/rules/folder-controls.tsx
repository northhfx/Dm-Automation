"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
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
import { ScheduleFields, ScheduleStatus, type ScheduleValue } from "./schedule-fields";

/*
 * โฟลเดอร์ (โปรเจกต์) ในหน้ากฎอัตโนมัติ
 * - FolderTabs: แถบเลือกโฟลเดอร์ (ทั้งหมด / แต่ละโฟลเดอร์ / ไม่มีโฟลเดอร์) + เมนูของโฟลเดอร์ที่เลือกอยู่
 * - NewFolderButton: ปุ่มสร้างโฟลเดอร์ (สร้างแล้วไปหน้าโฟลเดอร์นั้น)
 * - FolderDialog: หน้าต่างตั้งชื่อ ใช้ทั้งสร้างใหม่ เปลี่ยนชื่อ และ "ย้ายกฎไปโฟลเดอร์ใหม่" จากเมนูของกฎ
 */

export interface FolderSummary {
  id: number;
  name: string;
  /** ตั้งเวลาทั้งโฟลเดอร์ (ISO, null = ไม่จำกัด) */
  startsAt: string | null;
  endsAt: string | null;
  closedReply: string | null;
  /** จำนวนกฎในโฟลเดอร์ */
  count: number;
}

type DialogProps =
  | { mode: "create"; open: boolean; onClose: () => void; rule?: { id: number; name: string } }
  | { mode: "rename"; open: boolean; onClose: () => void; folder: Omit<FolderSummary, "count"> };

export function FolderDialog(props: DialogProps) {
  const t = useT(rulesMessages);
  const tCommon = useT(commonMessages);
  const inputId = useId();
  const rename = props.mode === "rename";
  const [state, formAction, pending] = useActionState<FolderFormState, FormData>(rename ? renameFolder : createFolder, {});
  // ซ่อน error เดิมเมื่อเปิดหน้าต่างใหม่ (state ของ action ค้างอยู่จนกว่าจะส่งครั้งถัดไป)
  const [shownFrom, setShownFrom] = useState(0);
  const error = state.error && (state.attempt ?? 0) > shownFrom ? state.error : undefined;
  const { open, onClose } = props;
  const initialName = props.mode === "rename" ? props.folder.name : "";
  const initialSchedule: ScheduleValue =
    props.mode === "rename"
      ? { startsAt: props.folder.startsAt, endsAt: props.folder.endsAt, closedReply: props.folder.closedReply ?? "" }
      : { startsAt: null, endsAt: null, closedReply: "" };
  // ควบคุมค่าเอง: ฟอร์มที่ส่ง action จะถูกล้างหลังส่ง → ค่าที่กรอกไว้ต้องอยู่ต่อตอนขึ้น error (เช่น ชื่อซ้ำ)
  const [name, setName] = useState(initialName);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initialName);
      setSchedule(initialSchedule);
    }
  }

  // เปลี่ยนชื่อสำเร็จ → ปิดหน้าต่าง + แจ้ง (สร้างใหม่สำเร็จจะย้ายไปหน้าโฟลเดอร์เอง)
  useEffect(() => {
    if (state.done && state.done === state.attempt) {
      toast(t("folderSaved"), { tone: "good" });
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ทำครั้งเดียวต่อการบันทึกที่สำเร็จ
  }, [state.done]);

  function close() {
    // ปิดระหว่างกำลังบันทึก → ผลของครั้งนั้นก็ไม่ต้องแสดงตอนเปิดใหม่
    setShownFrom((state.attempt ?? 0) + (pending ? 1 : 0));
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size={rename ? "md" : "sm"}
      icon={rename ? <Pencil aria-hidden /> : <FolderPlus aria-hidden />}
      iconTone="accent"
      title={rename ? t("folderEdit") : t("newFolderTitle")}
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
      {props.mode === "rename" && (
        <div className="mt-5 border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-semibold text-fg">{t("scheduleTitle")}</h3>
          <input type="hidden" name="startsAt" value={schedule.startsAt ?? ""} />
          <input type="hidden" name="endsAt" value={schedule.endsAt ?? ""} />
          <input type="hidden" name="closedReply" value={schedule.closedReply} />
          <ScheduleFields value={schedule} onChange={(p) => setSchedule((s) => ({ ...s, ...p }))} channel="folder" />
        </div>
      )}
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
  const stripRef = useRef<HTMLDivElement>(null);

  // จอแคบ: แถบเลื่อนได้ → เลื่อนให้เห็นโฟลเดอร์ที่เลือกอยู่ (เช่น เพิ่งสร้าง หรือกดป้ายโฟลเดอร์จากการ์ด)
  useEffect(() => {
    const strip = stripRef.current?.querySelector<HTMLElement>('[role="group"]');
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    const left = active.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + active.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - 16) });
    }
  }, [value]);

  return (
    <div className="space-y-2">
    <div className="flex items-center gap-2">
      {/* ไม่ยืดเต็มแถว → ปุ่ม ⋮ ของโฟลเดอร์อยู่ติดแถบ */}
      <div ref={stripRef} className="min-w-0">
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
              {t("folderEdit")}
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
    {/* โฟลเดอร์ที่ตั้งเวลาไว้: บอกสถานะของทั้งโฟลเดอร์ */}
    {selected && <ScheduleStatus value={selected} />}
    </div>
  );
}
