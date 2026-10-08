import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LeadDocument = HydratedDocument<Lead>;

export enum LeadStatus {
  NEW = 'new',
  IN_REVIEW = 'in_review',
  ARCHIVED = 'archived',
}

@Schema({ _id: false })
export class LeadFile {
  /** Имя, под которым файл лежит на диске. Наружу не отдаётся. */
  @Prop({ required: true })
  storedName!: string;

  @Prop({ required: true })
  originalName!: string;

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  size!: number;
}
const LeadFileSchema = SchemaFactory.createForClass(LeadFile);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.__v;
      // Путь на диске — деталь хранения, наружу отдавать нечего.
      if (Array.isArray(ret.files)) {
        ret.files = ret.files.map((file: Record<string, any>, index: number) => ({
          index,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
        }));
      }
      return ret;
    },
  },
})
export class Lead {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  description!: string;

  /** Желаемый срок в неделях. */
  @Prop({ required: true, min: 1, max: 52 })
  timelineWeeks!: number;

  @Prop({ type: [LeadFileSchema], default: [] })
  files!: LeadFile[];

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.NEW, index: true })
  status!: LeadStatus;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// Админка открывается на списке новых заявок — сортировка по дате убывающая.
LeadSchema.index({ createdAt: -1 });
