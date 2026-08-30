import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ApiBearerAuth } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { UpdatePropertyDto } from '../properties/dto/update-property.dto';

@ApiBearerAuth()
@Controller('assignments')
@UseGuards(JwtGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateAssignmentDto, @Request() req: any) {
    return this.assignmentsService.create(dto, req.user.id);
  }

  @Get()
  @Roles('ADMIN', 'DATA_CHECKER', 'REVIEWER')
  async findAll(@Query() query: AssignmentQueryDto) {
    return this.assignmentsService.findAll(
      query.page ?? 1,
      query.limit ?? 20,
      query.status,
    );
  }

  @Post(':id/claim')
  @Roles('DATA_CHECKER')
  async claim(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.claim(assignmentId, req.user.id);
  }

  @Post(':id/start')
  @Roles('DATA_CHECKER')
  async start(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.start(assignmentId, req.user.id);
  }

  @Patch(':assignmentId/properties/:propertyId')
  @Roles('DATA_CHECKER')
  async updateProperty(
    @Param('assignmentId') assignmentId: string,
    @Param('propertyId') propertyId: string,
    @Body() dto: UpdatePropertyDto,
    @Request() req: any,
  ) {
    return this.assignmentsService.updateProperty(
      assignmentId,
      propertyId,
      req.user.id,
      dto,
    );
  }

  @Post(':id/submit')
  @Roles('DATA_CHECKER')
  async submit(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.submit(assignmentId, req.user.id);
  }

  @Post(':id/complete')
  @Roles('ADMIN', 'REVIEWER')
  async complete(@Param('id') assignmentId: string) {
    return this.assignmentsService.complete(assignmentId);
  }

  @Get(':id')
  @Roles('ADMIN', 'DATA_CHECKER', 'REVIEWER')
  async findOne(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.findOne(
      assignmentId,
      req.user.id,
      req.user.role,
    );
  }
}
