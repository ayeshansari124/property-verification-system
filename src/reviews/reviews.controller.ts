import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Request,
} from '@nestjs/common';

import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(JwtGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('pending')
  @Roles('REVIEWER')
  async getPendingReviews() {
    return this.reviewsService.getPendingReviews();
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
