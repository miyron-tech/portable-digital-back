import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { CreateServiceDto } from './dto/create-service.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Service catalogue with filters and pagination' })
  findAll(@Query() query: QueryServicesDto) {
    return this.services.findAll(query);
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Storefront: featured services for the home page' })
  findFeatured() {
    return this.services.findFeatured();
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Categories with service counts' })
  categories() {
    return this.services.categoriesWithCounts();
  }

  @Public()
  @Get('sitemap')
  @ApiOperation({ summary: 'Published service slugs for sitemap.xml' })
  sitemap() {
    return this.services.listSlugs();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/all')
  findAllAdmin(@Query() query: QueryServicesDto) {
    return this.services.findAll(query, true);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Service detail page' })
  findOne(@Param('slug') slug: string) {
    return this.services.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Create a service (admin)' })
  create(@Body() dto: CreateServiceDto) {
    return this.services.create(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a service (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service (admin)' })
  remove(@Param('id') id: string) {
    return this.services.remove(id);
  }
}
