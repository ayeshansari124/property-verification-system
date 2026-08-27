import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Controller('assignments')
@UseGuards(JwtGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateAssignmentDto, @Request() request: any) {
    return this.assignmentsService.create(dto, request.user.id);
  }

  @Post(':id/claim')
  @Roles('DATA_CHECKER')
  async claim(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.claim(assignmentId, req.user.id);
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
