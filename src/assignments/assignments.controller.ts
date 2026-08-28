import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Controller('assignments')
@UseGuards(JwtGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * ADMIN creates a new assignment.
   */
  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateAssignmentDto, @Request() req: any) {
    return this.assignmentsService.create(dto, req.user.id);
  }

  /**
   * DATA_CHECKER claims an OPEN assignment.
   *
   * OPEN -> CLAIMED
   */
  @Post(':id/claim')
  @Roles('DATA_CHECKER')
  async claim(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.claim(assignmentId, req.user.id);
  }

  /**
   * DATA_CHECKER starts working on a claimed assignment.
   *
   * CLAIMED -> IN_PROGRESS
   */
  @Post(':id/start')
  @Roles('DATA_CHECKER')
  async start(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.start(assignmentId, req.user.id);
  }

  /**
   * DATA_CHECKER proposes a property change.
   *
   * The actual properties table is NOT changed here.
   * A pending property review is created instead.
   */
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

  /**
   * DATA_CHECKER submits the assignment.
   *
   * IN_PROGRESS -> SUBMITTED
   *
   * Submission is blocked if any property in the assignment
   * still has a PENDING review.
   */
  @Post(':id/submit')
  @Roles('DATA_CHECKER')
  async submit(@Param('id') assignmentId: string, @Request() req: any) {
    return this.assignmentsService.submit(assignmentId, req.user.id);
  }

  /**
   * ADMIN or REVIEWER completes a submitted assignment.
   *
   * SUBMITTED -> COMPLETED
   */
  @Post(':id/complete')
  @Roles('ADMIN', 'REVIEWER')
  async complete(@Param('id') assignmentId: string) {
    return this.assignmentsService.complete(assignmentId);
  }

  /**
   * View one assignment.
   */
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
