import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import type { UploadedFile } from '../leads/leads.service';

export const MESSAGE_UPLOAD_ROOT = resolve(process.env.UPLOAD_DIR ?? 'uploads', 'messages');
export const MESSAGE_MAX_FILES = 5;
export const MESSAGE_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MESSAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export interface MessageFile {
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/** Validate the bytes as well as the declared content type; never accept active SVG/HTML. */
function validSignature(file: UploadedFile) {
  const bytes = file.buffer;
  switch (file.mimetype) {
    case 'image/png': return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/jpeg': return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case 'image/webp': return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    case 'application/pdf': return bytes.length >= 8 && bytes.toString('ascii', 0, 5) === '%PDF-';
    default: return false;
  }
}

export async function removeMessageFiles(files: MessageFile[]) {
  await Promise.all(files.map((file) => fs.rm(join(MESSAGE_UPLOAD_ROOT, file.storedName), { force: true }).catch(() => undefined)));
}

export async function persistMessageFiles(files: UploadedFile[]): Promise<MessageFile[]> {
  if (files.length > MESSAGE_MAX_FILES) throw new BadRequestException('Attach up to 5 files per message');
  for (const file of files) {
    if (!file.size || file.size > MESSAGE_MAX_FILE_SIZE || !validSignature(file)) {
      throw new BadRequestException('Use valid JPG, PNG, WebP or PDF files, up to 10 MB each');
    }
  }
  if (!files.length) return [];
  await fs.mkdir(MESSAGE_UPLOAD_ROOT, { recursive: true });
  const stored: MessageFile[] = [];
  try {
    for (const file of files) {
      const attachment = {
        storedName: randomUUID(),
        originalName: file.originalname.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200),
        mimeType: file.mimetype,
        size: file.size,
      };
      stored.push(attachment);
      await fs.writeFile(join(MESSAGE_UPLOAD_ROOT, attachment.storedName), file.buffer, { flag: 'wx' });
    }
    return stored;
  } catch (error) {
    await removeMessageFiles(stored);
    throw error;
  }
}
