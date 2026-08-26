import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('assignments')
@UseGuards(JwtGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateAssignmentDto, @Request() request: any) {
    return this.assignmentsService.create(dto, request.user.id);
  }
}
