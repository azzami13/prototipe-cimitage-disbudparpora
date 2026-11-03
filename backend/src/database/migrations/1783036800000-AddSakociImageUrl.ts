import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSakociImageUrl1783036800000 implements MigrationInterface {
  name = 'AddSakociImageUrl1783036800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sakoci" ADD COLUMN IF NOT EXISTS "image_url" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sakoci" DROP COLUMN IF EXISTS "image_url"`,
    );
  }
}
