import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  create(data: { email: string; name: string; passwordHash: string; role?: UserRole }) {
    return this.userModel.create(data);
  }

  findByEmail(email: string, withSecrets = false) {
    const query = this.userModel.findOne({ email: email.toLowerCase().trim() });
    return withSecrets ? query.select('+passwordHash +refreshTokenHash +sessionVersion').exec() : query.exec();
  }

  findById(id: string, withSecrets = false) {
    const query = this.userModel.findById(id);
    return withSecrets ? query.select('+passwordHash +refreshTokenHash +sessionVersion').exec() : query.exec();
  }

  async findByIdOrFail(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setRefreshTokenHash(id: string, hash: string | null) {
    await this.userModel.updateOne({ _id: id }, { $set: { refreshTokenHash: hash } }).exec();
  }

  async revokeSessions(id: string) {
    await this.userModel.updateOne({ _id: id }, {
      $set: { refreshTokenHash: null }, $inc: { sessionVersion: 1 },
    }).exec();
  }

  async replacePassword(id: string, previousHash: string, passwordHash: string) {
    const result = await this.userModel.updateOne({ _id: id, passwordHash: previousHash }, {
      $set: { passwordHash, refreshTokenHash: null }, $inc: { sessionVersion: 1 },
    }).exec();
    return result.modifiedCount === 1;
  }
}
