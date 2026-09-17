import { IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  /** Android Credential Manager'dan alınan Google ID token (JWT). */
  @IsString()
  @MinLength(20)
  idToken!: string;
}
