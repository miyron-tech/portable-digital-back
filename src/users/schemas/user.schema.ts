import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

/**
 * Платёжный адрес. Все четыре поля обязательны для провайдера: без любого из
 * них WemoPay отклоняет платёж. Спрашивается один раз, при первой покупке, и
 * дальше «Buy» ведёт сразу к оплате.
 */
@Schema({ _id: false })
export class BillingAddress {
  @Prop({ required: true, trim: true, maxlength: 200 })
  addressLine1!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  city!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  postalCode!: string;

  /** ISO 3166-1 alpha-2. */
  @Prop({ required: true, trim: true, uppercase: true, minlength: 2, maxlength: 2 })
  countryCode!: string;
}
const BillingAddressSchema = SchemaFactory.createForClass(BillingAddress);

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      delete ret.refreshTokenHash;
      delete ret.sessionVersion;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Prop({ type: BillingAddressSchema, default: null })
  billingAddress?: BillingAddress | null;

  /** argon2 hash of the currently issued refresh token — enables real logout. */
  @Prop({ type: String, default: null, select: false })
  refreshTokenHash!: string | null;

  /** Invalidates access tokens after sign-out or a password change. */
  @Prop({ type: Number, default: 0, select: false })
  sessionVersion!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
