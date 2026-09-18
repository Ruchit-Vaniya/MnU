import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller()
export class AppController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get('health')
  async health() {
    // Round-trips a trivial command to prove the Mongoose <-> MongoDB
    // connection is alive, without depending on any business schema.
    // (Replaces Prisma's `$runCommandRaw({ ping: 1 })` — same idea, native
    // driver call instead.) `connection.db` is only undefined before the
    // initial connect resolves, which can't happen here since Nest awaits
    // MongooseModule's connection during app bootstrap.
    if (!this.connection.db) {
      throw new Error('Database connection is not ready.');
    }
    await this.connection.db.admin().ping();
    return { status: 'ok', database: 'connected' };
  }
}
