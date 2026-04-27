"use client";

/**
 * useAttachment — hook reutilizável para gerenciar anexos pendentes
 * antes do envio de uma mensagem. Extraído do `ChatInput` original
 * (Onda 5) e generalizado para uso no Terminal real-time.
 *
 * Responsabilidades:
 *   - manter lista local de anexos com status (uploading/uploaded/error)
 *   - validar arquivos (mime, size, count) antes de criar object URL
 *   - disparar uploads em paralelo para `POST /upload/image?teamId=<id>`
 *   - revocar object URLs no unmount (evita memory leak)
 *
 * O componente consumidor decide:
 *   - como exibir os chips (passa `attachments` pro AttachmentChip)
 *   - como reagir a erros de validação (callback `onValidationError`)
 *   - quando limpar a lista (após enviar a mensagem)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeLocalAttachmentId,
  uploadAttachment,
  validateAttachmentFile,
  type Attachment,
  type EventAttachment,
} from "@/lib/chat-attachments";

export interface UseAttachmentResult {
  attachments: Attachment[];
  /** Adiciona um lote de arquivos — valida cada um antes do upload */
  addFiles: (files: File[]) => void;
  /** Remove anexo (revoga object URL) */
  removeAttachment: (id: string) => void;
  /** Limpa lista após envio. Não revoga URLs (bubbles otimistas usam) */
  clearAttachments: () => void;
  /** True se algum anexo está em status `uploading` */
  hasUploading: boolean;
  /** Quantidade de anexos prontos pra envio */
  uploadedCount: number;
  /** True se há pelo menos um anexo na lista */
  hasAttachments: boolean;
  /**
   * Snapshot de IDs+EventAttachment dos anexos prontos pra envio.
   * Usado para montar o payload `{ attachmentIds, attachments }` sem
   * o consumidor precisar conhecer o shape interno.
   */
  collectUploaded: () => {
    attachmentIds: string[];
    eventAttachments: EventAttachment[];
  };
}

export function useAttachment(
  teamId: string | undefined,
  options?: {
    onValidationError?: (message: string) => void;
  }
): UseAttachmentResult {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const onValidationError = options?.onValidationError;

  const addFiles = useCallback(
    (files: File[]) => {
      if (!teamId || files.length === 0) return;

      const accepted: Attachment[] = [];
      setAttachments((prev) => {
        let count = prev.length;
        for (const file of files) {
          const err = validateAttachmentFile(file, count);
          if (err) {
            onValidationError?.(err);
            continue;
          }
          const id = makeLocalAttachmentId();
          const previewUrl = URL.createObjectURL(file);
          accepted.push({ id, file, previewUrl, status: "uploading" });
          count++;
        }
        return [...prev, ...accepted];
      });

      for (const att of accepted) {
        void (async () => {
          try {
            const { id: uploadedId, url: uploadedUrl } = await uploadAttachment(
              teamId,
              att.file
            );
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === att.id
                  ? { ...a, status: "uploaded", uploadedId, uploadedUrl }
                  : a
              )
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === att.id ? { ...a, status: "error", error: msg } : a
              )
            );
            onValidationError?.(msg);
          }
        })();
      }
    },
    [teamId, onValidationError]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const collectUploaded = useCallback((): {
    attachmentIds: string[];
    eventAttachments: EventAttachment[];
  } => {
    const uploaded = attachments.filter((a) => a.status === "uploaded");
    const attachmentIds = uploaded
      .map((a) => a.uploadedId)
      .filter((x): x is string => !!x);
    const eventAttachments: EventAttachment[] = uploaded.map((a) => ({
      id: a.uploadedId,
      url: a.previewUrl,
      filename: a.file.name,
    }));
    return { attachmentIds, eventAttachments };
  }, [attachments]);

  // Cleanup de object URLs no unmount
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    return () => {
      for (const a of attachmentsRef.current) {
        URL.revokeObjectURL(a.previewUrl);
      }
    };
  }, []);

  const hasUploading = attachments.some((a) => a.status === "uploading");
  const uploadedCount = attachments.filter((a) => a.status === "uploaded")
    .length;
  const hasAttachments = attachments.length > 0;

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    hasUploading,
    uploadedCount,
    hasAttachments,
    collectUploaded,
  };
}
