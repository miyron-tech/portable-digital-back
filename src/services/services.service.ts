import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { CreateServiceDto } from './dto/create-service.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service, ServiceDocument } from './schemas/service.schema';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
  ) {}

  async findAll(query: QueryServicesDto, includeDrafts = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const filter: QueryFilter<ServiceDocument> = includeDrafts ? {} : { published: true };
    if (includeDrafts && query.visibility) filter.published = query.visibility === 'published';
    if (query.category) filter.category = query.category;
    if (query.tag) filter.tags = query.tag;
    if (query.search?.trim()) filter.$text = { $search: query.search.trim() };

    const [items, total] = await Promise.all([
      this.serviceModel
        .find(filter)
        .sort({ featured: -1, order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.serviceModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((item) => item.toJSON()),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findFeatured(limit = 6) {
    const items = await this.serviceModel
      .find({ published: true })
      .sort({ featured: -1, order: 1 })
      .limit(limit)
      .exec();
    return items.map((item) => item.toJSON());
  }

  async findBySlug(slug: string) {
    const service = await this.serviceModel.findOne({ slug, published: true }).exec();
    if (!service) throw new NotFoundException(`Service "${slug}" not found`);
    return service.toJSON();
  }

  /** Slugs of every published service — feeds the frontend sitemap. */
  async listSlugs() {
    const items = await this.serviceModel
      .find({ published: true }, { slug: 1, updatedAt: 1 })
      .lean()
      .exec();
    return items.map((item: any) => ({ slug: item.slug, updatedAt: item.updatedAt }));
  }

  async categoriesWithCounts() {
    const rows = await this.serviceModel.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return rows.map((row) => ({ category: row._id, count: row.count }));
  }

  async create(dto: CreateServiceDto) {
    const created = await this.serviceModel.create(dto);
    return created.toJSON();
  }

  async update(id: string, dto: UpdateServiceDto) {
    const updated = await this.serviceModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!updated) throw new NotFoundException('Service not found');
    return updated.toJSON();
  }

  async remove(id: string) {
    const deleted = await this.serviceModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Service not found');
    return { success: true };
  }
}
