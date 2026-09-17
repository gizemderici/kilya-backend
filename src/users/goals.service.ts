import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoalResponseDto, type PutGoalsDto } from './dto/goals.dto.js';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<GoalResponseDto[]> {
    const goals = await this.prisma.userGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return goals.map((g) => GoalResponseDto.from(g));
  }

  /** Listenin tamamını değiştirir: eski hedefler silinir, yenileri yazılır. */
  async replace(userId: string, { goals }: PutGoalsDto) {
    await this.prisma.$transaction([
      this.prisma.userGoal.deleteMany({ where: { userId } }),
      this.prisma.userGoal.createMany({
        data: goals.map((g) => ({
          userId,
          type: g.type,
          dailyTargetMinutes: g.dailyTargetMinutes ?? null,
        })),
      }),
    ]);
    return this.list(userId);
  }
}
