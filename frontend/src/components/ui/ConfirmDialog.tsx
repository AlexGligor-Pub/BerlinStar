import Modal from "./Modal";
import Button from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Modal
      open={props.open}
      onClose={props.loading ? undefined : props.onCancel}
      title={props.title ?? "Confirmare"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => props.onCancel()} disabled={props.loading}>
            {props.cancelLabel ?? "Anulează"}
          </Button>
          <Button
            variant={props.variant ?? "primary"}
            size="sm"
            onClick={() => props.onConfirm()}
            loading={props.loading}
          >
            {props.confirmLabel ?? "Confirmă"}
          </Button>
        </>
      }
    >
      <p style="margin:0">{props.message}</p>
    </Modal>
  );
}
