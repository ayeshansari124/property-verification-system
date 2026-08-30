import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';

import { ApiBearerAuth } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiBearerAuth()
@Controller('properties')
@UseGuards(JwtGuard, RolesGuard)
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Roles('ADMIN', 'REVIEWER')
  async findAll(@Query() query: PropertyQueryDto) {
    return this.propertiesService.findAll(query.page ?? 1, query.limit ?? 20, {
      search: query.search,
      city: query.city,
      state: query.state,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'REVIEWER')
  async findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @Request() req: any,
  ) {
    return this.propertiesService.update(id, dto, req.user.id);
  }

  @Get(':id/history')
  @Roles('ADMIN', 'REVIEWER')
  async getHistory(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    await this.propertiesService.findOne(id);

    return this.auditService.getHistory(id, query.page ?? 1, query.limit ?? 20);
  }
}
