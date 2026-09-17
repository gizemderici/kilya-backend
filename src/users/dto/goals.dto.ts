import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { GoalType } from '../../generated/prisma/enums.js';
import type { UserGoal } from '../../generated/prisma/client.js';

export class GoalDto {
  /** POSTURE: duruşumu düzeltmek · BACK_PAIN: sırt ağrısını azaltmak · KYPHOSIS: kifozu önlemek */
  @IsEnum(GoalType, {
    message: 'Hedef türü POSTURE, BACK_PAIN ya da KYPHOSIS olmalı',
  })
  type!: GoalType;

  /**
   * Günlük hedef (dakika); boş bırakılabilir.
   * @example 240
   */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  dailyTargetMinutes?: number | null;
}

/** Hedef listesinin tamamı; gönderilmeyen hedefler silinir. */
export class PutGoalsDto {
  @ValidateNested({ each: true })
  @Type(() => GoalDto)
  @ArrayMaxSize(3)
  @ArrayUnique((g: GoalDto) => g.type, {
    message: 'Aynı hedef türü birden fazla kez gönderilemez',
  })
  goals!: GoalDto[];
}

export class GoalResponseDto {
  type!: GoalType;
  dailyTargetMinutes!: number | null;
  createdAt!: Date;

  static from(goal: UserGoal): GoalResponseDto {
    return {
      type: goal.type,
      dailyTargetMinutes: goal.dailyTargetMinutes,
      createdAt: goal.createdAt,
    };
  }
}

export class GoalsResponseDto {
  goals!: GoalResponseDto[];
}
