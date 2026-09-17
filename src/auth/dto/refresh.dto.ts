import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  /** Kayıt/giriş yanıtındaki refresh token. Tek kullanımlık. */
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
