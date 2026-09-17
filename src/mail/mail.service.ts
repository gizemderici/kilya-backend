import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * E-posta gönderimi. Geliştirmede Mailpit'e (localhost:1025) gider ve
 * http://localhost:8025 adresinde görülür. Test ortamında hiçbir yere gitmez.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.from = config.get('MAIL_FROM', { infer: true });

    if (config.get('NODE_ENV', { infer: true }) === 'test') {
      // Ağ yok: mesajlar JSON olarak "gönderilir", tesliminde kaybolur.
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return;
    }

    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASS', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: false, // 465 dışı portlarda STARTTLS varsa kendiliğinden kullanılır
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
    this.logger.log(`E-posta gönderildi: "${message.subject}" → ${message.to}`);
  }

  sendPasswordResetCode(to: string, code: string, ttlMinutes: number) {
    return this.send({
      to,
      subject: 'Kilya parola sıfırlama kodunuz',
      text: [
        `Parola sıfırlama kodunuz: ${code}`,
        '',
        `Bu kod ${ttlMinutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir.`,
        'Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; parolanız değişmez.',
      ].join('\n'),
    });
  }
}
