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
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(JwtGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * REVIEWER - view pending reviews.
   *
   * GET /reviews
   */
  @Get()
  @Roles('REVIEWER')
  async getReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
  ) {
    return this.reviewsService.getPendingReviews(
      Number(page) || 1,
      Number(limit) || 20,
      search,
      city,
      state,
    );
  }

  /**
   * Backwards-compatible pending reviews route.
   *
   * GET /reviews/pending
   */
  @Get('pending')
  @Roles('REVIEWER')
  async getPendingReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
  ) {
    return this.reviewsService.getPendingReviews(
      Number(page) || 1,
      Number(limit) || 20,
      search,
      city,
      state,
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
    @Body() body: { reviewerNotes?: string },
    @Request() req: any,
  ) {
    return this.reviewsService.approve(
      reviewId,
      req.user.id,
      body.reviewerNotes,
    );
  }

  @Patch(':id/reject')
  @Roles('REVIEWER')
  async reject(
    @Param('id') reviewId: string,
    @Body() body: { reviewerNotes?: string },
    @Request() req: any,
  ) {
    return this.reviewsService.reject(
      reviewId,
      req.user.id,
      body.reviewerNotes,
    );
  }

  @Patch(':id/return')
  @Roles('REVIEWER')
  async returnToChecker(
    @Param('id') reviewId: string,
    @Body() body: { reviewerNotes?: string },
    @Request() req: any,
  ) {
    return this.reviewsService.returnToChecker(
      reviewId,
      req.user.id,
      body.reviewerNotes,
    );
  }
}
