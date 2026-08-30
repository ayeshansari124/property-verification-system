import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';

@ApiBearerAuth()
@Controller('reviews')
@UseGuards(JwtGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * REVIEWER - view pending reviews, with optional search/city/state filters.
   *
   * GET /reviews
   */
  @Get()
  @Roles('REVIEWER')
  async getReviews(@Query() query: ReviewQueryDto) {
    return this.reviewsService.getPendingReviews(
      query.page ?? 1,
      query.limit ?? 20,
      {
        search: query.search,
        city: query.city,
        state: query.state,
      },
    );
  }

  @Get(':id')
  @Roles('REVIEWER')
  async findOne(@Param('id') reviewId: string) {
    return this.reviewsService.findOne(reviewId);
  }

  @Patch(':id/approve')
  @Roles('REVIEWER')
  async approve(
    @Param('id') reviewId: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: any,
  ) {
    return this.reviewsService.approve(
      reviewId,
      req.user.id,
      dto.reviewerNotes,
    );
  }

  @Patch(':id/reject')
  @Roles('REVIEWER')
  async reject(
    @Param('id') reviewId: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: any,
  ) {
    return this.reviewsService.reject(reviewId, req.user.id, dto.reviewerNotes);
  }

  @Patch(':id/return')
  @Roles('REVIEWER')
  async returnToChecker(
    @Param('id') reviewId: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: any,
  ) {
    return this.reviewsService.returnToChecker(
      reviewId,
      req.user.id,
      dto.reviewerNotes,
    );
  }
}
