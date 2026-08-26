import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { users } from '../database/schema';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async findByEmail(email: string) {
    const result = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0] ?? null;
  }

  async findById(id: string) {
    const result = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] ?? null;
  }
}
