/**
 * Anexos do chat — Onda 5 (Issue #4).
 *
 * Responsabilidades:
 *   - Tipos `Attachment` e `EventAttachment`.
 *   - Validação client-side (mime, size, count) — defense in depth.
 *   - Upload para `POST /upload/image?teamId=<id>` com FormData.
 *
 * O backend (Onda 5) valida mime por magic bytes e limita 15 MB; aqui
 * limitamos 5 MB para dar feedback antes do upload e evitar tráfego inútil.
 */

import { getAuthToken } from "@/lib/api";
import { getApiBase } from "@/lib/runtime-config";

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

/** Status do ciclo de vida do anexo enquanto o usuário edita a mensagem. */
export type AttachmentStatus = "uploading" | "uploaded" | "error";

/**
 * Anexo local (dentro do ChatInput) enquanto aguarda envio.
 * `file`, `previewUrl` e `id` são locais. `uploadedId` e `uploadedUrl` só
 * existem após o POST /upload/image retornar com sucesso.
 */
export interface Attachment {
  /** ID local (nanoid) — chave React e alvo de remoção */
  id: string;
  file: File;
  /** `URL.createObjectURL(file)` — precisa ser revocado no cleanup */
  previewUrl: string;
  status: AttachmentStatus;
  /** UUID retornado pelo backend (enviar no POST /message) */
  uploadedId?: string;
  /** URL no servidor (fallback se precisar renderizar do server) */
  uploadedUrl?: string;
  /** Mensagem de erro exibida no chip em caso de falha */
  error?: string;
}

/**
 * Representação de um anexo em um `StreamEvent` (bubble da timeline).
 * Usada tanto para otimismo (preview local) quanto para a versão reconciliada.
 */
export interface EventAttachment {
  /** UUID do backend (presente quando o upload já foi concluído) */
  id?: string;
  /** URL de exibição — pode ser object URL local ou URL do servidor */
  url: string;
  filename?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Constantes de validação
// ────────────────────────────────────────────────────────────────────────────

export const ALLOWED_MIMES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

/** Limite client-side — backend aceita até 15MB, mas damos feedback cedo. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Deve bater com `attachmentIds.max(6)` no backend (messageSchema). */
export const MAX_ATTACHMENTS = 6;

/**
 * Retorna null se válido, ou string de erro amigável para toast.
 *
 * Considera `currentCount` (anexos já na lista) para validar limite de
 * contagem ANTES de fazer URL.createObjectURL desnecessário.
 */
export function validateAttachmentFile(
  file: File,
  currentCount: number
): string | null {
  if (currentCount >= MAX_ATTACHMENTS) {
    return `Limite de ${MAX_ATTACHMENTS} anexos por mensagem`;
  }
  if (!ALLOWED_MIMES.includes(file.type)) {
    const shortName = file.name.length > 40 ? file.name.slice(0, 37) + "…" : file.name;
    return `${shortName}: tipo "${file.type || "desconhecido"}" não suportado (PNG/JPEG/WebP/GIF)`;
  }
  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const shortName = file.name.length > 40 ? file.name.slice(0, 37) + "…" : file.name;
    return `${shortName}: ${mb}MB excede o limite de ${MAX_FILE_SIZE / 1024 / 1024}MB`;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Upload
// ────────────────────────────────────────────────────────────────────────────

/**
 * Response do `POST /upload/image?teamId=<id>` — alinhado com
 * `backend/src/modules/uploads/routes.ts:155`.
 */
interface UploadResponse {
  id: string;
  teamId: string;
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  createdAt: string;
}

/**
 * Faz upload de UM anexo para o team. Retorna `{id, url}` prontos para
 * serem anexados a um `StreamEvent` e referenciados em `attachmentIds`.
 *
 * Lança `Error` com mensagem amigável em caso de falha.
 */
export async function uploadAttachment(
  teamId: string,
  file: File
): Promise<{ id: string; url: string }> {
  if (!teamId) throw new Error("teamId é obrigatório para upload");

  let token = "";
  try {
    token = await getAuthToken();
  } catch {
    /* sem token — o backend respondera 401 se necessário */
  }

  const form = new FormData();
  form.append("file", file);

  const API_BASE = getApiBase();
  const res = await fetch(
    `${API_BASE}/upload/image?teamId=${encodeURIComponent(teamId)}`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }
  );

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ? ` — ${body.error}` : "";
    } catch {
      detail = "";
    }
    if (res.status === 415) throw new Error(`Tipo de arquivo rejeitado${detail}`);
    if (res.status === 413) throw new Error(`Arquivo muito grande${detail}`);
    if (res.status === 429) throw new Error(`Muitos uploads — aguarde${detail}`);
    throw new Error(`Falha no upload (HTTP ${res.status})${detail}`);
  }

  const data = (await res.json()) as UploadResponse;
  if (!data.id) {
    throw new Error("Resposta do servidor sem id de anexo");
  }
  return { id: data.id, url: data.url };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

let _attachmentCounter = 0;
/** ID local — não precisa ser UUID, só único no componente. */
export function makeLocalAttachmentId(): string {
  return `a${++_attachmentCounter}-${Date.now()}`;
}

/**
 * Extrai File[] de um ClipboardEvent de paste.
 *
 * Estratégia (cobre mais casos):
 *   1. Itera `clipboardData.items` com `kind === "file"` — cobre screenshot
 *      do OS (Cmd+Shift+4 no Mac) e "Copy Image" do browser.
 *   2. Fallback: `clipboardData.files` — cobre copy de arquivo do filesystem.
 */
export function extractFilesFromClipboard(
  clipboardData: DataTransfer
): File[] {
  const out: File[] = [];
  if (clipboardData.items) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  if (out.length === 0 && clipboardData.files) {
    for (const f of Array.from(clipboardData.files)) {
      out.push(f);
    }
  }
  return out;
}
