import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createReadStream, promises as fs } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { Lead, LeadDocument, LeadStatus } from './schemas/lead.schema';

const PAGE_SIZE = 20;

/**
 * Форма файла, которую отдаёт multer при хранении в памяти. Описана локально,
 * чтобы не тащить @types/multer: пакет ставится только на хост, а в образе
 * бэкенда его нет, и сборка в контейнере падала бы.
 */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Каталог вынесен в переменную: в контейнере на него смотрит том. */
const UPLOAD_ROOT = resolve(process.env.UPLOAD_DIR ?? 'uploads', 'leads');

export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/zip',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class LeadsService {
  constructor(@InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>) {}

  async create(dto: CreateLeadDto, files: UploadedFile[]) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Leave an email address or a phone number');
    }

    const stored = await this.persistFiles(files);

    try {
      const lead = await this.leadModel.create({ ...dto, files: stored });
      return lead.toJSON();
    } catch (error) {
      // Документ не сохранился — на диске не должно остаться сирот.
      await Promise.all(
        stored.map((file) =>
          fs.rm(join(UPLOAD_ROOT, file.storedName), { force: true }).catch(() => undefined),
        ),
      );
      throw error;
    }
  }

  async findAll(query: QueryLeadsDto) {
    const page = Math.max(1, query.page ?? 1);
    const filter = query.status ? { status: query.status } : {};

    const [items, total, newCount] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .exec(),
      this.leadModel.countDocuments(filter).exec(),
      this.leadModel.countDocuments({ status: LeadStatus.NEW }).exec(),
    ]);

    return {
      items: items.map((item) => item.toJSON()),
      total,
      newCount,
      page,
      limit: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  async updateStatus(id: string, status: LeadStatus) {
    const updated = await this.leadModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Lead not found');
    return updated.toJSON();
  }

  /** Отдаёт файл по индексу в заявке — прямых ссылок на диск наружу нет. */
  async openFile(id: string, index: number) {
    const lead = await this.leadModel.findById(id).exec();
    if (!lead) throw new NotFoundException('Lead not found');

    const file = lead.files[index];
    if (!file) throw new NotFoundException('Attachment not found');

    const path = join(UPLOAD_ROOT, file.storedName);
    await fs.access(path).catch(() => {
      throw new NotFoundException('Attachment is no longer on disk');
    });

    return { stream: createReadStream(path), file };
  }

  private async persistFiles(files: UploadedFile[]) {
    if (!files.length) return [];
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });

    return Promise.all(
      files.map(async (file) => {
        // Имя на диске генерируем сами: пришедшее нельзя пускать в путь.
        const storedName = `${randomUUID()}${extname(file.originalname).slice(0, 12)}`;
        await fs.writeFile(join(UPLOAD_ROOT, storedName), file.buffer);
        return {
          storedName,
          originalName: file.originalname.slice(0, 200),
          mimeType: file.mimetype,
          size: file.size,
        };
      }),
    );
  }
}
