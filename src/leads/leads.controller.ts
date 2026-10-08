import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import {
  ALLOWED_MIME,
  LeadsService,
  MAX_FILES,
  MAX_FILE_SIZE,
  type UploadedFile,
} from './leads.service';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Post()
  // Форма открыта наружу, поэтому лимит запросов жёстче, чем на чтение.
  @RateLimit(5, 10 * 60_000)
  @ApiOperation({ summary: 'Submit a project enquiry' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
      // multer без указания storage держит файл в памяти — buffer нам и нужен.
      fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, accept: boolean) => void) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          callback(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  create(@Body() dto: CreateLeadDto, @UploadedFiles() files?: UploadedFile[]) {
    return this.leadsService.create(dto, files ?? []);
  }

  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List enquiries (admin)' })
  findAll(@Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(query);
  }

  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Change enquiry status (admin)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.leadsService.updateStatus(id, dto.status);
  }

  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get(':id/files/:index')
  @ApiOperation({ summary: 'Download an enquiry attachment (admin)' })
  async download(
    @Param('id') id: string,
    @Param('index') index: string,
    @Res() res: Response,
  ) {
    const { stream, file } = await this.leadsService.openFile(id, Number(index));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    // Имя берётся из формы, поэтому в заголовок идёт только закодированным.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    stream.pipe(res);
  }
}
