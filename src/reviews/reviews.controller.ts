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
   * Get pending reviews for the reviewer queue.
   *
   * Supports:
   *
   * GET /reviews/pending
   * GET /reviews/pending?page=1&limit=20
   * GET /reviews/pending?search=Maple
   * GET /reviews/pending?city=Austin
   * GET /reviews/pending?state=Texas
   * GET /reviews/pending?page=1&limit=10&search=Maple&city=Austin
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

  /**
   * Get one review with its old and proposed values.
   */
  @Get(':id')
  @Roles('REVIEWER')
  async findOne(@Param('id') reviewId: string) {
    return this.reviewsService.findOne(reviewId);
  }

  /**
   * Approve a pending review.
   *
   * Reviewer approval applies the proposed values
   * to the master property.
   */
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

  /**
   * Reject a pending review.
   *
   * The master property is NOT changed.
   */
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

  /**
   * Return a pending review to the checker.
   *
   * The master property is NOT changed.
   */
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
