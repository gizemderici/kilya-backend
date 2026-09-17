import { IsString, MinLength } from 'class-validator';

export class LogoutDto {
  /** Cihazdaki refresh token; iptal edilir. */
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
